// ─────────────────────────────────────────────────────────────
//  src/controllers/foodController.js
//  Reliability-First Food Controller using the 4-Tier Priority System
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

// ── Lazy Firestore getter — never crashes on module load ──────
function getDb() {
  try {
    return admin.firestore();
  } catch (err) {
    console.warn('⚠️ foodController: Firestore unavailable:', err.message);
    return null;
  }
}


// Services
const { searchFoodsProxy, getProductByBarcodeProxy, logApiHealth, isInternetConnected } = require('../services/openFoodFactsProxy');
const { getCachedFood, setCachedFood, generateRecommendationCacheKey, getCachedRecommendations, setCachedRecommendations } = require('../services/cacheService');
const { queryRecommendationsFromDb } = require('../services/recommendationDbService');
const { FALLBACK_FOODS } = require('../services/foodiebiteFallbackFoods');
const { recommendFoods, hardExclude, rankAndScore } = require('../services/recommendationEngine');
const { isDietCompatible } = require('../services/dietarySafetyService');
const { buildUserFoodProfile } = require('../services/profileBuilder');
const { normalizeOffProduct } = require('../services/foodNutrientNormalizer');
const { buildContextProfile, detectSeason, normalizeTemperatureCategory } = require('../services/contextService');
const { getBehavioralProfile, recordBehaviorEvent } = require('../services/behaviorLearningService');
const { trackFeatureUsage } = require('../services/activityTrackingService');
const { normalizeFoodName, normalizeFoodItem, normalizeFoodList, deduplicateFoods } = require('../services/foodNameNormalizer');
const { getActiveExperiment, assignVariant } = require('../services/experimentationService');
const { toPseudonymousId } = require('../services/analyticsEventService');


const DELIVERY_PROVIDER = (process.env.FOOD_DELIVERY_PROVIDER || 'mealme').toLowerCase();

// ── Diet → search terms mapping ───────────────────────
const DIET_TERMS = {
  'Vegetarian':        ['vegetable salad', 'paneer', 'lentil soup', 'tofu', 'chickpea', 'quinoa', 'yogurt'],
  'Vegan':             ['vegan salad', 'tofu', 'chickpea', 'lentil', 'quinoa', 'almond milk', 'soy'],
  'Eggetarian':        ['egg salad', 'omelette', 'egg protein', 'egg bowl', 'scrambled egg'],
  'Non-Vegetarian':    ['chicken salad', 'grilled chicken', 'tuna', 'salmon', 'turkey', 'lean beef'],
  'Non Vegetarian':    ['chicken salad', 'grilled chicken', 'tuna', 'salmon', 'turkey', 'lean beef'],
  'Keto':              ['keto', 'avocado', 'almond', 'low carb', 'cheese'],
  'Diabetic Friendly': ['low sugar', 'oat bran', 'whole grain', 'diabetic', 'low glycemic'],
};

const GOAL_TERMS = {
  weight_loss:    ['low calorie', 'light salad', 'diet food', 'low fat'],
  muscle_gain:    ['high protein', 'whey protein', 'chicken breast', 'protein shake'],
  healthy_eating: ['whole grain', 'superfood', 'organic salad', 'natural'],
  others:         ['balanced meal', 'mixed salad', 'healthy snack'],
};

// ── Calculate health score and grade ──────────────────
function calculateHealthScoreAndGrade(food) {
  const protein = food.protein || 0;
  const fiber = food.fiber || 0;
  const sugar = food.sugar || 0;
  const sodium = food.sodium || 0; // sodium in mg
  const fat = food.fat || 0;
  const satFat = food.saturatedFat || (fat * 0.3);

  // Determine NOVA classification from tags
  let nova = 1;
  const labels = food.labels || [];
  if (labels.some(l => l.includes('nova-4') || l.includes('ultra-processed') || l.includes('ultraprocessed'))) {
    nova = 4;
  } else if (labels.some(l => l.includes('nova-3') || l.includes('processed-food'))) {
    nova = 3;
  } else if (labels.some(l => l.includes('nova-2'))) {
    nova = 2;
  }

  let score = 5.0;
  score += Math.min(2.0, protein * 0.2); // max +2
  score += Math.min(2.0, fiber * 0.4);   // max +2
  score -= Math.min(2.5, sugar * 0.15);  // max -2.5
  score -= Math.min(1.5, sodium * 0.002); // max -1.5 (sodium in mg)
  score -= Math.min(1.5, satFat * 0.1);  // max -1.5

  if (nova === 4) score -= 2.5;
  else if (nova === 3) score -= 1.0;
  else if (nova === 2) score -= 0.5;

  score = Math.max(0.0, Math.min(10.0, Math.round(score * 10) / 10));

  let grade = 'C';
  if (score >= 9.0) grade = 'A+';
  else if (score >= 7.5) grade = 'A';
  else if (score >= 6.0) grade = 'B';
  else if (score >= 4.5) grade = 'C';
  else if (score >= 3.0) grade = 'D';
  else grade = 'E';

  return { healthScore: score, healthGrade: grade };
}

// ── Normalise OFF product → app shape ────────────────
function normalise(raw) {
  const normalized = normalizeOffProduct(raw);
  if (!normalized) return null;

  const { healthScore, healthGrade } = calculateHealthScoreAndGrade(normalized);
  normalized.healthScore = healthScore;
  normalized.healthGrade = healthGrade;

  return normalized;
}

const CURATED_DEFAULT_IMAGES = {
  'oats': 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
  'banana': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
  'boiled egg': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
  'egg': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
  'greek yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  'yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  'mixed nuts': 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  'nuts': 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  'chicken breast': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  'chicken': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  'brown rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  'rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  'lentil soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'spinach salad': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'apple': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80',
};

function ensureFoodImageAndGrade(food) {
  if (!food) return food;
  const cleanName = normalizeFoodName(food.name || food.foodName || food.product_name);
  const nameLower = cleanName.toLowerCase();
  
  let image = food.image || food.imageUrl || food.image_url;
  if (!image) {
    for (const [key, url] of Object.entries(CURATED_DEFAULT_IMAGES)) {
      if (nameLower.includes(key)) {
        image = url;
        break;
      }
    }
  }
  if (!image) {
    image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
  }

  let grade = food.grade || food.healthGrade || food.nutrition_grades;
  let healthGrade = food.healthGrade;
  if (!grade || grade === 'unknown') {
    const calculated = calculateHealthScoreAndGrade(food);
    grade = (calculated.healthGrade || 'B').toLowerCase();
    healthGrade = calculated.healthGrade || 'B';
  } else {
    healthGrade = String(grade).toUpperCase();
  }

  return {
    ...food,
    name: cleanName,
    displayName: cleanName,
    originalName: food.originalName || food.name || cleanName,
    image,
    imageUrl: image,
    grade: String(grade).toLowerCase(),
    healthGrade,
  };
}

