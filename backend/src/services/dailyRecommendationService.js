// ─────────────────────────────────────────────────────────────
//  backend/src/services/dailyRecommendationService.js
//  FoodieBite — Daily Personalized Food Recommendation Email Service
// ─────────────────────────────────────────────────────────────

'use strict';

const { getFirestoreDb } = require('../config/firebase');
const userStore = require('./userStore');
const brevoService = require('./brevoService');
const { recommendFoods } = require('./recommendationEngine');
const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');

// In-memory fallback stores for offline/test environments
const memoryDailyRuns = new Map();
const memoryDailyRecipients = new Map();
let isDailyJobRunning = false;

/**
 * Returns formatted YYYY-MM-DD in Asia/Kolkata timezone
 */
function getKolkataDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Generates stable daily campaign run ID
 */
function getDailyRunId(date = new Date()) {
  const dateStr = getKolkataDateString(date);
  return `daily-recommendations-${dateStr}`;
}

/**
 * Safe Firestore helper with timeout to prevent hanging on offline Firestore
 */
async function safeFirestore(promise, timeoutMs = 500) {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retrieve all active users and evaluate eligibility for daily recommendations
 */
async function getEligibleDailyRecipients(runId = getDailyRunId()) {
  const allUsers = [...userStore.getAllUsers()];
  const db = getFirestoreDb();

  // Merge Firestore users if reachable
  if (db) {
    try {
      const snap = await safeFirestore(db.collection('users').get(), 500);
      if (snap) {
        snap.forEach(doc => {
          const d = doc.data();
          if (d.email && !allUsers.some(u => (u.email || '').toLowerCase() === d.email.toLowerCase())) {
            allUsers.push({
              id: doc.id,
              uid: doc.id,
              ...d
            });
          }
        });
      }
    } catch (_) {}
  }

  // Retrieve already dispatched/submitted recipient emails for this day's runId
  const alreadySentSet = new Set();
  for (const r of memoryDailyRecipients.values()) {
    if (r.runId === runId && (r.status === 'submitted' || r.status === 'delivered' || r.status === 'processing')) {
      if (r.email) alreadySentSet.add(r.email.toLowerCase().trim());
    }
  }

  if (db) {
    try {
      const sentSnap = await safeFirestore(
        db.collection('dailyRecommendationRecipients')
          .where('runId', '==', runId)
          .where('status', 'in', ['submitted', 'delivered', 'processing'])
          .get(),
        500
      );
      if (sentSnap) {
        sentSnap.forEach(d => {
          const r = d.data();
          if (r.email) alreadySentSet.add(r.email.toLowerCase().trim());
        });
      }
    } catch (_) {}
  }

  const eligible = [];
  const skipped = [];

  for (const u of allUsers) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !brevoService.isValidEmail(email)) {
      skipped.push({ userId: u.id || u.uid, email: email || 'unknown', reason: 'invalid_email' });
      continue;
    }

    // Check account status
    if (u.disabled === true || u.accountStatus === 'disabled' || u.accountStatus === 'suspended') {
      skipped.push({ userId: u.id || u.uid, email, reason: 'account_inactive' });
      continue;
    }

    // Check consent & opt-in preference:
    // dailyRecommendationEmails default is true for active accounts unless explicitly set to false
    const optedIn = u.dailyRecommendationEmails !== false &&
      u.preferences?.dailyRecommendationEmails !== false &&
      u.notificationSettings?.dailySuggestions !== false;

    if (!optedIn) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'opted_out' });
      continue;
    }

    // Check unsubscription status
    const isUnsub = await brevoService.isUserUnsubscribed(email, 'recommendations');
    if (isUnsub) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'unsubscribed' });
      continue;
    }

    // Check daily idempotency
    if (alreadySentSet.has(email)) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'already_sent_today' });
      continue;
    }

    eligible.push({
      id: u.id || u.uid,
      uid: u.uid || u.id,
      name: u.name || email.split('@')[0],
      email,
      dietType: u.dietType || u.preferences?.dietType || 'Vegetarian',
      spiceLevel: u.spiceLevel || u.preferences?.spiceLevel || 'Medium',
      healthGoals: u.healthGoals || u.preferences?.healthGoals || [],
      allergies: u.allergies || u.preferences?.allergies || [],
      activeFoodRestrictions: u.activeFoodRestrictions || u.preferences?.activeFoodRestrictions || [],
      preferences: u.preferences || {}
    });
  }

  return { eligible, skipped, runId };
}

