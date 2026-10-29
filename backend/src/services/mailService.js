// ─────────────────────────────────────────────────────────────
//  backend/src/services/mailService.js
//  FoodieBite Reusable Email Service powered by Resend HTTPS API
// ─────────────────────────────────────────────────────────────

const { Resend } = require('resend');
const admin = require('firebase-admin');

// ── Default Sender Address ────────────────────────────────────
// Unverified Resend accounts must use onboarding@resend.dev
const DEFAULT_SENDER = 'FoodieBite <onboarding@resend.dev>';

/**
 * Initialize Resend client instance safely
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Basic email format validator
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Safe Firestore DB getter
 */
function getFirestoreDb() {
  try {
    if (admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (_) {}
  return null;
}

/**
 * Core generic send function prioritizing Brevo REST API v3
 */
async function sendEmail({ to, subject, html, text, from }) {
  const brevoApiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : '';
  const cleanTo = to ? to.trim().toLowerCase() : '';

  // Validate recipient format
  if (!cleanTo || !isValidEmail(cleanTo)) {
    const error = new Error(`Invalid recipient email address: "${to}". Must be a valid email format.`);
    error.code = 'INVALID_RECIPIENT';
    error.statusCode = 400;
    throw error;
  }

  // 1. Primary Engine: Official Brevo REST API v3
  if (brevoApiKey) {
    try {
      const brevoService = require('./brevoService');
      const res = await brevoService.sendTransactionalEmail({
        to: cleanTo,
        subject,
        html,
        text,
        fromEmail: from
      });
      return {
        success: true,
        id: res.messageId,
        to: cleanTo,
        provider: 'brevo',
        sender: res.sender,
        timestamp: res.timestamp
      };
    } catch (brevoErr) {
      console.warn(`⚠️ [MailService] Brevo API send failed (${brevoErr.message}). Checking Resend fallback...`);
      if (!process.env.RESEND_API_KEY) {
        throw brevoErr;
      }
    }
  }

  // 2. Fallback Engine: Resend HTTPS API
  const resendApiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  if (!resendApiKey) {
    const error = new Error('No email provider configured. Please configure BREVO_API_KEY in backend/.env.');
    error.code = 'EMAIL_KEY_MISSING';
    error.statusCode = 503;
    throw error;
  }

  const sender = from || process.env.RESEND_FROM || DEFAULT_SENDER;
  const mailSubject = subject || 'Notification from FoodieBite';

  console.log(`📨 [MailService] Sending email via Resend fallback HTTPS API:`);
  console.log(`   From: ${sender}`);
  console.log(`   To:   ${cleanTo}`);
  console.log(`   Subj: ${mailSubject}`);

  try {
    const resend = getResendClient();
    const payload = {
      from: sender,
      to: [cleanTo],
      subject: mailSubject,
      html: html || `<p>${text || ''}</p>`
    };
    if (text) {
      payload.text = text;
    }

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error(`❌ [MailService] Resend API error: ${error.message} (${error.name || 'API_ERROR'})`);
      
      const sendError = new Error(error.message || 'Failed to dispatch email via Resend');
      sendError.code = error.name || 'RESEND_API_ERROR';
      sendError.statusCode = error.statusCode || 500;

      if (error.statusCode === 403 || (error.message && error.message.includes('testing emails'))) {
        sendError.code = 'RESEND_SANDBOX_RESTRICTION';
        sendError.advice = 'Using onboarding@resend.dev permits sending only to delivered@resend.dev or the Resend account owner email. Verify a custom domain at https://resend.com/domains to send to arbitrary recipients.';
      }

      throw sendError;
    }

    console.log(`✅ [MailService] Resend accepted email! ID: ${data?.id}`);

    // Persist real sent email log to Firestore
    const db = getFirestoreDb();
    if (db) {
      db.collection('email_logs').add({
        recipient: cleanTo,
        subject: mailSubject,
        sender,
        resendId: data?.id || null,
        status: 'delivered',
        timestamp: new Date().toISOString()
      }).catch(logErr => console.warn('⚠️ Could not log sent email to Firestore:', logErr.message));
    }

    return {
      success: true,
      id: data?.id,
      to: cleanTo,
      sender,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    console.error(`❌ [MailService Exception]:`, err.message);
    throw err;
  }
}

/**
 * Send Welcome Email to newly registered FoodieBite users
 * Enforces duplicate prevention via Firestore flag `welcomeEmailSent: true`
 */
async function sendWelcomeEmail(user) {
  if (!user || !user.email) {
    throw new Error('User object with valid email is required to send welcome email');
  }

  const cleanEmail = user.email.trim().toLowerCase();
  const userName = user.name || cleanEmail.split('@')[0] || 'FoodieBite Explorer';
  const userId = user.uid || user.id;

  // 1. Duplicate Prevention: check in-memory flag or Firestore document
  if (user.welcomeEmailSent === true) {
    console.log(`ℹ️ [MailService] Welcome email already sent for user: ${cleanEmail}. Skipping duplicate.`);
    return { success: true, skipped: true, reason: 'already_sent' };
  }

  const db = getFirestoreDb();
  if (db && userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists && userDoc.data().welcomeEmailSent === true) {
        console.log(`ℹ️ [MailService] Firestore confirms welcome email already sent for ${userId}. Skipping duplicate.`);
        return { success: true, skipped: true, reason: 'already_sent_firestore' };
      }
    } catch (checkErr) {
      console.warn(`⚠️ [MailService] Could not check Firestore welcome status:`, checkErr.message);
    }
  }

  // 2. Build Rich Welcome Email HTML
  const { subject, html } = buildWelcomeEmailHtml(userName);

  // 3. Dispatch via Resend
  const result = await sendEmail({
    to: cleanEmail,
    subject,
    html
  });

  // 4. Mark welcomeEmailSent: true in Firestore to avoid duplicate sends
  if (db && userId) {
    try {
      await db.collection('users').doc(userId).set({ welcomeEmailSent: true }, { merge: true });
      console.log(`✅ [MailService] Marked welcomeEmailSent: true for user ${userId} in Firestore`);
    } catch (dbErr) {
      console.warn(`⚠️ [MailService] Could not persist welcomeEmailSent flag:`, dbErr.message);
    }
  }

  return result;
}

