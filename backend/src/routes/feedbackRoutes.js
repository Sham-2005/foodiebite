const express = require('express');
const router = express.Router();
const { protect, verifyAdmin } = require('../middleware/authMiddleware');
const feedbackController = require('../controllers/feedbackController');

// Submit feedback - public/authenticated user
router.post('/', protect, feedbackController.submitFeedback);

// Resolve feedback - admin only
router.put('/:id/resolve', protect, verifyAdmin, feedbackController.resolveFeedback);

// Delete feedback - admin only
router.delete('/:id', protect, verifyAdmin, feedbackController.deleteFeedback);

module.exports = router;