// ── Delivery Links ───────────────────────────────────
function buildSwiggyDeliveryLink(name) {
  return `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(name || '')}`;
}

function buildMealMeDeliveryLink(name) {
  const company = process.env.MEALME_COMPANY_NAME;
  if (!company) return null;
  const query = JSON.stringify({ [name]: 1 });
  return `https://sdk.mealme.ai/cart-search?api=${encodeURIComponent(company)}&query=${encodeURIComponent(query)}&storeType=grocery`;
}

function getDeliveryLinksForProduct(name) {
  if (!name) return [];
  const links = [];

  if (DELIVERY_PROVIDER === 'mealme') {
    const mealMeUrl = buildMealMeDeliveryLink(name);
    if (mealMeUrl) {
      links.push({
        provider: 'MealMe',
        mode: 'sdk',
        url: mealMeUrl,
        label: 'Search on MealMe',
      });
    }
  }

  links.push(
    { provider: 'Swiggy Instamart', mode: 'search', url: buildSwiggyDeliveryLink(name), label: 'Search on Swiggy Instamart' },
    { provider: 'Blinkit', mode: 'search', url: 'https://blinkit.com/s/', label: 'Open Blinkit search' },
    { provider: 'BigBasket', mode: 'search', url: 'https://www.bigbasket.com/search/', label: 'Open BigBasket search' },
    { provider: 'Zepto', mode: 'search', url: `https://www.zepto.com/search?query=${encodeURIComponent(name)}`, label: 'Search on Zepto' }
  );

  return links;
}

// ── Filter by user preferences ────────────────────────
function filterProducts(products, prefs) {
  const { dietType = 'Vegetarian', allergies = [], minProtein, maxCalories, minGrade } = prefs;
  const GRADE = { a:4, b:3, c:2, d:1, e:0, unknown:-1 };
  const minG  = GRADE[minGrade?.toLowerCase()] ?? -1;

  return products.filter(p => {
    if (!p.name || p.calories === 0) return false;

    // Strict diet type filtering using unified dietary safety service
    if (dietType && !isDietCompatible(p, dietType)) {
      return false;
    }

    if (minGrade && GRADE[p.grade?.toLowerCase()] < minG)   return false;
    if (maxCalories && p.calories > maxCalories)             return false;
    if (minProtein  && p.protein  < minProtein)              return false;
    
    if (allergies.length > 0) {
      const hit = allergies.some(a => p.allergens.some(pa => pa.toLowerCase().includes(a.toLowerCase())));
      if (hit) return false;
    }
    return true;
  });
}

// ── Rank by nutrient score ────────────────────────────
function rank(products, goals = []) {
  const GRADE = { a:40, b:30, c:15, d:5, e:0 };
  return [...products].sort((a, b) => {
    function score(p) {
      let s = GRADE[p.grade?.toLowerCase()] || 0;
      if (goals.includes('muscle_gain'))    { s += p.protein*4; s -= p.fat*0.5; }
      if (goals.includes('weight_loss'))    { s -= p.calories*0.05; s += p.fiber*3; s -= p.sugar*2; }
      if (goals.includes('healthy_eating')) { s += p.fiber*2; s -= p.sugar*1.5; s -= p.sodium*0.01; }
      s += p.protein*2; s += p.fiber*1.5; s -= p.sugar;
      if (!p.image) s -= 10;
      return s;
    }
    return score(b) - score(a);
  });
}

// ── Fetch full user document from Firestore (non-blocking) ───────────
async function getUserDocument(userId) {
  try {
    const db = getDb();
    if (!db || !userId) return null;
    const snap = await db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return snap.data() || null;
  } catch (err) {
    console.warn('foodController: user document fetch failed (non-fatal):', err.message);
    return null;
  }
}

// Keep legacy function for backward compatibility with any callers
async function getUserHealthProfile(userId) {
  const doc = await getUserDocument(userId);
  return doc?.healthProfile || null;
}

// ── Re-rank with health profile intelligence ──────────────────
// Boost foods matching medical 'prefer' list, penalise 'limit' list.
function applyHealthProfileRanking(foods, healthProfile) {
  if (!foods || !Array.isArray(foods)) return [];
  if (!healthProfile) return foods;
  return recommendFoods(foods, { healthProfile }, {}, foods.length).foods;
}

// ── Helper to filter static fallbacks (Phase 2: unified profile) ─────
function getStaticFallbackList(profileOrPrefs, count = 20, healthProfileLegacy = null, context = {}) {
  // Accept a UserFoodProfile (has activeFoodRestrictions) or a raw prefs object
  let unifiedProfile;
  if (profileOrPrefs && typeof profileOrPrefs.activeFoodRestrictions !== 'undefined') {
    unifiedProfile = profileOrPrefs;
  } else {
    const rawPrefs = profileOrPrefs || {};
    unifiedProfile = buildUserFoodProfile({ preferences: rawPrefs, healthProfile: healthProfileLegacy });
  }
  const prefs = {
    dietType:    unifiedProfile.dietType,
    allergies:   unifiedProfile.allergies,
    maxCalories: unifiedProfile.maxCaloriesOverride,
    minProtein:  unifiedProfile.minProteinOverride,
    healthGoals: unifiedProfile.healthGoals,
  };
  const innerUserProfile = {
    preferences:            prefs,
    healthProfile:          unifiedProfile.healthProfile,
    allergies:              unifiedProfile.allergies,
    activeFoodRestrictions: unifiedProfile.activeFoodRestrictions,
    preferredTags:          unifiedProfile.foodsToPrefer,
    healthGoals:            unifiedProfile.healthGoals,
    dietType:               unifiedProfile.dietType,
  };
  const candidatePool = filterProducts(FALLBACK_FOODS, prefs);
  const recResult = recommendFoods(candidatePool, innerUserProfile, context, count);
  return recResult.foods;
}


