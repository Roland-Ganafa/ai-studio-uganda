const mongoose = require('mongoose');

/**
 * Schema for aggregated user metrics
 * Stores pre-calculated metrics for user activity and engagement
 */
const userMetricsSchema = new mongoose.Schema({
  // Time period this metric covers
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time'],
    index: true
  },
  
  // Date this metric is for (start of the period)
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Company ID (null for platform-wide metrics)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // User counts
  counts: {
    total: {
      type: Number,
      default: 0
    },
    active: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    }
  },
  
  // User counts by role
  byRole: {
    admin: {
      type: Number,
      default: 0
    },
    manager: {
      type: Number,
      default: 0
    },
    agent: {
      type: Number,
      default: 0
    },
    customer: {
      type: Number,
      default: 0
    }
  },
  
  // Activity metrics
  activity: {
    // Average logins per user
    averageLogins: {
      type: Number,
      default: 0
    },
    // Average session duration in seconds
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    // Total sessions
    totalSessions: {
      type: Number,
      default: 0
    },
    // Total login count
    totalLogins: {
      type: Number,
      default: 0
    }
  },
  
  // Engagement metrics
  engagement: {
    // Average feedback submissions per user
    averageFeedbackSubmissions: {
      type: Number,
      default: 0
    },
    // Average comments per user
    averageComments: {
      type: Number,
      default: 0
    },
    // Average responses per agent
    averageResponses: {
      type: Number,
      default: 0
    },
    // Average resolution time per agent (in milliseconds)
    averageResolutionTime: {
      type: Number,
      default: 0
    }
  },
  
  // Performance metrics (for agents/managers)
  performance: {
    // Average feedback handled per agent
    averageFeedbackHandled: {
      type: Number,
      default: 0
    },
    // Average resolution rate (percentage)
    averageResolutionRate: {
      type: Number,
      default: 0
    },
    // Average satisfaction score
    averageSatisfactionScore: {
      type: Number,
      default: 0
    },
    // Average response time (in milliseconds)
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // Notification metrics
  notifications: {
    // Total sent
    sent: {
      type: Number,
      default: 0
    },
    // Total read
    read: {
      type: Number,
      default: 0
    },
    // Read rate (percentage)
    readRate: {
      type: Number,
      default: 0
    },
    // By channel
    byChannel: {
      email: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        opened: { type: Number, default: 0 }
      },
      sms: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 }
      },
      push: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        opened: { type: Number, default: 0 }
      },
      inApp: {
        sent: { type: Number, default: 0 },
        read: { type: Number, default: 0 }
      }
    }
  },
  
  // Timestamp when this metric was last calculated
  calculatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound indexes for common queries
userMetricsSchema.index({ period: 1, date: -1, companyId: 1 });
userMetricsSchema.index({ companyId: 1, period: 1, date: -1 });

// Create model
const UserMetrics = mongoose.model('UserMetrics', userMetricsSchema);

module.exports = UserMetrics;
