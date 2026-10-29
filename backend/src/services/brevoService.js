// ─────────────────────────────────────────────────────────────
//  backend/src/services/brevoService.js
//  FoodieBite Brevo Email Service (Transactional & Campaign Engine)
//  Uses Official Brevo REST API v3 (POST https://api.brevo.com/v3/smtp/email)
// ─────────────────────────────────────────────────────────────

const https = require('https');
const crypto = require('crypto');
const { getFirestoreDb } = require('../config/firebase');
const userStore = require('./userStore');

// ── Configuration Constants ──────────────────────────────────
const BREVO_API_HOST = 'api.brevo.com';
const DEFAULT_SENDER_NAME = 'FoodieBite';
const DEFAULT_SENDER_EMAIL = 'foodiebite881@gmail.com';
const DEFAULT_DAILY_QUOTA = 300; // Brevo free tier limit
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY_MS = 300;

// In-memory campaign locks to guarantee idempotency and prevent duplicate executions
const activeCampaignLocks = new Set();
const memoryUnsubscribes = new Set();
const memoryCampaigns = new Map();
const memoryCampaignRecipients = new Map();
const memoryEvents = new Set();

// In-memory quota cache with 60-second TTL
let quotaCache = null;
let quotaCacheExpiresAt = 0;

/**
 * Basic email format validator
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize header values against CRLF injection
 */
function sanitizeHeader(val) {
  if (!val) return '';
  return String(val).replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * Sanitize HTML email content against dangerous script tags and execution vectors
 */
function sanitizeEmailHtml(html) {
  if (!html) return '';
  let clean = String(html);
  // Remove script tags and embedded JavaScript
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/javascript:[^"']*/gi, '#');
  clean = clean.replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  return clean;
}

/**
 * Safely escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wrapper to prevent Firestore calls from hanging indefinitely when offline/uncertified
 */
function safeFirestore(promise, timeoutMs = 600) {
  if (!promise) return Promise.resolve(null);
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs))
  ]);
}

/**
 * Extract personalized first name with verified profile name or fallback to 'FoodieBite User'
 */
function extractFirstName(name, email) {
  if (!name || typeof name !== 'string') return 'FoodieBite User';
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed.includes('@') ||
    trimmed.toLowerCase() === 'user' ||
    trimmed.toLowerCase() === 'foodiebite user' ||
    trimmed.toLowerCase() === 'foodiebite explorer' ||
    /^\d+$/.test(trimmed)
  ) {
    return 'FoodieBite User';
  }
  const parts = trimmed.split(/\s+/);
  const first = parts[0].trim();
  if (!first || first.length < 2 || /^\d+$/.test(first) || first.toLowerCase() === 'user') return 'FoodieBite User';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}


/**
 * Generate HMAC token for one-click unsubscribe links
 */
function generateUnsubscribeToken(email) {
  const secret = process.env.JWT_SECRET || 'foodiebite_unsubscribe_secret_2026';
  return crypto.createHmac('sha256', secret).update(String(email).trim().toLowerCase()).digest('hex');
}

/**
 * Verify HMAC token for unsubscribe link
 */
function verifyUnsubscribeToken(email, token) {
  if (!email || !token) return false;
  const expected = generateUnsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) {
    return false;
  }
}

/**
 * Get Brevo API Key safely from environment
 */
function getBrevoApiKey() {
  const key = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : '';
  return key;
}

/**
 * Low-level HTTP client for Brevo REST API v3
 */