// ── GET /api/foods/recommendations ────────────────────
exports.getRecommendations = async (req, res, next) => {
  const startTime = Date.now();

  // ── Build unified profile from Firestore (Phase 2) ───────────────
  const userId = req.user?.uid || req.user?.id;
  trackFeatureUsage('recommendations', userId).catch(() => {});
  const rawUserDoc = (await getUserDocument(userId)) || req.user || {};

  // Merge client query parameters into preferences so guest/offline context is honored
  const queryAllergies = req.query?.allergies ? String(req.query.allergies).split(',').map(s => s.trim()).filter(Boolean) : null;
  const queryCuisines = req.query?.cuisines ? String(req.query.cuisines).split(',').map(s => s.trim()).filter(Boolean) : null;
  const queryGoals = req.query?.healthGoals ? String(req.query.healthGoals).split(',').map(s => s.trim()).filter(Boolean) : null;

  const defaultDiet = rawUserDoc.preferences?.dietType || rawUserDoc.dietType || req.query?.dietType || req.body?.preferences?.dietType || 'Vegetarian';
  const mergedUserDoc = {
    ...rawUserDoc,
    preferences: {
      dietType: defaultDiet,
      ...(rawUserDoc.preferences || {}),
      ...(req.query?.dietType ? { dietType: req.query.dietType } : {}),
      ...(queryAllergies ? { allergies: queryAllergies } : {}),
      ...(queryCuisines ? { cuisines: queryCuisines } : {}),
      ...(queryGoals ? { healthGoals: queryGoals } : {}),
      ...(req.body?.preferences || {}),
    }
  };
  const unifiedProfile = buildUserFoodProfile(mergedUserDoc);

  // Translate to the prefs shape filterProducts() / rank() expects
  const prefs = {
    dietType:    unifiedProfile.dietType,
    allergies:   unifiedProfile.allergies,
    maxCalories: unifiedProfile.maxCaloriesOverride,
    minProtein:  unifiedProfile.minProteinOverride,
    healthGoals: unifiedProfile.healthGoals,
    cuisines:    unifiedProfile.cuisines,
  };

  const healthProfile = unifiedProfile.healthProfile || null;

  // fullUserProfile for the two-pass recommendationEngine
  const fullUserProfile = {
    preferences:            prefs,
    healthProfile:          healthProfile,
    allergies:              unifiedProfile.allergies,
    activeFoodRestrictions: unifiedProfile.activeFoodRestrictions,
    preferredTags:          unifiedProfile.foodsToPrefer,
    healthGoals:            unifiedProfile.healthGoals,
    dietType:               unifiedProfile.dietType,
    cuisines:               unifiedProfile.cuisines,
    minProteinOverride:     unifiedProfile.minProteinOverride,
    maxCaloriesOverride:    unifiedProfile.maxCaloriesOverride,
    fasting:                unifiedProfile.fasting
  };

  // Phase 5: Centralized Behavioral Profile Loading
  const behavioralProfile = await getBehavioralProfile(userId);
  fullUserProfile.behavioralProfile = behavioralProfile;

  // Phase 4: Construct authoritative Centralized Context Profile
  const context = buildContextProfile({
    currentTime: req.query?.currentTime || req.body?.currentTime,
    mealPeriod: req.query?.mealPeriod || req.body?.mealPeriod || req.query?.mealType || req.body?.mealType,
    weather: {
      temperature: req.query?.temp || req.query?.temperature || req.body?.temperature,
      condition: req.query?.condition || req.body?.condition || req.query?.weather || req.body?.weather,
      humidity: req.query?.humidity || req.body?.humidity
    },
    season: {
      name: req.query?.season || req.body?.season,
      region: req.query?.region || req.body?.region || prefs.country
    },
    fasting: req.body?.fasting || req.query?.fasting || prefs.fasting,
    availability: req.query?.availability || req.body?.availability,
    recentRecommendations: req.body?.recentRecommendations || req.query?.recentRecommendations,
    userProfile: fullUserProfile,
    behavioralProfile,
    mood: req.query?.mood || req.body?.mood
  });

  const targetCount = Math.max(20, Math.min(60, parseInt(req.query?.count, 10) || 30));

  // Determine active A/B experiment assignment & tracking IDs
  const activeExp = getActiveExperiment();
  const anonUserId = toPseudonymousId(userId || req.headers['x-anonymous-user-id'] || req.query?.anonId || 'guest');
  let expAssignment = null;
  if (activeExp) {
    expAssignment = assignVariant(activeExp.id, anonUserId);
  }
  const recommendationId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const effectiveStrategy = expAssignment?.strategy || (req.query?.mood ? 'mood_aware' : 'preference_based');

  const annotateFoods = (foodsList) => {
    return deduplicateFoods((foodsList || []).map(f => {
      const ensured = ensureFoodImageAndGrade(f);
      return {
        ...ensured,
        recommendationId,
        recommendationStrategy: effectiveStrategy,
        experimentId: expAssignment?.experimentId || null,
        variantId: expAssignment?.variantId || null
      };
    }));
  };

  // Tier 1 Fast Path: Check In-Memory Recommendation Cache (<0.1ms)
  const recCacheKey = generateRecommendationCacheKey(userId, prefs, context);
  const cachedRecs = getCachedRecommendations(recCacheKey);
  if (cachedRecs && Array.isArray(cachedRecs.foods) && cachedRecs.foods.length >= 10) {
    return res.status(200).json({
      ...cachedRecs,
      recommendationId,
      recommendationStrategy: effectiveStrategy,
      experiment: expAssignment ? {
        experimentId: expAssignment.experimentId,
        variantId: expAssignment.variantId,
        variantName: expAssignment.variantName,
        strategy: expAssignment.strategy
      } : null,
      foods: annotateFoods(cachedRecs.foods),
      source: 'cache'
    });
  }

  const online = await isInternetConnected();
  if (!online) {
    console.log('Backend offline: immediately returning static recommendations.');
    const candidatePool = filterProducts(FALLBACK_FOODS, prefs);
    const recResult = recommendFoods(candidatePool, fullUserProfile, context, targetCount, behavioralProfile);
    const payload = {
      success: true,
      source: 'fallback',
      recommendationId,
      recommendationStrategy: effectiveStrategy,
      experiment: expAssignment ? {
        experimentId: expAssignment.experimentId,
        variantId: expAssignment.variantId,
        variantName: expAssignment.variantName,
        strategy: expAssignment.strategy
      } : null,
      healthProfileApplied: !!(unifiedProfile && unifiedProfile.healthProfile),
      foods: annotateFoods(recResult.foods),
      contextProfile: recResult.contextProfile,
      behavioralProfile: recResult.behavioralProfile || behavioralProfile,
      unverifiedFoodRestrictions: recResult.unverifiedFoodRestrictions
    };
    setCachedRecommendations(recCacheKey, payload);
    return res.status(200).json(payload);
  }

  try {

    // ── Priority 1: Check Firestore Cache (cachedFoods)
    let cacheList = [];
    const db = getDb();
    if (db) {
      try {
        const cachedSnap = await db.collection('cachedFoods')
          .where('sourceLookupType', '==', 'recommendation')
          .get();
        cachedSnap.forEach(doc => {
          const d = doc.data();
          const ageInMs = Date.now() - new Date(d.lastUpdated).getTime();
          const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
          const nameLower = (d.foodName || '').toLowerCase();
          let ttl = 1;
          if (nameLower.includes('milk') || nameLower.includes('egg') || nameLower.includes('rice') ||
              nameLower.includes('chicken') || nameLower.includes('paneer') || nameLower.includes('oats')) {
            ttl = 30;
          }
          
          if (ageInDays <= ttl) {
            cacheList.push({
              id: d.foodId,
              name: d.foodName,
              calories: d.calories,
              protein: d.protein,
              carbs: d.carbs,
              fat: d.fat,
              image: d.image,
              healthScore: d.healthScore,
              grade: d.nutritionGrade,
              source: 'cache'
            });
          }
        });
      } catch (cacheErr) {
        console.warn('⚠️ foodController: cachedFoods read failed (safe):', cacheErr.message);
      }
    }

    const filteredCached = filterProducts(cacheList, prefs);
    if (filteredCached.length >= 12) {
      const recResult = recommendFoods(filteredCached, fullUserProfile, context, targetCount, behavioralProfile);
      await logApiHealth('/api/foods/recommendations', 'cache', true, Date.now() - startTime);
      const payload = {
        success: true,
        source: 'cache',
        recommendationId,
        recommendationStrategy: effectiveStrategy,
        experiment: expAssignment ? {
          experimentId: expAssignment.experimentId,
          variantId: expAssignment.variantId,
          variantName: expAssignment.variantName,
          strategy: expAssignment.strategy
        } : null,
        healthProfileApplied: !!healthProfile,
        foods: annotateFoods(recResult.foods),
        contextProfile: recResult.contextProfile,
        behavioralProfile: recResult.behavioralProfile || behavioralProfile,
        unverifiedFoodRestrictions: recResult.unverifiedFoodRestrictions
      };
      setCachedRecommendations(recCacheKey, payload);
      return res.status(200).json(payload);
    }

    // ── Priority 2: Backend Proxy Query to Open Food Facts
    const dietTerms = DIET_TERMS[prefs.dietType] || DIET_TERMS['Vegetarian'];
    const goalTerms = (prefs.healthGoals || []).flatMap(g => GOAL_TERMS[g] || []);
    const terms = [...dietTerms, ...goalTerms].slice(0, 4);

    let proxyFoods = [];
    try {
      const rawArrays = await Promise.all(terms.map(t => searchFoodsProxy(t, 10)));
      const rawAll = rawArrays.filter(Boolean).flat();

      const seen = new Set();
      const unique = rawAll.filter(p => {
        const k = p.id || p._id;
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });

      const normalised = unique.map(normalise).filter(Boolean);
      const filtered = filterProducts(normalised, prefs);

      filtered.forEach(food => {
        setCachedFood(food, 'recommendation').catch(err => console.warn('Cache write failed:', err.message));
      });

      proxyFoods = filtered;
    } catch (err) {
      console.warn('Proxy recommendations load failed, routing to database:', err.message);
    }

    if (proxyFoods.length > 0) {
      const recResult = recommendFoods(proxyFoods, fullUserProfile, context, targetCount, behavioralProfile);
      await logApiHealth('/api/foods/recommendations', 'off', true, Date.now() - startTime);
      const payload = {
        success: true,
        source: 'off',
        recommendationId,
        recommendationStrategy: effectiveStrategy,
        experiment: expAssignment ? {
          experimentId: expAssignment.experimentId,
          variantId: expAssignment.variantId,
          variantName: expAssignment.variantName,
          strategy: expAssignment.strategy
        } : null,
        healthProfileApplied: !!healthProfile,
        foods: annotateFoods(recResult.foods),
        contextProfile: recResult.contextProfile,
        behavioralProfile: recResult.behavioralProfile || behavioralProfile,
        unverifiedFoodRestrictions: recResult.unverifiedFoodRestrictions
      };
      setCachedRecommendations(recCacheKey, payload);
      return res.status(200).json(payload);
    }

    // ── Priority 3: Query foodiebiteRecommendations Database
    const dbRecs = await queryRecommendationsFromDb(prefs.dietType, prefs.healthGoals || [], null, null);
    const filteredDb = filterProducts(dbRecs, prefs);
    if (filteredDb.length > 0) {
      const recResult = recommendFoods(filteredDb, fullUserProfile, context, targetCount, behavioralProfile);
      await logApiHealth('/api/foods/recommendations', 'fallback', true, Date.now() - startTime);
      const payload = {
        success: true,
        source: 'fallback',
        recommendationId,
        recommendationStrategy: effectiveStrategy,
        experiment: expAssignment ? {
          experimentId: expAssignment.experimentId,
          variantId: expAssignment.variantId,
          variantName: expAssignment.variantName,
          strategy: expAssignment.strategy
        } : null,
        healthProfileApplied: !!healthProfile,
        foods: annotateFoods(recResult.foods),
        contextProfile: recResult.contextProfile,
        behavioralProfile: recResult.behavioralProfile || behavioralProfile,
        unverifiedFoodRestrictions: recResult.unverifiedFoodRestrictions
      };
      setCachedRecommendations(recCacheKey, payload);
      return res.status(200).json(payload);
    }

    // ── Priority 4: Static Fallback Dataset (Guaranteed Response)
    const candidatePool = filterProducts(FALLBACK_FOODS, prefs);
    const recResult = recommendFoods(candidatePool, fullUserProfile, context, targetCount, behavioralProfile);
    await logApiHealth('/api/foods/recommendations', 'fallback', true, Date.now() - startTime);
    const payload = {
      success: true,
      source: 'fallback',
      recommendationId,
      recommendationStrategy: effectiveStrategy,
      experiment: expAssignment ? {
        experimentId: expAssignment.experimentId,
        variantId: expAssignment.variantId,
        variantName: expAssignment.variantName,
        strategy: expAssignment.strategy
      } : null,
      healthProfileApplied: !!healthProfile,
      foods: annotateFoods(recResult.foods),
      contextProfile: recResult.contextProfile,
      behavioralProfile: recResult.behavioralProfile || behavioralProfile,
      unverifiedFoodRestrictions: recResult.unverifiedFoodRestrictions
    };
    setCachedRecommendations(recCacheKey, payload);
    return res.status(200).json(payload);

  } catch (err) {
    // Ultimate resilience: Never throw, always return fallback foods
    console.error('Recommendations handler error, using fallback:', err.message);
    const staticFallback = getStaticFallbackList(prefs, targetCount, healthProfile, context);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      recommendationId,
      recommendationStrategy: effectiveStrategy,
      experiment: expAssignment ? {
        experimentId: expAssignment.experimentId,
        variantId: expAssignment.variantId,
        variantName: expAssignment.variantName,
        strategy: expAssignment.strategy
      } : null,
      foods: annotateFoods(staticFallback)
    });
  }
};

