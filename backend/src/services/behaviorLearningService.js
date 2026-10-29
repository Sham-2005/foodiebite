// ─────────────────────────────────────────────────────────────
//  backend/src/services/behaviorLearningService.js
//  Phase 5: Behavioral Learning, Preference Evolution & Adaptive Store
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

// ── 1. Centralized Configuration ──────────────────────────────
const BEHAVIOR_CONFIG = {
  // Positive & Negative Signal Weights
  SIGNAL_WEIGHTS: {
    food_consumed: 1.0,
    recommendation_favorited: 1.0,
    recommendation_accepted: 0.8,
    recommendation_clicked: 0.4,
    food_details_viewed: 0.4,
    cuisine_selected: 0.6,
    spice_preference_selected: 0.5,
    food_searched: 0.2,
    recommendation_viewed: 0.05,
    recommendation_rejected: -0.8,
    recommendation_unfavorited: -0.5,
    food_skipped: -0.15 // weak negative, accumulates on repetition
  },

  // Time decay half-life: 14 days (in ms)
  DECAY_HALF_LIFE_MS: 14 * 24 * 60 * 60 * 1000,

  // Confidence saturation threshold: 5 independent interactions = 1.0 confidence
  CONFIDENCE_SATURATION_COUNT: 5,

  // Max events retained per user (bounded history window)
  MAX_EVENTS_PER_USER: 200,

  // Default exploration rate (15% safe exploration)
  DEFAULT_EXPLORATION_RATE: 0.15,

  // Minimum distinct food evidence count for ingredient learning
  MIN_INGREDIENT_EVIDENCE: 2,

  // Recommendation Scoring Bonus / Penalty Multipliers
  SCORING: {
    CUISINE_BONUS: 15.0,
    FOOD_BONUS: 20.0,
    INGREDIENT_BONUS: 8.0,
    DISLIKED_FOOD_PENALTY: 35.0,
    DISLIKED_INGREDIENT_PENALTY: 20.0,
    SPICE_MATCH_BONUS: 10.0,
    MEAL_TYPE_BONUS: 10.0,
    WEATHER_FOOD_BONUS: 8.0,
    GOAL_ALIGNMENT_BONUS: 8.0
  }
};

// Supported Event Types
const SUPPORTED_EVENTS = Object.keys(BEHAVIOR_CONFIG.SIGNAL_WEIGHTS);

// In-memory cache for ultra-fast recommendation path lookup
const memoryEventsStore = new Map(); // userId -> Array<NormalizedEvent>
const memoryProfileStore = new Map(); // userId -> NormalizedBehavioralProfile

