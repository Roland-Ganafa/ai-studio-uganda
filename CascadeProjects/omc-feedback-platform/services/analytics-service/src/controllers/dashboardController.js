const Dashboard = require('../models/dashboard');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

/**
 * Controller for handling dashboard operations
 */
const dashboardController = {
  /**
   * Create a new dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createDashboard: async (req, res) => {
    try {
      const { name, description, layout, widgets, filters, isDefault } = req.body;
      
      // Validate required fields
      if (!name || !layout || !widgets || !Array.isArray(widgets)) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'name, layout, and widgets array are required'
        });
      }
      
      // Create new dashboard
      const dashboard = new Dashboard({
        name,
        description,
        layout,
        widgets,
        filters: filters || [],
        isDefault: isDefault || false,
        userId: req.user.id,
        companyId: req.user.companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // If setting as default, unset any existing defaults for this user
      if (isDefault) {
        await Dashboard.updateMany(
          { userId: req.user.id, isDefault: true },
          { $set: { isDefault: false } }
        );
      }
      
      // Save dashboard
      await dashboard.save();
      
      logger.info(`Created dashboard: ${name}`, {
        dashboardId: dashboard._id.toString(),
        userId: req.user.id,
        companyId: req.user.companyId
      });
      
      return res.status(201).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error(`Error creating dashboard: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Update an existing dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateDashboard: async (req, res) => {
    try {
      const dashboardId = req.params.id;
      const { name, description, layout, widgets, filters, isDefault, sharing } = req.body;
      
      // Find dashboard
      const dashboard = await Dashboard.findById(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Dashboard not found'
        });
      }
      
      // Check if user has permission to update this dashboard
      if (
        dashboard.userId.toString() !== req.user.id &&
        !req.user.roles.includes('admin') &&
        (!dashboard.sharing || !dashboard.sharing.canEdit)
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to update this dashboard'
        });
      }
      
      // Update fields
      if (name) dashboard.name = name;
      if (description !== undefined) dashboard.description = description;
      if (layout) dashboard.layout = layout;
      if (widgets) dashboard.widgets = widgets;
      if (filters) dashboard.filters = filters;
      if (sharing) dashboard.sharing = sharing;
      
      // Handle default status
      if (isDefault !== undefined) {
        // If setting as default, unset any existing defaults for this user
        if (isDefault && !dashboard.isDefault) {
          await Dashboard.updateMany(
            { userId: dashboard.userId, isDefault: true },
            { $set: { isDefault: false } }
          );
        }
        dashboard.isDefault = isDefault;
      }
      
      dashboard.updatedAt = new Date();
      
      // Save changes
      await dashboard.save();
      
      // Clear cache
      await cache.clearByPattern(`dashboard:${dashboardId}*`);
      
      logger.info(`Updated dashboard: ${dashboard.name}`, {
        dashboardId: dashboard._id.toString(),
        userId: req.user.id
      });
      
      return res.status(200).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error(`Error updating dashboard: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        dashboardId: req.params.id,
        body: req.body
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Get all dashboards for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getDashboards: async (req, res) => {
    try {
      // Build query
      const query = {
        $or: [
          { userId: req.user.id }, // User's own dashboards
          { 'sharing.isPublic': true }, // Public dashboards
          { 'sharing.sharedWith': req.user.id } // Dashboards shared with user
        ]
      };
      
      // If company filter is provided
      if (req.query.companyId) {
        // Check if user has permission to access company data
        if (
          req.user.companyId &&
          req.query.companyId !== req.user.companyId.toString() &&
          !req.user.roles.includes('admin')
        ) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access dashboards for this company'
          });
        }
        
        query.companyId = req.query.companyId;
      }
      
      // Execute query
      const dashboards = await Dashboard.find(query)
        .sort({ updatedAt: -1 });
      
      return res.status(200).json({
        success: true,
        data: dashboards
      });
    } catch (error) {
      logger.error(`Error getting dashboards: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        query: req.query
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Get a single dashboard by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getDashboardById: async (req, res) => {
    try {
      const dashboardId = req.params.id;
      
      // Try to get from cache first
      const cacheKey = `dashboard:${dashboardId}:${req.user.id}`;
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        logger.debug('Returning cached dashboard', {
          cacheKey,
          dashboardId
        });
        
        return res.status(200).json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
      
      // Find dashboard
      const dashboard = await Dashboard.findById(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Dashboard not found'
        });
      }
      
      // Check if user has permission to view this dashboard
      const canView = 
        dashboard.userId.toString() === req.user.id || // User's own dashboard
        req.user.roles.includes('admin') || // Admin
        dashboard.sharing?.isPublic || // Public dashboard
        (dashboard.sharing?.sharedWith && dashboard.sharing.sharedWith.includes(req.user.id)); // Shared with user
      
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to view this dashboard'
        });
      }
      
      // Cache dashboard
      await cache.set(cacheKey, dashboard, 300); // 5 minutes TTL
      
      return res.status(200).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error(`Error getting dashboard by ID: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        dashboardId: req.params.id
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Delete a dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteDashboard: async (req, res) => {
    try {
      const dashboardId = req.params.id;
      
      // Find dashboard
      const dashboard = await Dashboard.findById(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Dashboard not found'
        });
      }
      
      // Check if user has permission to delete this dashboard
      if (
        dashboard.userId.toString() !== req.user.id &&
        !req.user.roles.includes('admin')
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to delete this dashboard'
        });
      }
      
      // Delete dashboard
      await Dashboard.deleteOne({ _id: dashboardId });
      
      // Clear cache
      await cache.clearByPattern(`dashboard:${dashboardId}*`);
      
      logger.info(`Deleted dashboard: ${dashboard.name}`, {
        dashboardId,
        userId: req.user.id
      });
      
      return res.status(200).json({
        success: true,
        message: 'Dashboard deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting dashboard: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        dashboardId: req.params.id
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Share a dashboard with other users
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  shareDashboard: async (req, res) => {
    try {
      const dashboardId = req.params.id;
      const { isPublic, canEdit, sharedWith } = req.body;
      
      // Find dashboard
      const dashboard = await Dashboard.findById(dashboardId);
      
      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Dashboard not found'
        });
      }
      
      // Check if user has permission to share this dashboard
      if (
        dashboard.userId.toString() !== req.user.id &&
        !req.user.roles.includes('admin')
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to share this dashboard'
        });
      }
      
      // Update sharing settings
      dashboard.sharing = {
        isPublic: isPublic !== undefined ? isPublic : dashboard.sharing?.isPublic || false,
        canEdit: canEdit !== undefined ? canEdit : dashboard.sharing?.canEdit || false,
        sharedWith: sharedWith || dashboard.sharing?.sharedWith || []
      };
      
      dashboard.updatedAt = new Date();
      
      // Save changes
      await dashboard.save();
      
      // Clear cache
      await cache.clearByPattern(`dashboard:${dashboardId}*`);
      
      logger.info(`Updated dashboard sharing: ${dashboard.name}`, {
        dashboardId,
        userId: req.user.id,
        isPublic: dashboard.sharing.isPublic,
        canEdit: dashboard.sharing.canEdit,
        sharedWithCount: dashboard.sharing.sharedWith.length
      });
      
      return res.status(200).json({
        success: true,
        data: {
          dashboardId,
          sharing: dashboard.sharing
        }
      });
    } catch (error) {
      logger.error(`Error sharing dashboard: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        dashboardId: req.params.id,
        body: req.body
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Clone an existing dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  cloneDashboard: async (req, res) => {
    try {
      const sourceDashboardId = req.params.id;
      const { name } = req.body;
      
      // Validate request
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'name is required for the cloned dashboard'
        });
      }
      
      // Find source dashboard
      const sourceDashboard = await Dashboard.findById(sourceDashboardId);
      
      if (!sourceDashboard) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Source dashboard not found'
        });
      }
      
      // Check if user has permission to view the source dashboard
      const canView = 
        sourceDashboard.userId.toString() === req.user.id ||
        req.user.roles.includes('admin') ||
        sourceDashboard.sharing?.isPublic ||
        (sourceDashboard.sharing?.sharedWith && sourceDashboard.sharing.sharedWith.includes(req.user.id));
      
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to clone this dashboard'
        });
      }
      
      // Create new dashboard as a clone
      const newDashboard = new Dashboard({
        name,
        description: `Clone of ${sourceDashboard.name}`,
        layout: sourceDashboard.layout,
        widgets: sourceDashboard.widgets,
        filters: sourceDashboard.filters,
        isDefault: false,
        userId: req.user.id,
        companyId: req.user.companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
        sharing: {
          isPublic: false,
          canEdit: false,
          sharedWith: []
        }
      });
      
      // Save new dashboard
      await newDashboard.save();
      
      logger.info(`Cloned dashboard: ${sourceDashboard.name} -> ${name}`, {
        sourceDashboardId,
        newDashboardId: newDashboard._id.toString(),
        userId: req.user.id
      });
      
      return res.status(201).json({
        success: true,
        data: newDashboard
      });
    } catch (error) {
      logger.error(`Error cloning dashboard: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        sourceDashboardId: req.params.id,
        body: req.body
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  }
};

module.exports = dashboardController;