function callBrevoApi({ path, method = 'GET', body = null }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    const err = new Error('BREVO_API_KEY is not configured in backend/.env.');
    err.code = 'BREVO_KEY_MISSING';
    err.statusCode = 503;
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BREVO_API_HOST,
      path: path.startsWith('/') ? path : `/${path}`,
      method: method.toUpperCase(),
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = rawData ? JSON.parse(rawData) : {};
        } catch (_) {
          parsed = { raw: rawData };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: parsed });
        } else {
          const errMsg = parsed?.message || parsed?.error || `Brevo API error (Status ${res.statusCode})`;
          const err = new Error(errMsg);
          err.statusCode = res.statusCode;
          err.code = parsed?.code || `BREVO_HTTP_${res.statusCode}`;
          err.details = parsed;
          reject(err);
        }
      });
    });

    req.on('error', (netErr) => {
      const err = new Error(`Network failure connecting to Brevo API: ${netErr.message}`);
      err.code = 'BREVO_NETWORK_ERROR';
      err.statusCode = 502;
      reject(err);
    });

    // Timeout handling
    req.setTimeout(15000, () => {
      req.destroy();
      const err = new Error('Brevo API request timed out after 15 seconds.');
      err.code = 'BREVO_TIMEOUT';
      err.statusCode = 504;
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Fetch Brevo Account details, sender statuses, and remaining daily quota
 */
async function getBrevoAccountStatus() {
  const now = Date.now();
  if (quotaCache && now < quotaCacheExpiresAt) {
    return quotaCache;
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME;

  try {
    const [accountRes, sendersRes] = await Promise.all([
      callBrevoApi({ path: '/v3/account', method: 'GET' }),
      callBrevoApi({ path: '/v3/senders', method: 'GET' }).catch(() => ({ data: { senders: [] } }))
    ]);

    const account = accountRes.data || {};
    const senders = sendersRes?.data?.senders || [];

    // Find daily quota in plans
    let dailyCredits = DEFAULT_DAILY_QUOTA;
    let planType = 'free';
    if (Array.isArray(account.plan)) {
      const activePlan = account.plan.find(p => p.creditsType === 'sendLimit' || p.credits !== undefined) || account.plan[0];
      if (activePlan) {
        dailyCredits = typeof activePlan.credits === 'number' ? activePlan.credits : DEFAULT_DAILY_QUOTA;
        planType = activePlan.type || 'free';
      }
    }

    // Verify configured sender
    const matchedSender = senders.find(s => (s.email || '').toLowerCase() === senderEmail.toLowerCase());
    const isSenderVerified = Boolean(matchedSender && matchedSender.active);

    const result = {
      provider: 'brevo',
      configured: true,
      accountEmail: account.email || 'N/A',
      companyName: account.companyName || 'FoodieBite',
      planType,
      dailyQuotaLimit: parseInt(process.env.BREVO_DAILY_QUOTA_LIMIT, 10) || DEFAULT_DAILY_QUOTA,
      creditsRemainingToday: dailyCredits,
      sender: {
        name: senderName,
        email: senderEmail,
        active: isSenderVerified,
        id: matchedSender?.id || null
      },
      sendersList: senders.map(s => ({ id: s.id, name: s.name, email: s.email, active: s.active })),
      timestamp: new Date().toISOString()
    };

    quotaCache = result;
    quotaCacheExpiresAt = now + 60000; // cache for 60s
    return result;

  } catch (err) {
    return {
      provider: 'brevo',
      configured: Boolean(getBrevoApiKey()),
      error: err.message,
      code: err.code || 'BREVO_STATUS_ERROR',
      accountEmail: 'N/A',
      planType: 'unknown',
      dailyQuotaLimit: parseInt(process.env.BREVO_DAILY_QUOTA_LIMIT, 10) || DEFAULT_DAILY_QUOTA,
      creditsRemainingToday: parseInt(process.env.BREVO_DAILY_QUOTA_LIMIT, 10) || DEFAULT_DAILY_QUOTA,
      sender: {
        name: senderName,
        email: senderEmail,
        active: false
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Send Transactional Email via Brevo API
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 */
async function sendTransactionalEmail({
  to,
  toName = '',
  subject,
  html,
  text = '',
  fromName,
  fromEmail,
  tags = [],
  headers = {},
  campaignId = null
}) {
  if (!to || !isValidEmail(to)) {
    const err = new Error(`Invalid recipient email address: "${to}".`);
    err.code = 'INVALID_RECIPIENT';
    err.statusCode = 400;
    throw err;
  }

  const cleanTo = to.trim().toLowerCase();
  const cleanSubject = sanitizeHeader(subject || 'Notification from FoodieBite');
  const cleanFromName = sanitizeHeader(fromName || process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME);
  const cleanFromEmail = (fromEmail || process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL).trim().toLowerCase();

  const sanitizedHtml = sanitizeEmailHtml(html || `<p>${text || ''}</p>`);

  const payload = {
    sender: {
      name: cleanFromName,
      email: cleanFromEmail
    },
    to: [
      {
        email: cleanTo,
        name: sanitizeHeader(toName || cleanTo.split('@')[0])
      }
    ],
    subject: cleanSubject,
    htmlContent: sanitizedHtml
  };

  if (text) {
    payload.textContent = String(text);
  }

  if (Array.isArray(tags) && tags.length > 0) {
    payload.tags = tags.map(t => sanitizeHeader(t).substring(0, 50));
  }

  if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) {
    payload.headers = {};
    for (const [k, v] of Object.entries(headers)) {
      payload.headers[sanitizeHeader(k)] = sanitizeHeader(v);
    }
  }

  console.log(`📨 [BrevoService] Dispatching email to: ${cleanTo} | Subject: "${cleanSubject}"`);

  const response = await callBrevoApi({
    path: '/v3/smtp/email',
    method: 'POST',
    body: payload
  });

  const messageId = response?.data?.messageId || `msg_${Date.now()}`;
  console.log(`✅ [BrevoService] Brevo accepted message! MessageId: ${messageId}`);

  // Invalidate quota cache after send
  quotaCache = null;

  return {
    success: true,
    messageId,
    recipient: cleanTo,
    sender: `${cleanFromName} <${cleanFromEmail}>`,
    subject: cleanSubject,
    timestamp: new Date().toISOString()
  };
}

/**
 * Send Single Test Email
 */
async function sendTestEmail({ to, subject, html, text }) {
  const targetRecipient = to || 'foodiebite881@gmail.com';
  const testSubject = subject || 'FoodieBite Brevo Integration Test';
  
  const testHtml = html || `
    <div style="font-family: sans-serif; background-color: #0f1217; color: #ffffff; padding: 24px; border-radius: 12px; max-width: 500px; border: 1px solid #272d3b;">
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="font-size: 32px;">🍏</span>
        <h2 style="color: #FF6B35; margin: 8px 0 0 0;">FoodieBite Email Test</h2>
      </div>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
        This test email confirms that your <strong>Brevo API</strong> integration is working correctly.
      </p>
      <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px; font-size: 12px; color: #94a3b8; margin: 16px 0;">
        <p style="margin: 0 0 4px 0;"><strong style="color: #FF6B35;">Provider:</strong> Brevo REST API v3</p>
        <p style="margin: 0 0 4px 0;"><strong style="color: #FF6B35;">Endpoint:</strong> /v3/smtp/email</p>
        <p style="margin: 0;"><strong style="color: #FF6B35;">Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">
        FoodieBite &bull; Secure Email Service
      </p>
    </div>
  `;

  return sendTransactionalEmail({
    to: targetRecipient,
    subject: testSubject,
    html: testHtml,
    text: text || 'FoodieBite Brevo Integration Test',
    tags: ['test', 'admin_test']
  });
}

/**
 * Check if user is unsubscribed from marketing emails
 */
async function isUserUnsubscribed(email) {
  if (!email || !isValidEmail(email)) return true;
  const cleanEmail = email.trim().toLowerCase();

  if (memoryUnsubscribes.has(cleanEmail)) {
    return true;
  }

  const db = getFirestoreDb();
  if (!db) {
    return false;
  }

  try {
    const timeout = new Promise(resolve => setTimeout(() => resolve({ __timedOut: true }), 400));
    const unsubDoc = await Promise.race([
      db.collection('email_unsubscribes').doc(cleanEmail).get(),
      timeout
    ]);
    if (unsubDoc && !unsubDoc.__timedOut && unsubDoc.exists) {
      memoryUnsubscribes.add(cleanEmail);
      return true;
    }

    const snap = await Promise.race([
      db.collection('users').where('email', '==', cleanEmail).limit(1).get(),
      timeout
    ]);
    if (snap && !snap.__timedOut && !snap.empty) {
      const uData = snap.docs[0].data();
      if (uData.marketingEmails === false || uData.emailPreferences?.promotional === false || uData.unsubscribed === true) {
        memoryUnsubscribes.add(cleanEmail);
        return true;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [BrevoService] Could not check unsubscribe status for ${cleanEmail}:`, err.message);
  }

  return false;
}

/**
 * Unsubscribe user from promotional emails
 */
async function unsubscribeUser({ email, token, campaignId = null, reason = 'user_request' }) {
  if (!email || !isValidEmail(email)) {
    const err = new Error('Valid email address required to unsubscribe.');
    err.statusCode = 400;
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();

  // Validate token if provided
  if (token && !verifyUnsubscribeToken(cleanEmail, token)) {
    const err = new Error('Invalid or expired unsubscribe token.');
    err.statusCode = 403;
    throw err;
  }

  // Record in-memory for immediate enforcement
  memoryUnsubscribes.add(cleanEmail);

  const db = getFirestoreDb();
  const unsubRecord = {
    email: cleanEmail,
    unsubscribedAt: new Date().toISOString(),
    campaignId: campaignId || null,
    reason: reason || 'one_click_unsubscribe',
    source: 'brevo_unsubscribe_handler'
  };

  if (db) {
    try {
      await db.collection('email_unsubscribes').doc(cleanEmail).set(unsubRecord, { merge: true });
      const userSnap = await db.collection('users').where('email', '==', cleanEmail).get();
      userSnap.forEach(doc => {
        doc.ref.set({
          unsubscribed: true,
          marketingEmails: false,
          'emailPreferences.promotional': false,
          unsubscribedAt: unsubRecord.unsubscribedAt
        }, { merge: true }).catch(() => {});
      });
    } catch (dbErr) {
      console.warn('⚠️ [BrevoService] Firestore unsubscribe write warning:', dbErr.message);
    }
  }

  console.log(`🚫 [BrevoService] User ${cleanEmail} unsubscribed from marketing emails.`);
  return { success: true, email: cleanEmail, unsubscribedAt: unsubRecord.unsubscribedAt };
}

/**
 * Query eligible recipients based on segmentation criteria, consent, and campaign idempotency
 */
async function getEligibleRecipients({ recipientType = 'all', filterCriteria = {}, selectedEmails = [], campaignId = null }) {
  const allUsers = [...userStore.getAllUsers()];
  const db = getFirestoreDb();

  if (db) {
    try {
      const snap = await safeFirestore(db.collection('users').get(), 400);
      if (snap) {
        snap.forEach(doc => {
          const d = doc.data();
          if (d.email && !allUsers.some(u => (u.email || '').toLowerCase() === d.email.toLowerCase())) {
            allUsers.push({
              id: doc.id,
              uid: doc.id,
              name: d.name || d.email.split('@')[0],
              email: d.email,
              dietType: d.dietType || d.preferences?.dietType || 'Vegetarian',
              spiceLevel: d.spiceLevel || d.preferences?.spiceLevel || 'Medium',
              healthGoals: d.healthGoals || d.preferences?.healthGoals || [],
              disabled: !!d.disabled,
              marketingEmails: d.marketingEmails !== false && d.emailPreferences?.promotional !== false && !d.unsubscribed
            });
          }
        });
      }
    } catch (_) {}
  }

  const unsubscribedSet = new Set();
  memoryUnsubscribes.forEach(e => unsubscribedSet.add(e.toLowerCase()));

  if (db) {
    try {
      const unsubSnap = await safeFirestore(db.collection('email_unsubscribes').get(), 400);
      if (unsubSnap) {
        unsubSnap.forEach(doc => unsubscribedSet.add(doc.id.toLowerCase()));
      }
    } catch (_) {}
  }

  // Populate already-sent set for campaign idempotency
  const alreadySentSet = new Set();
  if (campaignId) {
    for (const [key, r] of memoryCampaignRecipients.entries()) {
      if (r.campaignId === campaignId && (r.deliveryStatus === 'submitted' || r.deliveryStatus === 'delivered')) {
        if (r.email) alreadySentSet.add(r.email.toLowerCase().trim());
      }
    }
    if (db) {
      try {
        const sentSnap = await safeFirestore(
          db.collection('emailCampaignRecipients')
            .where('campaignId', '==', campaignId)
            .where('deliveryStatus', 'in', ['submitted', 'delivered'])
            .get(),
          400
        );
        if (sentSnap) {
          sentSnap.forEach(d => {
            const rec = d.data();
            if (rec.email) alreadySentSet.add(rec.email.toLowerCase().trim());
          });
        }
      } catch (_) {}
    }
  }

  const excludedList = [];
  const userMap = new Map();

  for (const u of allUsers) {
    if (!u.email || !isValidEmail(u.email)) {
      excludedList.push({ email: u.email || 'unknown', reason: 'invalid_email' });
      continue;
    }
    const cleanEmail = u.email.trim().toLowerCase();
    if (!userMap.has(cleanEmail)) {
      userMap.set(cleanEmail, u);
    }
  }

  // Ensure any specifically selected emails are evaluated
  if (recipientType === 'selected' && Array.isArray(selectedEmails)) {
    for (const sEmail of selectedEmails) {
      const raw = String(sEmail || '').trim();
      if (!raw || !isValidEmail(raw)) {
        excludedList.push({ email: raw || 'invalid', reason: 'invalid_email' });
        continue;
      }
      const cleanS = raw.toLowerCase();
      if (!userMap.has(cleanS)) {
        userMap.set(cleanS, {
          id: `sel_${cleanS}`,
          email: cleanS,
          name: cleanS.split('@')[0],
          dietType: 'Standard',
          disabled: false,
          marketingEmails: true
        });
      }
    }
  }

  const eligibleList = [];

  for (const [cleanEmail, user] of userMap.entries()) {
    if (user.disabled === true || user.accountStatus === 'disabled') {
      excludedList.push({ email: cleanEmail, reason: 'account_disabled' });
      continue;
    }

    if (alreadySentSet.has(cleanEmail)) {
      excludedList.push({ email: cleanEmail, reason: 'already_sent' });
      continue;
    }

    if (unsubscribedSet.has(cleanEmail) || user.unsubscribed === true || user.marketingEmails === false) {
      excludedList.push({ email: cleanEmail, reason: 'unsubscribed' });
      continue;
    }

    if (recipientType === 'selected') {
      const selectedSet = new Set((selectedEmails || []).map(e => String(e).toLowerCase().trim()));
      if (!selectedSet.has(cleanEmail)) {
        continue;
      }
    } else if (recipientType === 'dietType') {
      const targetDiet = String(filterCriteria?.dietType || '').toLowerCase();
      const userDiet = String(user.dietType || user.preferences?.dietType || '').toLowerCase();
      if (!userDiet.includes(targetDiet)) {
        continue;
      }
    } else if (recipientType === 'spiceLevel') {
      const targetSpice = String(filterCriteria?.spiceLevel || '').toLowerCase();
      const userSpice = String(user.spiceLevel || user.preferences?.spiceLevel || '').toLowerCase();
      if (!userSpice.includes(targetSpice)) {
        continue;
      }
    } else if (recipientType === 'healthGoals') {
      const targetGoal = String(filterCriteria?.healthGoal || '').toLowerCase();
      const userGoals = (user.healthGoals || user.preferences?.healthGoals || []).map(g => String(g).toLowerCase());
      if (!userGoals.some(g => g.includes(targetGoal))) {
        continue;
      }
    }

    eligibleList.push({
      email: cleanEmail,
      name: user.name || cleanEmail.split('@')[0] || 'FoodieBite Explorer',
      id: user.id || user.uid || cleanEmail,
      dietType: user.dietType || 'Vegetarian'
    });
  }

  const unsubscribedCount = excludedList.filter(e => e.reason === 'unsubscribed' || e.reason === 'unsubscribed_or_no_consent').length;
  const invalidEmailCount = excludedList.filter(e => e.reason === 'invalid_email').length;
  const alreadySentCount = excludedList.filter(e => e.reason === 'already_sent').length;

  return {
    totalEvaluated: userMap.size + invalidEmailCount,
    eligibleCount: eligibleList.length,
    excludedCount: excludedList.length,
    unsubscribedCount,
    invalidEmailCount,
    alreadySentCount,
    eligibleRecipients: eligibleList,
    excludedRecipients: excludedList
  };
}

/**
 * Build rich HTML email wrapper with mandatory List-Unsubscribe footer
 */
function buildCampaignEmailHtml({ htmlContent, recipientEmail, recipientName, campaignId, subject }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const token = generateUnsubscribeToken(recipientEmail);
  const unsubscribeUrl = `${clientUrl}/api/email/unsubscribe?email=${encodeURIComponent(recipientEmail)}&token=${token}&cid=${campaignId || ''}`;
  const firstName = extractFirstName(recipientName, recipientEmail);

  // Safely interpolate {{firstName}}, {{name}}, {{email}}
  let processedHtml = (htmlContent || '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, escapeHtml(firstName))
    .replace(/\{\{\s*name\s*\}\}/gi, escapeHtml(recipientName || firstName))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(recipientEmail));

  // If content already contains a greeting like "Hello ...", avoid prepending a duplicate greeting
  const hasGreeting = /hello\s+/i.test(processedHtml) || /hi\s+/i.test(processedHtml) || /dear\s+/i.test(processedHtml);
  const greetingHeader = hasGreeting ? '' : `
    <div style="margin-bottom: 16px;">
      <span style="color: #94a3b8; font-size: 13px;">Hello ${escapeHtml(firstName)},</span>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizeHeader(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f1217; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f1217; padding: 28px 14px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #161a22; border-radius: 16px; border: 1px solid #272d3b; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding: 24px; text-align: center;">
              <span style="font-size: 36px; display: inline-block;">🍏</span>
              <h1 style="color: #ffffff; margin: 4px 0 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">FoodieBite</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Personalized Nutrition & Dining</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 24px; color: #cbd5e1; font-size: 14px; line-height: 1.65;">
              ${greetingHeader}
              ${sanitizeEmailHtml(processedHtml)}
            </td>
          </tr>
          <!-- Unsubscribe & Compliance Footer -->
          <tr>
            <td style="background-color: #0f1217; padding: 20px 24px; text-align: center; border-top: 1px solid #1f2532;">
              <p style="color: #64748b; font-size: 11px; margin: 0 0 8px 0; line-height: 1.5;">
                You received this email because you are a registered user of <strong>FoodieBite</strong>.
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 0; line-height: 1.5;">
                <a href="${unsubscribeUrl}" style="color: #FF6B35; text-decoration: underline;">Unsubscribe from marketing emails</a>
                &bull; <a href="${clientUrl}/privacy" style="color: #94a3b8; text-decoration: none;">Privacy Policy</a>
                &bull; &copy; 2026 FoodieBite Team
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
}

/**
 * Create a new Email Campaign draft or scheduled campaign in Firestore
 */
async function createCampaign({
  campaignId: customCampaignId,
  campaignName,
  subject,
  senderName = DEFAULT_SENDER_NAME,
  htmlContent,
  textContent = '',
  recipientType = 'all',
  filterCriteria = {},
  selectedEmails = [],
  createdBy = 'admin'
}) {
  if (!campaignName || !subject || !htmlContent) {
    const err = new Error('Campaign name, subject, and email content are required.');
    err.statusCode = 400;
    throw err;
  }

  const evaluation = await getEligibleRecipients({ recipientType, filterCriteria, selectedEmails });

  const campaignId = customCampaignId || `camp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const campaignDoc = {
    campaignId,
    campaignName: sanitizeHeader(campaignName),
    subject: sanitizeHeader(subject),
    senderName: sanitizeHeader(senderName || DEFAULT_SENDER_NAME),
    senderEmail: process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL,
    htmlContent: sanitizeEmailHtml(htmlContent),
    textContent: textContent || '',
    recipientType,
    filterCriteria: filterCriteria || {},
    selectedEmails: selectedEmails || [],
    status: 'draft',
    createdBy: sanitizeHeader(createdBy),
    createdAt: now,
    startedAt: null,
    completedAt: null,
    recipientCount: evaluation.eligibleCount,
    submittedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    bouncedCount: 0,
    openedCount: 0,
    unsubscribedCount: 0,
    lastErrorSummary: null,
    targetSummary: {
      totalEvaluated: evaluation.totalEvaluated,
      excludedCount: evaluation.excludedCount
    }
  };

  const db = getFirestoreDb();
  memoryCampaigns.set(campaignId, campaignDoc);

  // Populate in-memory recipient records
  for (const r of evaluation.eligibleRecipients) {
    const recKey = `${campaignId}_${r.id}`;
    memoryCampaignRecipients.set(recKey, {
      id: recKey,
      campaignId,
      recipientId: r.id,
      recipientEmail: r.email,
      recipientName: r.name,
      deliveryStatus: 'pending',
      providerMessageId: null,
      attemptCount: 0,
      lastAttemptAt: null,
      deliveredAt: null,
      failureReason: null
    });
  }

  if (db) {
    try {
      await safeFirestore(db.collection('emailCampaigns').doc(campaignId).set(campaignDoc), 400);

      const batch = db.batch();
      for (const r of evaluation.eligibleRecipients) {
        const rRef = db.collection('emailCampaignRecipients').doc(`${campaignId}_${r.id}`);
        batch.set(rRef, {
          campaignId,
          recipientId: r.id,
          recipientEmail: r.email,
          recipientName: r.name,
          deliveryStatus: 'pending',
          providerMessageId: null,
          attemptCount: 0,
          lastAttemptAt: null,
          deliveredAt: null,
          failureReason: null
        });
      }
      await safeFirestore(batch.commit(), 400).catch(e => console.warn('Recipient batch commit warning:', e.message));
    } catch (dbErr) {
      console.warn('⚠️ Firestore campaign save note:', dbErr.message);
    }
  }

  console.log(`📋 [BrevoService] Campaign "${campaignName}" created with ID: ${campaignId} (${evaluation.eligibleCount} recipients)`);
  return campaignDoc;
}

/**
 * Start and execute a campaign with controlled batching and duplicate send prevention
 */
async function startCampaign(campaignId) {
  if (!campaignId) {
    const err = new Error('Campaign ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (activeCampaignLocks.has(campaignId)) {
    const err = new Error(`Campaign ${campaignId} is already actively executing.`);
    err.code = 'CAMPAIGN_ALREADY_RUNNING';
    err.statusCode = 409;
    throw err;
  }

  const db = getFirestoreDb();
  let campaign = null;

  if (db) {
    try {
      const docSnap = await safeFirestore(db.collection('emailCampaigns').doc(campaignId).get(), 400);
      if (docSnap && docSnap.exists) {
        campaign = docSnap.data();
      }
    } catch (dbErr) {
      console.warn(`⚠️ [BrevoService] Firestore fetch error for ${campaignId}:`, dbErr.message);
    }
  }

  if (!campaign) {
    campaign = memoryCampaigns.get(campaignId);
  }

  if (!campaign) {
    const err = new Error(`Campaign ${campaignId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (campaign.status === 'completed') {
    const err = new Error('Campaign was already completed. Duplicate sending prevented.');
    err.code = 'CAMPAIGN_ALREADY_COMPLETED';
    err.statusCode = 400;
    throw err;
  }

  const quota = await getBrevoAccountStatus();
  if (quota.creditsRemainingToday !== null && quota.creditsRemainingToday <= 0) {
    const err = new Error('Brevo daily credit quota exhausted (0 credits remaining today). Remaining recipients queued for next quota refresh.');
    err.code = 'QUOTA_EXCEEDED';
    err.statusCode = 400;
    throw err;
  }

  activeCampaignLocks.add(campaignId);

  const now = new Date().toISOString();
  if (db) {
    try {
      await safeFirestore(
        db.collection('emailCampaigns').doc(campaignId).set({
          status: 'sending',
          startedAt: campaign.startedAt || now
        }, { merge: true }),
        400
      );
    } catch (e) {
      console.warn('⚠️ [BrevoService] Could not persist sending status to Firestore:', e.message);
    }
  }


  if (memoryCampaigns.has(campaignId)) {
    const mCamp = memoryCampaigns.get(campaignId);
    mCamp.status = 'sending';
    mCamp.startedAt = campaign.startedAt || now;
  }

  processCampaignExecution(campaignId).catch(err => {
    console.error(`❌ [BrevoService] Error in background execution of ${campaignId}:`, err);
  });

  return {
    success: true,
    message: `Campaign "${campaign.campaignName}" started successfully! Batch delivery in progress.`,
    campaignId,
    status: 'sending',
    recipientCount: campaign.recipientCount
  };
}

/**
 * Internal worker to process campaign recipients in rate-limited batches
 */
async function processCampaignExecution(campaignId) {
  const db = getFirestoreDb();
  const batchSize = parseInt(process.env.BREVO_BATCH_SIZE, 10) || DEFAULT_BATCH_SIZE;
  const batchDelay = parseInt(process.env.BREVO_BATCH_DELAY_MS, 10) || DEFAULT_BATCH_DELAY_MS;

  try {
    let campaign = null;
    let recipients = [];

    if (db) {
      try {
        const campDoc = await safeFirestore(db.collection('emailCampaigns').doc(campaignId).get(), 400);
        if (campDoc && campDoc.exists) {
          campaign = campDoc.data();
        }
        const recSnap = await safeFirestore(
          db.collection('emailCampaignRecipients')
            .where('campaignId', '==', campaignId)
            .where('deliveryStatus', '==', 'pending')
            .get(),
          400
        );
        if (recSnap) recSnap.forEach(d => recipients.push({ id: d.id, ...d.data() }));
      } catch (dbErr) {
        console.warn('⚠️ [BrevoService] Firestore read warning in processCampaignExecution:', dbErr.message);
      }
    }

    if (!campaign) {
      campaign = memoryCampaigns.get(campaignId);
    }

    if (!campaign) {
      console.error(`💥 [BrevoService] Campaign ${campaignId} data not found for background execution.`);
      return;
    }

    // Check memoryCampaignRecipients for pending recipients
    if (recipients.length === 0) {
      for (const [k, r] of memoryCampaignRecipients.entries()) {
        if (r.campaignId === campaignId && r.deliveryStatus === 'pending') {
          recipients.push({ id: k, ...r });
        }
      }
    }

    // If still 0 and no emails submitted yet, evaluate recipients
    if (recipients.length === 0 && (campaign.submittedCount || 0) === 0) {
      const evalResult = await getEligibleRecipients({
        recipientType: campaign.recipientType,
        filterCriteria: campaign.filterCriteria,
        selectedEmails: campaign.selectedEmails
      });
      recipients = evalResult.eligibleRecipients.map(r => {
        const recKey = `${campaignId}_${r.id}`;
        const recObj = {
          id: recKey,
          campaignId,
          recipientId: r.id,
          recipientEmail: r.email,
          recipientName: r.name,
          deliveryStatus: 'pending',
          providerMessageId: null,
          attemptCount: 0,
          lastAttemptAt: null,
          deliveredAt: null,
          failureReason: null
        };
        memoryCampaignRecipients.set(recKey, recObj);
        return recObj;
      });
    }

    // Check available quota immediately before sending
    const quota = await getBrevoAccountStatus();
    const availableQuota = (typeof quota.creditsRemainingToday === 'number') ? quota.creditsRemainingToday : 300;

    // Process only up to availableQuota recipients in this run to respect free plan limits
    const recipientsToProcess = recipients.slice(0, Math.max(0, availableQuota));
    const queuedCount = recipients.length - recipientsToProcess.length;

    if (queuedCount > 0) {
      console.log(`ℹ️ [BrevoService] Campaign has ${recipients.length} pending recipients, but daily quota is ${availableQuota}. Processing ${recipientsToProcess.length} today; ${queuedCount} queued for next quota period.`);
    }

    console.log(`🚀 [BrevoService] Processing ${recipientsToProcess.length} pending recipients for campaign: ${campaignId}`);

    let submittedCount = campaign.submittedCount || 0;
    let failedCount = campaign.failedCount || 0;

    for (let i = 0; i < recipientsToProcess.length; i += batchSize) {
      const chunk = recipientsToProcess.slice(i, i + batchSize);

      await Promise.all(chunk.map(async (recipient) => {
        const cleanEmail = recipient.recipientEmail;

        // Idempotency: skip if already submitted or delivered
        const inMem = memoryCampaignRecipients.get(recipient.id);
        if (inMem && (inMem.deliveryStatus === 'submitted' || inMem.deliveryStatus === 'delivered')) {
          console.log(`ℹ️ [BrevoService] Skipping ${cleanEmail}: already ${inMem.deliveryStatus}.`);
          return;
        }

        const unsub = await isUserUnsubscribed(cleanEmail);
        if (unsub) {
          console.log(`ℹ️ [BrevoService] Skipping ${cleanEmail}: unsubscribed prior to batch send.`);
          const unsubRecord = {
            deliveryStatus: 'unsubscribed',
            failureReason: 'User unsubscribed',
            lastAttemptAt: new Date().toISOString()
          };
          if (inMem) Object.assign(inMem, unsubRecord);
          if (db) {
            await db.collection('emailCampaignRecipients').doc(recipient.id).set(unsubRecord, { merge: true }).catch(() => {});
          }
          return;
        }

        const emailHtml = buildCampaignEmailHtml({
          htmlContent: campaign.htmlContent,
          recipientEmail: cleanEmail,
          recipientName: recipient.recipientName,
          campaignId,
          subject: campaign.subject
        });

        const token = generateUnsubscribeToken(cleanEmail);
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const unsubscribeUrl = `${clientUrl}/api/email/unsubscribe?email=${encodeURIComponent(cleanEmail)}&token=${token}&cid=${campaignId}`;

        const firstName = extractFirstName(recipient.recipientName, cleanEmail);
        const interpolatedText = (campaign.textContent || '')
          .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
          .replace(/\{\{\s*name\s*\}\}/gi, recipient.recipientName || firstName)
          .replace(/\{\{\s*email\s*\}\}/gi, cleanEmail);

        try {
          const sendRes = await sendTransactionalEmail({
            to: cleanEmail,
            toName: recipient.recipientName,
            subject: campaign.subject,
            html: emailHtml,
            text: interpolatedText,
            fromName: campaign.senderName,
            tags: ['campaign', campaignId],
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'X-Campaign-Id': campaignId
            },
            campaignId
          });

          submittedCount++;
          const submitRecord = {
            deliveryStatus: 'submitted',
            providerMessageId: sendRes.messageId,
            attemptCount: (recipient.attemptCount || 0) + 1,
            lastAttemptAt: new Date().toISOString()
          };
          if (inMem) Object.assign(inMem, submitRecord);
          if (db) {
            await db.collection('emailCampaignRecipients').doc(recipient.id).set(submitRecord, { merge: true }).catch(() => {});
          }

        } catch (sendErr) {
          failedCount++;
          console.error(`❌ Failed to send to ${cleanEmail}:`, sendErr.message);
          const failRecord = {
            deliveryStatus: 'failed',
            attemptCount: (recipient.attemptCount || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            failureReason: sendErr.message
          };
          if (inMem) Object.assign(inMem, failRecord);
          if (db) {
            await db.collection('emailCampaignRecipients').doc(recipient.id).set(failRecord, { merge: true }).catch(() => {});
          }
        }
      }));

      if (db) {
        await db.collection('emailCampaigns').doc(campaignId).set({
          submittedCount,
          failedCount
        }, { merge: true }).catch(() => {});
      }
      if (memoryCampaigns.has(campaignId)) {
        const mCamp = memoryCampaigns.get(campaignId);
        mCamp.submittedCount = submittedCount;
        mCamp.failedCount = failedCount;
      }

      if (i + batchSize < recipientsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    // Check remaining pending recipients across store
    let pendingCount = 0;
    for (const r of memoryCampaignRecipients.values()) {
      if (r.campaignId === campaignId && r.deliveryStatus === 'pending') {
        pendingCount++;
      }
    }

    const isFullyCompleted = pendingCount === 0 && (submittedCount + failedCount >= (campaign.recipientCount || recipients.length));
    const finalStatus = isFullyCompleted ? 'completed' : 'partially_completed';
    const nowIso = new Date().toISOString();

    const finalDoc = {
      status: finalStatus,
      completedAt: isFullyCompleted ? nowIso : null,
      lastRunAt: nowIso,
      submittedCount,
      failedCount,
      remainingCount: pendingCount
    };

    if (db) {
      await db.collection('emailCampaigns').doc(campaignId).set(finalDoc, { merge: true }).catch(() => {});
    }

    if (memoryCampaigns.has(campaignId)) {
      const mCamp = memoryCampaigns.get(campaignId);
      Object.assign(mCamp, finalDoc);
    }

    console.log(`🏁 [BrevoService] Campaign ${campaignId} batch finished! Status: ${finalStatus} (Submitted: ${submittedCount}, Failed: ${failedCount}, Pending: ${pendingCount})`);

  } catch (err) {
    console.error(`💥 [BrevoService] Campaign execution exception for ${campaignId}:`, err);
    if (db) {
      await db.collection('emailCampaigns').doc(campaignId).set({
        status: 'failed',
        lastErrorSummary: err.message
      }, { merge: true }).catch(() => {});
    }
    if (memoryCampaigns.has(campaignId)) {
      const mCamp = memoryCampaigns.get(campaignId);
      mCamp.status = 'failed';
      mCamp.lastErrorSummary = err.message;
    }
  } finally {
    activeCampaignLocks.delete(campaignId);
  }
}

/**
 * Retrieve Campaign status and delivery breakdown
 */
async function getCampaignStatus(campaignId) {
  const db = getFirestoreDb();
  let campaign = null;
  let sampleRecipients = [];

  if (db) {
    try {
      const campDoc = await safeFirestore(db.collection('emailCampaigns').doc(campaignId).get(), 400);
      if (campDoc && campDoc.exists) {
        campaign = campDoc.data();
        const recSnap = await safeFirestore(
          db.collection('emailCampaignRecipients')
            .where('campaignId', '==', campaignId)
            .limit(100)
            .get(),
          400
        );
        if (recSnap) recSnap.forEach(d => sampleRecipients.push(d.data()));
      }
    } catch (e) {
      console.warn('⚠️ [BrevoService] Firestore getCampaignStatus warning:', e.message);
    }
  }

  if (!campaign) {
    campaign = memoryCampaigns.get(campaignId);
  }

  if (sampleRecipients.length === 0) {
    for (const r of memoryCampaignRecipients.values()) {
      if (r.campaignId === campaignId) {
        sampleRecipients.push(r);
      }
    }
  }

  if (!campaign) {
    const err = new Error(`Campaign ${campaignId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  return {
    success: true,
    campaign,
    sampleRecipients
  };
}

/**
 * Retry failed recipients for a campaign (max 3 attempts, skips permanently bounced/unsubscribed)
 */
async function retryFailedCampaignRecipients(campaignId) {
  if (!campaignId) throw new Error('Campaign ID is required.');
  const db = getFirestoreDb();
  let resetCount = 0;

  for (const [k, r] of memoryCampaignRecipients.entries()) {
    if (r.campaignId === campaignId) {
      if (r.deliveryStatus === 'failed' && (r.attemptCount || 0) < 3) {
        r.deliveryStatus = 'pending';
        r.failureReason = null;
        resetCount++;
      } else if (r.deliveryStatus === 'pending') {
        resetCount++;
      }
    }
  }

  if (db) {
    try {
      const snap = await safeFirestore(
        db.collection('emailCampaignRecipients')
          .where('campaignId', '==', campaignId)
          .where('deliveryStatus', '==', 'failed')
          .get(),
        400
      );
      if (snap) {
        const batch = db.batch();
        snap.forEach(doc => {
          const d = doc.data();
          if ((d.attemptCount || 0) < 3) {
            batch.set(doc.ref, { deliveryStatus: 'pending', failureReason: null }, { merge: true });
            resetCount++;
          }
        });
        await safeFirestore(batch.commit(), 400).catch(() => {});
      }
    } catch (_) {}
  }

  if (resetCount > 0) {
    const startRes = await startCampaign(campaignId);
    return {
      success: true,
      message: `Retrying campaign for ${resetCount} recipients`,
      retriedCount: resetCount,
      ...startRes
    };
  }

  return { success: true, message: 'No eligible pending or failed recipients to retry', retriedCount: 0, resetCount: 0 };
}


/**
 * Retrieve or pre-seed the dedicated Welcome Email Campaign for existing users as a draft
 */
async function getOrCreateExistingUserWelcomeCampaignDraft() {
  const existingId = 'camp_existing_users_welcome';
  const db = getFirestoreDb();

  let existing = null;
  if (db) {
    try {
      const snap = await safeFirestore(db.collection('emailCampaigns').doc(existingId).get(), 400);
      if (snap && snap.exists) existing = snap.data();
    } catch (_) {}
  }
  if (!existing) {
    existing = memoryCampaigns.get(existingId);
  }

  if (existing) {
    return existing;
  }

  const welcomeHtml = `
<h2 style="color: #ffffff; margin-top: 0; font-size: 18px; font-weight: 700;">Welcome to FoodieBite! 🍏</h2>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  We're excited to help you discover food that matches your preferences and lifestyle.
</p>
<div style="background-color: rgba(255, 107, 53, 0.08); border-left: 3px solid #FF6B35; padding: 14px 18px; border-radius: 8px; margin: 18px 0;">
  <p style="margin: 0 0 10px 0; color: #FF6B35; font-weight: 700; font-size: 14px;">With FoodieBite, you can:</p>
  <ul style="margin: 0; padding-left: 20px; color: #e2e8f0; font-size: 13px; line-height: 1.7;">
    <li style="margin-bottom: 6px;"><strong>Personalized Meal Recommendations:</strong> Discover personalized food recommendations tailored to your taste.</li>
    <li style="margin-bottom: 6px;"><strong>Dietary Preferences:</strong> Explore foods based on your dietary preferences (Vegetarian, Vegan, Keto, etc.).</li>
    <li style="margin-bottom: 6px;"><strong>Seasonal & Fresh Suggestions:</strong> Find seasonal and fresh food suggestions throughout the year.</li>
    <li style="margin-bottom: 6px;"><strong>Spice Preferences:</strong> Explore food options matched to your spice preferences.</li>
    <li><strong>Health & Wellness Goals:</strong> Discover foods that align with your health and wellness goals.</li>
  </ul>
</div>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  Visit FoodieBite and start exploring your next favorite meal!
</p>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 24px;">
  Thank you for being part of our community.<br><br>
  Warm regards,<br>
  <strong style="color: #ffffff;">The FoodieBite Team</strong>
</p>
  `;


  const welcomeText = `Welcome to FoodieBite!

We're excited to help you discover food that matches your preferences and lifestyle.

With FoodieBite, you can:
• Discover personalized food recommendations.
• Explore foods based on your dietary preferences.
• Find seasonal food suggestions.
• Explore food options based on your tastes and spice preferences.
• Discover foods that align with your health and wellness goals.

Visit FoodieBite and start exploring your next favorite meal!

Thank you for being part of our community.

Warm regards,
The FoodieBite Team`;

  return createCampaign({
    campaignId: existingId,
    campaignName: 'FoodieBite Existing User Welcome Campaign',
    subject: 'Welcome to FoodieBite – Discover Food That Fits You!',
    senderName: DEFAULT_SENDER_NAME,
    htmlContent: welcomeHtml,
    textContent: welcomeText,
    recipientType: 'all',
    createdBy: 'system_initializer'
  });
}

/**
 * Get Campaign History list with pagination and real delivery metrics
 */
async function getCampaignHistory({ limit = 20, offset = 0 } = {}) {
  const db = getFirestoreDb();
  let campaigns = [];

  if (db) {
    try {
      const snap = await db.collection('emailCampaigns').get();
      snap.forEach(d => campaigns.push(d.data()));
    } catch (err) {
      console.warn('⚠️ Firestore campaign history fetch warning, using in-memory campaigns:', err.message);
    }
  }

  if (campaigns.length === 0 && memoryCampaigns.size > 0) {
    campaigns = Array.from(memoryCampaigns.values());
  }

  campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const paginated = campaigns.slice(offset, offset + limit);

  return {
    success: true,
    totalCount: campaigns.length,
    count: paginated.length,
    campaigns: paginated
  };
}

/**
 * Process Brevo Delivery Webhooks
 * Handles events: 'sent', 'delivered', 'opened', 'clicks', 'soft_bounce', 'hard_bounce', 'blocked', 'spam', 'unsubscribed'
 */
async function processDeliveryWebhook(eventPayload, secretHeader = '') {
  const expectedSecret = process.env.BREVO_WEBHOOK_SECRET || 'foodiebite_brevo_webhook_secret_2026';
  if (expectedSecret && secretHeader && secretHeader !== expectedSecret) {
    const err = new Error('Unauthorized Brevo webhook request: Invalid secret key.');
    err.statusCode = 401;
    throw err;
  }

  const event = eventPayload?.event;
  const email = (eventPayload?.email || '').trim().toLowerCase();
  const messageId = eventPayload?.['message-id'] || eventPayload?.messageId;
  const eventTimestamp = eventPayload?.ts_event || eventPayload?.date || Date.now();
  const eventId = eventPayload?.id || `${messageId}_${event}_${eventTimestamp}`;

  if (!event || !email) {
    const err = new Error('Invalid Brevo webhook payload: Missing event or email.');
    err.statusCode = 400;
    throw err;
  }

  if (memoryEvents.has(String(eventId))) {
    console.log(`ℹ️ [BrevoWebhook] Duplicate event ${eventId} discarded.`);
    return { success: true, skipped: true, reason: 'duplicate_event' };
  }
  memoryEvents.add(String(eventId));

  const db = getFirestoreDb();
  if (db) {
    try {
      const eventDocRef = db.collection('email_events').doc(String(eventId));
      const existingEvent = await eventDocRef.get();
      if (existingEvent.exists) {
        console.log(`ℹ️ [BrevoWebhook] Duplicate event ${eventId} discarded.`);
        return { success: true, skipped: true, reason: 'duplicate_event' };
      }

      await eventDocRef.set({
        eventId,
        event,
        email,
        messageId: messageId || null,
        eventTimestamp,
        processedAt: new Date().toISOString(),
        raw: eventPayload
      });
    } catch (dbErr) {
      console.warn('⚠️ Webhook event Firestore write warning:', dbErr.message);
    }
  }

  let recipientDoc = null;
  if (db) {
    try {
      if (messageId) {
        const recSnap = await safeFirestore(
          db.collection('emailCampaignRecipients')
            .where('providerMessageId', '==', messageId)
            .limit(1)
            .get(),
          400
        );
        if (recSnap && !recSnap.empty) {
          recipientDoc = recSnap.docs[0];
        }
      }

      if (!recipientDoc) {
        const recSnap = await safeFirestore(
          db.collection('emailCampaignRecipients')
            .where('recipientEmail', '==', email)
            .limit(1)
            .get(),
          400
        );
        if (recSnap && !recSnap.empty) {
          recipientDoc = recSnap.docs[0];
        }
      }
    } catch (e) {
      // Offline fallback
    }
  }

  if (recipientDoc) {
    const rData = recipientDoc.data();
    const campaignId = rData.campaignId;

    let newStatus = rData.deliveryStatus;
    if (event === 'delivered') newStatus = 'delivered';
    else if (event === 'opened') newStatus = 'opened';
    else if (event === 'clicks' || event === 'click') newStatus = 'clicked';
    else if (event === 'soft_bounce' || event === 'hard_bounce' || event === 'bounce') newStatus = 'bounced';
    else if (event === 'blocked' || event === 'spam') newStatus = 'failed';
    else if (event === 'unsubscribe' || event === 'unsubscribed') newStatus = 'unsubscribed';

    await safeFirestore(
      recipientDoc.ref.set({
        deliveryStatus: newStatus,
        lastEvent: event,
        lastEventAt: new Date().toISOString(),
        deliveredAt: event === 'delivered' ? new Date().toISOString() : rData.deliveredAt
      }, { merge: true }),
      400
    ).catch(() => {});

    if (campaignId) {
      const campRef = db.collection('emailCampaigns').doc(campaignId);
      const campSnap = await safeFirestore(campRef.get(), 400);
      if (campSnap && campSnap.exists) {
        const cData = campSnap.data();
        const update = {};
        if (event === 'delivered') update.deliveredCount = (cData.deliveredCount || 0) + 1;
        if (event === 'opened') update.openedCount = (cData.openedCount || 0) + 1;
        if (event === 'soft_bounce' || event === 'hard_bounce' || event === 'bounce') {
          update.bouncedCount = (cData.bouncedCount || 0) + 1;
        }
        if (event === 'unsubscribe') update.unsubscribedCount = (cData.unsubscribedCount || 0) + 1;

        if (Object.keys(update).length > 0) {
          await safeFirestore(campRef.set(update, { merge: true }), 400).catch(() => {});
        }
      }
    }
  }

  // Update in-memory recipient state
  for (const [k, r] of memoryCampaignRecipients.entries()) {
    if (
      (messageId && (r.providerMessageId === messageId || r.messageId === messageId)) ||
      (email && (r.recipientEmail === email || r.email === email))
    ) {

      if (event === 'delivered') r.deliveryStatus = 'delivered';
      else if (event === 'opened') r.deliveryStatus = 'opened';
      else if (event === 'clicks' || event === 'click') r.deliveryStatus = 'clicked';
      else if (event === 'soft_bounce' || event === 'hard_bounce' || event === 'bounce') r.deliveryStatus = 'bounced';
      else if (event === 'blocked' || event === 'spam') r.deliveryStatus = 'failed';
      else if (event === 'unsubscribe' || event === 'unsubscribed') r.deliveryStatus = 'unsubscribed';

      r.lastEvent = event;
      r.lastEventAt = new Date().toISOString();
      if (event === 'delivered') r.deliveredAt = new Date().toISOString();

      if (r.campaignId && memoryCampaigns.has(r.campaignId)) {
        const mCamp = memoryCampaigns.get(r.campaignId);
        if (event === 'delivered') mCamp.deliveredCount = (mCamp.deliveredCount || 0) + 1;
        if (event === 'opened') mCamp.openedCount = (mCamp.openedCount || 0) + 1;
        if (event === 'soft_bounce' || event === 'hard_bounce' || event === 'bounce') mCamp.bouncedCount = (mCamp.bouncedCount || 0) + 1;
        if (event === 'unsubscribe') mCamp.unsubscribedCount = (mCamp.unsubscribedCount || 0) + 1;
      }
    }
  }

  if (event === 'unsubscribe' || event === 'unsubscribed') {
    await unsubscribeUser({ email, reason: 'brevo_webhook_unsubscribe' }).catch(() => {});
  }

  console.log(`📬 [BrevoWebhook] Successfully processed event "${event}" for ${email} (Message: ${messageId || 'N/A'})`);
  return { success: true, processed: true, event, email };
}

/**
 * Automated Welcome Email Dispatch
 * Sends rich welcome email to new users; idempotent via Firestore flag `welcomeEmailSent: true`
 */
/**
 * Automated Welcome Email Dispatch
 * Sends rich welcome email to new users upon first registration; idempotent via `welcomeEmailSent: true`
 */
async function sendWelcomeEmail(user) {
  if (!user || !user.email) {
    throw new Error('User object with valid email is required to send welcome email');
  }

  const cleanEmail = user.email.trim().toLowerCase();
  const firstName = extractFirstName(user.name || cleanEmail.split('@')[0]);
  const userId = user.uid || user.id;

  if (user.welcomeEmailSent === true || user.welcomeEmailStatus === 'submitted' || user.welcomeEmailStatus === 'delivered') {
    console.log(`ℹ️ [BrevoService] Welcome email already dispatched for: ${cleanEmail}. Skipping duplicate.`);
    return { success: true, skipped: true, reason: 'already_sent' };
  }

  const db = getFirestoreDb();
  if (db && userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const udata = userDoc.data();
        if (udata.welcomeEmailSent === true || udata.welcomeEmailStatus === 'submitted' || udata.welcomeEmailStatus === 'delivered') {
          console.log(`ℹ️ [BrevoService] Firestore confirms welcome email already dispatched for ${userId}. Skipping duplicate.`);
          return { success: true, skipped: true, reason: 'already_sent_firestore' };
        }
      }
    } catch (_) {}
  }

  // Exact required subject line:
  const subject = "Welcome to FoodieBite – Let's Discover Your Next Favorite Food!";
  const clientAppUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const now = new Date().toISOString();

  const text = `Hello ${firstName},

Welcome to FoodieBite!

We're excited to help you discover foods that match your preferences.

With FoodieBite, you can explore personalized food recommendations, discover seasonal foods, and find options that match your dietary preferences.

Visit FoodieBite and start discovering something delicious: ${clientAppUrl}/home

We're happy to have you here!

Regards,
The FoodieBite Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1217; color: #ffffff; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background-color: #161a22; border-radius: 16px; border: 1px solid #272d3b; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding: 28px; text-align: center;">
          <span style="font-size: 40px;">🍏</span>
          <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 24px; font-weight: 800;">Welcome to FoodieBite</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase;">Discover Food That Fits You</p>
        </div>
        <div style="padding: 28px 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">Hello ${escapeHtml(firstName)}, 👋</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            Welcome to <strong>FoodieBite</strong>!
          </p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            We're excited to help you discover foods that match your preferences.
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            With FoodieBite, you can explore personalized food recommendations, discover seasonal foods, and find options that match your dietary preferences.
          </p>
          <div style="text-align: center; margin: 24px 0 16px 0;">
            <a href="${clientAppUrl}/home" style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 24px; font-size: 14px; font-weight: 700; display: inline-block;">
              Visit FoodieBite &rarr;
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 16px 0 4px 0;">
            We're happy to have you here!
          </p>
          <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">
            Regards,<br/>
            <strong>The FoodieBite Team</strong>
          </p>
        </div>
        <div style="background-color: #0f1217; padding: 16px; text-align: center; border-top: 1px solid #1f2532;">
          <p style="color: #475569; font-size: 11px; margin: 0;">
            FoodieBite Notifications &bull; Powered by Brevo Email &bull; &copy; 2026 FoodieBite Team
          </p>
        </div>
      </div>
    </div>
  `;

  let attemptCount = (user.welcomeEmailAttemptCount || 0) + 1;
  let result;
  try {
    result = await sendTransactionalEmail({
      to: cleanEmail,
      toName: firstName,
      subject,
      html,
      text,
      tags: ['welcome', 'onboarding']
    });

    const statusRecord = {
      welcomeEmailSent: true,
      welcomeEmailStatus: 'submitted',
      welcomeEmailSentAt: now,
      welcomeEmailAttemptCount: attemptCount,
      welcomeEmailMessageId: result.messageId || null,
      welcomeEmailLastAttemptAt: now,
      welcomeEmailFailureReason: null
    };

    if (db && userId) {
      try {
        await safeFirestore(db.collection('users').doc(userId).set(statusRecord, { merge: true }), 400);
        console.log(`✅ [BrevoService] Marked welcome email status in Firestore for ${userId}`);
      } catch (_) {}
    }

    try {
      userStore.upsertUser({
        ...(userStore.findByEmail(cleanEmail) || user),
        ...statusRecord
      });
    } catch (_) {}

    return result;
  } catch (err) {
    console.error(`❌ [BrevoService] Welcome email dispatch failed for ${cleanEmail}:`, err.message);
    const failureRecord = {
      welcomeEmailSent: false,
      welcomeEmailStatus: 'failed',
      welcomeEmailAttemptCount: attemptCount,
      welcomeEmailLastAttemptAt: now,
      welcomeEmailFailureReason: err.message
    };

    if (db && userId) {
      try {
        await safeFirestore(db.collection('users').doc(userId).set(failureRecord, { merge: true }), 400);
      } catch (_) {}
    }

    try {
      userStore.upsertUser({
        ...(userStore.findByEmail(cleanEmail) || user),
        ...failureRecord
      });
    } catch (_) {}

    // Rethrow error so caller can handle, but registration caller catches safely
    throw err;
  }
}

module.exports = {
  isValidEmail,
  sanitizeHeader,
  sanitizeEmailHtml,
  escapeHtml,
  extractFirstName,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  getBrevoApiKey,
  getBrevoAccountStatus,
  sendTransactionalEmail,
  sendTestEmail,
  sendWelcomeEmail,
  isUserUnsubscribed,
  unsubscribeUser,
  getEligibleRecipients,
  createCampaign,
  startCampaign,
  getCampaignStatus,
  getCampaignHistory,
  retryFailedCampaignRecipients,
  getOrCreateExistingUserWelcomeCampaignDraft,
  processDeliveryWebhook,
  activeCampaignLocks,
  memoryCampaigns,
  memoryCampaignRecipients,
  memoryUnsubscribes,
  memoryEvents
};

