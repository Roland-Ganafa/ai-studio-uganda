const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import utilities
const logger = require('./utils/logger');
const messageQueue = require('./utils/messageQueue');
const cache = require('./utils/cache');
const scheduler = require('./utils/scheduler');
const DataAggregator = require('./utils/dataAggregator');

// Import routes
const eventRoutes = require('./routes/eventRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Import middleware
const { errorHandler, notFoundHandler, validationErrorHandler, mongoErrorHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded: ${req.ip}`, {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    });
  }
});

// Apply rate limiting to all requests
app.use(apiLimiter);

// HTTP request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => {
        logger.http(message.trim());
      }
    }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'analytics-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/events', eventRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/dashboards', dashboardRoutes);

// Error handling middleware
app.use(validationErrorHandler);
app.use(mongoErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    // Exit process with failure
    process.exit(1);
  }
};

// Connect to Redis cache
const connectCache = async () => {
  try {
    await cache.connect();
    logger.info('Redis cache connected successfully');
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

// Connect to RabbitMQ
const connectMessageQueue = async () => {
  try {
    await messageQueue.connect();
    logger.info('RabbitMQ connected successfully');
    
    // Set up event consumers
    setupEventConsumers();
  } catch (error) {
    logger.error(`RabbitMQ connection error: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

// Set up RabbitMQ event consumers
const setupEventConsumers = async () => {
  try {
    // Consume events from feedback service
    await messageQueue.consume('feedback-events', async (message) => {
      try {
        const event = JSON.parse(message.content.toString());
        logger.info(`Received feedback event: ${event.type}`, {
          eventType: event.type,
          feedbackId: event.feedbackId
        });
        
        // Create analytics event from feedback event
        const AnalyticsEvent = require('./models/analyticsEvent');
        
        const analyticsEvent = new AnalyticsEvent({
          sourceService: 'feedback-service',
          eventType: event.type,
          eventData: event,
          userId: event.userId,
          companyId: event.companyId,
          resourceId: event.feedbackId,
          resourceType: 'feedback',
          metadata: {
            category: event.category,
            priority: event.priority,
            status: event.status
          },
          timestamp: new Date(event.timestamp || Date.now())
        });
        
        await analyticsEvent.save();
        
        logger.debug(`Created analytics event from feedback event: ${event.type}`, {
          eventId: analyticsEvent._id.toString(),
          feedbackId: event.feedbackId
        });
        
        // Acknowledge message
        messageQueue.ack(message);
      } catch (error) {
        logger.error(`Error processing feedback event: ${error.message}`, {
          error: error.message,
          stack: error.stack,
          message: message.content.toString()
        });
        
        // Reject message and requeue
        messageQueue.nack(message, false, true);
      }
    });
    
    // Consume events from user service
    await messageQueue.consume('user-events', async (message) => {
      try {
        const event = JSON.parse(message.content.toString());
        logger.info(`Received user event: ${event.type}`, {
          eventType: event.type,
          userId: event.userId
        });
        
        // Create analytics event from user event
        const AnalyticsEvent = require('./models/analyticsEvent');
        
        const analyticsEvent = new AnalyticsEvent({
          sourceService: 'user-service',
          eventType: event.type,
          eventData: event,
          userId: event.userId,
          companyId: event.companyId,
          resourceId: event.userId,
          resourceType: 'user',
          metadata: {
            role: event.role,
            action: event.action
          },
          timestamp: new Date(event.timestamp || Date.now())
        });
        
        await analyticsEvent.save();
        
        logger.debug(`Created analytics event from user event: ${event.type}`, {
          eventId: analyticsEvent._id.toString(),
          userId: event.userId
        });
        
        // Acknowledge message
        messageQueue.ack(message);
      } catch (error) {
        logger.error(`Error processing user event: ${error.message}`, {
          error: error.message,
          stack: error.stack,
          message: message.content.toString()
        });
        
        // Reject message and requeue
        messageQueue.nack(message, false, true);
      }
    });
    
    // Consume events from notification service
    await messageQueue.consume('notification-events', async (message) => {
      try {
        const event = JSON.parse(message.content.toString());
        logger.info(`Received notification event: ${event.type}`, {
          eventType: event.type,
          notificationId: event.notificationId
        });
        
        // Create analytics event from notification event
        const AnalyticsEvent = require('./models/analyticsEvent');
        
        const analyticsEvent = new AnalyticsEvent({
          sourceService: 'notification-service',
          eventType: event.type,
          eventData: event,
          userId: event.userId,
          companyId: event.companyId,
          resourceId: event.notificationId,
          resourceType: 'notification',
          metadata: {
            channel: event.channel,
            status: event.status
          },
          timestamp: new Date(event.timestamp || Date.now())
        });
        
        await analyticsEvent.save();
        
        logger.debug(`Created analytics event from notification event: ${event.type}`, {
          eventId: analyticsEvent._id.toString(),
          notificationId: event.notificationId
        });
        
        // Acknowledge message
        messageQueue.ack(message);
      } catch (error) {
        logger.error(`Error processing notification event: ${error.message}`, {
          error: error.message,
          stack: error.stack,
          message: message.content.toString()
        });
        
        // Reject message and requeue
        messageQueue.nack(message, false, true);
      }
    });
    
    logger.info('Event consumers set up successfully');
  } catch (error) {
    logger.error(`Error setting up event consumers: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

// Initialize scheduler for periodic tasks
const initializeScheduler = async () => {
  try {
    // Initialize scheduler
    scheduler.initialize();
    logger.info('Scheduler initialized successfully');
    
    // Run initial aggregation if needed
    if (process.env.RUN_INITIAL_AGGREGATION === 'true') {
      logger.info('Running initial data aggregation');
      
      // Run daily aggregation
      await DataAggregator.runScheduledAggregation('daily');
      
      // Run weekly aggregation
      await DataAggregator.runScheduledAggregation('weekly');
      
      // Run monthly aggregation
      await DataAggregator.runScheduledAggregation('monthly');
      
      logger.info('Initial data aggregation completed');
    }
  } catch (error) {
    logger.error(`Error initializing scheduler: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
  }
};

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Connect to Redis cache
    await connectCache();
    
    // Connect to RabbitMQ
    await connectMessageQueue();
    
    // Initialize scheduler
    await initializeScheduler();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Analytics Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Stop scheduler
    scheduler.stopAll();
    logger.info('Scheduler stopped');
    
    // Close message queue connection
    await messageQueue.close();
    logger.info('RabbitMQ connection closed');
    
    // Close cache connection
    await cache.close();
    logger.info('Redis connection closed');
    
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    
    logger.info('Shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during graceful shutdown: ${error.message}`, {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
};

// Handle signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, {
    error: error.message,
    stack: error.stack
  });
  
  // Exit with failure
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at ${promise}: ${reason}`, {
    reason: reason.message || reason,
    stack: reason.stack || 'No stack trace'
  });
  
  // Exit with failure
  process.exit(1);
});

// Start the server
startServer();