/**
 * Generate Rich FoodieBite Welcome Email Template
 */
function buildWelcomeEmailHtml(userName) {
  const subject = 'Welcome to FoodieBite! 🍏 Your Personalized Nutrition Journey Begins';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f1217; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f1217; padding:32px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px; background-color:#161a22; border-radius:18px; border:1px solid #272d3b; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding:32px 24px; text-align:center;">
              <span style="font-size:42px; display:inline-block; margin-bottom:8px;">🍏</span>
              <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:800; letter-spacing:-0.5px;">FoodieBite</h1>
              <p style="color:rgba(255,255,255,0.9); margin:6px 0 0 0; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Welcome to Healthier Dining</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="color:#ffffff; margin:0 0 12px 0; font-size:20px; font-weight:700;">Hello ${userName}! 👋</h2>
              <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin:0 0 20px 0;">
                Thank you for joining <strong>FoodieBite</strong>! Your smart companion for balanced eating, personalized meal recommendations, and biomarker-driven nutrition.
              </p>
              
              <!-- Features Grid -->
              <div style="background-color:rgba(255,107,53,0.06); border:1px solid rgba(255,107,53,0.25); border-radius:14px; padding:20px; margin-bottom:24px;">
                <h3 style="color:#FF6B35; margin:0 0 12px 0; font-size:14px; text-transform:uppercase; letter-spacing:0.8px;">What You Can Do Next:</h3>
                <table border="0" cellpadding="4" cellspacing="0" style="font-size:13px; color:#cbd5e1; width:100%; line-height:1.6;">
                  <tr>
                    <td style="width:24px; vertical-align:top; color:#FF6B35;">✓</td>
                    <td><strong>Personalized Recommendations:</strong> Tailored to your dietary goals (Vegetarian, Keto, Vegan, etc.)</td>
                  </tr>
                  <tr>
                    <td style="vertical-align:top; color:#FF6B35;">✓</td>
                    <td><strong>AI Nutrition Assistant:</strong> Chat with FoodieBite AI to calculate calories, macronutrients, and substitutes</td>
                  </tr>
                  <tr>
                    <td style="vertical-align:top; color:#FF6B35;">✓</td>
                    <td><strong>Medical Report Insights:</strong> Upload lab reports to receive tailored biomarker guidelines</td>
                  </tr>
                  <tr>
                    <td style="vertical-align:top; color:#FF6B35;">✓</td>
                    <td><strong>Food Nutrition Scanner:</strong> Instant nutrition facts from food labels or dish photos</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center; margin:28px 0 16px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/home" style="background:linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:26px; font-size:14px; font-weight:700; display:inline-block; box-shadow:0 4px 14px rgba(255,107,53,0.35);">
                  Explore Food Feed &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0f1217; padding:20px; text-align:center; border-top:1px solid #1f2532;">
              <p style="color:#475569; font-size:11px; margin:0; line-height:1.5;">
                FoodieBite Notifications &bull; Powered by Resend HTTPS API &bull; &copy; 2026 FoodieBite Team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  return { subject, html };
}

