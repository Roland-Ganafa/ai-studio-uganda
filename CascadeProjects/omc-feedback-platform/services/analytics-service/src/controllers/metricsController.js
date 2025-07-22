const FeedbackMetrics = require('../models/feedbackMetrics');
const UserMetrics = require('../models/userMetrics');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const DataAggregator = require('../utils/dataAggregator');

/**
 * Controller for handling analytics metrics
 */
const metricsController = {
  /**
   * Get feedback metrics with filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getFeedbackMetrics: async (req, res) => {
    try {
      const {
        companyId,
        period = 'monthly',
        startDate,
        endDate,
        category,
        priority
      } = req.query;
      
      // Check if user has permission to access company data
      if (req.user && !req.user.roles.includes('admin')) {
        // Regular users can only access their company's metrics
        if (req.user.companyId) {
          if (!companyId) {
            // If no company ID provided, use user's company
            req.query.companyId = req.user.companyId;
          } else if (companyId !== req.user.companyId.toString()) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'You do not have permission to access metrics for this company'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access company metrics'
          });
        }
      }
      
      // Build query
      const query = {};
      
      if (companyId) query.companyId = companyId;
      if (period) query.period = period;
      
      // Add date range if provided
      if (startDate || endDate) {
        query.periodStart = {};
        if (startDate) query.periodStart.$gte = new Date(startDate);
        if (endDate) query.periodStart.$lte = new Date(endDate);
      }
      
      // Try to get from cache first
      const cacheKey = cache.generateKey('feedback-metrics', req.query);
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        logger.debug('Returning cached feedback metrics', {
          cacheKey,
          query: req.query
        });
        
        return res.status(200).json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
      
      // Execute query
      let metrics = await FeedbackMetrics.find(query)
        .sort({ periodStart: -1 });
      
      // Apply additional filters that can't be done in the query
      if (category) {
        metrics = metrics.filter(metric => 
          metric.categories.some(cat => cat.name === category)
        );
      }
      
      if (priority) {
        metrics = metrics.filter(metric => 
          metric.priorities.some(pri => pri.name === priority)
        );
      }
      
      // Cache results
      await cache.set(cacheKey, metrics, 300); // 5 minutes TTL
      
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error(`Error getting feedback metrics: ${error.message}`, {
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
   * Get user metrics with filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getUserMetrics: async (req, res) => {
    try {
      const {
        companyId,
        period = 'monthly',
        startDate,
        endDate,
        role
      } = req.query;
      
      // Check if user has permission to access company data
      if (req.user && !req.user.roles.includes('admin')) {
        // Regular users can only access their company's metrics
        if (req.user.companyId) {
          if (!companyId) {
            // If no company ID provided, use user's company
            req.query.companyId = req.user.companyId;
          } else if (companyId !== req.user.companyId.toString()) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'You do not have permission to access metrics for this company'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access company metrics'
          });
        }
      }
      
      // Build query
      const query = {};
      
      if (companyId) query.companyId = companyId;
      if (period) query.period = period;
      
      // Add date range if provided
      if (startDate || endDate) {
        query.periodStart = {};
        if (startDate) query.periodStart.$gte = new Date(startDate);
        if (endDate) query.periodStart.$lte = new Date(endDate);
      }
      
      // Try to get from cache first
      const cacheKey = cache.generateKey('user-metrics', req.query);
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        logger.debug('Returning cached user metrics', {
          cacheKey,
          query: req.query
        });
        
        return res.status(200).json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
      
      // Execute query
      let metrics = await UserMetrics.find(query)
        .sort({ periodStart: -1 });
      
      // Apply additional filters that can't be done in the query
      if (role) {
        metrics = metrics.filter(metric => 
          metric.roles.some(r => r.name === role)
        );
      }
      
      // Cache results
      await cache.set(cacheKey, metrics, 300); // 5 minutes TTL
      
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error(`Error getting user metrics: ${error.message}`, {
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
   * Get combined metrics summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getMetricsSummary: async (req, res) => {
    try {
      const {
        companyId,
        period = 'monthly'
      } = req.query;
      
      // Check if user has permission to access company data
      if (req.user && !req.user.roles.includes('admin')) {
        // Regular users can only access their company's metrics
        if (req.user.companyId) {
          if (!companyId) {
            // If no company ID provided, use user's company
            req.query.companyId = req.user.companyId;
          } else if (companyId !== req.user.companyId.toString()) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'You do not have permission to access metrics for this company'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access company metrics'
          });
        }
      }
      
      // Try to get from cache first
      const cacheKey = cache.generateKey('metrics-summary', req.query);
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        logger.debug('Returning cached metrics summary', {
          cacheKey,
          query: req.query
        });
        
        return res.status(200).json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
      
      // Build query
      const query = {};
      
      if (companyId) query.companyId = companyId;
      if (period) query.period = period;
      
      // Get latest feedback metrics
      const feedbackMetrics = await FeedbackMetrics.findOne(query)
        .sort({ periodStart: -1 });
      
      // Get latest user metrics
      const userMetrics = await UserMetrics.findOne(query)
        .sort({ periodStart: -1 });
      
      // Get previous period metrics for comparison
      const previousPeriodStart = feedbackMetrics ? 
        DataAggregator.getPreviousPeriodStart(feedbackMetrics.periodStart, period) : 
        null;
      
      const previousQuery = { ...query };
      if (previousPeriodStart) {
        previousQuery.periodStart = previousPeriodStart;
      }
      
      const previousFeedbackMetrics = await FeedbackMetrics.findOne(previousQuery);
      const previousUserMetrics = await UserMetrics.findOne(previousQuery);
      
      // Calculate changes
      const calculateChange = (current, previous, field) => {
        if (!current || !previous) return null;
        
        const currentValue = current[field] || 0;
        const previousValue = previous[field] || 0;
        
        if (previousValue === 0) return null;
        
        return {
          value: currentValue,
          previousValue,
          change: currentValue - previousValue,
          percentChange: ((currentValue - previousValue) / previousValue) * 100
        };
      };
      
      // Build summary
      const summary = {
        period,
        periodStart: feedbackMetrics?.periodStart || null,
        periodEnd: feedbackMetrics?.periodEnd || null,
        
        feedback: {
          total: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'totalFeedback'),
          open: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'openFeedback'),
          resolved: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'resolvedFeedback'),
          avgResponseTime: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'avgResponseTime'),
          avgResolutionTime: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'avgResolutionTime'),
          satisfactionScore: calculateChange(feedbackMetrics, previousFeedbackMetrics, 'avgSatisfactionScore'),
          topCategories: feedbackMetrics?.categories?.slice(0, 3).map(c => ({
            name: c.name,
            count: c.count
          })) || []
        },
        
        users: {
          total: calculateChange(userMetrics, previousUserMetrics, 'totalUsers'),
          active: calculateChange(userMetrics, previousUserMetrics, 'activeUsers'),
          new: calculateChange(userMetrics, previousUserMetrics, 'newUsers'),
          engagement: calculateChange(userMetrics, previousUserMetrics, 'avgEngagementScore'),
          topRoles: userMetrics?.roles?.slice(0, 3).map(r => ({
            name: r.name,
            count: r.count
          })) || []
        }
      };
      
      // Cache results
      await cache.set(cacheKey, summary, 300); // 5 minutes TTL
      
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error(`Error getting metrics summary: ${error.message}`, {
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
   * Trigger manual metrics aggregation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  triggerAggregation: async (req, res) => {
    try {
      const { period, companyId, startDate, endDate } = req.body;
      
      // Only admins can trigger manual aggregation
      if (!req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Only administrators can trigger manual aggregation'
        });
      }
      
      // Validate period
      if (!period || !['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time'].includes(period)) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid period. Must be one of: daily, weekly, monthly, quarterly, yearly, all_time'
        });
      }
      
      // Parse dates if provided
      let parsedStartDate = startDate ? new Date(startDate) : null;
      let parsedEndDate = endDate ? new Date(endDate) : null;
      
      // Validate dates if provided
      if (startDate && isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid startDate format'
        });
      }
      
      if (endDate && isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid endDate format'
        });
      }
      
      // Run aggregation
      logger.info(`Triggering manual ${period} aggregation`, {
        period,
        companyId,
        startDate: parsedStartDate,
        endDate: parsedEndDate
      });
      
      // Run aggregation asynchronously
      DataAggregator.runManualAggregation(period, {
        companyId,
        startDate: parsedStartDate,
        endDate: parsedEndDate
      })
        .then(result => {
          logger.info(`Manual aggregation completed successfully`, {
            period,
            result
          });
        })
        .catch(error => {
          logger.error(`Error in manual aggregation: ${error.message}`, {
            error: error.message,
            stack: error.stack,
            period
          });
        });
      
      return res.status(202).json({
        success: true,
        message: `${period} aggregation started successfully`,
        data: {
          period,
          companyId: companyId || 'all',
          startDate: parsedStartDate,
          endDate: parsedEndDate
        }
      });
    } catch (error) {
      logger.error(`Error triggering aggregation: ${error.message}`, {
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
  }
};

module.exports = metricsController;
