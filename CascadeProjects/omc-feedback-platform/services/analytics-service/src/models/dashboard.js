const mongoose = require('mongoose');

/**
 * Schema for user dashboard configurations
 * Stores customizable dashboard layouts and widget preferences
 */
const dashboardSchema = new mongoose.Schema({
  // User who owns this dashboard
  userId: {
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
  
  // Dashboard name
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Dashboard description
  description: {
    type: String,
    trim: true
  },
  
  // Is this the default dashboard for the user
  isDefault: {
    type: Boolean,
    default: false
  },
  
  // Dashboard layout (array of widgets with positions and sizes)
  layout: [{
    // Widget identifier
    widgetId: {
      type: String,
      required: true
    },
    
    // Widget type
    widgetType: {
      type: String,
      required: true,
      enum: [
        'feedback_count', 
        'feedback_by_status', 
        'feedback_by_priority',
        'feedback_by_category',
        'response_time',
        'resolution_time',
        'satisfaction_score',
        'agent_performance',
        'user_activity',
        'notification_metrics',
        'trending_categories',
        'feedback_volume_trend',
        'custom'
      ]
    },
    
    // Widget title (customizable)
    title: {
      type: String,
      required: true
    },
    
    // Widget position and size
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      w: { type: Number, required: true },
      h: { type: Number, required: true }
    },
    
    // Widget configuration (specific to widget type)
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    // Time range for data
    timeRange: {
      type: String,
      enum: ['day', 'week', 'month', 'quarter', 'year', 'custom'],
      default: 'week'
    },
    
    // For custom time range
    customTimeRange: {
      start: { type: Date },
      end: { type: Date }
    },
    
    // Refresh interval in seconds (0 for manual refresh)
    refreshInterval: {
      type: Number,
      default: 0
    }
  }],
  
  // Dashboard filters (applied to all applicable widgets)
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
  
  // Dashboard sharing settings
  sharing: {
    // Is this dashboard shared
    isShared: {
      type: Boolean,
      default: false
    },
    
    // Users this dashboard is shared with
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
    
    // Is this dashboard shared with the entire company
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
dashboardSchema.index({ userId: 1, isDefault: 1 });
dashboardSchema.index({ companyId: 1, 'sharing.sharedWithCompany': 1 });
dashboardSchema.index({ 'sharing.sharedWith.userId': 1 });

// Create model
const Dashboard = mongoose.model('Dashboard', dashboardSchema);

module.exports = Dashboard;