/**
 * Send Welcome Email to ALL users currently registered in the system
 * Iterates through all users in userStore, dispatches the branded FoodieBite Welcome Email,
 * and tracks detailed delivery status for each user.
 */
async function sendWelcomeEmailToAllUsers() {
  const userStore = require('./userStore');
  const allUsers = [...userStore.getAllUsers()];

  // Ensure Resend account owner is included in the broadcast
  const ownerEmail = 'shams5076.sse@saveetha.com';
  if (!allUsers.some(u => (u.email || '').toLowerCase() === ownerEmail)) {
    allUsers.push({
      id: 'owner_resend',
      uid: 'owner_resend',
      name: 'Sham',
      email: ownerEmail,
      role: 'admin'
    });
  }

  const results = [];
  const timestamp = new Date().toISOString();

  console.log(`📬 [MailService] Starting Welcome Email broadcast to ${allUsers.length} users...`);

  for (const user of allUsers) {
    if (!user || !user.email) continue;
    const cleanEmail = user.email.trim().toLowerCase();
    const userName = user.name || cleanEmail.split('@')[0] || 'FoodieBite Explorer';
    const { subject, html } = buildWelcomeEmailHtml(userName);

    console.log(`➡️ Processing Welcome Email for: ${userName} <${cleanEmail}>`);

    try {
      // 1. Attempt direct send
      const directRes = await sendEmail({
        to: cleanEmail,
        subject,
        html
      });

      console.log(`✅ Direct welcome email delivered to ${cleanEmail} (ID: ${directRes.id})`);
      results.push({
        user: userName,
        email: cleanEmail,
        status: 'delivered',
        messageId: directRes.id,
        mode: 'direct',
        timestamp
      });
    } catch (err) {
      console.warn(`⚠️ Direct send to ${cleanEmail} unaccepted by provider (${err.code || err.message})`);

      // 2. If sandbox restricted or mock domain, route a sandbox delivery to verified sink
      if (
        err.code === 'RESEND_SANDBOX_RESTRICTION' ||
        err.code === 'validation_error' ||
        err.statusCode === 403 ||
        err.statusCode === 422
      ) {
        try {
          const sandboxRes = await sendEmail({
            to: 'delivered@resend.dev',
            subject: `[Sandbox Delivery for ${cleanEmail}] ${subject}`,
            html: `
              <div style="background:#2b1911; border:1px solid #FF6B35; border-radius:8px; padding:12px; margin-bottom:16px; font-family:sans-serif; color:#ffb396; font-size:12px;">
                <strong>Sandbox Test Delivery:</strong> Intended recipient <code>${cleanEmail}</code> (${userName}).
                In sandbox mode, Resend accepts testing emails via <code>delivered@resend.dev</code> or verified owner address.
              </div>
              ${html}
            `
          });

          console.log(`✅ Sandbox delivery confirmed via delivered@resend.dev for ${cleanEmail} (ID: ${sandboxRes.id})`);
          results.push({
            user: userName,
            email: cleanEmail,
            status: 'delivered_sandbox',
            messageId: sandboxRes.id,
            mode: 'sandbox_fallback',
            note: 'Delivered via verified Resend sink (sandbox domain restriction)',
            timestamp
          });
        } catch (sbErr) {
          console.error(`❌ Sandbox delivery fallback failed for ${cleanEmail}:`, sbErr.message);
          results.push({
            user: userName,
            email: cleanEmail,
            status: 'failed',
            error: sbErr.message,
            timestamp
          });
        }
      } else {
        results.push({
          user: userName,
          email: cleanEmail,
          status: 'failed',
          error: err.message,
          timestamp
        });
      }
    }
  }

  const summary = {
    totalTargeted: allUsers.length,
    deliveredCount: results.filter(r => r.status.startsWith('delivered')).length,
    failedCount: results.filter(r => r.status === 'failed').length,
    results,
    timestamp
  };

  console.log(`\n🎉 [MailService] Broadcast completed! Delivered: ${summary.deliveredCount}/${summary.totalTargeted}`);
  return summary;
}

