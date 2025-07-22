const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, authorize } = require('../middleware/auth');

// Create a new analytics event
router.post('/', 
  authenticate,
  eventController.createEvent
);

// Create multiple analytics events in batch
router.post('/batch', 
  authenticate,
  eventController.createBatchEvents
);

// Get analytics events with filtering and pagination
router.get('/', 
  authenticate,
  eventController.getEvents
);

// Get a single analytics event by ID
router.get('/:id', 
  authenticate,
  eventController.getEventById
);

// Mark events as processed
router.put('/mark-processed', 
  authenticate,
  authorize(['admin', 'analyst']),
  eventController.markEventsAsProcessed
);

// Delete events (admin only)
router.delete('/', 
  authenticate,
  authorize(['admin']),
  eventController.deleteEvents
);

module.exports = router;
