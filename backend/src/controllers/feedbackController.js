// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/feedbackController.js
//  FoodieBite User Feedback Controller (Strict Supabase PostgreSQL)
// ─────────────────────────────────────────────────────────────

'use strict';

const feedbackStore = require('../services/feedbackStore');
const mailService = require('../services/mailService');

/**
 * Submit feedback (POST /api/feedback)
 */
exports.submitFeedback = async (req, res, next) => {
  try {
    const { name, email, rating, message, category } = req.body || {};
    const userId = req.user ? (req.user.id || req.user.uid) : null;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    const feedbackDoc = {
      userId,
      uid: userId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      category: category || 'general',
      rating: Number(rating || 5),
      message: String(message).trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const saved = await feedbackStore.addFeedback(feedbackDoc);

    // 1. Send Contact Us Confirmation Email to User
    try {
      if (mailService && typeof mailService.sendFeedbackConfirmationEmail === 'function') {
        mailService.sendFeedbackConfirmationEmail({
          name: saved.name,
          email: saved.email,
          feedbackId: saved.id,
          message: saved.message,
          rating: saved.rating
        }).catch(err => {
          console.warn('⚠️ [Feedback] User confirmation email note:', err.message);
        });
      }
    } catch (_) {}

    // 2. Send Alert Notification to Admin
    try {
      if (mailService && typeof mailService.sendFeedbackAdminAlert === 'function') {
        mailService.sendFeedbackAdminAlert({
          name: saved.name,
          email: saved.email,
          rating: saved.rating,
          message: saved.message,
          feedbackId: saved.id,
          createdAt: saved.createdAt
        }).catch(err => {
          console.warn('⚠️ [Feedback] Admin alert email note:', err.message);
        });
      }
    } catch (_) {}

    return res.status(201).json({ success: true, feedback: saved });
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
    const { replyMessage, status = 'resolved', internalNotes } = req.body || {};
    const adminUser = req.user;

    const feedback = await feedbackStore.getFeedbackById(id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: `Feedback ticket ${id} not found` });
    }

    const updated = await feedbackStore.updateFeedback(id, {
      status,
      internalNotes: internalNotes !== undefined ? internalNotes : (feedback.internalNotes || null),
      reviewedBy: adminUser?.email || adminUser?.id || 'admin@foodiebite.com',
      reviewedAt: new Date().toISOString()
    });

    if (replyMessage && feedback.email) {
      try {
        if (mailService && typeof mailService.sendFeedbackResolutionEmail === 'function') {
          await mailService.sendFeedbackResolutionEmail({
            name: feedback.name,
            email: feedback.email,
            replyMessage,
            originalMessage: feedback.message
          });
        }
      } catch (emailErr) {
        console.warn('⚠️ [Feedback] Resolution email note:', emailErr.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Feedback resolved successfully in Supabase', feedback: updated });
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
    return res.status(200).json({ success: true, message: 'Feedback deleted successfully from Supabase' });
  } catch (err) {
    next(err);
  }
};
