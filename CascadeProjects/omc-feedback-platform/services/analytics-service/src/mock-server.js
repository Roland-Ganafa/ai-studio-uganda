/**
 * Mock Analytics Service Server
 * This version runs without requiring MongoDB, Redis, or RabbitMQ
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3004;

// In-memory data stores
const mockDB = {
  events: [],
  metrics: {
    feedback: [],
    users: []
  },
  dashboards: [],
  reports: []
};

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.http(message.trim()) } }));

// Mock authentication middleware
const authenticate = (req, res, next) => {
  // Mock user data
  req.user = {
    userId: '123456',
    email: 'test@example.com',
    roles: ['admin'],
    companyId: 'company123'
  };
  next();
};

// Mock authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (roles.length && !roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions'
      });
    }
    next();
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'analytics-service',
    version: '1.0.0'
  });
});

// API Routes

// Events API
app.post('/api/events', authenticate, (req, res) => {
  const event = {
    id: `event-${Date.now()}`,
    ...req.body,
    userId: req.user.userId,
    companyId: req.user.companyId,
    timestamp: new Date(),
    processed: false
  };
  mockDB.events.push(event);
  logger.info(`Event created: ${event.id}`);
  res.status(201).json({ success: true, data: event });
});

app.post('/api/events/batch', authenticate, (req, res) => {
  const { events } = req.body;
  const createdEvents = events.map(event => ({
    id: `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...event,
    timestamp: new Date(),
    processed: false
  }));
  
  mockDB.events.push(...createdEvents);
  logger.info(`Batch created: ${createdEvents.length} events`);
  res.status(201).json({ 
    success: true, 
    data: { 
      insertedCount: createdEvents.length,
      events: createdEvents
    } 
  });
});

app.get('/api/events', authenticate, (req, res) => {
  // Filter by company
  const events = mockDB.events.filter(event => event.companyId === req.user.companyId);
  
  // Apply additional filters if provided
  const { sourceService, eventType, startDate, endDate, processed } = req.query;
  
  let filteredEvents = events;
  
  if (sourceService) {
    filteredEvents = filteredEvents.filter(event => event.sourceService === sourceService);
  }
  
  if (eventType) {
    filteredEvents = filteredEvents.filter(event => event.eventType === eventType);
  }
  
  if (startDate) {
    const start = new Date(startDate);
    filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) >= start);
  }
  
  if (endDate) {
    const end = new Date(endDate);
    filteredEvents = filteredEvents.filter(event => new Date(event.timestamp) <= end);
  }
  
  if (processed !== undefined) {
    const isProcessed = processed === 'true';
    filteredEvents = filteredEvents.filter(event => event.processed === isProcessed);
  }
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);
  
  res.status(200).json({
    success: true,
    data: {
      events: paginatedEvents,
      pagination: {
        total: filteredEvents.length,
        page,
        limit,
        pages: Math.ceil(filteredEvents.length / limit)
      }
    }
  });
});

// Metrics API
app.get('/api/metrics/feedback', authenticate, (req, res) => {
  // Mock feedback metrics
  const feedbackMetrics = {
    companyId: req.user.companyId,
    period: 'daily',
    periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    periodEnd: new Date(),
    totalFeedback: 120,
    newFeedback: 15,
    openFeedback: 35,
    resolvedFeedback: 85,
    avgResponseTime: 120, // minutes
    avgResolutionTime: 1440, // minutes
    avgSatisfactionScore: 4.2,
    categories: [
      { name: 'bug', count: 45, percentage: 37.5 },
      { name: 'feature', count: 30, percentage: 25 },
      { name: 'question', count: 25, percentage: 20.8 },
      { name: 'other', count: 20, percentage: 16.7 }
    ],
    priorities: [
      { name: 'high', count: 25, percentage: 20.8 },
      { name: 'medium', count: 65, percentage: 54.2 },
      { name: 'low', count: 30, percentage: 25 }
    ],
    statuses: [
      { name: 'new', count: 15, percentage: 12.5 },
      { name: 'in_progress', count: 20, percentage: 16.7 },
      { name: 'resolved', count: 85, percentage: 70.8 }
    ]
  };
  
  res.status(200).json({
    success: true,
    data: feedbackMetrics
  });
});

app.get('/api/metrics/users', authenticate, (req, res) => {
  // Mock user metrics
  const userMetrics = {
    companyId: req.user.companyId,
    period: 'daily',
    periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    periodEnd: new Date(),
    totalUsers: 250,
    activeUsers: 180,
    newUsers: 5,
    roles: [
      { name: 'admin', count: 10, percentage: 4 },
      { name: 'manager', count: 40, percentage: 16 },
      { name: 'agent', count: 100, percentage: 40 },
      { name: 'customer', count: 100, percentage: 40 }
    ],
    activity: {
      logins: 210,
      avgSessionDuration: 45, // minutes
      avgActionsPerSession: 12
    }
  };
  
  res.status(200).json({
    success: true,
    data: userMetrics
  });
});

app.get('/api/metrics/summary', authenticate, (req, res) => {
  // Mock metrics summary
  const summary = {
    companyId: req.user.companyId,
    period: 'daily',
    periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
    periodEnd: new Date(),
    feedback: {
      total: 120,
      new: 15,
      open: 35,
      resolved: 85,
      avgSatisfactionScore: 4.2
    },
    users: {
      total: 250,
      active: 180,
      new: 5
    },
    performance: {
      avgResponseTime: 120, // minutes
      avgResolutionTime: 1440, // minutes
      satisfactionTrend: '+0.3'
    }
  };
  
  res.status(200).json({
    success: true,
    data: summary
  });
});

app.post('/api/metrics/aggregate', authenticate, authorize(['admin']), (req, res) => {
  logger.info(`Manual aggregation triggered by user ${req.user.userId}`);
  res.status(200).json({
    success: true,
    message: 'Aggregation job started successfully'
  });
});

// Dashboards API
app.post('/api/dashboards', authenticate, (req, res) => {
  const dashboard = {
    id: `dashboard-${Date.now()}`,
    ...req.body,
    userId: req.user.userId,
    companyId: req.user.companyId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  mockDB.dashboards.push(dashboard);
  logger.info(`Dashboard created: ${dashboard.id}`);
  
  res.status(201).json({
    success: true,
    data: dashboard
  });
});

app.get('/api/dashboards', authenticate, (req, res) => {
  const userDashboards = mockDB.dashboards.filter(
    dashboard => dashboard.userId === req.user.userId || 
                (dashboard.sharing && dashboard.sharing.sharedWith && 
                 dashboard.sharing.sharedWith.includes(req.user.userId))
  );
  
  res.status(200).json({
    success: true,
    data: userDashboards
  });
});

app.get('/api/dashboards/:id', authenticate, (req, res) => {
  const dashboard = mockDB.dashboards.find(d => d.id === req.params.id);
  
  if (!dashboard) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard not found'
    });
  }
  
  // Check if user has access
  if (dashboard.userId !== req.user.userId && 
      !(dashboard.sharing && dashboard.sharing.sharedWith && 
        dashboard.sharing.sharedWith.includes(req.user.userId))) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have access to this dashboard'
    });
  }
  
  res.status(200).json({
    success: true,
    data: dashboard
  });
});

app.put('/api/dashboards/:id', authenticate, (req, res) => {
  const dashboardIndex = mockDB.dashboards.findIndex(d => d.id === req.params.id);
  
  if (dashboardIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard not found'
    });
  }
  
  const dashboard = mockDB.dashboards[dashboardIndex];
  
  // Check if user has edit access
  if (dashboard.userId !== req.user.userId && 
      !(dashboard.sharing && dashboard.sharing.canEdit)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have edit access to this dashboard'
    });
  }
  
  // Update dashboard
  mockDB.dashboards[dashboardIndex] = {
    ...dashboard,
    ...req.body,
    id: dashboard.id, // Preserve ID
    userId: dashboard.userId, // Preserve owner
    companyId: dashboard.companyId, // Preserve company
    updatedAt: new Date()
  };
  
  logger.info(`Dashboard updated: ${dashboard.id}`);
  
  res.status(200).json({
    success: true,
    data: mockDB.dashboards[dashboardIndex]
  });
});

app.delete('/api/dashboards/:id', authenticate, (req, res) => {
  const dashboardIndex = mockDB.dashboards.findIndex(d => d.id === req.params.id);
  
  if (dashboardIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard not found'
    });
  }
  
  const dashboard = mockDB.dashboards[dashboardIndex];
  
  // Check if user is owner
  if (dashboard.userId !== req.user.userId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only the owner can delete a dashboard'
    });
  }
  
  // Remove dashboard
  mockDB.dashboards.splice(dashboardIndex, 1);
  logger.info(`Dashboard deleted: ${req.params.id}`);
  
  res.status(200).json({
    success: true,
    message: 'Dashboard deleted successfully'
  });
});

app.post('/api/dashboards/:id/share', authenticate, (req, res) => {
  const dashboardIndex = mockDB.dashboards.findIndex(d => d.id === req.params.id);
  
  if (dashboardIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard not found'
    });
  }
  
  const dashboard = mockDB.dashboards[dashboardIndex];
  
  // Check if user is owner
  if (dashboard.userId !== req.user.userId) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only the owner can share a dashboard'
    });
  }
  
  const { isPublic, canEdit, sharedWith } = req.body;
  
  // Update sharing settings
  mockDB.dashboards[dashboardIndex] = {
    ...dashboard,
    sharing: {
      isPublic: isPublic !== undefined ? isPublic : dashboard.sharing?.isPublic || false,
      canEdit: canEdit !== undefined ? canEdit : dashboard.sharing?.canEdit || false,
      sharedWith: sharedWith || dashboard.sharing?.sharedWith || []
    },
    updatedAt: new Date()
  };
  
  logger.info(`Dashboard sharing updated: ${dashboard.id}`);
  
  res.status(200).json({
    success: true,
    data: mockDB.dashboards[dashboardIndex]
  });
});

app.post('/api/dashboards/:id/clone', authenticate, (req, res) => {
  const dashboard = mockDB.dashboards.find(d => d.id === req.params.id);
  
  if (!dashboard) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard not found'
    });
  }
  
  // Check if user has access
  if (dashboard.userId !== req.user.userId && 
      !(dashboard.sharing && (dashboard.sharing.isPublic || 
        (dashboard.sharing.sharedWith && 
         dashboard.sharing.sharedWith.includes(req.user.userId))))) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have access to clone this dashboard'
    });
  }
  
  // Create cloned dashboard
  const clonedDashboard = {
    ...dashboard,
    id: `dashboard-${Date.now()}`,
    name: `${dashboard.name} (Clone)`,
    userId: req.user.userId,
    companyId: req.user.companyId,
    isDefault: false,
    sharing: {
      isPublic: false,
      canEdit: false,
      sharedWith: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  mockDB.dashboards.push(clonedDashboard);
  logger.info(`Dashboard cloned: ${clonedDashboard.id} from ${dashboard.id}`);
  
  res.status(201).json({
    success: true,
    data: clonedDashboard
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Analytics Service (Mock) running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