// ── Lazy Firestore getter ─────────────────────────────────────
function getDb() {
  try {
    if (admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (err) {
    // Graceful fallback to in-memory store
  }
  return null;
}

// ── 2. Blank Behavioral Profile Generator ─────────────────────
function getBlankBehavioralProfile(userId = 'default_user') {
  return {
    userId,
    preferredCuisines: {},      // [cuisine]: { score, confidence, evidenceCount }
    preferredFoods: {},         // [foodId]: { score, confidence, evidenceCount, name }
    dislikedFoods: {},          // [foodId]: { score, confidence, evidenceCount, name }
    preferredIngredients: {},   // [ingredient]: { score, confidence, evidenceCount }
    dislikedIngredients: {},    // [ingredient]: { score, confidence, evidenceCount }
    preferredSpiceLevel: {},    // [level]: { score, confidence, evidenceCount }
    preferredMealTypes: {},     // [mealType]: { score, confidence, evidenceCount }
    preferredWeatherFoods: {},  // [weatherCategory]: { score, confidence, evidenceCount }
    observedGoalSignals: {},    // [goal]: { score, confidence, evidenceCount }
    explorationRate: BEHAVIOR_CONFIG.DEFAULT_EXPLORATION_RATE,
    lastUpdated: new Date().toISOString()
  };
}

// ── 3. Event Normalization ────────────────────────────────────
/**
 * Normalizes and validates a raw behavioral event.
 * Strips any sensitive clinical or diagnosis data to enforce medical privacy.
 */
function normalizeEvent(rawEvent, fallbackUserId = 'default_user') {
  if (!rawEvent || typeof rawEvent !== 'object') return null;

  const type = String(rawEvent.type || '').trim().toLowerCase();
  if (!SUPPORTED_EVENTS.includes(type)) {
    return null;
  }

  const userId = String(rawEvent.userId || fallbackUserId).trim() || 'default_user';
  const timestamp = typeof rawEvent.timestamp === 'number'
    ? rawEvent.timestamp
    : (rawEvent.timestamp ? new Date(rawEvent.timestamp).getTime() : Date.now());

  const normalized = {
    type,
    userId,
    timestamp: isNaN(timestamp) ? Date.now() : timestamp
  };

  if (rawEvent.foodId) {
    normalized.foodId = String(rawEvent.foodId).trim();
  }
  if (rawEvent.foodName || rawEvent.name) {
    normalized.foodName = String(rawEvent.foodName || rawEvent.name).trim();
  }
  if (rawEvent.cuisine) {
    normalized.cuisine = String(rawEvent.cuisine).trim().toLowerCase();
  }
  if (rawEvent.spiceLevel) {
    normalized.spiceLevel = String(rawEvent.spiceLevel).trim().toLowerCase();
  }
  if (Array.isArray(rawEvent.ingredients)) {
    normalized.ingredients = rawEvent.ingredients
      .map(i => String(i).toLowerCase().trim())
      .filter(Boolean);
  }
  if (rawEvent.query) {
    normalized.query = String(rawEvent.query).trim().toLowerCase();
  }
  if (rawEvent.mealType || rawEvent.mealPeriod) {
    normalized.mealType = String(rawEvent.mealType || rawEvent.mealPeriod).trim().toLowerCase();
  }

  // Sanitize context: capture only weather/season/mealPeriod, NO medical data
  if (rawEvent.context && typeof rawEvent.context === 'object') {
    normalized.context = {};
    if (rawEvent.context.weather) {
      const w = rawEvent.context.weather;
      normalized.context.weather = typeof w === 'string' ? w.toLowerCase() : (w.category || w.condition || '').toLowerCase();
    }
    if (rawEvent.context.mealPeriod) {
      normalized.context.mealPeriod = String(rawEvent.context.mealPeriod).toLowerCase();
    }
    if (rawEvent.context.season) {
      const s = rawEvent.context.season;
      normalized.context.season = typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase();
    }
  }

  return normalized;
}

// ── 4. Time Decay Calculator ──────────────────────────────────
/**
 * Calculates exponential time-decay factor between 0.0 and 1.0.
 * Weight(t) = exp(-ln(2) * (now - t) / halfLife)
 */
function calculateTimeDecay(eventTimestamp, currentTime = Date.now(), halfLifeMs = BEHAVIOR_CONFIG.DECAY_HALF_LIFE_MS) {
  const ageMs = Math.max(0, currentTime - eventTimestamp);
  const lambda = Math.LN2 / halfLifeMs;
  return Math.exp(-lambda * ageMs);
}

// ── 5. Confidence Calculator ──────────────────────────────────
/**
 * Derives confidence based on accumulated evidence count.
 * Scales smoothly from 0.0 up to 1.0 at CONFIDENCE_SATURATION_COUNT.
 */
function calculateConfidence(evidenceCount, saturationCount = BEHAVIOR_CONFIG.CONFIDENCE_SATURATION_COUNT) {
  if (!evidenceCount || evidenceCount <= 0) return 0;
  return Math.min(1.0, Math.round((evidenceCount / saturationCount) * 100) / 100);
}

// ── 6. Aggregate Behavioral Profile ───────────────────────────
/**
 * Aggregates a user's chronological events with time decay into a normalized BehavioralProfile.
 */
function aggregateBehavior(events = [], userId = 'default_user', currentTime = Date.now()) {
  const profile = getBlankBehavioralProfile(userId);
  if (!Array.isArray(events) || events.length === 0) {
    return profile;
  }

  // Accumulation buckets: { [key]: { positiveSum, negativeSum, count, name, meta } }
  const foods = {};
  const cuisines = {};
  const ingredients = {};
  const spiceLevels = {};
  const mealTypes = {};
  const weatherFoods = {};
  const goalSignals = {};

  // Track distinct foods per ingredient to prevent single-dish false generalizations
  const ingredientDistinctFoods = {};

  for (const event of events) {
    const baseWeight = BEHAVIOR_CONFIG.SIGNAL_WEIGHTS[event.type] || 0;
    if (baseWeight === 0) continue;

    const decay = calculateTimeDecay(event.timestamp, currentTime);
    const effectiveWeight = baseWeight * decay;
    const isPositive = effectiveWeight > 0;
    const absWeight = Math.abs(effectiveWeight);

    // ── A. Food Aggregation ──
    if (event.foodId) {
      const fid = event.foodId;
      if (!foods[fid]) {
        foods[fid] = { pos: 0, neg: 0, count: 0, name: event.foodName || fid };
      }
      if (isPositive) {
        foods[fid].pos += absWeight;
      } else {
        foods[fid].neg += absWeight;
      }
      foods[fid].count += 1;
      if (event.foodName) foods[fid].name = event.foodName;

      // Ingredient correlation
      if (Array.isArray(event.ingredients) && event.ingredients.length > 0) {
        for (const ing of event.ingredients) {
          if (!ingredients[ing]) {
            ingredients[ing] = { pos: 0, neg: 0, count: 0 };
            ingredientDistinctFoods[ing] = new Set();
          }
          ingredientDistinctFoods[ing].add(fid);
          if (isPositive) {
            ingredients[ing].pos += absWeight * 0.7; // ingredient signal is secondary
          } else {
            ingredients[ing].neg += absWeight * 0.7;
          }
          ingredients[ing].count += 1;
        }
      }
    }

    // ── B. Cuisine Aggregation ──
    if (event.cuisine) {
      const c = event.cuisine;
      if (!cuisines[c]) {
        cuisines[c] = { pos: 0, neg: 0, count: 0 };
      }
      if (isPositive) cuisines[c].pos += absWeight;
      else cuisines[c].neg += absWeight;
      cuisines[c].count += 1;
    }

    // ── C. Spice Level Aggregation ──
    if (event.spiceLevel) {
      const sp = event.spiceLevel;
      if (!spiceLevels[sp]) {
        spiceLevels[sp] = { pos: 0, neg: 0, count: 0 };
      }
      if (isPositive) spiceLevels[sp].pos += absWeight;
      else spiceLevels[sp].neg += absWeight;
      spiceLevels[sp].count += 1;
    }

    // ── D. Meal Type Aggregation ──
    const mType = event.mealType || event.context?.mealPeriod;
    if (mType) {
      if (!mealTypes[mType]) {
        mealTypes[mType] = { pos: 0, count: 0 };
      }
      if (isPositive) {
        mealTypes[mType].pos += absWeight;
        mealTypes[mType].count += 1;
      }
    }

    // ── E. Weather Context Aggregation ──
    const wCtx = event.context?.weather;
    if (wCtx && isPositive) {
      if (!weatherFoods[wCtx]) {
        weatherFoods[wCtx] = { pos: 0, count: 0 };
      }
      weatherFoods[wCtx].pos += absWeight;
      weatherFoods[wCtx].count += 1;
    }

    // ── F. Search Queries → Observed Goal & Interest Signals ──
    if (event.type === 'food_searched' && event.query) {
      const q = event.query;
      if (/protein|muscle|gym|workout|shake/i.test(q)) {
        goalSignals['high_protein'] = (goalSignals['high_protein'] || 0) + 1;
      }
      if (/low calorie|weight loss|diet|light|slimming/i.test(q)) {
        goalSignals['weight_loss'] = (goalSignals['weight_loss'] || 0) + 1;
      }
      if (/sugar|diabetic|low gi|glycemic/i.test(q)) {
        goalSignals['diabetic_friendly'] = (goalSignals['diabetic_friendly'] || 0) + 1;
      }
      if (/fiber|digestion|gut/i.test(q)) {
        goalSignals['high_fiber'] = (goalSignals['high_fiber'] || 0) + 1;
      }
    }
  }

  // ── 7. Normalize Scores into Behavioral Profile ─────────────

  // 1. Preferred Foods vs Disliked Foods
  for (const [fid, data] of Object.entries(foods)) {
    const net = data.pos - data.neg;
    const confidence = calculateConfidence(data.count);

    if (net > 0.3 && data.pos > data.neg) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.0)) * 100) / 100);
      profile.preferredFoods[fid] = {
        name: data.name,
        score,
        confidence,
        evidenceCount: data.count
      };
    } else if (data.neg > 0.4 && data.neg > data.pos) {
      const score = Math.min(1.0, Math.round((data.neg / (data.neg + 1.0)) * 100) / 100);
      profile.dislikedFoods[fid] = {
        name: data.name,
        score,
        confidence,
        evidenceCount: data.count
      };
    }
  }

  // 2. Preferred Cuisines
  for (const [c, data] of Object.entries(cuisines)) {
    const net = data.pos - data.neg;
    if (net > 0.2) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.5)) * 100) / 100);
      profile.preferredCuisines[c] = {
        score,
        confidence: calculateConfidence(data.count),
        evidenceCount: data.count
      };
    }
  }

  // 3. Ingredients (Requires evidence from >= MIN_INGREDIENT_EVIDENCE distinct foods)
  for (const [ing, data] of Object.entries(ingredients)) {
    const distinctCount = (ingredientDistinctFoods[ing] && ingredientDistinctFoods[ing].size) || 0;
    if (distinctCount < BEHAVIOR_CONFIG.MIN_INGREDIENT_EVIDENCE) {
      continue; // Skip generalizing from a single dish
    }

    const net = data.pos - data.neg;
    const confidence = calculateConfidence(data.count, 6);

    if (net > 0.4 && data.pos > data.neg) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.5)) * 100) / 100);
      profile.preferredIngredients[ing] = { score, confidence, evidenceCount: data.count };
    } else if (data.neg > 0.4 && data.neg > data.pos) {
      const score = Math.min(1.0, Math.round((data.neg / (data.neg + 1.5)) * 100) / 100);
      profile.dislikedIngredients[ing] = { score, confidence, evidenceCount: data.count };
    }
  }

  // 4. Spice Levels
  for (const [sp, data] of Object.entries(spiceLevels)) {
    if (data.pos > data.neg && data.pos > 0.2) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.0)) * 100) / 100);
      profile.preferredSpiceLevel[sp] = {
        score,
        confidence: calculateConfidence(data.count),
        evidenceCount: data.count
      };
    }
  }

  // 5. Preferred Meal Types
  for (const [mt, data] of Object.entries(mealTypes)) {
    if (data.pos > 0.3) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.5)) * 100) / 100);
      profile.preferredMealTypes[mt] = {
        score,
        confidence: calculateConfidence(data.count),
        evidenceCount: data.count
      };
    }
  }

  // 6. Preferred Weather Foods
  for (const [w, data] of Object.entries(weatherFoods)) {
    if (data.pos > 0.3) {
      const score = Math.min(1.0, Math.round((data.pos / (data.pos + 1.5)) * 100) / 100);
      profile.preferredWeatherFoods[w] = {
        score,
        confidence: calculateConfidence(data.count),
        evidenceCount: data.count
      };
    }
  }

  // 7. Observed Goal Signals
  for (const [goal, count] of Object.entries(goalSignals)) {
    if (count >= 2) {
      profile.observedGoalSignals[goal] = {
        score: Math.min(1.0, Math.round((count / (count + 2.0)) * 100) / 100),
        confidence: calculateConfidence(count, 4),
        evidenceCount: count
      };
    }
  }

  profile.lastUpdated = new Date().toISOString();
  return profile;
}

