// ─────────────────────────────────────────────────────────────
//  backend/src/routes/healthCheckinRoutes.js
//  FoodieBite Health Check-in & AI Wellness Insights Routes
// ─────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const healthCheckinController = require('../controllers/healthCheckinController');

// All check-in routes require authenticated user access
router.use(protect);

router.post('/start', healthCheckinController.startCheckin);
router.get('/current', healthCheckinController.getCurrentDraft);
router.post('/answers', healthCheckinController.saveAnswers);
router.post('/follow-ups', healthCheckinController.getFollowUpQuestions);
router.post('/complete', healthCheckinController.completeCheckin);
router.get('/history', healthCheckinController.getHistory);
router.get('/trends/personal', healthCheckinController.getPersonalTrends);
router.get('/:id', healthCheckinController.getCheckinDetails);

module.exports = router;
