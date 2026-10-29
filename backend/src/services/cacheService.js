// ─────────────────────────────────────────────────────────────
//  src/services/cacheService.js
//  FoodieBite — High-Performance Dual-Tier Caching Service
//  Tier 1: High-Speed In-Memory LRU/TTL Cache (<0.1ms access)
//  Tier 2: Persistent Firestore Document Cache
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

// ── Lazy Firestore getter — never crashes on module load ──────
function getDb() {
  try {
    return admin.firestore();
  } catch (err) {
    return null;
  }
}

const MS_PER_SEC = 1000;
const MS_PER_MIN = 60 * MS_PER_SEC;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// Hybrid TTL Policy configurations (in days for foods, ms for transient context)
const TTL_POLICIES = {
  frequent: 30,         // Milk, Eggs, Rice, Chicken, Paneer, Oats
  barcode: 60,          // Barcode Lookups
  search: 7,            // Search Results
  recommendation: 1     // User Recommendations (24 hours in persistent store)
};

// In-Memory Transient TTL Policies (milliseconds)
const MEMORY_TTL = {
  food: 30 * MS_PER_MIN,          // 30 minutes in RAM
  recommendation: 10 * MS_PER_MIN, // 10 minutes in RAM
  weather: 20 * MS_PER_MIN,        // 20 minutes in RAM
  userProfile: 5 * MS_PER_MIN,     // 5 minutes in RAM
  context: 15 * MS_PER_MIN         // 15 minutes in RAM
};

// ── In-Memory Bounded LRU Cache Store ────────────────────────
const MAX_CACHE_ENTRIES = 2000;

class MemoryLruStore {
  constructor(maxEntries = MAX_CACHE_ENTRIES) {
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict oldest entry (first item in Map)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || MEMORY_TTL.food),
      createdAt: Date.now()
    });
    this.stats.sets++;
  }

  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

// Singleton Cache Stores for distinct domains
const foodMemoryCache = new MemoryLruStore(2000);
const recMemoryCache = new MemoryLruStore(1000);
const weatherMemoryCache = new MemoryLruStore(200);
const profileMemoryCache = new MemoryLruStore(500);

/**
 * Determine the specific TTL (in days) for a cached food item
 */
function getTtlDaysForFood(foodName, sourceLookupType) {
  const name = (foodName || '').toLowerCase();
  
  // 1. Frequently Accessed Foods override: 30 Days
  if (
    name.includes('milk') ||
    name.includes('egg') ||
    name.includes('rice') ||
    name.includes('chicken') ||
    name.includes('paneer') ||
    name.includes('oats')
  ) {
    return TTL_POLICIES.frequent;
  }

  // 2. Specific source type lookup TTLs
  if (sourceLookupType && TTL_POLICIES[sourceLookupType] !== undefined) {
    return TTL_POLICIES[sourceLookupType];
  }

  // Default fallback: 7 Days
  return TTL_POLICIES.search;
}

/**
 * Check if a cached document has expired based on its TTL policy
 */
function isCacheExpired(cachedDoc) {
  if (!cachedDoc.lastUpdated) return true;

  const ttlDays = getTtlDaysForFood(cachedDoc.foodName, cachedDoc.sourceLookupType);
  const ageInMs = Date.now() - new Date(cachedDoc.lastUpdated).getTime();
  const ageInDays = ageInMs / MS_PER_DAY;

  return ageInDays > ttlDays;
}

/**
 * Fetch a cached food item.
 * Dual-Tier:
 *  1. Checks high-speed In-Memory Cache first (<0.1ms).
 *  2. On miss, falls back to Firestore cachedFoods collection.
 *  3. Populates in-memory cache on Firestore hit.
 */