// ── 8. Centralized Event Recording & Persistence ──────────────
/**
 * Records a new behavioral event, persists it, and updates the user's BehavioralProfile.
 * Supports Firestore when available and maintains an active in-memory cache.
 */
async function recordBehaviorEvent(userId, rawEvent) {
  const normEvent = normalizeEvent(rawEvent, userId);
  if (!normEvent) {
    return { success: false, reason: 'Invalid or unsupported event format' };
  }

  const uId = normEvent.userId;

  // 1. In-memory append
  let userEvents = memoryEventsStore.get(uId) || [];
  userEvents.push(normEvent);

  // Keep bounded window
  if (userEvents.length > BEHAVIOR_CONFIG.MAX_EVENTS_PER_USER) {
    userEvents = userEvents.slice(userEvents.length - BEHAVIOR_CONFIG.MAX_EVENTS_PER_USER);
  }
  memoryEventsStore.set(uId, userEvents);

  // 2. Re-aggregate updated behavioral profile
  const updatedProfile = aggregateBehavior(userEvents, uId);
  memoryProfileStore.set(uId, updatedProfile);

  // 3. Asynchronously persist to Firestore (with error isolation)
  const db = getDb();
  if (db) {
    try {
      const userDocRef = db.collection('users').doc(uId);
      await userDocRef.set({
        behavioralProfile: updatedProfile,
        behavioralEvents: userEvents.slice(-50) // persist recent 50 events in document
      }, { merge: true });
    } catch (fsErr) {
      console.warn('⚠️ behaviorLearningService: Firestore sync failed (cached in memory):', fsErr.message);
    }
  }

  return {
    success: true,
    eventType: normEvent.type,
    behavioralProfile: updatedProfile
  };
}

