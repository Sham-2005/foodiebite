// ─────────────────────────────────────────────────────────────
//  src/routes/emailRoutes.js
//  FoodieBite Brevo Email Service & Campaign Management Routes
//  Full-featured: Verification, Campaigns, Batched Delivery, Webhooks & Unsubscribes
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const brevoService = require('../services/brevoService');
const mailService = require('../services/mailService');
const { logAdminAudit } = require('../services/activityTrackingService');

// Rate limiting on test emails and campaign initiation to prevent spam or abuse
const emailRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // max 30 email requests per 10 minutes per IP
  message: {
    success: false,
    message: 'Too many email requests. Please slow down.'
  }
});

const campaignStartLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many campaign launch requests. Please slow down.'
  }
});

/**
 * Flexible authentication guard for email administrative endpoints:
 * 1. Accepts standard Bearer tokens (Firebase ID token, JWT) via `protect`
 * 2. Checks role === 'admin'
 * 3. Accepts admin secret header `x-admin-key` or `x-api-key`
 */
const secureAdminEmailGuard = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['x-api-key'];
  const expectedKey = process.env.ADMIN_KEY || process.env.AI_API_KEY || 'foodiebite_ai_live_key_2026';

  if (adminKey && adminKey === expectedKey) {
    req.user = {
      id: 'admin_api_user',
      uid: 'admin_api_user',
      email: 'admin@foodiebite.com',
      role: 'admin'
    };
    return next();
  }

  return protect(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required to manage email campaigns.'
      });
    }
    return next();
  });
};

/**
 * GET /api/email/status & GET /api/email/verify
 * Returns current Brevo configuration, account info, and verified daily quota
 */
