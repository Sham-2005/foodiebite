// ─────────────────────────────────────────────────────────────
//  src/services/localStorageService.js
//  Unified LocalStorage Service for offline sessions, preferences, and usage analytics
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'fb_user_session';
const PREFS_KEY = 'fb_user_preferences';
const THREAD_KEY = 'fb_active_thread';

// Frequent usage keys
const STATS_VIEWED = 'fb_stats_viewed';
const STATS_SEARCHED = 'fb_stats_searched';
const STATS_SCANNED = 'fb_stats_scanned';
const STATS_RECOMMENDED = 'fb_stats_recommended';

/**
 * Session Cache Methods (30-day TTL)
 */
export function saveSession(user) {
  if (!user) return;
  const sessionData = {
    uid: user.uid || user.id,
    email: user.email,
    displayName: user.name || user.displayName || 'FoodieBite User',
    // Persist these so VerificationGuard doesn't redirect on refresh
    // before the full Firebase profile finishes loading.
    age: user.age || null,
    gender: user.gender || null,
    profileCompleted: !!(user.age && user.gender),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 Days
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

  // Also save the token locally
  if (user.token) {
    localStorage.setItem('nb_token', user.token);
  }
}

export function getSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;

  try {
    const session = JSON.parse(data);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch (err) {
    console.error('Failed to parse session cache:', err);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('nb_token');
  // Optional: clear thread history
  const active = JSON.parse(localStorage.getItem('nb_mock_active'));
  if (active) {
    localStorage.removeItem('nb_mock_active');
  }
}

export function refreshSessionExpiration() {
  const session = getSession();
  if (session) {
    session.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

/**
 * Preferences Persistence
 */
export function savePreferences(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function getPreferences() {
  const data = localStorage.getItem(PREFS_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Thread Persistence
 */
export function saveLastActiveThread(uid, threadId) {
  localStorage.setItem(`${THREAD_KEY}_${uid}`, threadId);
}

export function getLastActiveThread(uid) {
  return localStorage.getItem(`${THREAD_KEY}_${uid}`) || 'default';
}

/**
 * Frequent Usage Engine
 */
function trackItem(key, itemId, itemData = {}) {
  try {
    const data = localStorage.getItem(key);
    const stats = data ? JSON.parse(data) : {};

    if (stats[itemId]) {
      stats[itemId].count += 1;
      stats[itemId].lastInteracted = new Date().toISOString();
      stats[itemId].data = { ...stats[itemId].data, ...itemData };
    } else {
      stats[itemId] = {
        id: itemId,
        count: 1,
        lastInteracted: new Date().toISOString(),
        data: itemData
      };
    }
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (err) {
    console.error(`Failed to track usage stats for ${key}:`, err);
  }
}

export function trackViewedFood(food) {
  if (!food) return;
  const foodId = food.id || food.foodId;
  trackItem(STATS_VIEWED, foodId, {
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    image: food.image,
    grade: food.grade || food.healthGrade
  });
}

export function trackSearchedFood(queryText) {
  if (!queryText || queryText.trim().length < 2) return;
  trackItem(STATS_SEARCHED, queryText.trim().toLowerCase(), { query: queryText.trim() });
}

export function trackScannedFood(barcode, foodData = {}) {
  if (!barcode) return;
  trackItem(STATS_SCANNED, barcode, {
    barcode,
    name: foodData.name || 'Scanned Food Product',
    calories: foodData.calories,
    protein: foodData.protein,
    image: foodData.image
  });
}

export function trackSelectedRecommendation(foodId, foodData = {}) {
  if (!foodId) return;
  trackItem(STATS_RECOMMENDED, foodId, {
    name: foodData.name,
    calories: foodData.calories,
    protein: foodData.protein,
    image: foodData.image
  });
}

/**
 * Retrieve Frequent Items sorted by count descending
 */
export function getFrequentItems(type, limit = 10) {
  const keyMap = {
    viewed: STATS_VIEWED,
    searched: STATS_SEARCHED,
    scanned: STATS_SCANNED,
    recommended: STATS_RECOMMENDED
  };

  const key = keyMap[type];
  if (!key) return [];

  try {
    const data = localStorage.getItem(key);
    if (!data) return [];

    const stats = JSON.parse(data);
    return Object.values(stats)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (err) {
    console.error(`Failed to retrieve frequent items for ${type}:`, err);
    return [];
  }
}

/**
 * Chat History Caching (30-day retention)
 */
export function saveChatHistory(threadId, messages) {
  try {
    const backupStr = localStorage.getItem('chat_threads') || '{}';
    const backup = JSON.parse(backupStr);
    
    backup[threadId] = messages.map(m => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      source: m.source || 'gemini',
      timestamp: m.timestamp || Date.now()
    }));

    // Prune messages older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const key in backup) {
      backup[key] = backup[key].filter(m => m.timestamp >= thirtyDaysAgo);
      if (backup[key].length === 0) delete backup[key];
    }

    localStorage.setItem('chat_threads', JSON.stringify(backup));
  } catch (err) {
    console.error('Failed to save chat history to local storage:', err);
  }
}

export function loadChatHistory(threadId) {
  try {
    const backupStr = localStorage.getItem('chat_threads') || '{}';
    const backup = JSON.parse(backupStr);
    const tMsgs = backup[threadId] || [];
    return tMsgs.map(m => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      source: m.source || 'gemini',
      time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      timestamp: m.timestamp
    }));
  } catch (err) {
    console.error('Failed to load chat history from local storage:', err);
    return [];
  }
}

