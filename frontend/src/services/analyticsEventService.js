// ─────────────────────────────────────────────────────────────
//  frontend/src/services/analyticsEventService.js
//  FoodieBite Client-Side Centralized Analytics Event Tracking Service
//  Manages pseudonymous user ID, session ID, batched dispatch, and deduplication.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

const STORAGE_KEYS = {
  ANONYMOUS_USER_ID: 'foodiebite_anon_user_id',
  SESSION_ID: 'foodiebite_analytics_session_id',
  SESSION_EXPIRES: 'foodiebite_analytics_session_expires'
};

// In-memory queue for batched network writes
let eventQueue = [];
let batchTimeout = null;
const FLUSH_INTERVAL_MS = 2500; // 2.5 seconds

// Set of already recorded impressions in this session to prevent re-render duplicates
const recordedImpressions = new Set();

/**
 * Get or create persistent pseudonymous user ID
 */
export function getAnonymousUserId(userId = null) {
  if (userId) {
    return 'anon_' + String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      let id = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_USER_ID);
      if (!id) {
        id = 'anon_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEYS.ANONYMOUS_USER_ID, id);
      }
      return id;
    } catch (_) {}
  }
  return 'anon_guest_' + Date.now();
}

/**
 * Get or renew session ID (30-minute inactivity timeout)
 */
export function getAnalyticsSessionId() {
  const now = Date.now();
  const thirtyMins = 30 * 60 * 1000;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      let sessId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
      let exp = parseInt(sessionStorage.getItem(STORAGE_KEYS.SESSION_EXPIRES) || '0', 10);

      if (!sessId || now > exp) {
        sessId = 'sess_' + now.toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessId);
      }
      sessionStorage.setItem(STORAGE_KEYS.SESSION_EXPIRES, String(now + thirtyMins));
      return sessId;
    } catch (_) {}
  }
  return 'sess_default';
}

/**
 * Flush queued events to backend
 */
export async function flushEventQueue() {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    const apiUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api') + '/analytics/events/batch';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: eventsToSend })
    });
    if (!response.ok) {
      console.warn('Analytics batch write status:', response.status);
    }
  } catch (err) {
    // Fail silently: analytics failures must never interrupt user experience
    console.debug('Analytics batch flush note:', err.message);
  }
}

/**
 * Queue event for dispatch
 */
function queueEvent(event) {
  eventQueue.push(event);

  if (eventQueue.length >= 10) {
    if (batchTimeout) clearTimeout(batchTimeout);
    flushEventQueue();
  } else if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      batchTimeout = null;
      flushEventQueue();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Base tracking dispatch
 */
export function trackEvent(eventType, payload = {}) {
  try {
    const occurredAt = new Date().toISOString();
    const anonymousUserId = getAnonymousUserId(payload.userId);
    const sessionId = getAnalyticsSessionId();

    const event = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      occurredAt,
      anonymousUserId,
      sessionId,
      recommendationId: payload.recommendationId || null,
      foodId: payload.foodId || payload.food?.id || null,
      recommendationStrategy: payload.recommendationStrategy || payload.strategy || 'general',
      experimentId: payload.experimentId || null,
      variantId: payload.variantId || null,
      metadata: {
        foodName: payload.food?.name || payload.foodName || null,
        foodCategory: payload.food?.category || payload.foodCategory || 'Healthy',
        cuisine: payload.food?.cuisine || payload.cuisine || 'General',
        dietType: payload.dietType || null,
        rating: payload.rating || null,
        query: payload.query || null,
        position: payload.position !== undefined ? payload.position : null,
        platform: Platform.OS
      }
    };

    queueEvent(event);
  } catch (err) {
    console.debug('Analytics trackEvent safe note:', err.message);
  }
}

// ── High-Level Reusable Semantic Tracking Helpers ──────────────

/**
 * Track Recommendation Impression (Deduplicated per session/recommendation batch)
 */
export function trackRecommendationImpression(food, meta = {}) {
  if (!food) return;
  const foodId = food.id || food.foodId;
  const recId = meta.recommendationId || 'default';
  const dedupKey = `${recId}:${foodId}`;

  if (recordedImpressions.has(dedupKey)) {
    return; // Already counted as visible impression in this batch
  }
  recordedImpressions.add(dedupKey);

  trackEvent('recommendation_impression', {
    food,
    foodId,
    recommendationId: meta.recommendationId,
    recommendationStrategy: meta.recommendationStrategy || meta.strategy || food.recommendationStrategy || 'context_aware',
    experimentId: meta.experimentId,
    variantId: meta.variantId,
    position: meta.position
  });
}

/**
 * Track Recommendation Click
 */
export function trackRecommendationClick(food, meta = {}) {
  if (!food) return;
  trackEvent('recommendation_click', {
    food,
    foodId: food.id || food.foodId,
    recommendationId: meta.recommendationId || food.recommendationId,
    recommendationStrategy: meta.recommendationStrategy || meta.strategy || food.recommendationStrategy || 'context_aware',
    experimentId: meta.experimentId || food.experimentId,
    variantId: meta.variantId || food.variantId,
    position: meta.position
  });
}

/**
 * Track Food Detail View
 */
export function trackFoodDetailView(food, meta = {}) {
  if (!food) return;
  trackEvent('food_detail_view', {
    food,
    foodId: food.id || food.foodId,
    recommendationId: meta.recommendationId || food.recommendationId,
    recommendationStrategy: meta.recommendationStrategy || food.recommendationStrategy,
    ...meta
  });
}

/**
 * Track Food Added to Favorites
 */
export function trackFoodAddedToFavorites(food, meta = {}) {
  if (!food) return;
  trackEvent('food_added_to_favorites', {
    food,
    foodId: food.id || food.foodId,
    recommendationId: meta.recommendationId || food.recommendationId,
    recommendationStrategy: meta.recommendationStrategy || food.recommendationStrategy,
    ...meta
  });
}

/**
 * Track Food Removed from Favorites
 */
export function trackFoodRemovedFromFavorites(foodId, meta = {}) {
  trackEvent('food_removed_from_favorites', {
    foodId,
    ...meta
  });
}

/**
 * Track Food Search
 */
export function trackFoodSearch(query, resultCount = 0, meta = {}) {
  if (!query || !query.trim()) return;
  trackEvent('food_search', {
    query: query.trim(),
    metadata: {
      query: query.trim(),
      resultCount,
      hasResults: resultCount > 0,
      ...meta
    }
  });

  if (resultCount === 0) {
    trackEvent('search_no_results', {
      query: query.trim()
    });
  }
}

/**
 * Track Search Result Click
 */
export function trackSearchResultClick(food, query, meta = {}) {
  if (!food) return;
  trackEvent('search_result_click', {
    food,
    foodId: food.id || food.foodId,
    query,
    ...meta
  });
}

/**
 * Track Recommendation Feedback (1-5 stars)
 */
export function trackRecommendationFeedback(rating, message = '', meta = {}) {
  trackEvent('recommendation_feedback', {
    rating,
    metadata: {
      rating,
      messageSnippet: message ? message.slice(0, 100) : '',
      ...meta
    }
  });
}

// Flush queue before web page unloads
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', () => {
    flushEventQueue();
  });
}

export default {
  getAnonymousUserId,
  getAnalyticsSessionId,
  flushEventQueue,
  trackEvent,
  trackRecommendationImpression,
  trackRecommendationClick,
  trackFoodDetailView,
  trackFoodAddedToFavorites,
  trackFoodRemovedFromFavorites,
  trackFoodSearch,
  trackSearchResultClick,
  trackRecommendationFeedback
};
