const mongoose = require('mongoose');

/**
 * Schema for analytics reports
 * Stores report configurations and generated report data
 */
const reportSchema = new mongoose.Schema({
  // User who created this report
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Company ID
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Report name
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Report description
  description: {
    type: String,
    trim: true
  },
  
  // Report type
  type: {
    type: String,
    required: true,
    enum: [
      'feedback_summary',
      'agent_performance',
      'customer_satisfaction',
      'response_times',
      'category_analysis',
      'trend_analysis',
      'user_activity',
      'notification_effectiveness',
      'custom'
    ],
    index: true
  },
  
  // Report format
  format: {
    type: String,
    required: true,
    enum: ['pdf', 'csv', 'excel', 'json'],
    default: 'pdf'
  },
  
  // Time range for the report
  timeRange: {
    // Predefined range
    preset: {
      type: String,
      enum: ['day', 'week', 'month', 'quarter', 'year', 'custom'],
      default: 'month'
    },
    
    // For custom time range
    custom: {
      start: { type: Date },
      end: { type: Date }
    }
  },
  
  // Report configuration (specific to report type)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Report filters
  filters: {
    // Filter by categories
    categories: [{
      type: mongoose.Schema.Types.ObjectId
    }],
    
    // Filter by status
    status: [{
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'closed']
    }],
    
    // Filter by priority
    priority: [{
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    }],
    
    // Filter by assignee
    assignees: [{
      type: mongoose.Schema.Types.ObjectId
    }],
    
    // Additional custom filters
    custom: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Schedule for automatic report generation
  schedule: {
    // Is this report scheduled
    isScheduled: {
      type: Boolean,
      default: false
    },
    
    // Frequency of the report
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    
    // Day of week for weekly reports (0 = Sunday, 6 = Saturday)
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6
    },
    
    // Day of month for monthly reports
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31
    },
    
    // Time of day to generate the report (24-hour format)
    time: {
      hour: {
        type: Number,
        min: 0,
        max: 23,
        default: 0
      },
      minute: {
        type: Number,
        min: 0,
        max: 59,
        default: 0
      }
    },
    
    // Next scheduled run
    nextRun: {
      type: Date
    },
    
    // Last run timestamp
    lastRun: {
      type: Date
    }
  },
  
  // Report delivery settings
  delivery: {
    // Delivery method
    method: {
      type: String,
      enum: ['email', 'download', 'api', 'dashboard'],
      default: 'email'
    },
    
    // Email recipients (if delivery method is email)
    recipients: [{
      email: {
        type: String,
        trim: true
      },
      name: {
        type: String,
        trim: true
      }
    }],
    
    // Email subject template
    emailSubject: {
      type: String,
      trim: true
    },
    
    // Email body template
    emailBody: {
      type: String,
      trim: true
    }
  },
  
  // Generated reports history
  history: [{
    // Generated report ID
    reportId: {
      type: String,
      required: true
    },
    
    // Generation timestamp
    generatedAt: {
      type: Date,
      default: Date.now
    },
    
    // Time period covered
    period: {
      start: { type: Date },
      end: { type: Date }
    },
    
    // File URL or path
    fileUrl: {
      type: String
    },
    
    // File size in bytes
    fileSize: {
      type: Number
    },
    
    // Generation status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    
    // Error message if failed
    error: {
      type: String
    },
    
    // Delivery status
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'downloaded'],
      default: 'pending'
    },
    
    // Delivery timestamp
    deliveredAt: {
      type: Date
    }
  }],
  
  // Report sharing settings
  sharing: {
    // Is this report shared
    isShared: {
      type: Boolean,
      default: false
    },
    
    // Users this report is shared with
    sharedWith: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId
      },
      permission: {
        type: String,
        enum: ['view', 'edit'],
        default: 'view'
      }
    }],
    
    // Is this report shared with the entire company
    sharedWithCompany: {
      type: Boolean,
      default: false
    },
    
    // Company permission level
    companyPermission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    }
  }
}, {
  timestamps: true
});

// Create compound indexes for common queries
reportSchema.index({ companyId: 1, type: 1 });
reportSchema.index({ createdBy: 1, type: 1 });
reportSchema.index({ 'schedule.isScheduled': 1, 'schedule.nextRun': 1 });
reportSchema.index({ companyId: 1, 'sharing.sharedWithCompany': 1 });
reportSchema.index({ 'sharing.sharedWith.userId': 1 });

// Create model
const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
