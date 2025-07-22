# Analytics Service - OMC Feedback Platform

The Analytics Service is a microservice component of the OMC Feedback Platform designed to collect, process, and provide insights into platform data such as feedback trends, user activity, and notification effectiveness.

## Features

- **Event Collection**: Captures events from all platform services via API and message queue
- **Metrics Aggregation**: Processes raw events into meaningful metrics and KPIs
- **Dashboards**: Customizable dashboards with shareable widgets
- **Reports**: Scheduled and on-demand analytics reports
- **Data Caching**: Redis-based caching for optimized performance
- **RESTful API**: Comprehensive API for analytics data access

## Table of Contents

- [Architecture](#architecture)
- [Setup](#setup)
- [API Endpoints](#api-endpoints)
- [Models](#models)
- [Integration](#integration)
- [Security](#security)
- [Error Handling](#error-handling)
- [Logging](#logging)

## Architecture

The Analytics Service follows a microservice architecture pattern with the following components:

- **Models**: MongoDB schemas for analytics events, metrics, dashboards, and reports
- **Controllers**: Business logic for handling API requests
- **Routes**: RESTful API endpoints
- **Middleware**: Authentication, authorization, and error handling
- **Utils**: Shared utilities for logging, caching, message queue, and data aggregation
- **Scheduler**: Periodic tasks for data aggregation and report generation

## Setup

### Prerequisites

- Node.js (v14+)
- MongoDB
- Redis
- RabbitMQ

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   cd services/analytics-service
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values according to your environment

4. Start the service:
   ```
   npm start
   ```

For development:
```
npm run dev
```

### Environment Variables

```
# Server
PORT=3003
NODE_ENV=development
LOG_LEVEL=info

# MongoDB
MONGODB_URI=mongodb://localhost:27017/omc-analytics

# JWT
JWT_SECRET=your_jwt_secret

# RabbitMQ
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=omc-events
RABBITMQ_QUEUE=analytics-service

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Service URLs
FEEDBACK_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3000
NOTIFICATION_SERVICE_URL=http://localhost:3002

# Aggregation Schedules (cron format)
DAILY_AGGREGATION_SCHEDULE=0 0 * * *
WEEKLY_AGGREGATION_SCHEDULE=0 0 * * 0
MONTHLY_AGGREGATION_SCHEDULE=0 0 1 * *

# Initial Setup
RUN_INITIAL_AGGREGATION=false
```

## API Endpoints

### Events

- `POST /api/events` - Create a new analytics event
- `POST /api/events/batch` - Create multiple analytics events in batch
- `GET /api/events` - Get analytics events with filtering and pagination
- `GET /api/events/:id` - Get a single analytics event by ID
- `PUT /api/events/mark-processed` - Mark events as processed
- `DELETE /api/events` - Delete events (admin only)

### Metrics

- `GET /api/metrics/feedback` - Get feedback metrics with filtering
- `GET /api/metrics/users` - Get user metrics with filtering
- `GET /api/metrics/summary` - Get combined metrics summary
- `POST /api/metrics/aggregate` - Trigger manual metrics aggregation

### Dashboards

- `POST /api/dashboards` - Create a new dashboard
- `PUT /api/dashboards/:id` - Update an existing dashboard
- `GET /api/dashboards` - Get all dashboards for the current user
- `GET /api/dashboards/:id` - Get a single dashboard by ID
- `DELETE /api/dashboards/:id` - Delete a dashboard
- `POST /api/dashboards/:id/share` - Share a dashboard with other users
- `POST /api/dashboards/:id/clone` - Clone an existing dashboard

## Models

### AnalyticsEvent

Raw event data from various services:

```javascript
{
  sourceService: String,  // e.g., 'feedback-service', 'user-service'
  eventType: String,      // e.g., 'feedback.created', 'user.login'
  eventData: Object,      // Raw event data
  userId: String,         // User who triggered the event
  companyId: String,      // Company context
  resourceId: String,     // Related resource ID
  resourceType: String,   // Type of resource
  metadata: Object,       // Additional metadata
  timestamp: Date,        // When the event occurred
  processed: Boolean,     // Whether event has been processed
  processedAt: Date       // When event was processed
}
```

### FeedbackMetrics

Aggregated feedback metrics:

```javascript
{
  companyId: String,           // Company ID
  period: String,              // 'daily', 'weekly', 'monthly', etc.
  periodStart: Date,           // Start of period
  periodEnd: Date,             // End of period
  totalFeedback: Number,       // Total feedback count
  newFeedback: Number,         // New feedback count
  openFeedback: Number,        // Open feedback count
  resolvedFeedback: Number,    // Resolved feedback count
  avgResponseTime: Number,     // Average response time (minutes)
  avgResolutionTime: Number,   // Average resolution time (minutes)
  avgSatisfactionScore: Number, // Average satisfaction score
  categories: [{               // Feedback by category
    name: String,
    count: Number,
    percentage: Number
  }],
  priorities: [{               // Feedback by priority
    name: String,
    count: Number,
    percentage: Number
  }],
  statuses: [{                 // Feedback by status
    name: String,
    count: Number,
    percentage: Number
  }],
  responseTimeDistribution: {  // Response time distribution
    lessThan1Hour: Number,
    lessThan4Hours: Number,
    lessThan24Hours: Number,
    lessThan3Days: Number,
    moreThan3Days: Number
  },
  escalations: {               // Escalation metrics
    total: Number,
    percentage: Number,
    avgTimeToEscalation: Number
  },
  comments: {                  // Comment metrics
    total: Number,
    avgPerFeedback: Number
  }
}
```

### UserMetrics

Aggregated user metrics:

```javascript
{
  companyId: String,           // Company ID
  period: String,              // 'daily', 'weekly', 'monthly', etc.
  periodStart: Date,           // Start of period
  periodEnd: Date,             // End of period
  totalUsers: Number,          // Total user count
  activeUsers: Number,         // Active user count
  newUsers: Number,            // New user count
  roles: [{                    // Users by role
    name: String,
    count: Number,
    percentage: Number
  }],
  activity: {                  // User activity metrics
    logins: Number,
    avgSessionDuration: Number,
    avgActionsPerSession: Number
  },
  engagement: {                // User engagement metrics
    feedbackSubmitted: Number,
    commentsAdded: Number,
    avgEngagementScore: Number
  },
  performance: {               // User performance metrics
    avgResponseTime: Number,
    avgResolutionTime: Number,
    satisfactionScore: Number
  },
  notifications: {             // Notification metrics
    sent: Number,
    read: Number,
    clicked: Number,
    readRate: Number,
    clickRate: Number
  }
}
```

### Dashboard

User dashboard configurations:

```javascript
{
  name: String,                // Dashboard name
  description: String,         // Dashboard description
  layout: Object,              // Layout configuration
  widgets: [{                  // Dashboard widgets
    id: String,
    type: String,              // e.g., 'chart', 'table', 'metric'
    title: String,
    config: Object,            // Widget configuration
    position: Object           // Widget position
  }],
  filters: [{                  // Dashboard filters
    id: String,
    type: String,
    field: String,
    operator: String,
    value: Mixed
  }],
  isDefault: Boolean,          // Whether this is user's default dashboard
  userId: String,              // Owner user ID
  companyId: String,           // Company ID
  createdAt: Date,
  updatedAt: Date,
  sharing: {                   // Sharing settings
    isPublic: Boolean,
    canEdit: Boolean,
    sharedWith: [String]       // User IDs
  }
}
```

### Report

Analytics reports:

```javascript
{
  name: String,                // Report name
  description: String,         // Report description
  type: String,                // e.g., 'feedback', 'user', 'performance'
  config: {                    // Report configuration
    metrics: [String],
    filters: [Object],
    groupBy: String,
    sortBy: String,
    limit: Number
  },
  schedule: {                  // Scheduling configuration
    isScheduled: Boolean,
    frequency: String,         // 'daily', 'weekly', 'monthly', 'quarterly'
    time: {
      hour: Number,
      minute: Number
    },
    lastRun: Date,
    nextRun: Date
  },
  delivery: {                  // Delivery configuration
    method: String,            // 'email', 'download', 'dashboard'
    recipients: [String],
    format: String             // 'pdf', 'csv', 'json'
  },
  sharing: {                   // Sharing settings
    isPublic: Boolean,
    canEdit: Boolean,
    sharedWith: [String]       // User IDs
  },
  userId: String,              // Owner user ID
  companyId: String,           // Company ID
  createdAt: Date,
  updatedAt: Date,
  history: [{                  // Report generation history
    reportId: String,
    generatedAt: Date,
    period: {
      start: Date,
      end: Date
    },
    status: String,            // 'completed', 'failed'
    deliveryStatus: String,    // 'sent', 'failed'
    deliveredAt: Date
  }]
}
```

## Integration

### RabbitMQ Event Consumption

The Analytics Service consumes events from other services via RabbitMQ:

- **Feedback Events**: Events related to feedback creation, updates, and resolution
- **User Events**: User registration, login, activity, and profile updates
- **Notification Events**: Notification delivery, read status, and interactions

### Service-to-Service Communication

The service communicates with other microservices via RESTful APIs:

- **User Service**: For user and company information
- **Feedback Service**: For detailed feedback data
- **Notification Service**: For sending report notifications

## Security

- **Authentication**: JWT-based authentication for all API endpoints
- **Authorization**: Role-based access control for sensitive operations
- **Data Isolation**: Company-based data isolation to ensure data privacy

## Error Handling

The service implements comprehensive error handling:

- **Validation Errors**: 400 Bad Request with detailed error messages
- **Authentication Errors**: 401 Unauthorized for invalid or missing tokens
- **Authorization Errors**: 403 Forbidden for insufficient permissions
- **Not Found Errors**: 404 Not Found for non-existent resources
- **Server Errors**: 500 Internal Server Error with appropriate logging

## Logging

The service uses structured logging with Winston:

- **Log Levels**: error, warn, info, http, debug
- **Log Format**: JSON format with timestamp, level, message, and metadata
- **Context**: Includes request ID, user ID, and company ID for traceability
- **Transport**: Console and file transport with rotation
