const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metricsController');
const { authenticate, authorize } = require('../middleware/auth');

// Get feedback metrics with filtering
router.get('/feedback', 
  authenticate,
  metricsController.getFeedbackMetrics
);

// Get user metrics with filtering
router.get('/users', 
  authenticate,
  metricsController.getUserMetrics
);

// Get combined metrics summary
router.get('/summary', 
  authenticate,
  metricsController.getMetricsSummary
);

// Trigger manual metrics aggregation (admin only)
router.post('/aggregate', 
  authenticate,
  authorize(['admin', 'analyst']),
  metricsController.triggerAggregation
);

module.exports = router;
