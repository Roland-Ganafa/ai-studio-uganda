const mongoose = require('mongoose');

/**
 * Schema for aggregated feedback metrics
 * Stores pre-calculated metrics for feedback data
 */
const feedbackMetricsSchema = new mongoose.Schema({
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
  
  // Category ID (null for all categories)
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  // Feedback counts
  counts: {
    total: {
      type: Number,
      default: 0
    },
    new: {
      type: Number,
      default: 0
    },
    inProgress: {
      type: Number,
      default: 0
    },
    resolved: {
      type: Number,
      default: 0
    },
    closed: {
      type: Number,
      default: 0
    }
  },
  
  // Feedback by priority
  byPriority: {
    low: {
      type: Number,
      default: 0
    },
    medium: {
      type: Number,
      default: 0
    },
    high: {
      type: Number,
      default: 0
    },
    critical: {
      type: Number,
      default: 0
    }
  },
  
  // Feedback by category (dynamic object)
  byCategory: {
    type: Map,
    of: Number,
    default: {}
  },
  
  // Response time metrics (in milliseconds)
  responseTimes: {
    average: {
      type: Number,
      default: 0
    },
    median: {
      type: Number,
      default: 0
    },
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    },
    percentile95: {
      type: Number,
      default: 0
    }
  },
  
  // Resolution time metrics (in milliseconds)
  resolutionTimes: {
    average: {
      type: Number,
      default: 0
    },
    median: {
      type: Number,
      default: 0
    },
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    },
    percentile95: {
      type: Number,
      default: 0
    }
  },
  
  // Satisfaction metrics
  satisfaction: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    },
    distribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  
  // Escalation metrics
  escalations: {
    count: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    byLevel: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 }
    }
  },
  
  // Comment metrics
  comments: {
    total: {
      type: Number,
      default: 0
    },
    average: {
      type: Number,
      default: 0
    },
    internal: {
      type: Number,
      default: 0
    },
    external: {
      type: Number,
      default: 0
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
feedbackMetricsSchema.index({ period: 1, date: -1, companyId: 1 });
feedbackMetricsSchema.index({ period: 1, date: -1, categoryId: 1 });
feedbackMetricsSchema.index({ companyId: 1, period: 1, date: -1 });

// Create model
const FeedbackMetrics = mongoose.model('FeedbackMetrics', feedbackMetricsSchema);

module.exports = FeedbackMetrics;
