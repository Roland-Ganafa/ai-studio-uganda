const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

// Create a new dashboard
router.post('/', 
  authenticate,
  dashboardController.createDashboard
);

// Update an existing dashboard
router.put('/:id', 
  authenticate,
  dashboardController.updateDashboard
);

// Get all dashboards for the current user
router.get('/', 
  authenticate,
  dashboardController.getDashboards
);

// Get a single dashboard by ID
router.get('/:id', 
  authenticate,
  dashboardController.getDashboardById
);

// Delete a dashboard
router.delete('/:id', 
  authenticate,
  dashboardController.deleteDashboard
);

// Share a dashboard with other users
router.post('/:id/share', 
  authenticate,
  dashboardController.shareDashboard
);

// Clone an existing dashboard
router.post('/:id/clone', 
  authenticate,
  dashboardController.cloneDashboard
);

module.exports = router;