router.get('/status', secureAdminEmailGuard, async (req, res) => {
  try {
    const status = await brevoService.getBrevoAccountStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/verify', secureAdminEmailGuard, async (req, res) => {
  try {
    const status = await brevoService.getBrevoAccountStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/test & POST /api/email/send-test
 * Dispatches one test email via Brevo REST API
 * Body: { to?: string, subject?: string, message?: string, html?: string }
 */
const handleSendTestEmail = async (req, res) => {
  try {
    const { to, subject, message, html } = req.body || {};
    
    // Default to configured Brevo sender or authenticated admin
    const defaultRecipient = process.env.BREVO_SENDER_EMAIL || req.user?.email || 'foodiebite881@gmail.com';
    const recipient = (to && typeof to === 'string' && to.trim()) 
      ? to.trim().toLowerCase() 
      : defaultRecipient;

    if (!brevoService.isValidEmail(recipient)) {
      return res.status(400).json({
        success: false,
        message: `Invalid recipient email address: "${recipient}".`
      });
    }

    console.log(`📨 [EmailRoute] Test email requested for: ${recipient} by: ${req.user?.email || 'admin'}`);

    const result = await brevoService.sendTestEmail({
      to: recipient,
      subject: subject || 'FoodieBite Brevo Integration Test',
      html,
      text: message
    });

    // Audit log admin action
    logAdminAudit({
      adminId: req.user?.id || 'admin',
      adminEmail: req.user?.email || 'admin@foodiebite.com',
      action: 'BREVO_TEST_EMAIL_SENT',
      target: recipient,
      details: { subject: result.subject, messageId: result.messageId }
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Test email accepted by Brevo API for ${recipient}!`,
      details: {
        id: result.messageId,
        messageId: result.messageId,
        to: result.recipient,
        sender: result.sender,
        timestamp: result.timestamp
      }
    });

  } catch (err) {
    console.error('❌ [EmailRoute Error] Test email failed:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to send test email',
      code: err.code || 'BREVO_ERROR',
      details: err.details
    });
  }
};

router.post('/test', emailRateLimiter, secureAdminEmailGuard, handleSendTestEmail);
router.post('/send-test', emailRateLimiter, secureAdminEmailGuard, handleSendTestEmail);

/**
 * POST /api/email/recipients/evaluate
 * Calculates real-time recipient counts and segmentation preview
 * Body: { recipientType, filterCriteria, selectedEmails }
 */
router.post('/recipients/evaluate', secureAdminEmailGuard, async (req, res) => {
  try {
    const { recipientType, filterCriteria, selectedEmails } = req.body || {};
    const evaluation = await brevoService.getEligibleRecipients({
      recipientType: recipientType || 'all',
      filterCriteria: filterCriteria || {},
      selectedEmails: selectedEmails || []
    });

    return res.status(200).json({
      success: true,
      totalEvaluated: evaluation.totalEvaluated,
      eligibleCount: evaluation.eligibleCount,
      excludedCount: evaluation.excludedCount,
      eligibleRecipients: evaluation.eligibleRecipients.map(r => ({ email: r.email, name: r.name, dietType: r.dietType })),
      excludedRecipients: evaluation.excludedRecipients
    });
  } catch (err) {
    console.error('❌ /api/email/recipients/evaluate error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/email/campaigns
 * Retrieves campaign history and delivery statistics
 */
router.get('/campaigns', secureAdminEmailGuard, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const history = await brevoService.getCampaignHistory({ limit, offset });
    return res.status(200).json(history);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/email/campaigns/welcome/existing-user-draft
 * Retrieves or pre-seeds the dedicated Welcome Email Campaign for existing users as a draft
 */
router.get('/campaigns/welcome/existing-user-draft', secureAdminEmailGuard, async (req, res) => {
  try {
    const draft = await brevoService.getOrCreateExistingUserWelcomeCampaignDraft();
    return res.status(200).json({ success: true, campaign: draft });
  } catch (err) {
    console.error('❌ Error getting existing user welcome draft:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/email/campaigns/:id
 * Retrieves status and recipient audit of a specific campaign
 */
router.get('/campaigns/:id', secureAdminEmailGuard, async (req, res) => {
  try {
    const status = await brevoService.getCampaignStatus(req.params.id);
    return res.status(200).json(status);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message });
  }
});


/**
 * POST /api/email/campaigns
 * Creates a new email campaign draft
 */
router.post('/campaigns', secureAdminEmailGuard, async (req, res) => {
  try {
    const {
      campaignName,
      subject,
      senderName,
      htmlContent,
      textContent,
      recipientType,
      filterCriteria,
      selectedEmails
    } = req.body || {};

    if (!campaignName || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Campaign name, subject, and email content are required.'
      });
    }

    const campaign = await brevoService.createCampaign({
      campaignName,
      subject,
      senderName,
      htmlContent,
      textContent,
      recipientType: recipientType || 'all',
      filterCriteria,
      selectedEmails,
      createdBy: req.user?.email || 'admin'
    });

    logAdminAudit({
      adminId: req.user?.id || 'admin',
      adminEmail: req.user?.email || 'admin@foodiebite.com',
      action: 'BREVO_CAMPAIGN_CREATED',
      target: campaign.campaignId,
      details: { campaignName: campaign.campaignName, recipientCount: campaign.recipientCount }
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Campaign "${campaign.campaignName}" created successfully.`,
      campaign
    });

  } catch (err) {
    console.error('❌ Create campaign error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/campaigns/:id/start
 * Launches batch delivery for a campaign after explicit confirmation
 */
router.post('/campaigns/:id/start', campaignStartLimiter, secureAdminEmailGuard, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const result = await brevoService.startCampaign(campaignId);

    logAdminAudit({
      adminId: req.user?.id || 'admin',
      adminEmail: req.user?.email || 'admin@foodiebite.com',
      action: 'BREVO_CAMPAIGN_LAUNCHED',
      target: campaignId,
      details: { recipientCount: result.recipientCount }
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Start campaign error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message,
      code: err.code
    });
  }
});

/**
 * POST /api/email/campaigns/:id/retry
 * Retries eligible transient failed recipients for a campaign
 */
router.post('/campaigns/:id/retry', campaignStartLimiter, secureAdminEmailGuard, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const result = await brevoService.retryFailedCampaignRecipients(campaignId);

    logAdminAudit({
      adminId: req.user?.id || 'admin',
      adminEmail: req.user?.email || 'admin@foodiebite.com',
      action: 'BREVO_CAMPAIGN_RETRIED',
      target: campaignId,
      details: { result }
    }).catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Retry campaign error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message });
  }
});


/**
 * POST /api/email/welcome
 * Automated welcome email to authenticated user (idempotent)
 */
router.post('/welcome', emailRateLimiter, protect, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: 'Authenticated user email required for welcome email'
      });
    }

    const result = await brevoService.sendWelcomeEmail(user);
    if (result.skipped) {
      return res.status(200).json({
        success: true,
        message: 'Welcome email was already dispatched previously (duplicate prevented).',
        skipped: true
      });
    }

    return res.status(200).json({
      success: true,
      message: `Welcome email sent successfully to ${user.email}`,
      id: result.messageId
    });

  } catch (err) {
    console.error('❌ /api/email/welcome error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to dispatch welcome email',
      code: err.code || 'EMAIL_SEND_FAILED'
    });
  }
});