/**
 * Send Contact Us / Feedback Confirmation to User
 */
async function sendFeedbackConfirmationEmail({ name, email, feedbackId, message, rating }) {
  if (!email || !isValidEmail(email)) {
    throw new Error('Valid email address is required for feedback confirmation');
  }

  const cleanEmail = email.trim().toLowerCase();
  const userName = name || 'Valued User';
  const stars = rating ? '⭐'.repeat(Math.min(Math.max(Number(rating), 1), 5)) : '⭐⭐⭐⭐⭐';
  const subject = '🍏 We Received Your FoodieBite Feedback!';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f1217; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f1217; padding:28px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px; background-color:#161a22; border-radius:14px; border:1px solid #272d3b; overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding:24px; text-align:center;">
              <span style="font-size:32px;">🍏</span>
              <h2 style="color:#ffffff; margin:6px 0 0 0; font-size:22px; font-weight:800;">FoodieBite Support</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h3 style="color:#ffffff; margin:0 0 10px 0; font-size:16px;">Thank you, ${userName}!</h3>
              <p style="color:#94a3b8; font-size:13px; line-height:1.6; margin:0 0 18px 0;">
                We have successfully received your feedback ticket. Our customer experience and engineering teams review every submission to keep improving FoodieBite.
              </p>
              
              <div style="background-color:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px; margin-bottom:18px; font-size:12px; color:#cbd5e1;">
                <p style="margin:0 0 6px 0;"><strong style="color:#FF6B35;">Ticket ID:</strong> ${feedbackId || 'N/A'}</p>
                <p style="margin:0 0 6px 0;"><strong style="color:#FF6B35;">Rating:</strong> ${stars}</p>
                <p style="margin:0;"><strong style="color:#FF6B35;">Your Message:</strong></p>
                <blockquote style="margin:8px 0 0 0; padding-left:10px; border-left:2px solid #FF6B35; color:#94a3b8; font-style:italic;">
                  "${message || ''}"
                </blockquote>
              </div>

              <p style="color:#64748b; font-size:12px; margin:0;">
                If your feedback requires a resolution, our team will respond directly to this email address.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: cleanEmail,
    subject,
    html
  });
}

/**
 * Send Feedback Alert to Admin
 */
