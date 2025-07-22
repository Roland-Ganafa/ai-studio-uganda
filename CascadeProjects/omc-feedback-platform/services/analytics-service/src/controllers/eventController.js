const AnalyticsEvent = require('../models/analyticsEvent');
const logger = require('../utils/logger');

/**
 * Controller for handling analytics events
 */
const eventController = {
  /**
   * Create a new analytics event
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createEvent: async (req, res) => {
    try {
      const { sourceService, eventType, eventData, userId, companyId, resourceId, resourceType, metadata } = req.body;
      
      // Validate required fields
      if (!sourceService || !eventType || !eventData) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'sourceService, eventType, and eventData are required'
        });
      }
      
      // Create new event
      const event = new AnalyticsEvent({
        sourceService,
        eventType,
        eventData,
        userId,
        companyId,
        resourceId,
        resourceType,
        metadata,
        timestamp: new Date()
      });
      
      // Save event
      await event.save();
      
      logger.info(`Created analytics event: ${eventType}`, {
        eventId: event._id.toString(),
        sourceService,
        eventType,
        userId,
        companyId
      });
      
      return res.status(201).json({
        success: true,
        data: {
          eventId: event._id,
          timestamp: event.timestamp
        }
      });
    } catch (error) {
      logger.error(`Error creating analytics event: ${error.message}`, {
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
   * Create multiple analytics events in batch
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  createBatchEvents: async (req, res) => {
    try {
      const { events } = req.body;
      
      // Validate request
      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'events array is required and must not be empty'
        });
      }
      
      // Validate each event
      const validEvents = events.filter(event => 
        event.sourceService && event.eventType && event.eventData
      );
      
      if (validEvents.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'No valid events provided'
        });
      }
      
      // Add timestamp to each event
      const timestamp = new Date();
      const eventsToInsert = validEvents.map(event => ({
        ...event,
        timestamp: event.timestamp || timestamp
      }));
      
      // Insert events
      const result = await AnalyticsEvent.insertMany(eventsToInsert);
      
      logger.info(`Created ${result.length} analytics events in batch`, {
        count: result.length,
        sourceServices: [...new Set(validEvents.map(e => e.sourceService))],
        eventTypes: [...new Set(validEvents.map(e => e.eventType))]
      });
      
      return res.status(201).json({
        success: true,
        data: {
          insertedCount: result.length,
          eventIds: result.map(event => event._id)
        }
      });
    } catch (error) {
      logger.error(`Error creating batch analytics events: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Get analytics events with filtering and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getEvents: async (req, res) => {
    try {
      const {
        sourceService,
        eventType,
        userId,
        companyId,
        resourceId,
        resourceType,
        startDate,
        endDate,
        processed
      } = req.query;
      
      // Parse pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      
      // Build query
      const query = {};
      
      if (sourceService) query.sourceService = sourceService;
      if (eventType) query.eventType = eventType;
      if (userId) query.userId = userId;
      if (companyId) query.companyId = companyId;
      if (resourceId) query.resourceId = resourceId;
      if (resourceType) query.resourceType = resourceType;
      if (processed !== undefined) query.processed = processed === 'true';
      
      // Add date range if provided
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      
      // Check if user has permission to access company data
      if (req.user && !req.user.roles.includes('admin')) {
        // Regular users can only access their own events or their company's events
        if (req.user.companyId) {
          if (!companyId) {
            query.companyId = req.user.companyId;
          } else if (companyId !== req.user.companyId.toString()) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'You do not have permission to access events for this company'
            });
          }
        } else {
          // If no company ID, only allow access to user's own events
          query.userId = req.user.id;
        }
      }
      
      // Execute query with pagination
      const events = await AnalyticsEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const total = await AnalyticsEvent.countDocuments(query);
      
      return res.status(200).json({
        success: true,
        data: {
          events,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error(`Error getting analytics events: ${error.message}`, {
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
   * Get a single analytics event by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getEventById: async (req, res) => {
    try {
      const eventId = req.params.id;
      
      // Find event
      const event = await AnalyticsEvent.findById(eventId);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Analytics event not found'
        });
      }
      
      // Check if user has permission to access this event
      if (req.user && !req.user.roles.includes('admin')) {
        // Regular users can only access their own events or their company's events
        if (
          (event.userId && event.userId.toString() !== req.user.id) &&
          (event.companyId && event.companyId.toString() !== req.user.companyId?.toString())
        ) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to access this event'
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error(`Error getting analytics event by ID: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        eventId: req.params.id
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Mark events as processed
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  markEventsAsProcessed: async (req, res) => {
    try {
      const { eventIds } = req.body;
      
      // Validate request
      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'eventIds array is required and must not be empty'
        });
      }
      
      // Update events
      const result = await AnalyticsEvent.updateMany(
        { _id: { $in: eventIds } },
        {
          $set: {
            processed: true,
            processedAt: new Date()
          }
        }
      );
      
      logger.info(`Marked ${result.modifiedCount} events as processed`, {
        eventIds,
        modifiedCount: result.modifiedCount
      });
      
      return res.status(200).json({
        success: true,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      });
    } catch (error) {
      logger.error(`Error marking events as processed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        eventIds: req.body.eventIds
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  },
  
  /**
   * Delete events (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  deleteEvents: async (req, res) => {
    try {
      const { eventIds } = req.body;
      
      // Validate request
      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'eventIds array is required and must not be empty'
        });
      }
      
      // Only admins can delete events
      if (!req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Only administrators can delete analytics events'
        });
      }
      
      // Delete events
      const result = await AnalyticsEvent.deleteMany({ _id: { $in: eventIds } });
      
      logger.info(`Deleted ${result.deletedCount} analytics events`, {
        eventIds,
        deletedCount: result.deletedCount
      });
      
      return res.status(200).json({
        success: true,
        data: {
          deletedCount: result.deletedCount
        }
      });
    } catch (error) {
      logger.error(`Error deleting analytics events: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        eventIds: req.body.eventIds
      });
      
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  }
};

module.exports = eventController;