/**
 * POST /api/email/welcome-all
 * Broadcasts welcome emails to all users currently in the system
 */
router.post('/welcome-all', secureAdminEmailGuard, async (req, res) => {
  try {
    const summary = await mailService.sendWelcomeEmailToAllUsers();
    return res.status(200).json({
      success: true,
      message: `Welcome emails processed for ${summary.totalTargeted} users (${summary.deliveredCount} delivered)`,
      data: summary
    });
  } catch (err) {
    console.error('❌ /api/email/welcome-all error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Failed to dispatch welcome emails to all users',
      code: err.code || 'EMAIL_BROADCAST_FAILED'
    });
  }
});

/**
 * POST /api/email/webhook & POST /api/brevo/webhook
 * Handles official Brevo delivery event webhooks (sent, delivered, opened, bounced, etc.)
 */
const handleBrevoWebhook = async (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'] || req.headers['x-brevo-secret'] || req.query.secret;
    const payload = req.body || {};

    const result = await brevoService.processDeliveryWebhook(payload, secret);
    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Brevo Webhook Error:', err.message);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message });
  }
};

router.post('/webhook', handleBrevoWebhook);
router.post('/brevo/webhook', handleBrevoWebhook);

/**
 * GET & POST /api/email/unsubscribe
 * Public one-click unsubscribe endpoint with cryptographic HMAC token validation
 */
const handleUnsubscribe = async (req, res) => {
  const email = (req.query.email || req.body?.email || '').trim().toLowerCase();
  const token = req.query.token || req.body?.token || '';
  const campaignId = req.query.cid || req.body?.campaignId || null;

  if (!email || !brevoService.isValidEmail(email)) {
    return res.status(400).send(`
      <!DOCTYPE html><html><body style="font-family:sans-serif; background:#0f1217; color:#fff; text-align:center; padding:50px;">
        <h2 style="color:#EF4444;">Invalid Request</h2>
        <p style="color:#94a3b8;">Missing or malformed email address.</p>
      </body></html>
    `);
  }

  // Verify HMAC signature
  if (!brevoService.verifyUnsubscribeToken(email, token)) {
    return res.status(403).send(`
      <!DOCTYPE html><html><body style="font-family:sans-serif; background:#0f1217; color:#fff; text-align:center; padding:50px;">
        <h2 style="color:#EF4444;">Invalid Security Token</h2>
        <p style="color:#94a3b8;">The unsubscribe link is invalid or has expired.</p>
      </body></html>
    `);
  }

  try {
    await brevoService.unsubscribeUser({ email, token, campaignId, reason: 'one_click_link' });

    if (req.method === 'POST') {
      return res.status(200).json({
        success: true,
        message: `${email} has been unsubscribed from promotional FoodieBite emails.`
      });
    }

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Unsubscribed &bull; FoodieBite</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f1217; color: #ffffff; margin: 0; padding: 40px 16px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #161a22; border: 1px solid #272d3b; border-radius: 16px; padding: 32px 24px; text-align: center;">
          <span style="font-size: 42px; display: block; margin-bottom: 12px;">🍏</span>
          <h2 style="color: #ffffff; margin: 0 0 10px 0; font-size: 22px;">You've Been Unsubscribed</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            The email address <strong style="color: #FF6B35;">${email}</strong> has been successfully removed from our promotional announcements and newsletter list.
          </p>
          <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; margin-bottom: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
            You will continue to receive essential account security notifications and password resets if requested.
          </div>
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/home" style="display: inline-block; background: #FF6B35; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-size: 13px; font-weight: 700;">
            Return to FoodieBite
          </a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`
      <!DOCTYPE html><html><body style="font-family:sans-serif; background:#0f1217; color:#fff; text-align:center; padding:50px;">
        <h2 style="color:#EF4444;">Unsubscribe Error</h2>
        <p style="color:#94a3b8;">${err.message}</p>
      </body></html>
    `);
  }
};