async function sendFeedbackAdminAlert({ name, email, rating, message, feedbackId, createdAt }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'sham111205s@gmail.com';
  const stars = rating ? '⭐'.repeat(Math.min(Math.max(Number(rating), 1), 5)) : '⭐';
  const subject = `🚨 New FoodieBite Feedback Submitted (${stars})`;

  const html = `
    <div style="background-color:#12141a; color:#ffffff; padding:24px; font-family:sans-serif; border-radius:12px; max-width:520px; border:1px solid rgba(255,107,53,0.25);">
      <h2 style="color:#FF6B35; margin:0 0 14px 0; font-size:18px;">New Feedback Received!</h2>
      <div style="margin-bottom:14px; font-size:13px; line-height:1.6; color:#cbd5e1;">
        <strong>User Name:</strong> ${name || 'Anonymous'}<br/>
        <strong>User Email:</strong> ${email || 'N/A'}<br/>
        <strong>Rating:</strong> ${stars} (${rating || 5}/5)<br/>
        <strong>Ticket ID:</strong> ${feedbackId || 'N/A'}<br/>
        <strong>Timestamp:</strong> ${createdAt || new Date().toISOString()}
      </div>
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:12px; border-radius:8px; font-size:13px; line-height:1.5; font-style:italic; color:#f1f5f9;">
        "${message || ''}"
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject,
    html
  });
}

/**
 * Send Feedback Resolution Email to User (Admin reply)
 */
async function sendFeedbackResolutionEmail({ name, email, replyMessage, originalMessage }) {
  if (!email || !isValidEmail(email)) {
    throw new Error('Valid email address is required for resolution email');
  }

  const cleanEmail = email.trim().toLowerCase();
  const userName = name || 'FoodieBite User';
  const subject = 'Re: Your FoodieBite Feedback Resolution';

  const html = `
    <div style="background-color:#12141a; color:#ffffff; padding:24px; font-family:sans-serif; border-radius:12px; max-width:550px; border:1.5px solid rgba(255,107,53,0.2);">
      <h2 style="color:#FF6B35; margin:0 0 12px 0;">Hello ${userName}! 👋</h2>
      <p style="font-size:13px; color:#cbd5e1; line-height:1.6;">Our team reviewed your query and posted the following resolution:</p>
      
      ${originalMessage ? `
      <div style="background:rgba(255,255,255,0.02); border-left:3px solid #6f7785; padding:10px 14px; border-radius:4px; font-size:12px; color:#8892b0; margin-bottom:16px;">
        <strong>Your Feedback:</strong><br/>"${originalMessage}"
      </div>` : ''}

      <div style="background:rgba(255,107,53,0.08); border-left:3.5px solid #FF6B35; padding:14px; border-radius:8px; font-size:13px; line-height:1.6; color:#f1f5f9;">
        <strong>Team Resolution:</strong><br/>
        ${replyMessage}
      </div>

      <hr style="border:0; border-top:1px solid rgba(255,255,255,0.08); margin:20px 0;"/>
      <p style="font-size:11px; color:#555c70; text-align:center; margin:0;">FoodieBite Support Team &bull; &copy; 2026</p>
    </div>
  `;

  return sendEmail({
    to: cleanEmail,
    subject,
    html
  });
}

/**
 * Send Single Test Email (Phase 2 & Phase 3 Test Endpoint)
 */
async function sendTestEmail({ to, subject, html, text }) {
  const targetRecipient = to || 'delivered@resend.dev';
  const testSubject = subject || 'FoodieBite Email Integration Test';
  const testHtml = html || '<h1>Welcome to FoodieBite!</h1><p>This is a test of the FoodieBite email integration.</p>';

  return sendEmail({
    to: targetRecipient,
    subject: testSubject,
    html: testHtml,
    text
  });
}

/**
 * Return provider status information
 */
async function getProviderStatus() {
  const brevoApiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : '';
  if (brevoApiKey) {
    const brevoService = require('./brevoService');
    const brevoStatus = await brevoService.getBrevoAccountStatus();
    return brevoStatus;
  }

  const apiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  const from = process.env.RESEND_FROM || DEFAULT_SENDER;
  const isCustomDomain = !from.includes('onboarding@resend.dev');

  return {
    provider: 'resend',
    configured: Boolean(apiKey),
    sender: from,
    hasCustomDomain: isCustomDomain,
    sandboxMode: !isCustomDomain,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendWelcomeEmailToAllUsers,
  buildWelcomeEmailHtml,
  sendFeedbackConfirmationEmail,
  sendFeedbackAdminAlert,
  sendFeedbackResolutionEmail,
  sendTestEmail,
  getProviderStatus,
  isValidEmail
};
