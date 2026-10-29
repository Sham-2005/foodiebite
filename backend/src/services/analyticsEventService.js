// ─────────────────────────────────────────────────────────────
//  backend/src/services/analyticsEventService.js
//  FoodieBite Centralized Behavioral Analytics Event Service
//  Validates, sanitizes, deduplicates and persists behavioral events.
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFirestoreDb } = require('../config/firebase');

const DATA_DIR = path.join(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'analytics_events.json');
const DAILY_FILE = path.join(DATA_DIR, 'analytics_daily.json');

// Supported Event Types
const VALID_EVENT_TYPES = new Set([
  'recommendation_impression',
  'recommendation_click',
  'food_detail_view',
  'food_added_to_favorites',
  'food_removed_from_favorites',
  'food_search',
  'search_result_click',
  'search_no_results',
  'recommendation_feedback',
  'recommendation_session_started',
  'recommendation_session_completed'
]);

// In-memory sliding cache for event deduplication: key -> timestamp
const deduplicationCache = new Map();
const DEDUP_WINDOW_MS = 1500; // 1.5 seconds deduplication window

// Memory buffer for high-throughput batching
let inMemoryEvents = [];
let dailyAggregates = {};

/**
 * Ensure storage directory and local persistence files exist
 */
function initStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(EVENTS_FILE)) {
      const raw = fs.readFileSync(EVENTS_FILE, 'utf8');
      inMemoryEvents = JSON.parse(raw);
    } else {
      inMemoryEvents = [];
      fs.writeFileSync(EVENTS_FILE, JSON.stringify([], null, 2));
    }

    if (fs.existsSync(DAILY_FILE)) {
      const raw = fs.readFileSync(DAILY_FILE, 'utf8');
      dailyAggregates = JSON.parse(raw);
    } else {
      dailyAggregates = {};
      fs.writeFileSync(DAILY_FILE, JSON.stringify({}, null, 2));
    }
  } catch (err) {
    console.warn('⚠️ analyticsEventService: Failed to init storage files:', err.message);
    inMemoryEvents = [];
    dailyAggregates = {};
  }
}

initStorage();

/**
 * Generate a pseudonymous user ID from raw userId or IP/fingerprint
 */
function toPseudonymousId(rawId) {
  if (!rawId) return 'anon_guest';
  if (typeof rawId === 'string' && rawId.startsWith('anon_')) return rawId;
  return 'anon_' + crypto.createHash('sha256').update(String(rawId)).digest('hex').substring(0, 16);
}

/**
 * Sanitize event metadata to ensure strictly no PII or sensitive medical details are stored
 */
function sanitizeMetadata(meta = {}) {
  if (!meta || typeof meta !== 'object') return {};
  const clean = {};
  const forbiddenPatterns = ['email', 'password', 'token', 'medical', 'prescription', 'image_raw', 'phone', 'ssn', 'address', 'credit'];
  const forbiddenNames = ['name', 'user_name', 'username', 'fullname', 'first_name', 'last_name', 'display_name', 'displayname', 'patient_name'];

  for (const [k, v] of Object.entries(meta)) {
    const keyLower = k.toLowerCase();
    if (forbiddenNames.includes(keyLower) || forbiddenPatterns.some(p => keyLower.includes(p))) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      clean[k] = v;
    } else if (Array.isArray(v)) {
      clean[k] = v.filter(item => typeof item === 'string' || typeof item === 'number').slice(0, 10);
    }
  }
  return clean;
}

/**
 * Validate and normalize incoming event payload
 */