// ─────────────────────────────────────────────────────────────
//  DAILY PERSONALIZED FOOD RECOMMENDATIONS AUTOMATION ENDPOINTS
// ─────────────────────────────────────────────────────────────

const scheduler = require('../services/scheduler');
const dailyRecommendationService = require('../services/dailyRecommendationService');

/**
 * GET /api/email/daily-recommendations/status
 * Returns current schedule, timezone, next execution, eligible recipient count, and recent runs
 */
router.get('/daily-recommendations/status', secureAdminEmailGuard, async (req, res) => {
  try {
    const status = await scheduler.getStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/daily-recommendations/config
 * Updates the cron pattern, enabled/disabled state, and timezone for daily recommendation scheduler
 */
router.post('/daily-recommendations/config', secureAdminEmailGuard, async (req, res) => {
  try {
    const { cron: newCron, enabled, timezone } = req.body;
    const updated = await scheduler.updateSchedule({ cron: newCron, enabled, timezone });
    return res.status(200).json({
      success: true,
      message: 'Daily recommendation schedule configuration updated successfully.',
      ...updated
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/daily-recommendations/trigger
 * Manually trigger the daily recommendation email job (controlled test run)
 */
router.post('/daily-recommendations/trigger', campaignStartLimiter, secureAdminEmailGuard, async (req, res) => {
  try {
    const force = Boolean(req.body && req.body.force);
    const result = await scheduler.triggerManualRun(force);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/daily-recommendations/test
 * Send a test daily recommendation email to an administrator or specified address
 */
router.post('/daily-recommendations/test', emailRateLimiter, secureAdminEmailGuard, async (req, res) => {
  try {
    const recipient = req.body.to || req.user?.email || 'delivered@resend.dev';
    const result = await dailyRecommendationService.sendTestDailyRecommendationEmail(recipient, req.body);
    return res.status(200).json({
      success: true,
      message: `Test recommendation email sent successfully to ${recipient}`,
      ...result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/email/daily-recommendations/retry
 * Retries failed or queued recipients for a daily run
 */
router.post('/daily-recommendations/retry', secureAdminEmailGuard, async (req, res) => {
  try {
    const runId = req.body.runId;
    const result = await scheduler.retryFailed(runId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/email/daily-recommendations/preview
 * Previews sample daily recommendation email content without sending
 */
router.get('/daily-recommendations/preview', secureAdminEmailGuard, async (req, res) => {
  try {
    const sampleUser = {
      id: 'preview_user',
      name: req.query.name || 'FoodieBite Explorer',
      email: req.query.email || 'preview@foodiebite.com',
      dietType: req.query.dietType || 'Vegetarian',
      spiceLevel: req.query.spiceLevel || 'Medium',
      healthGoals: req.query.healthGoals ? req.query.healthGoals.split(',') : ['healthy_eating'],
      allergies: req.query.allergies ? req.query.allergies.split(',') : []
    };
    const recData = dailyRecommendationService.buildDailyRecommendationForUser(sampleUser);
    return res.status(200).json({ success: true, ...recData });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/unsubscribe', handleUnsubscribe);
router.post('/unsubscribe', handleUnsubscribe);

module.exports = router;