// ── 9. Fetch Behavioral Profile ───────────────────────────────
/**
 * Retrieves the normalized behavioral profile for a user.
 * Tries in-memory cache first, then Firestore.
 */
async function getBehavioralProfile(userId) {
  const uId = userId || 'default_user';

  // 1. Fast memory cache check
  if (memoryProfileStore.has(uId)) {
    return memoryProfileStore.get(uId);
  }

  // 2. Firestore retrieval check
  const db = getDb();
  if (db) {
    try {
      const snap = await db.collection('users').doc(uId).get();
      if (snap.exists) {
        const data = snap.data();
        if (data.behavioralProfile) {
          memoryProfileStore.set(uId, data.behavioralProfile);
          if (Array.isArray(data.behavioralEvents)) {
            memoryEventsStore.set(uId, data.behavioralEvents);
          }
          return data.behavioralProfile;
        }
      }
    } catch (fsErr) {
      console.warn('⚠️ behaviorLearningService: Firestore read error:', fsErr.message);
    }
  }

  // 3. Fallback blank profile
  const blank = getBlankBehavioralProfile(uId);
  memoryProfileStore.set(uId, blank);
  return blank;
}

// ── 10. Synchronous In-Memory Profile Getter (For hot loops) ────
function getBehavioralProfileSync(userId) {
  const uId = userId || 'default_user';
  if (memoryProfileStore.has(uId)) {
    return memoryProfileStore.get(uId);
  }
  return getBlankBehavioralProfile(uId);
}

