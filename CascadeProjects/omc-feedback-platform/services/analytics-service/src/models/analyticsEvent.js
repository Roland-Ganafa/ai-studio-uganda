const mongoose = require('mongoose');

/**
 * Schema for analytics events
 * Stores raw events from various services for analytics processing
 */
const analyticsEventSchema = new mongoose.Schema({
  // Event source service (feedback, user, notification)
  sourceService: {
    type: String,
    required: true,
    enum: ['feedback', 'user', 'notification', 'system'],
    index: true
  },
  
  // Event type
  eventType: {
    type: String,
    required: true,
    index: true
  },
  
  // Event data (stored as JSON)
  eventData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Associated user ID (if applicable)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Associated company ID (if applicable)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Associated resource ID (feedback ID, notification ID, etc.)
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Resource type (feedback, notification, user, etc.)
  resourceType: {
    type: String,
    index: true
  },
  
  // Timestamp when the event occurred
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Processing status
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // When the event was processed
  processedAt: {
    type: Date
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create compound indexes for common queries
analyticsEventSchema.index({ sourceService: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ companyId: 1, timestamp: -1 });
analyticsEventSchema.index({ resourceId: 1, resourceType: 1 });
analyticsEventSchema.index({ processed: 1, timestamp: 1 });

// Create model
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);

module.exports = AnalyticsEvent;