// ── GET /api/foods/search?q=&filter= ──────────────────
exports.searchFoods = async (req, res, next) => {
  const startTime = Date.now();
  const { q, filter } = req.query;

  // ── Build unified profile for search (Phase 2) ───────────
  const userId = req.user?.uid || req.user?.id;
  trackFeatureUsage('searches', userId).catch(() => {});
  const rawUserDoc = (await getUserDocument(userId)) || req.user || {};
  const queryAllergies = req.query?.allergies ? String(req.query.allergies).split(',').map(s => s.trim()).filter(Boolean) : null;
  const queryCuisines = req.query?.cuisines ? String(req.query.cuisines).split(',').map(s => s.trim()).filter(Boolean) : null;
  const queryGoals = req.query?.healthGoals ? String(req.query.healthGoals).split(',').map(s => s.trim()).filter(Boolean) : null;

  const mergedUserDoc = {
    ...rawUserDoc,
    preferences: {
      ...(rawUserDoc.preferences || {}),
      ...(req.query?.dietType ? { dietType: req.query.dietType } : {}),
      ...(queryAllergies ? { allergies: queryAllergies } : {}),
      ...(queryCuisines ? { cuisines: queryCuisines } : {}),
      ...(queryGoals ? { healthGoals: queryGoals } : {}),
      ...(req.body?.preferences || {}),
    }
  };
  const unifiedProfile = buildUserFoodProfile(mergedUserDoc);
  const prefs = {
    dietType:    unifiedProfile.dietType,
    allergies:   unifiedProfile.allergies,
    maxCalories: unifiedProfile.maxCaloriesOverride,
    minProtein:  unifiedProfile.minProteinOverride,
    healthGoals: unifiedProfile.healthGoals,
    cuisines:    unifiedProfile.cuisines,
  };

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
  }

  const queryText = q.trim();

  // Phase 5: Behavioral Event Ingestion for Search
  if (userId && queryText) {
    recordBehaviorEvent(userId, { type: 'food_searched', query: queryText }).catch(() => {});
  }

  const online = await isInternetConnected();
  if (!online) {
    console.log('Backend offline: immediately returning static search results.');
    const matchedStatic = FALLBACK_FOODS.filter(f => 
      f.name.toLowerCase().includes(queryText.toLowerCase()) ||
      (f.categories && f.categories.some(c => c.toLowerCase().includes(queryText.toLowerCase())))
    );
    let finalFallback = filterProducts(matchedStatic, prefs);
    if (finalFallback.length === 0) {
      finalFallback = getStaticFallbackList(prefs, 15);
    }
    const ranked = rank(finalFallback, prefs.healthGoals || []);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      foods: ranked.slice(0, 25)
    });
  }

  try {
    // ── Priority 1: Check Firestore Cache
    let cacheList = [];
    const db2 = getDb();
    if (db2) {
      try {
        const cachedSnap = await db2.collection('cachedFoods')
          .where('sourceLookupType', '==', 'search')
          .get();
        cachedSnap.forEach(doc => {
      const d = doc.data();
      const ageInMs = Date.now() - new Date(d.lastUpdated).getTime();
      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      const nameLower = d.foodName.toLowerCase();
      
      let ttl = 7; // Search Result TTL = 7 Days
      if (nameLower.includes('milk') || nameLower.includes('egg') || nameLower.includes('rice') ||
          nameLower.includes('chicken') || nameLower.includes('paneer') || nameLower.includes('oats')) {
        ttl = 30; // Frequent override
      }

      if (ageInDays <= ttl && nameLower.includes(queryText.toLowerCase())) {
        cacheList.push({
          id: d.foodId,
          name: d.foodName,
          calories: d.calories,
          protein: d.protein,
          carbs: d.carbs,
          fat: d.fat,
          image: d.image,
          healthScore: d.healthScore,
          grade: d.nutritionGrade,
          source: 'cache'
        });
      }
        });
      } catch (cacheErr) {
        console.warn('⚠️ foodController: search cachedFoods read failed (safe):', cacheErr.message);
      }
    }

    if (cacheList.length >= 3) {
      let filtered = filterProducts(cacheList, prefs);
      const ranked = rank(filtered, prefs.healthGoals || []);
      await logApiHealth(`/api/foods/search?q=${queryText}`, 'cache', true, Date.now() - startTime);
      return res.status(200).json({
        success: true,
        source: 'cache',
        foods: ranked.slice(0, 25)
      });
    }

    // ── Priority 2: Backend Proxy Query to Open Food Facts
    let proxyResults = [];
    try {
      const raw = await searchFoodsProxy(queryText, 30);
      if (raw && raw.length > 0) {
        const normalised = raw.map(normalise).filter(Boolean);
        const filtered = filterProducts(normalised, prefs);
        
        // Cache foods
        filtered.forEach(food => {
          setCachedFood(food, 'search').catch(err => console.warn('Cache write failed:', err.message));
        });
        
        proxyResults = filtered;
      }
    } catch (err) {
      console.warn('Proxy search failed, using database/fallback:', err.message);
    }

    if (proxyResults.length > 0) {
      const ranked = rank(proxyResults, prefs.healthGoals || []);
      await logApiHealth(`/api/foods/search?q=${queryText}`, 'off', true, Date.now() - startTime);
      return res.status(200).json({
        success: true,
        source: 'off',
        foods: deduplicateFoods(ranked.slice(0, 30).map(ensureFoodImageAndGrade))
      });
    }

    // ── Priority 3/4: Database & Static Fallback search
    // Search the static fallback list for query matches (checking both name, originalName, and categories)
    const matchedStatic = FALLBACK_FOODS.filter(f => 
      f.name.toLowerCase().includes(queryText.toLowerCase()) ||
      (f.originalName && f.originalName.toLowerCase().includes(queryText.toLowerCase())) ||
      (f.categories && f.categories.some(c => c.toLowerCase().includes(queryText.toLowerCase())))
    );

    let finalFallback = filterProducts(matchedStatic, prefs);
    if (finalFallback.length === 0) {
      // If nothing matches the search, return generic fallbacks to avoid blank screen
      finalFallback = getStaticFallbackList(prefs, 20);
    }

    const ranked = rank(finalFallback, prefs.healthGoals || []);
    await logApiHealth(`/api/foods/search?q=${queryText}`, 'fallback', true, Date.now() - startTime);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      foods: deduplicateFoods(ranked.slice(0, 30).map(ensureFoodImageAndGrade))
    });

  } catch (err) {
    console.error('Search handler error, returning fallback:', err.message);
    const fallbackList = getStaticFallbackList(prefs, 20);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      foods: deduplicateFoods(fallbackList.map(ensureFoodImageAndGrade))
    });
  }
};