// ── 11. User Control: Reset Behavioral Profile ────────────────
/**
 * Resets a user's learned behavioral profile without deleting dietary preferences,
 * allergies, or medical health reports.
 */
async function resetBehavioralProfile(userId) {
  const uId = userId || 'default_user';

  // Clear memory stores
  memoryEventsStore.delete(uId);
  const blank = getBlankBehavioralProfile(uId);
  memoryProfileStore.set(uId, blank);

  // Clear in Firestore document
  const db = getDb();
  if (db) {
    try {
      const userDocRef = db.collection('users').doc(uId);
      await userDocRef.update({
        behavioralProfile: blank,
        behavioralEvents: []
      });
    } catch (fsErr) {
      console.warn('⚠️ behaviorLearningService: Firestore reset error:', fsErr.message);
    }
  }

  return {
    success: true,
    message: 'Behavioral learning preferences reset successfully. Medical and dietary profiles preserved.',
    behavioralProfile: blank
  };
}

// ── 12. Explainability Formatter ──────────────────────────────
/**
 * Produces user-friendly, food-specific explanations of why a behavioral preference applies.
 */
function getBehavioralExplanation(food, profile) {
  if (!food || !profile) return [];
  const explanations = [];

  const fId = String(food.id || '').trim();
  const fCuisine = String(food.cuisine || '').toLowerCase().trim();

  // 1. Food-level preference
  if (fId && profile.preferredFoods[fId]) {
    const pf = profile.preferredFoods[fId];
    if (pf.confidence >= 0.4) {
      explanations.push(`frequently enjoyed by you (${Math.round(pf.score * 100)}% match)`);
    }
  }

  // 2. Cuisine preference
  if (fCuisine && profile.preferredCuisines[fCuisine]) {
    const pc = profile.preferredCuisines[fCuisine];
    if (pc.confidence >= 0.4) {
      const displayCuisine = fCuisine.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      explanations.push(`matches your learned affinity for ${displayCuisine} cuisine`);
    }
  }

  // 3. Ingredient affinity
  if (profile.preferredIngredients && Object.keys(profile.preferredIngredients).length > 0) {
    const fIngredients = (food.ingredients || []).map(i => String(i).toLowerCase().trim());
    for (const [ing, data] of Object.entries(profile.preferredIngredients)) {
      if (data.confidence >= 0.4 && (fIngredients.includes(ing) || (food.name && food.name.toLowerCase().includes(ing)))) {
        explanations.push(`contains ${ing}, one of your preferred ingredients`);
        break; // surface at most one ingredient reason
      }
    }
  }

  return explanations;
}

module.exports = {
  BEHAVIOR_CONFIG,
  SUPPORTED_EVENTS,
  normalizeEvent,
  calculateTimeDecay,
  calculateConfidence,
  aggregateBehavior,
  recordBehaviorEvent,
  getBehavioralProfile,
  getBehavioralProfileSync,
  resetBehavioralProfile,
  getBehavioralExplanation,
  getBlankBehavioralProfile,
  _memoryEventsStore: memoryEventsStore,
  _memoryProfileStore: memoryProfileStore
};
