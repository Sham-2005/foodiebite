// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/healthCheckinController.js
//  FoodieBite Health Check-in REST API Controller
//  Guards user tenant isolation and provides survey lifecycle endpoints
// ─────────────────────────────────────────────────────────────

'use strict';

const healthCheckinService = require('../services/healthCheckinService');

/**
 * Helper to extract authenticated user ID
 */
function getAuthUserId(req) {
  return req.user?.id || req.user?.uid;
}

/**
 * POST /api/checkin/start
 * Starts a new check-in or resumes an active draft
 */
exports.startCheckin = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const result = await healthCheckinService.startCheckin(userId, req.token);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/checkin/current
 * Retrieves the currently active draft for the user
 */
exports.getCurrentDraft = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const draft = await healthCheckinService.getCurrentDraft(userId, req.token);
    return res.status(200).json({
      success: true,
      hasDraft: Boolean(draft),
      draft
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/checkin/answers
 * Saves answers to questions (supports partial progress / draft saving)
 */
exports.saveAnswers = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { checkinId, answers } = req.body || {};
    if (!checkinId || !answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Valid checkinId and answers object are required.'
      });
    }

    const result = await healthCheckinService.saveAnswers(checkinId, userId, answers, req.token);
    return res.status(200).json({
      success: true,
      message: 'Answers saved successfully.',
      ...result
    });
  } catch (err) {
    if (err.message.includes('Unauthorized') || err.message.includes('not found')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/checkin/follow-ups
 * Analyzes answers and requests dynamic follow-up questions from Ollama
 */
exports.getFollowUpQuestions = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { checkinId, answers, userContext } = req.body || {};
    if (!checkinId) {
      return res.status(400).json({ success: false, message: 'checkinId is required.' });
    }

    const result = await healthCheckinService.generateFollowUpQuestions(
      checkinId,
      userId,
      answers || {},
      userContext || {},
      req.token
    );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /api/checkin/complete
 * Submits and finalizes the health check-in, generating AI wellness analysis
 */
exports.completeCheckin = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { checkinId, userProfile } = req.body || {};
    if (!checkinId) {
      return res.status(400).json({ success: false, message: 'checkinId is required.' });
    }

    const result = await healthCheckinService.completeCheckin(
      checkinId,
      userId,
      userProfile || req.user || {},
      req.token
    );

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/checkin/history
 * Returns the authenticated user's previous check-in submissions
 */
exports.getHistory = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await healthCheckinService.getCheckinHistory(userId, { limit, offset }, req.token);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/checkin/trends/personal
 * Returns timeline metrics for wellness visualization (energy, sleep, hydration)
 */
exports.getPersonalTrends = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const trends = await healthCheckinService.getPersonalTrends(userId, req.token);
    return res.status(200).json({
      success: true,
      trends
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/checkin/:id
 * Retrieves full single check-in details (questions, answers, AI analysis)
 */
exports.getCheckinDetails = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const checkinId = req.params.id;
    const isAdmin = req.user?.role === 'admin' || req.user?.email === 'sham111205s@gmail.com';

    const result = await healthCheckinService.getCheckinDetails(checkinId, userId, isAdmin, req.token);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    if (err.message.includes('Unauthorized') || err.message.includes('not found')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    next(err);
  }
};