// ── GET /api/foods/barcode/:barcode ──────────────────
exports.getFoodById = async (req, res, next) => {
  const startTime = Date.now();
  const { barcode } = req.params;
  const userId = req.user?.uid || req.user?.id;

  // Phase 5: Behavioral Event Ingestion for Food Details Viewed
  if (userId && barcode) {
    trackFeatureUsage('food_detail_views', userId).catch(() => {});
    recordBehaviorEvent(userId, { type: 'food_details_viewed', foodId: barcode }).catch(() => {});
  }

  const online = await isInternetConnected();
  if (!online) {
    console.log('Backend offline: immediately returning static barcode result.');
    const staticMatch = FALLBACK_FOODS.find(f => f.id === barcode);
    if (staticMatch) {
      return res.status(200).json({
        success: true,
        source: 'fallback',
        food: staticMatch
      });
    }
    const defaultFood = FALLBACK_FOODS[0];
    return res.status(200).json({
      success: true,
      source: 'fallback',
      food: {
        ...defaultFood,
        id: barcode,
        name: `${defaultFood.name} (Offline Match)`
      }
    });
  }

  try {
    // ── Priority 1: Check Firestore Cache (cachedFoods)
    const cached = await getCachedFood(barcode);
    if (cached) {
      await logApiHealth(`/api/foods/barcode/${barcode}`, 'cache', true, Date.now() - startTime);
      return res.status(200).json({
        success: true,
        source: 'cache',
        food: {
          id: cached.foodId,
          name: cached.foodName,
          calories: cached.calories,
          protein: cached.protein,
          carbs: cached.carbs,
          fat: cached.fat,
          image: cached.image,
          healthScore: cached.healthScore,
          grade: cached.nutritionGrade
        }
      });
    }

    // ── Priority 2: Backend Proxy Query
    try {
      const raw = await getProductByBarcodeProxy(barcode);
      if (raw) {
        const normalised = normalise(raw);
        if (normalised) {
          await setCachedFood(normalised, 'barcode');
          await logApiHealth(`/api/foods/barcode/${barcode}`, 'off', true, Date.now() - startTime);
          return res.status(200).json({
            success: true,
            source: 'off',
            food: normalised
          });
        }
      }
    } catch (err) {
      console.warn('Proxy barcode lookup failed:', err.message);
    }

    // ── Priority 3/4: Search fallback dataset for id or return a close match
    const staticMatch = FALLBACK_FOODS.find(f => f.id === barcode);
    if (staticMatch) {
      await logApiHealth(`/api/foods/barcode/${barcode}`, 'fallback', true, Date.now() - startTime);
      return res.status(200).json({
        success: true,
        source: 'fallback',
        food: staticMatch
      });
    }

    // Return a default mock food instead of failing with 404
    const defaultFood = FALLBACK_FOODS[0]; // Oats with Almond Milk
    await logApiHealth(`/api/foods/barcode/${barcode}`, 'fallback', true, Date.now() - startTime);
    return res.status(200).json({
      success: true,
      source: 'fallback',
      food: {
        ...defaultFood,
        id: barcode, // assign the barcode so UI maps correctly
        name: `${defaultFood.name} (Offline Match)`
      }
    });

  } catch (err) {
    console.error('Barcode handler error:', err.message);
    const defaultFood = FALLBACK_FOODS[0];
    return res.status(200).json({
      success: true,
      source: 'fallback',
      food: {
        ...defaultFood,
        id: barcode,
        name: `${defaultFood.name} (Offline Match)`
      }
    });
  }
};