async function getCachedFood(foodId) {
  if (!foodId) return null;

  // Tier 1: Check In-Memory Cache
  const memoryHit = foodMemoryCache.get(String(foodId));
  if (memoryHit) {
    return memoryHit;
  }

  // Tier 2: Check Firestore Collection
  const db = getDb();
  if (!db) {
    return null;
  }

  try {
    const docRef = db.collection('cachedFoods').doc(String(foodId));
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (!isCacheExpired(data)) {
        // Backfill Tier 1 in-memory cache
        foodMemoryCache.set(String(foodId), data, MEMORY_TTL.food);
        return data;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Synchronous in-memory lookup for hot-loop evaluation without async overhead.
 */
function getCachedFoodSync(foodId) {
  if (!foodId) return null;
  return foodMemoryCache.get(String(foodId));
}

/**
 * Save/Update a food item in cache.
 * Writes immediately to Tier 1 In-Memory cache, and asynchronously writes to Firestore.
 */
async function setCachedFood(food, sourceLookupType = 'search') {
  if (!food || !food.id) return;

  const foodId = String(food.id);
  const cacheData = {
    foodId,
    foodName:       food.name || '',
    calories:       food.calories || 0,
    protein:        food.protein  || 0,
    carbs:          food.carbs    || 0,
    fat:            food.fat      || 0,
    image:          food.image    || null,
    healthScore:    food.healthScore || 0,
    nutritionGrade: food.healthGrade || food.grade || 'unknown',
    sourceLookupType,
    lastUpdated: new Date().toISOString()
  };

  // Immediate write to Tier 1 In-Memory Cache
  foodMemoryCache.set(foodId, cacheData, MEMORY_TTL.food);

  // Asynchronous write to Tier 2 Firestore (fire-and-forget, non-blocking)
  const db = getDb();
  if (db) {
    db.collection('cachedFoods').doc(foodId).set(cacheData).catch(() => {});
  }
}

// ── Recommendation Cache Helpers ─────────────────────────────

/**
 * Generates a deterministic cache key for recommendation responses.
 */
function generateRecommendationCacheKey(userId = 'guest', prefs = {}, context = {}) {
  const uPart = userId || 'guest';
  const dietPart = prefs.dietType || 'default';
  const goalsPart = Array.isArray(prefs.healthGoals) ? prefs.healthGoals.slice().sort().join('+') : '';
  const mealPart = context.mealPeriod || 'default';
  const weatherPart = context.weather?.category || 'default';
  const fastingPart = context.fasting?.active ? (context.fasting.type || 'vrat') : 'none';

  return `rec:${uPart}:${dietPart}:${goalsPart}:${mealPart}:${weatherPart}:${fastingPart}`;
}

/**
 * Retrieves cached recommendation result from in-memory cache.
 */
function getCachedRecommendations(cacheKey) {
  if (!cacheKey) return null;
  return recMemoryCache.get(cacheKey);
}

/**
 * Stores recommendation result in in-memory cache.
 */
function setCachedRecommendations(cacheKey, recResult, ttlMs = MEMORY_TTL.recommendation) {
  if (!cacheKey || !recResult) return;
  recMemoryCache.set(cacheKey, recResult, ttlMs);
}

// ── Weather & Context Cache Helpers ──────────────────────────

function getCachedWeather(locationKey) {
  if (!locationKey) return null;
  return weatherMemoryCache.get(locationKey);
}

function setCachedWeather(locationKey, weatherData, ttlMs = MEMORY_TTL.weather) {
  if (!locationKey || !weatherData) return;
  weatherMemoryCache.set(locationKey, weatherData, ttlMs);
}

// ── User Profile Cache Helpers ───────────────────────────────

function getCachedUserProfile(userId) {
  if (!userId) return null;
  return profileMemoryCache.get(String(userId));
}

function setCachedUserProfile(userId, profile, ttlMs = MEMORY_TTL.userProfile) {
  if (!userId || !profile) return;
  profileMemoryCache.set(String(userId), profile, ttlMs);
}

function invalidateUserProfile(userId) {
  if (!userId) return;
  profileMemoryCache.delete(String(userId));
}

// ── Telemetry & Health Diagnostics ───────────────────────────

function getCacheStats() {
  const totalHits = foodMemoryCache.stats.hits + recMemoryCache.stats.hits + weatherMemoryCache.stats.hits + profileMemoryCache.stats.hits;
  const totalMisses = foodMemoryCache.stats.misses + recMemoryCache.stats.misses + weatherMemoryCache.stats.misses + profileMemoryCache.stats.misses;
  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(1) + '%' : '0.0%';

  return {
    hitRate,
    totalHits,
    totalMisses,
    foodCacheSize: foodMemoryCache.size,
    recommendationCacheSize: recMemoryCache.size,
    weatherCacheSize: weatherMemoryCache.size,
    userProfileCacheSize: profileMemoryCache.size,
    totalEvictions: foodMemoryCache.stats.evictions + recMemoryCache.stats.evictions
  };
}

function clearAllMemoryCaches() {
  foodMemoryCache.clear();
  recMemoryCache.clear();
  weatherMemoryCache.clear();
  profileMemoryCache.clear();
}

module.exports = {
  TTL_POLICIES,
  MEMORY_TTL,
  getTtlDaysForFood,
  isCacheExpired,
  getCachedFood,
  getCachedFoodSync,
  setCachedFood,
  generateRecommendationCacheKey,
  getCachedRecommendations,
  setCachedRecommendations,
  getCachedWeather,
  setCachedWeather,
  getCachedUserProfile,
  setCachedUserProfile,
  invalidateUserProfile,
  getCacheStats,
  clearAllMemoryCaches
};

