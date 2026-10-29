// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/userController.js
//  Decommissioned userController.
//  Configured for direct client-side Firestore serverless operations.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { extractBiomarkersAndRecommendations } = require('../services/medicalAnalysisService');
const {
  recordBehaviorEvent,
  getBehavioralProfile,
  resetBehavioralProfile
} = require('../services/behaviorLearningService');
const { trackFeatureUsage } = require('../services/activityTrackingService');

exports.getProfile = async (req, res) => {
  res.status(200).json({ success: true, message: "Decommissioned. Use Firestore directly." });
};

exports.updateProfile = async (req, res) => {
  res.status(200).json({ success: true, message: "Decommissioned. Use Firestore directly." });
};

exports.getPreferences = async (req, res) => {
  res.status(200).json({ success: true, message: "Decommissioned. Use Firestore directly." });
};

exports.updatePreferences = async (req, res) => {
  res.status(200).json({ success: true, message: "Decommissioned. Use Firestore directly." });
};

exports.getFavorites = async (req, res) => {
  res.status(200).json({ success: true, message: "Decommissioned. Use Firestore directly." });
};

exports.addFavoriteFood = async (req, res) => {
  const userId = req.user?.uid || req.user?.id;
  if (userId && req.body) {
    trackFeatureUsage('favorites_added', userId).catch(() => {});
    recordBehaviorEvent(userId, {
      type: 'recommendation_favorited',
      foodId: req.body.foodId || req.body.id,
      foodName: req.body.name,
      cuisine: req.body.cuisine,
      ingredients: req.body.ingredients
    }).catch(() => {});
  }
  res.status(200).json({ success: true, message: "Favorite saved and behavioral affinity updated." });
};

exports.removeFavoriteFood = async (req, res) => {
  const userId = req.user?.uid || req.user?.id;
  const foodId = req.params?.foodId || req.body?.foodId;
  if (userId && foodId) {
    trackFeatureUsage('favorites_removed', userId).catch(() => {});
    recordBehaviorEvent(userId, {
      type: 'recommendation_unfavorited',
      foodId: foodId
    }).catch(() => {});
  }
  res.status(200).json({ success: true, message: "Favorite removed and behavioral affinity updated." });
};

// ── Phase 5: Behavioral Event Ingestion & Profile Endpoints ────────
exports.recordBehavioralEvent = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const result = await recordBehaviorEvent(userId, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getBehaviorProfile = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const profile = await getBehavioralProfile(userId);
    res.status(200).json({ success: true, behavioralProfile: profile });
  } catch (err) {
    next(err);
  }
};

exports.resetBehaviorLearning = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const result = await resetBehavioralProfile(userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// Note: extractBiomarkersAndRecommendations is now in medicalAnalysisService.js
exports.extractBiomarkersAndRecommendations = extractBiomarkersAndRecommendations;

const medicalController = require('./medicalController');

exports.uploadMedicalReport = medicalController.uploadMedicalReport;
exports.getMedicalReports    = medicalController.getMedicalReports;
exports.deleteMedicalReport = medicalController.deleteMedicalReport;

exports.getSearchHistory = async (req, res) => {
  res.status(200).json({ success: true, history: [] });
};

exports.clearSearchHistory = async (req, res) => {
  res.status(200).json({ success: true, message: 'Search history cleared' });
};

const mailService = require('../services/mailService');

exports.sendTestDailyEmail = async (req, res) => {
  try {
    const recipient = (req.body && req.body.to) || req.user?.email || 'delivered@resend.dev';
    const result = await mailService.sendTestEmail({
      to: recipient,
      subject: '🍏 FoodieBite Daily Nutrition Test Digest'
    });
    return res.status(200).json({
      success: true,
      message: `Test email generated and processed successfully! Sent to ${recipient}.`,
      id: result.id || result.messageId
    });
  } catch (err) {
    console.error('❌ sendTestDailyEmail failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to dispatch test daily email',
      code: err.code,
      advice: err.advice
    });
  }
};

/**
 * Synchronize authenticated user profile with the backend user directory and Firestore.
 * Used whenever a user signs in, registers, or changes auth state.
 */
exports.syncUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const authUser = req.user;
    const userData = {
      ...payload,
      uid: payload.uid || payload.id || authUser?.uid || authUser?.id,
      email: payload.email || authUser?.email,
      name: payload.name || payload.displayName || authUser?.name
    };

    if (!userData.email && !userData.uid) {
      return res.status(400).json({ success: false, message: 'User uid or email is required for sync' });
    }

    const { upsertUser } = require('../services/userStore');
    const synced = upsertUser(userData);

    // Also sync to Firestore if reachable
    try {
      const { getFirestoreDb } = require('../config/firebase');
      const db = getFirestoreDb();
      if (db && synced && synced.uid) {
        db.collection('users').doc(synced.uid).set(synced, { merge: true }).catch(() => {});
      }
    } catch (e) {}

    // If this is a new registration, trigger welcome email asynchronously (safe catch)
    if (payload.isNewRegistration && !synced.welcomeEmailSent && synced.email) {
      try {
        const brevoService = require('../services/brevoService');
        brevoService.sendWelcomeEmail(synced).catch(err => {
          console.warn('⚠️ [WelcomeEmail] Asynchronous registration dispatch note:', err.message);
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      message: 'User synchronized successfully with admin directory',
      user: synced
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


