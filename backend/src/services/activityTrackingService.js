// ─────────────────────────────────────────────────────────────
//  src/services/activityTrackingService.js
//  Privacy-Conscious Feature Usage & User Activity Tracking Service
//  Aggregates daily metrics and tracks real user active timestamps.
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const { getFirestoreDb } = require('../config/firebase');

// In-memory cache for fast lookups & throttling
const recentUserActivityThrottles = new Map(); // userId -> lastRecordedMs
const memoryAggregates = new Map(); // dateString -> { [feature]: count }

// Formats YYYY-MM-DD in UTC / reporting timezone
function getReportingDateKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Record real user activity timestamp in Firestore (throttled to once every 5 minutes per user).
 * This ensures "Active Users in the Last 30 Days" relies on actual application activity.
 */
async function recordUserActivity(userId) {
  if (!userId || typeof userId !== 'string' || userId.startsWith('guest_') || userId === 'mock_guest_token_dev_2026') {
    return;
  }

  const now = Date.now();
  const lastRecorded = recentUserActivityThrottles.get(userId) || 0;
  // Throttle to once every 5 minutes to prevent Firestore write spam
  if (now - lastRecorded < 5 * 60 * 1000) {
    return;
  }
  recentUserActivityThrottles.set(userId, now);

  const db = getFirestoreDb();
  if (db) {
    try {
      const isoNow = new Date(now).toISOString();
      await db.collection('users').doc(userId).set({
        lastActiveAt: isoNow
      }, { merge: true });
    } catch (err) {
      console.warn(`⚠️ recordUserActivity warning for ${userId}:`, err.message);
    }
  }
}

/**
 * Privacy-conscious feature usage tracking.
 * Supported features: 'recommendations', 'searches', 'favorites_added',
 * 'favorites_removed', 'food_detail_views', 'ai_coach_queries'
 */
async function trackFeatureUsage(featureName, userId = null, meta = {}) {
  try {
    const validFeatures = [
      'recommendations',
      'searches',
      'favorites_added',
      'favorites_removed',
      'food_detail_views',
      'ai_coach_queries'
    ];

    if (!validFeatures.includes(featureName)) {
      return;
    }

    const dateKey = getReportingDateKey();

    // 1. Update in-memory aggregate
    if (!memoryAggregates.has(dateKey)) {
      memoryAggregates.set(dateKey, {
        recommendations: 0,
        searches: 0,
        favorites_added: 0,
        favorites_removed: 0,
        food_detail_views: 0,
        ai_coach_queries: 0
      });
    }
    const memData = memoryAggregates.get(dateKey);
    memData[featureName] = (memData[featureName] || 0) + 1;

    // 2. Track user activity if registered user
    if (userId) {
      recordUserActivity(userId).catch(() => {});
    }

    // 3. Increment daily aggregate in Firestore
    const db = getFirestoreDb();
    if (db) {
      const FieldValue = admin.firestore.FieldValue;
      const docRef = db.collection('feature_aggregates').doc(dateKey);
      await docRef.set({
        date: dateKey,
        [featureName]: FieldValue.increment(1),
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err) {
    console.warn(`⚠️ trackFeatureUsage error (${featureName}):`, err.message);
  }
}

/**
 * Get feature usage statistics over the last N days.
 */
async function getFeatureUsageStats(days = 30) {
  const db = getFirestoreDb();
  const results = [];
  const totals = {
    recommendations: 0,
    searches: 0,
    favorites_added: 0,
    favorites_removed: 0,
    food_detail_views: 0,
    ai_coach_queries: 0
  };

  // Generate date keys for the requested window
  const now = new Date();
  const dateKeys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dateKeys.push(getReportingDateKey(d));
  }

  // Load from Firestore if available
  const dbDocs = new Map();
  if (db) {
    try {
      const snap = await db.collection('feature_aggregates')
        .where('date', '>=', dateKeys[0])
        .where('date', '<=', dateKeys[dateKeys.length - 1])
        .get();

      snap.forEach(doc => {
        dbDocs.set(doc.id, doc.data());
      });
    } catch (err) {
      console.warn('⚠️ getFeatureUsageStats Firestore read warning:', err.message);
    }
  }

  for (const dateKey of dateKeys) {
    const docData = dbDocs.get(dateKey) || memoryAggregates.get(dateKey) || {};
    const item = {
      date: dateKey,
      recommendations: docData.recommendations || 0,
      searches: docData.searches || 0,
      favorites_added: docData.favorites_added || 0,
      favorites_removed: docData.favorites_removed || 0,
      food_detail_views: docData.food_detail_views || 0,
      ai_coach_queries: docData.ai_coach_queries || 0
    };
    results.push(item);

    totals.recommendations += item.recommendations;
    totals.searches += item.searches;
    totals.favorites_added += item.favorites_added;
    totals.favorites_removed += item.favorites_removed;
    totals.food_detail_views += item.food_detail_views;
    totals.ai_coach_queries += item.ai_coach_queries;
  }

  return {
    days,
    totals,
    timeline: results
  };
}

/**
 * Log administrative operations for security audit compliance.
 */
async function logAdminAudit(adminUser, action, details = {}, ip = null) {
  try {
    const db = getFirestoreDb();
    const entry = {
      adminId: adminUser?.uid || adminUser?.id || 'unknown_admin',
      adminEmail: adminUser?.email || 'unknown_admin',
      action,
      details,
      ip: ip || 'system',
      timestamp: new Date().toISOString()
    };

    console.log(`🛡️ [ADMIN AUDIT] ${entry.adminEmail} performed ${action}:`, details);

    if (db) {
      await db.collection('admin_audit_logs').add(entry);
    }
    return entry;
  } catch (err) {
    console.error('⚠️ Failed to write admin audit log:', err.message);
    return null;
  }
}

/**
 * Get recent admin audit logs (paginated).
 */
async function getAdminAuditLogs(limit = 50, startAfter = null) {
  const db = getFirestoreDb();
  const logs = [];

  if (db) {
    try {
      let query = db.collection('admin_audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(limit);

      const snap = await query.get();
      snap.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });
    } catch (err) {
      console.warn('⚠️ getAdminAuditLogs read failed:', err.message);
    }
  }

  return logs;
}

module.exports = {
  recordUserActivity,
  trackFeatureUsage,
  getFeatureUsageStats,
  logAdminAudit,
  getAdminAuditLogs,
  getReportingDateKey
};