function normalizeEvent(payload = {}) {
  const {
    eventType,
    anonymousUserId,
    userId,
    sessionId,
    recommendationId,
    foodId,
    recommendationStrategy,
    experimentId,
    variantId,
    metadata
  } = payload;

  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    throw new Error(`Invalid or unsupported eventType: "${eventType}". Must be one of: ${[...VALID_EVENT_TYPES].join(', ')}`);
  }

  const pUserId = anonymousUserId ? toPseudonymousId(anonymousUserId) : (userId ? toPseudonymousId(userId) : 'anon_guest');
  const now = new Date();

  return {
    eventId: payload.eventId || `evt_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
    eventType,
    occurredAt: payload.occurredAt || now.toISOString(),
    anonymousUserId: pUserId,
    sessionId: sessionId || `sess_${now.toISOString().split('T')[0]}_default`,
    recommendationId: recommendationId || null,
    foodId: foodId ? String(foodId) : null,
    recommendationStrategy: recommendationStrategy || 'general',
    experimentId: experimentId || null,
    variantId: variantId || null,
    metadata: sanitizeMetadata(metadata)
  };
}

/**
 * Check if event is a rapid duplicate
 */
function isDuplicate(event) {
  const dedupKey = `${event.anonymousUserId}:${event.eventType}:${event.foodId || ''}:${event.recommendationId || ''}`;
  const now = Date.now();
  const lastTime = deduplicationCache.get(dedupKey);

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    return true;
  }
  deduplicationCache.set(dedupKey, now);

  // Evict old keys if map exceeds 5000 items
  if (deduplicationCache.size > 5000) {
    const cutoff = now - DEDUP_WINDOW_MS * 2;
    for (const [k, t] of deduplicationCache.entries()) {
      if (t < cutoff) deduplicationCache.delete(k);
    }
  }
  return false;
}

/**
 * Record a single analytics event
 */
async function recordEvent(rawPayload) {
  const event = normalizeEvent(rawPayload);

  // Suppress duplicate impressions and clicks within window
  if (isDuplicate(event)) {
    return { success: true, deduplicated: true, eventId: event.eventId };
  }

  // 1. In-memory append (bounded to last 50,000 events)
  inMemoryEvents.push(event);
  if (inMemoryEvents.length > 50000) {
    inMemoryEvents = inMemoryEvents.slice(-40000);
  }

  // 2. Persist to local JSON file asynchronously
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(inMemoryEvents.slice(-5000), null, 2));
  } catch (err) {
    console.warn('⚠️ Failed to flush analytics event to disk:', err.message);
  }

  // 3. Update Daily Aggregation
  updateDailyAggregate(event);

  // 4. Save to Firestore if available
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('analyticsEvents').doc(event.eventId).set(event);
    } catch (fsErr) {
      // Non-fatal if offline
    }
  }

  return { success: true, eventId: event.eventId, eventType: event.eventType };
}

/**
 * Record a batch of analytics events
 */
async function recordBatchEvents(eventsList = []) {
  if (!Array.isArray(eventsList)) {
    throw new Error('Batch events payload must be an array of event objects.');
  }
  const results = [];
  for (const raw of eventsList) {
    try {
      const res = await recordEvent(raw);
      results.push(res);
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  return { success: true, processed: results.length, details: results };
}

/**
 * Increment daily rollup aggregate metrics
 */
function updateDailyAggregate(event) {
  const dateKey = (event.occurredAt || new Date().toISOString()).split('T')[0];
  if (!dailyAggregates[dateKey]) {
    dailyAggregates[dateKey] = {
      date: dateKey,
      totalEvents: 0,
      recommendationImpressions: 0,
      recommendationClicks: 0,
      foodDetailViews: 0,
      favoritesAdded: 0,
      favoritesRemoved: 0,
      searches: 0,
      searchSuccesses: 0,
      searchNoResults: 0,
      feedbacks: 0,
      feedbackPositive: 0,
      feedbackNeutral: 0,
      feedbackNegative: 0,
      uniqueUsers: {},
      strategyBreakdown: {},
      categoryBreakdown: {},
      cuisineBreakdown: {}
    };
  }

  const d = dailyAggregates[dateKey];
  d.totalEvents++;
  d.uniqueUsers[event.anonymousUserId] = true;

  const strategy = event.recommendationStrategy || 'general';
  if (!d.strategyBreakdown[strategy]) {
    d.strategyBreakdown[strategy] = { impressions: 0, clicks: 0, favorites: 0 };
  }

  const category = event.metadata?.foodCategory || 'Uncategorized';
  if (!d.categoryBreakdown[category]) {
    d.categoryBreakdown[category] = { impressions: 0, clicks: 0, searches: 0, favorites: 0 };
  }

  const cuisine = event.metadata?.cuisine || 'General';
  if (!d.cuisineBreakdown[cuisine]) {
    d.cuisineBreakdown[cuisine] = { impressions: 0, clicks: 0, searches: 0 };
  }

  switch (event.eventType) {
    case 'recommendation_impression':
      d.recommendationImpressions++;
      d.strategyBreakdown[strategy].impressions++;
      d.categoryBreakdown[category].impressions++;
      d.cuisineBreakdown[cuisine].impressions++;
      break;
    case 'recommendation_click':
      d.recommendationClicks++;
      d.strategyBreakdown[strategy].clicks++;
      d.categoryBreakdown[category].clicks++;
      d.cuisineBreakdown[cuisine].clicks++;
      break;
    case 'food_detail_view':
      d.foodDetailViews++;
      break;
    case 'food_added_to_favorites':
      d.favoritesAdded++;
      d.strategyBreakdown[strategy].favorites++;
      d.categoryBreakdown[category].favorites++;
      break;
    case 'food_removed_from_favorites':
      d.favoritesRemoved++;
      break;
    case 'food_search':
      d.searches++;
      d.categoryBreakdown[category].searches++;
      d.cuisineBreakdown[cuisine].searches++;
      break;
    case 'search_result_click':
      d.searchSuccesses++;
      break;
    case 'search_no_results':
      d.searchNoResults++;
      break;
    case 'recommendation_feedback': {
      d.feedbacks++;
      const rating = Number(event.metadata?.rating);
      if (rating >= 4) d.feedbackPositive++;
      else if (rating === 3) d.feedbackNeutral++;
      else if (rating > 0) d.feedbackNegative++;
      break;
    }
  }

  // Persist daily rollup periodically
  try {
    fs.writeFileSync(DAILY_FILE, JSON.stringify(dailyAggregates, null, 2));
  } catch (_) {}
}

/**
 * Query in-memory and persisted events with filtering
 */
function queryEvents(filters = {}) {
  const {
    eventType,
    startDate,
    endDate,
    anonymousUserId,
    foodId,
    recommendationStrategy,
    experimentId,
    limit = 1000,
    offset = 0
  } = filters;

  let filtered = inMemoryEvents;

  if (eventType) {
    filtered = filtered.filter(e => e.eventType === eventType);
  }
  if (startDate) {
    filtered = filtered.filter(e => e.occurredAt >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(e => e.occurredAt <= endDate);
  }
  if (anonymousUserId) {
    filtered = filtered.filter(e => e.anonymousUserId === anonymousUserId);
  }
  if (foodId) {
    filtered = filtered.filter(e => e.foodId === foodId);
  }
  if (recommendationStrategy) {
    filtered = filtered.filter(e => e.recommendationStrategy === recommendationStrategy);
  }
  if (experimentId) {
    filtered = filtered.filter(e => e.experimentId === experimentId);
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return { total, events: paged, offset, limit };
}

/**
 * Retrieve daily aggregated summaries
 */
function getDailySummaries(days = 30) {
  const dateKeys = Object.keys(dailyAggregates).sort().slice(-days);
  return dateKeys.map(k => {
    const raw = dailyAggregates[k];
    const uCount = Object.keys(raw.uniqueUsers || {}).length;
    const ctr = raw.recommendationImpressions > 0 
      ? Number(((raw.recommendationClicks / raw.recommendationImpressions) * 100).toFixed(2)) 
      : 0;
    const favConversion = raw.recommendationImpressions > 0 
      ? Number(((raw.favoritesAdded / raw.recommendationImpressions) * 100).toFixed(2)) 
      : 0;
    const searchSuccessRate = raw.searches > 0 
      ? Number(((raw.searchSuccesses / raw.searches) * 100).toFixed(2)) 
      : 0;

    return {
      ...raw,
      uniqueUsersCount: uCount,
      uniqueUsers: undefined, // remove map for lightweight payload
      ctr,
      favConversionRate: favConversion,
      searchSuccessRate
    };
  });
}

module.exports = {
  VALID_EVENT_TYPES,
  toPseudonymousId,
  sanitizeMetadata,
  normalizeEvent,
  recordEvent,
  recordBatchEvents,
  queryEvents,
  getDailySummaries
};