/**
 * Generate personalized recommendations and email content for a user
 */
function buildDailyRecommendationForUser(user) {
  const userProfile = {
    allergies: user.allergies || user.preferences?.allergies || [],
    dietType: user.dietType || user.preferences?.dietType || user.diet || 'Vegetarian',
    cuisines: user.cuisines || user.preferences?.cuisines || ['indian'],
    spiceLevel: user.spiceLevel || user.preferences?.spiceLevel || 'Medium',
    healthGoals: user.healthGoals || user.preferences?.healthGoals || [],
    activeFoodRestrictions: user.activeFoodRestrictions || user.preferences?.activeFoodRestrictions || [],
    preferences: user.preferences || {}
  };

  // Run the existing context-aware recommendation engine
  const recResult = recommendFoods(FALLBACK_FOODS, userProfile, { mealPeriod: 'lunch', weather: 'mild', season: 'winter' }, 10);
  const safePicks = (recResult.foods || []).slice(0, 3);

  if (safePicks.length === 0) {
    return {
      success: false,
      reason: 'no_safe_recommendations',
      picks: []
    };
  }

  // Personalization summary factor
  let personalizationReason = `Handcrafted for your ${userProfile.dietType} preference`;
  if (userProfile.allergies && userProfile.allergies.length > 0) {
    personalizationReason += ` with strict zero-${userProfile.allergies.join(', ')} allergy protection`;
  }
  if (userProfile.healthGoals && userProfile.healthGoals.length > 0) {
    personalizationReason += ` and optimized for ${userProfile.healthGoals.map(g => g.replace(/_/g, ' ')).join(', ')}`;
  } else {
    personalizationReason += ` to support balanced daily energy and vitality`;
  }
  personalizationReason += '.';

  const firstName = brevoService.extractFirstName(user.name);
  const clientAppUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const unsubToken = brevoService.generateUnsubscribeToken(user.email);
  const unsubUrl = `${clientAppUrl}/unsubscribe?email=${encodeURIComponent(user.email)}&type=recommendations&token=${unsubToken}`;

  // Build Plain Text
  let text = `Hello ${firstName},

Ready to discover something delicious today?

FoodieBite has selected food recommendations based on your preferences.

Today's food picks:
`;

  safePicks.forEach((p, idx) => {
    const nutritionInfo = p.calories ? ` (${p.calories} kcal${p.protein ? ` | ${p.protein}g protein` : ''})` : '';
    const desc = p.description || `${p.name} prepared with wholesome ingredients aligned with your nutrition goals.`;
    text += `\n${idx + 1}. ${p.name}${nutritionInfo}\n   ${desc}\n`;
  });

  text += `
Why these picks?
${personalizationReason}

Explore FoodieBite to discover more foods that match your preferences: ${clientAppUrl}/home

Enjoy your day!

The FoodieBite Team

---
To unsubscribe from daily food recommendations: ${unsubUrl}
`;

  // Build Responsive HTML Email
  let htmlFoodCards = '';
  safePicks.forEach((p, idx) => {
    const nutritionBadge = p.calories
      ? `<span style="background-color: rgba(255,107,53,0.12); color: #FF6B35; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,107,53,0.3);">${p.calories} kcal${p.protein ? ` &bull; ${p.protein}g protein` : ''}</span>`
      : '';
    const desc = p.description || `${p.name} is carefully matched to your nutrition and dietary goals.`;
    const foodLink = `${clientAppUrl}/home?food=${encodeURIComponent(p.id || p.name)}`;

    htmlFoodCards += `
      <div style="background-color: #1a1f29; border: 1px solid #272d3b; border-radius: 12px; padding: 16px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <h3 style="color: #ffffff; font-size: 16px; margin: 0; font-weight: 700;">
            <span style="color: #FF6B35; margin-right: 6px;">${idx + 1}.</span> ${brevoService.escapeHtml(p.name)}
          </h3>
          ${nutritionBadge}
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 6px 0 10px 0;">
          ${brevoService.escapeHtml(desc)}
        </p>
        <a href="${foodLink}" style="color: #FF8C5A; font-size: 12px; font-weight: 600; text-decoration: none;">
          View details on FoodieBite &rarr;
        </a>
      </div>
    `;
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1217; color: #ffffff; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #161a22; border-radius: 16px; border: 1px solid #272d3b; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding: 26px 24px; text-align: center;">
          <span style="font-size: 38px;">🍽️</span>
          <h1 style="color: #ffffff; margin: 6px 0 0 0; font-size: 22px; font-weight: 800;">Your Daily Food Picks</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase;">Personalized Nutrition by FoodieBite</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #ffffff; font-size: 17px; margin: 0 0 8px 0;">Hello ${brevoService.escapeHtml(firstName)}, 👋</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
            Ready to discover something delicious today?<br/>
            FoodieBite has selected fresh food recommendations tailored to your preferences.
          </p>

          <h3 style="color: #FF6B35; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px 0;">Today's Food Picks:</h3>
          ${htmlFoodCards}

          <div style="background-color: rgba(255, 107, 53, 0.08); border-left: 3px solid #FF6B35; padding: 14px; border-radius: 8px; margin: 18px 0;">
            <p style="margin: 0 0 4px 0; color: #FF6B35; font-weight: 700; font-size: 12px; text-transform: uppercase;">Why these picks?</p>
            <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${brevoService.escapeHtml(personalizationReason)}</p>
          </div>

          <div style="text-align: center; margin: 24px 0 16px 0;">
            <a href="${clientAppUrl}/home" style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 24px; font-size: 14px; font-weight: 700; display: inline-block;">
              Explore More Dishes &rarr;
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 16px 0 4px 0;">
            Enjoy your day!
          </p>
          <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">
            <strong>The FoodieBite Team</strong>
          </p>
        </div>

        <div style="background-color: #0f1217; padding: 16px; text-align: center; border-top: 1px solid #1f2532;">
          <p style="color: #475569; font-size: 11px; margin: 0 0 6px 0;">
            You are receiving this daily email because you are registered on FoodieBite with daily suggestions enabled.
          </p>
          <a href="${unsubUrl}" style="color: #64748b; font-size: 11px; text-decoration: underline;">
            Unsubscribe from Daily Recommendations
          </a>
        </div>
      </div>
    </div>
  `;

  return {
    success: true,
    subject: 'Your Daily Food Picks Are Here! | FoodieBite',
    html,
    text,
    picks: safePicks,
    personalizationReason
  };
}

/**
 * Execute the automated daily recommendations email run.
 * Handles rate limits, Brevo daily quota, batches of 10, run & recipient persistence.
 */
async function executeDailyRecommendationRun(options = {}) {
  if (isDailyJobRunning && !options.force) {
    console.warn('⚠️ [DailyRecommendations] Another daily recommendation job is currently in progress. Skipping overlapping run.');
    return { success: false, reason: 'overlapping_execution_prevented' };
  }

  isDailyJobRunning = true;
  const now = new Date();
  const runId = options.runId || getDailyRunId(now);
  const runDate = getKolkataDateString(now);
  const db = getFirestoreDb();

  console.log(`\n🚀 [DailyRecommendations] Starting daily run: ${runId} (Date: ${runDate} Asia/Kolkata)...`);

  const runDoc = {
    runId,
    runDate,
    timezone: 'Asia/Kolkata',
    status: 'processing',
    triggerType: options.triggerType || 'scheduled',
    startedAt: now.toISOString(),
    completedAt: null,
    eligibleCount: 0,
    submittedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    skippedCount: 0,
    queuedCount: 0,
    notes: ''
  };

  memoryDailyRuns.set(runId, runDoc);
  if (db) {
    try {
      await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
    } catch (_) {}
  }

  try {
    // 1. Evaluate recipients
    const { eligible, skipped } = await getEligibleDailyRecipients(runId);
    runDoc.eligibleCount = eligible.length;
    runDoc.skippedCount = skipped.length;

    // Record skipped recipients
    for (const sk of skipped) {
      const recId = `${runId}_${sk.email}`;
      const recDoc = {
        runId,
        userId: sk.userId || 'unknown',
        email: sk.email,
        status: 'skipped',
        skipReason: sk.reason,
        attemptCount: 0,
        completedAt: new Date().toISOString()
      };
      memoryDailyRecipients.set(recId, recDoc);
      if (db) {
        try {
          safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
        } catch (_) {}
      }
    }

    if (eligible.length === 0) {
      console.log(`ℹ️ [DailyRecommendations] No eligible recipients for ${runId}.`);
      runDoc.status = 'completed';
      runDoc.completedAt = new Date().toISOString();
      memoryDailyRuns.set(runId, runDoc);
      if (db) {
        try {
          await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
        } catch (_) {}
      }
      isDailyJobRunning = false;
      return { success: true, runDoc };
    }

    // 2. Check Brevo Quota
    const status = await brevoService.getBrevoAccountStatus();
    const remainingQuota = typeof status.creditsRemainingToday === 'number' ? status.creditsRemainingToday : 300;
    console.log(`📊 [DailyRecommendations] Brevo quota remaining: ${remainingQuota} | Eligible recipients: ${eligible.length}`);

    // If quota is exhausted or insufficient, queue remaining recipients
    const BATCH_SIZE = parseInt(process.env.BREVO_BATCH_SIZE, 10) || 10;
    const BATCH_DELAY_MS = parseInt(process.env.BREVO_BATCH_DELAY_MS, 10) || 300;

    let submitted = 0;
    let failed = 0;
    let queued = 0;

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const currentQuotaCheck = remainingQuota - submitted;
      const batch = eligible.slice(i, i + BATCH_SIZE);

      for (const user of batch) {
        const recId = `${runId}_${user.email}`;

        // Check if Brevo quota exhausted for the day
        if (currentQuotaCheck <= 0) {
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'queued',
            skipReason: 'quota_exhausted',
            attemptCount: 0,
            lastAttemptAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          queued++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
          continue;
        }

        // Generate recommendations
        const recData = buildDailyRecommendationForUser(user);
        if (!recData.success) {
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'skipped',
            skipReason: recData.reason,
            attemptCount: 0,
            completedAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          runDoc.skippedCount++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
          continue;
        }

        // Send via Brevo
        try {
          const sendRes = await brevoService.sendTransactionalEmail({
            to: user.email,
            toName: user.name,
            subject: recData.subject,
            html: recData.html,
            text: recData.text,
            tags: ['daily-recommendation', runId]
          });

          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'submitted',
            providerMessageId: sendRes.messageId || null,
            attemptCount: 1,
            recommendations: recData.picks.map(p => ({ id: p.id, name: p.name, calories: p.calories })),
            lastAttemptAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          submitted++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
        } catch (sendErr) {
          console.error(`❌ [DailyRecommendations] Send failed for ${user.email}:`, sendErr.message);
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'failed',
            failureReason: sendErr.message,
            attemptCount: 1,
            lastAttemptAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          failed++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
        }
      }

      // Small throttle delay between batches
      if (i + BATCH_SIZE < eligible.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    runDoc.submittedCount = submitted;
    runDoc.failedCount = failed;
    runDoc.queuedCount = queued;
    runDoc.status = failed > 0 && submitted === 0 ? 'failed' : 'completed';
    runDoc.completedAt = new Date().toISOString();

    memoryDailyRuns.set(runId, runDoc);
    if (db) {
      try {
        await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
      } catch (_) {}
    }

    console.log(`✅ [DailyRecommendations] Completed run ${runId}: Submitted: ${submitted}, Failed: ${failed}, Queued: ${queued}, Skipped: ${runDoc.skippedCount}`);
    return { success: true, runDoc };
  } catch (err) {
    console.error(`❌ [DailyRecommendations] Fatal error executing run ${runId}:`, err);
    runDoc.status = 'failed';
    runDoc.notes = err.message;
    runDoc.completedAt = new Date().toISOString();
    memoryDailyRuns.set(runId, runDoc);
    return { success: false, error: err.message, runDoc };
  } finally {
    isDailyJobRunning = false;
  }
}

/**
 * Send a test recommendation email to a given recipient
 */
async function sendTestDailyRecommendationEmail(targetEmail, profileOverrides = {}) {
  if (!targetEmail || !brevoService.isValidEmail(targetEmail)) {
    throw new Error('Valid email address is required for test email');
  }

  const testUser = {
    id: 'test_admin_recipient',
    name: targetEmail.split('@')[0],
    email: targetEmail,
    dietType: profileOverrides.dietType || 'Vegetarian',
    allergies: profileOverrides.allergies || [],
    spiceLevel: profileOverrides.spiceLevel || 'Medium',
    healthGoals: profileOverrides.healthGoals || ['healthy_eating']
  };

  const recData = buildDailyRecommendationForUser(testUser);
  if (!recData.success) {
    throw new Error('Could not generate safe food recommendations for test profile: ' + recData.reason);
  }

  const result = await brevoService.sendTransactionalEmail({
    to: targetEmail,
    toName: testUser.name,
    subject: `[TEST PREVIEW] ${recData.subject}`,
    html: recData.html,
    text: recData.text,
    tags: ['test', 'daily-recommendation-preview']
  });

  return {
    success: true,
    messageId: result.messageId,
    previewContent: {
      subject: recData.subject,
      picks: recData.picks,
      personalizationReason: recData.personalizationReason
    }
  };
}

/**
 * Retry failed recipients for a given daily run ID
 */
async function retryDailyRunFailures(runId = getDailyRunId()) {
  const failedRecipients = [];
  for (const r of memoryDailyRecipients.values()) {
    if (r.runId === runId && (r.status === 'failed' || r.status === 'queued')) {
      failedRecipients.push(r);
    }
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await safeFirestore(
        db.collection('dailyRecommendationRecipients')
          .where('runId', '==', runId)
          .where('status', 'in', ['failed', 'queued'])
          .get(),
        500
      );
      if (snap) {
        snap.forEach(d => {
          const r = d.data();
          if (!failedRecipients.some(fr => fr.email === r.email)) {
            failedRecipients.push(r);
          }
        });
      }
    } catch (_) {}
  }

  if (failedRecipients.length === 0) {
    return { success: true, retriedCount: 0, message: 'No failed or queued recipients to retry for this run' };
  }

  let retriedCount = 0;
  for (const fr of failedRecipients) {
    try {
      const user = userStore.findByEmail(fr.email) || { email: fr.email, name: fr.email.split('@')[0] };
      const recData = buildDailyRecommendationForUser(user);
      if (recData.success) {
        const sendRes = await brevoService.sendTransactionalEmail({
          to: fr.email,
          toName: user.name,
          subject: recData.subject,
          html: recData.html,
          text: recData.text,
          tags: ['daily-recommendation-retry', runId]
        });

        const recId = `${runId}_${fr.email}`;
        const updated = {
          ...fr,
          status: 'submitted',
          attemptCount: (fr.attemptCount || 1) + 1,
          providerMessageId: sendRes.messageId || null,
          lastAttemptAt: new Date().toISOString()
        };
        memoryDailyRecipients.set(recId, updated);
        if (db) {
          try {
            safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(updated, { merge: true }), 300);
          } catch (_) {}
        }
        retriedCount++;
      }
    } catch (e) {
      console.warn(`Retry failed for ${fr.email}:`, e.message);
    }
  }

  return { success: true, retriedCount, totalFailed: failedRecipients.length };
}

/**
 * Get daily runs history and summary
 */
async function getDailyRunsHistory(limitCount = 10) {
  const runs = Array.from(memoryDailyRuns.values());
  const db = getFirestoreDb();

  if (db) {
    try {
      const snap = await safeFirestore(db.collection('dailyRecommendationRuns').orderBy('startedAt', 'desc').limit(limitCount).get(), 500);
      if (snap) {
        snap.forEach(d => {
          const data = d.data();
          if (!runs.some(r => r.runId === data.runId)) {
            runs.push(data);
          }
        });
      }
    } catch (_) {}
  }

  runs.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  return runs.slice(0, limitCount);
}

module.exports = {
  getKolkataDateString,
  getDailyRunId,
  getEligibleDailyRecipients,
  buildDailyRecommendationForUser,
  executeDailyRecommendationRun,
  sendTestDailyRecommendationEmail,
  retryDailyRunFailures,
  getDailyRunsHistory,
  isJobRunning: () => isDailyJobRunning
};
