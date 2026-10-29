const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Helper to get Firestore reference safely
function getDb() {
  try {
    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } else {
        admin.initializeApp({
          projectId: 'mock-foodiebite'
        });
      }
    }
    return admin.firestore();
  } catch (err) {
    console.error('⚠️ Failed to initialize Firestore reference in feedbackController:', err.message);
    return null;
  }
}

const feedbackStore = require('../services/feedbackStore');

/**
 * Submit feedback (POST /api/feedback)
 */
exports.submitFeedback = async (req, res, next) => {
  try {
    const { name, email, rating, message, category } = req.body;
    const uid = req.user ? req.user.uid : 'anonymous';

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    const feedbackId = `feedback-${Date.now()}`;
    const feedbackDoc = {
      id: feedbackId,
      uid,
      name,
      email: email.toLowerCase(),
      category: category || 'general',
      rating: Number(rating || 5),
      message,
      status: 'pending', // pending | reviewed | resolved
      reviewedBy: null,
      reviewedAt: null,
      internalNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await feedbackStore.addFeedback(feedbackDoc);

    // 1. Send Contact Us Confirmation Email to User
    try {
      await mailService.sendFeedbackConfirmationEmail({
        name: feedbackDoc.name,
        email: feedbackDoc.email,
        feedbackId: feedbackDoc.id,
        message: feedbackDoc.message,
        rating: feedbackDoc.rating
      });
      console.log(`✉️ [Feedback] Contact Us confirmation sent to ${feedbackDoc.email}`);
    } catch (userEmailErr) {
      console.warn('⚠️ [Feedback] User confirmation email failed (safe catch):', userEmailErr.message);
    }

    // 2. Send Alert Notification to Admin
    try {
      await mailService.sendFeedbackAdminAlert({
        name: feedbackDoc.name,
        email: feedbackDoc.email,
        rating: feedbackDoc.rating,
        message: feedbackDoc.message,
        feedbackId: feedbackDoc.id,
        createdAt: feedbackDoc.createdAt
      });
      console.log(`✉️ [Feedback] Admin alert dispatched for ticket ${feedbackDoc.id}`);
    } catch (adminEmailErr) {
      console.warn('⚠️ [Feedback] Admin alert email failed (safe catch):', adminEmailErr.message);
    }

    res.status(201).json({ success: true, feedback: feedbackDoc });
  } catch (err) {
    next(err);
  }
};

/**
 * Resolve/Reply feedback (PUT /api/feedback/:id/resolve) - Admin Only
 */
exports.resolveFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyMessage, status = 'resolved', internalNotes } = req.body;
    const adminUser = req.user;

    const feedback = await feedbackStore.getFeedbackById(id);
    const updated = await feedbackStore.updateFeedback(id, {
      status,
      replyMessage: replyMessage || feedback?.replyMessage || null,
      internalNotes: internalNotes !== undefined ? internalNotes : (feedback?.internalNotes || null),
      reviewedBy: adminUser?.email || adminUser?.id || 'admin@foodiebite.com',
      reviewedAt: new Date().toISOString()
    });

    // Send email reply to user if replyMessage is supplied and feedback was loaded
    if (feedback && replyMessage && feedback.email) {
      try {
        const mailService = require('../services/mailService');
        await mailService.sendFeedbackResolutionEmail({
          name: feedback.name,
          email: feedback.email,
          replyMessage,
          originalMessage: feedback.message
        });
        console.log(`✉️ [Feedback] Resolution reply sent to ${feedback.email}`);
      } catch (emailErr) {
        console.warn('⚠️ [Feedback] Resolution email failed (safe catch):', emailErr.message);
      }
    }

    res.status(200).json({ success: true, message: `Feedback resolved successfully`, feedback: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete feedback (DELETE /api/feedback/:id) - Admin Only
 */
exports.deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    await feedbackStore.deleteFeedback(id);
    res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (err) {
    next(err);
  }
};