// ── GET /api/foods/delivery-link ────────────────────
exports.getDeliveryLink = async (req, res, next) => {
  try {
    const name = String(req.query.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const deliveryOptions = getDeliveryLinksForProduct(name);
    res.status(200).json({
      success: true,
      delivery: deliveryOptions[0] || null,
      deliveryOptions,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/foods/compare ──────────────────────────
exports.compareFoods = async (req, res, next) => {
  try {
    const { foodA, foodB } = req.body;
    if (!foodA || !foodB) {
      return res.status(400).json({ success: false, message: 'Both food products are required for comparison' });
    }
    
    const prefs = req.user?.preferences || {};
    const healthGoals = prefs.healthGoals || [];
    
    const details = {
      calories: { valA: foodA.calories, valB: foodB.calories, winner: foodA.calories < foodB.calories ? 'A' : 'B' },
      protein: { valA: foodA.protein, valB: foodB.protein, winner: foodA.protein > foodB.protein ? 'A' : 'B' },
      carbs: { valA: foodA.carbs, valB: foodB.carbs, winner: foodA.carbs < foodB.carbs ? 'A' : 'B' },
      fat: { valA: foodA.fat, valB: foodB.fat, winner: foodA.fat < foodB.fat ? 'A' : 'B' },
      fiber: { valA: foodA.fiber, valB: foodB.fiber, winner: foodA.fiber > foodB.fiber ? 'A' : 'B' },
      sugar: { valA: foodA.sugar, valB: foodB.sugar, winner: foodA.sugar < foodB.sugar ? 'A' : 'B' },
      healthScore: { valA: foodA.healthScore || 0, valB: foodB.healthScore || 0, winner: (foodA.healthScore || 0) > (foodB.healthScore || 0) ? 'A' : 'B' }
    };

    let weightProtein = 1.0;
    let weightCalories = -0.5;
    let weightSugar = -1.5;
    let weightFiber = 1.0;

    if (healthGoals.includes('muscle_gain')) {
      weightProtein = 3.0;
      weightCalories = 0.5;
    }
    if (healthGoals.includes('weight_loss')) {
      weightCalories = -3.0;
      weightFiber = 2.0;
      weightSugar = -2.0;
    }
    if (healthGoals.includes('healthy_eating')) {
      weightFiber = 2.5;
      weightSugar = -3.0;
    }

    const valA = (foodA.protein * weightProtein) + (foodA.fiber * weightFiber) + (foodA.calories * weightCalories) + (foodA.sugar * weightSugar);
    const valB = (foodB.protein * weightProtein) + (foodB.fiber * weightFiber) + (foodB.calories * weightCalories) + (foodB.sugar * weightSugar);
    
    const recommended = valA >= valB ? 'A' : 'B';
    const recommendedFood = valA >= valB ? foodA : foodB;
    
    let reason = `We recommend ${recommendedFood.name} based on your personal health settings. `;
    if (healthGoals.includes('muscle_gain')) {
      reason += `${recommendedFood.name} has ${Math.abs(foodA.protein - foodB.protein).toFixed(1)}g more protein per 100g, supporting muscle repair.`;
    } else if (healthGoals.includes('weight_loss')) {
      reason += `${recommendedFood.name} provides a better calorie-to-fiber ratio, keeping you full with fewer net calories.`;
    } else {
      reason += `It scores higher on our Nutritional Health Index (${recommendedFood.healthGrade}) and has a lower glycemic/processing impact.`;
    }

    res.status(200).json({
      success: true,
      winner: recommended,
      coachDecision: reason,
      details
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/foods/mood ──────────────────────────────
exports.getMoodRecommendations = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { mood } = req.query;
    if (!mood) {
      return res.status(400).json({ success: false, message: 'Mood parameter is required' });
    }
    
    const MOOD_MAPPINGS = {
      'Stressed': ['dark chocolate', 'pumpkin seeds', 'salmon', 'chia seeds', 'avocado'],
      'Gym': ['banana', 'oats', 'beetroot', 'peanut butter', 'honey', 'dates'],
      'Studying': ['walnuts', 'eggs', 'blueberries', 'green tea', 'spinach'],
      'Working': ['coffee', 'eggs', 'walnuts', 'almonds', 'dark chocolate'],
      'Relaxing': ['chamomile', 'almonds', 'banana', 'turkey', 'warm milk', 'honey'],
      'Happy': ['raw cacao', 'strawberries', 'bananas', 'yogurt', 'almonds']
    };
    
    const terms = MOOD_MAPPINGS[mood] || MOOD_MAPPINGS['Happy'];

    let foodList = [];
    try {
      const rawArrays = await Promise.all(terms.slice(0, 3).map(t => searchFoodsProxy(t, 8)));
      const rawAll = rawArrays.filter(Boolean).flat();
      
      const seen = new Set();
      const unique = rawAll.filter(p => {
        const k = p.id || p._id;
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      
      foodList = unique.map(normalise).filter(Boolean);
      
      // Async cache
      foodList.forEach(f => setCachedFood(f, 'search'));
    } catch (err) {
      console.warn('Proxy mood lookup failed:', err.message);
    }

    // Filter static fallback list for mood matching
    if (foodList.length === 0) {
      const moodLower = String(mood).toLowerCase();
      foodList = FALLBACK_FOODS.filter(f => {
        const mTags = (f.contextTags?.mood || f.mood || []).map(m => String(m).toLowerCase());
        return mTags.includes(moodLower);
      });
      if (foodList.length === 0) {
        foodList = FALLBACK_FOODS.slice(0, 20);
      }
    }

    await logApiHealth(`/api/foods/mood?mood=${mood}`, foodList.length > 0 ? 'off' : 'fallback', true, Date.now() - startTime);

    res.status(200).json({
      success: true,
      mood,
      foods: deduplicateFoods(foodList.slice(0, 20).map(ensureFoodImageAndGrade))
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/foods/weather ───────────────────────────
exports.getWeatherRecommendations = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { temp, condition, humidity, region } = req.query;
    const temperature = (temp !== null && temp !== undefined && temp !== '') ? parseFloat(temp) : 22;
    const weatherCond = String(condition || 'Clear').toLowerCase();
    const tempCat = normalizeTemperatureCategory(temperature);
    const detectedSeason = detectSeason(new Date(), region || 'India');
    
    let weatherTerms = ['salad', 'fruit', 'cucumber', 'watermelon'];
    let season = req.query.season || detectedSeason.name;
    
    if (temperature < 18) {
      weatherTerms = ['soup', 'ginger', 'stew', 'lentil soup', 'broth'];
      season = 'winter';
    } else if (weatherCond.includes('rain') || weatherCond.includes('drizzle') || weatherCond.includes('thunder') || weatherCond.includes('monsoon')) {
      weatherTerms = ['turmeric tea', 'mushroom soup', 'green tea', 'herbal tea'];
      season = 'monsoon';
    }
    
    let foodList = [];
    try {
      const rawArrays = await Promise.all(weatherTerms.slice(0, 3).map(t => searchFoodsProxy(t, 8)));
      const rawAll = rawArrays.filter(Boolean).flat();
      
      const seen = new Set();
      const unique = rawAll.filter(p => {
        const k = p.id || p._id;
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      
      foodList = unique.map(normalise).filter(Boolean);
      foodList.forEach(f => setCachedFood(f, 'search'));
    } catch (err) {
      console.warn('Proxy weather lookup failed:', err.message);
    }

    if (foodList.length === 0) {
      const seasonLower = String(season).toLowerCase();
      foodList = FALLBACK_FOODS.filter(f => {
        const wTags = (f.contextTags?.weather || f.weather || []).map(w => String(w).toLowerCase());
        return wTags.includes(seasonLower);
      });
      if (foodList.length === 0) {
        foodList = FALLBACK_FOODS.slice(0, 20);
      }
    }

    await logApiHealth(`/api/foods/weather?season=${season}`, foodList.length > 0 ? 'off' : 'fallback', true, Date.now() - startTime);

    res.status(200).json({
      success: true,
      weather: { temperature, condition: weatherCond, category: tempCat, season },
      foods: deduplicateFoods(foodList.slice(0, 20).map(ensureFoodImageAndGrade))
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/foods/dna ───────────────────────────────
exports.getDnaRecommendations = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const prefs = req.user?.preferences || {};
    const healthGoals = prefs.healthGoals || [];
    const allergies = prefs.allergies || [];
    const favoriteFoods = req.user?.favoriteFoods || [];
    const favoriteCuisines = prefs.favoriteCuisines || ['Mediterranean', 'Asian'];
    const dietType = prefs.dietType || 'Vegetarian';
    
    let seedTerms = [...favoriteCuisines];
    if (favoriteFoods.length > 0) {
      seedTerms.push(...favoriteFoods.map(f => f.name || f.product_name).slice(0, 2));
    }
    if (seedTerms.length === 0) {
      seedTerms = DIET_TERMS[dietType] || DIET_TERMS['Vegetarian'];
    }
    
    let foodList = [];
    try {
      const rawArrays = await Promise.all(seedTerms.slice(0, 3).map(t => searchFoodsProxy(t, 8)));
      const rawAll = rawArrays.filter(Boolean).flat();
      
      const seen = new Set();
      const unique = rawAll.filter(p => {
        const k = p.id || p._id;
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      
      foodList = unique.map(normalise).filter(Boolean);
      foodList.forEach(f => setCachedFood(f, 'search'));
    } catch (err) {
      console.warn('Proxy DNA lookup failed:', err.message);
    }

    if (foodList.length === 0) {
      // Use fallback dataset foods matching diet and cuisines
      foodList = FALLBACK_FOODS.filter(f => f.dietType && f.dietType.includes(dietType));
    }

    const userVector = {
      protein: healthGoals.includes('muscle_gain') ? 25 : 10,
      calories: healthGoals.includes('weight_loss') ? 150 : 350,
      sugar: healthGoals.includes('weight_loss') || healthGoals.includes('glycemic_control') ? 2 : 8,
      fiber: healthGoals.includes('healthy_eating') ? 6 : 2
    };

    const scoredFoods = foodList.map(food => {
      const fVec = {
        protein: food.protein || 0,
        calories: food.calories || 0,
        sugar: food.sugar || 0,
        fiber: food.fiber || 0
      };
      
      const dotProduct = (userVector.protein * fVec.protein) + (userVector.fiber * fVec.fiber);
      const magUser = Math.sqrt(userVector.protein**2 + userVector.fiber**2);
      const magFood = Math.sqrt(fVec.protein**2 + fVec.fiber**2) || 1;
      const cosine = dotProduct / (magUser * magFood);
      
      const allergenOverlap = allergies.some(a => food.allergens.some(pa => pa.toLowerCase().includes(a.toLowerCase())));
      
      let similarityScore = cosine * 10;
      if (allergenOverlap) similarityScore -= 8.0;
      
      similarityScore += (food.healthScore || 0) * 0.4;
      
      return {
        ...food,
        dnaMatchScore: Math.round(Math.max(0, Math.min(100, similarityScore * 10)))
      };
    });
    
    const ranked = scoredFoods.sort((a, b) => b.dnaMatchScore - a.dnaMatchScore);
    
    await logApiHealth('/api/foods/dna', ranked.length > 0 ? 'off' : 'fallback', true, Date.now() - startTime);

    res.status(200).json({
      success: true,
      count: ranked.length,
      foods: ranked.slice(0, 20)
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/food/scan-nutrition ─────────────────────
exports.scanNutrition = async (req, res, next) => {
  try {
    const { image, filename } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, message: 'No image provided for scanning' });
    }

    let buffer = null;
    if (typeof image === 'string' && image.includes('base64,')) {
      const base64Data = image.split('base64,')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(image)) {
      buffer = image;
    }

    let text = '';
    let confidence = 0;

    if (buffer) {
      try {
        const { runTesseractOCR } = require('../services/documentProcessorService');
        const ocrRes = await runTesseractOCR(buffer);
        text = ocrRes.text || '';
        confidence = ocrRes.confidence || 0;
      } catch (ocrErr) {
        console.warn('Backend OCR error (non-fatal):', ocrErr.message);
      }
    }

    // Try finding matching food item from foodKnowledge or fallbackFoods
    const { FALLBACK_FOODS } = require('../services/foodiebiteFallbackFoods');
    let matchedFood = null;
    
    // Check if filename contains food name hint (e.g. apple.jpg -> apple)
    const rawHint = (filename || '').replace(/[_-]/g, ' ').replace(/\.[a-z0-9]+$/i, '').trim().toLowerCase();
    
    // Search in FALLBACK_FOODS
    if (text) {
      const cleanText = text.toLowerCase();
      matchedFood = FALLBACK_FOODS.find(f => cleanText.includes(f.name.toLowerCase()));
    }
    if (!matchedFood && rawHint && rawHint.length >= 3 && !rawHint.includes('camera') && !rawHint.includes('image')) {
      matchedFood = FALLBACK_FOODS.find(f => f.name.toLowerCase().includes(rawHint) || rawHint.includes(f.name.toLowerCase()));
    }

    res.status(200).json({
      success: true,
      text,
      confidence,
      filename: filename || 'scanned_image.jpg',
      matchedFood: matchedFood || null
    });
  } catch (err) {
    console.error('scanNutrition error:', err);
    res.status(500).json({ success: false, message: 'Scan failed', error: err.message });
  }
};

module.exports.filterProducts = filterProducts;
module.exports.rank = rank;
module.exports.getStaticFallbackList = getStaticFallbackList;
module.exports.applyHealthProfileRanking = applyHealthProfileRanking;


