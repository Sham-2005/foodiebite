/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/recommendationEngine.js
 *  FoodieBite — Context-Aware Two-Pass Recommendation Engine (Phase 4)
 * ─────────────────────────────────────────────────────────────
 *
 *  PIPELINE:
 *  Candidate Foods
 *       ↓
 *  Pass 1: Safety & Hard Constraints
 *    - Dietary Safety (Vegan / Vegetarian / Eggetarian)
 *    - Allergen Safety (User-specific Allergies)
 *    - Confirmed Medical Restrictions (activeFoodRestrictions)
 *    - Fasting Restrictions (Constraint Layer: Navratri, Ekadashi, User-defined)
 *       ↓
 *  Pass 2: Context-Aware Scoring & Ranking (Safe Candidate Pool Only)
 *    - Base Nutritional Health Score
 *    - Medical Preference Tags Boost (+20)
 *    - Health Goal Suitability (+5 to +12)
 *    - Cuisine Preference Boost (+15)
 *    - Protein Target Override Boost (+10)
 *    - Meal-Time Suitability (+15)
 *    - Weather Intelligence (+12)
 *    - Seasonality Engine (+10)
 *    - Fasting Suitability (+15)
 *    - Availability Handling (available +5, unavailable -500, unknown 0)
 *    - Repetition & Recency Penalty (-12 to -25)
 *       ↓
 *  Traceable Explanations & Transparency (Surfacing Unverified Medical Restrictions)
 *       ↓
 *  Recommended Output
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { isDietCompatible } = require('./dietarySafetyService');
const { buildContextProfile, isFastingCompatible } = require('./contextService');
const { BEHAVIOR_CONFIG, getBehavioralProfileSync } = require('./behaviorLearningService');
const { calculateTransparentScore } = require('./scoringEngine');

/**
 * Pass 1 — Hard exclusion (safety-critical, must run first and be unconditional).
 * Evaluates dietary compatibility, allergens, confirmed medical restrictions,
 * and active religious/custom fasting constraints.
 *
 * @param {Array<Object>} foods - Candidate food items
 * @param {Object} userProfile - User profile containing allergies & confirmed activeFoodRestrictions
 * @param {Object} contextProfile - Optional normalized context profile
 * @returns {Array<Object>} Foods that pass all safety exclusions
 */
function hardExclude(foods, userProfile = {}, contextProfile = null) {
  if (!Array.isArray(foods)) return [];

  const userAllergies = (userProfile.allergies || []).map(a => String(a).toLowerCase().trim());
  const activeRestrictions = (userProfile.activeFoodRestrictions || []).map(r => String(r).toLowerCase().trim());
  const dietType = userProfile.dietType || userProfile.preferences?.dietType || userProfile.preferences?.diet || userProfile.diet || '';

  // Fasting constraint layer
  const fasting = contextProfile?.fasting || userProfile.fasting || userProfile.preferences?.fasting || null;

  return foods.filter(f => {
    if (!f || typeof f !== 'object') return false;

    // 0. Hard Exclusion for Incompatible Diet Type (Vegan, Vegetarian, Eggetarian)
    if (dietType && !isDietCompatible(f, dietType)) {
      return false;
    }

    // 1. Hard Exclusion for Allergens
    const foodAllergens = (f.allergens || []).map(a => String(a).toLowerCase().trim());
    const allergenConflict = foodAllergens.some(a => userAllergies.includes(a));
    if (allergenConflict) return false;

    // 2. Hard Exclusion for Confirmed Medical Food Restrictions (activeFoodRestrictions)
    const foodAvoidTags = (f.conditionTags?.avoid || []).map(t => String(t).toLowerCase().trim());
    const restrictionConflict = activeRestrictions.some(r => foodAvoidTags.includes(r));
    if (restrictionConflict) return false;

    // 3. Hard Exclusion for Active Religious / Custom Fasting Constraints
    if (fasting && fasting.active) {
      const fastingEvaluation = isFastingCompatible(f, fasting);
      if (!fastingEvaluation.compatible) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Pass 2 — Context-Aware Ranking & Scoring (runs ONLY on the output of Pass 1).
 *
 * @param {Array<Object>} pass1Foods - Safe foods from Pass 1
 * @param {Object} userProfile - User profile with preferred tags and health goals
 * @param {Object} context - Environmental context { weather, mood, mealPeriod, season, fasting, availability }
 * @param {Object|null} behavioralProfile - Derived BehavioralProfile
 * @returns {Array<Object>} Safe foods sorted by recommendationScore (descending)
 */
function rankAndScore(pass1Foods, userProfile = {}, context = {}, behavioralProfile = null) {
  if (!Array.isArray(pass1Foods)) return [];

  // Normalize or resolve context profile
  const ctx = (context && context.mealPeriod && context.weather && context.season)
    ? context
    : buildContextProfile({ ...context, userProfile });

  const scored = pass1Foods.map(f => {
    const beh = behavioralProfile || userProfile.behavioralProfile || ctx.behavioralProfile || null;
    const transparent = calculateTransparentScore(f, userProfile, ctx, beh);

    // Merge contextual reasons from transparent scoring
    const contextualReasons = Array.from(new Set([
      ...transparent.explanationFactors
    ]));

    return {
      ...f,
      recommendationScore: transparent.totalScore,
      explanation: transparent.explanationText,
      subScores: transparent.subScores,
      weightedScores: transparent.weightedScores,
      contextualReasons
    };
  });

  // Sort descending by recommendationScore
  return scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
}

/**
 * Applies diversity protection and controlled exploration on safe, ranked foods.
 * - Prevents repetitive recommendation loops (e.g. 3 paneer or soup dishes in a row).
 * - Introduces safe exploration candidates outside the user's primary routine.
 * - All candidates are guaranteed to have passed Pass 1 hard safety gates.
 */
function applyDiversityAndExploration(rankedFoods, topN = 30, behavioralProfile = null, userProfile = {}) {
  if (!Array.isArray(rankedFoods) || rankedFoods.length <= 1) {
    return (rankedFoods || []).slice(0, topN);
  }

  const explorationRate = behavioralProfile?.explorationRate || BEHAVIOR_CONFIG.DEFAULT_EXPLORATION_RATE || 0.15;
  const desiredExplorationCount = Math.max(1, Math.round(topN * explorationRate));

  const result = [];
  const pool = [...rankedFoods];

  // Helper to extract primary category or key noun from food name
  function getPrimaryNoun(name = '') {
    const norm = name.toLowerCase();
    if (/paneer/i.test(norm)) return 'paneer';
    if (/chicken/i.test(norm)) return 'chicken';
    if (/tofu/i.test(norm)) return 'tofu';
    if (/dal|lentil/i.test(norm)) return 'dal';
    if (/salad/i.test(norm)) return 'salad';
    if (/soup/i.test(norm)) return 'soup';
    if (/rice|biryani|pulao/i.test(norm)) return 'rice';
    if (/egg|omelette/i.test(norm)) return 'egg';
    if (/dosa|idli/i.test(norm)) return 'south_indian_tiffin';
    return null;
  }

  // Identify top learned/preferred cuisines to know what is "familiar" vs "exploration"
  const familiarCuisines = new Set([
    ...(userProfile.cuisines || userProfile.preferences?.cuisines || []),
    ...Object.keys(behavioralProfile?.preferredCuisines || {})
  ].map(c => c.toLowerCase().trim()).filter(Boolean));

  let explorationAdded = 0;
  const maxExploration = (topN >= 3 && pool.length >= 4) ? desiredExplorationCount : 0;

  while (pool.length > 0 && result.length < topN) {
    // Check if we should insert an exploration candidate at slot 2 or 4
    const isExplorationTurn = maxExploration > 0 && explorationAdded < maxExploration &&
      (result.length === 2 || (result.length === 4 && maxExploration > 1));

    if (isExplorationTurn && familiarCuisines.size > 0) {
      // Find a safe food from a cuisine outside familiar cuisines
      const exploreIdx = pool.findIndex(f => {
        const fCuisine = (f.cuisine || '').toLowerCase().trim();
        return fCuisine && !familiarCuisines.has(fCuisine);
      });

      if (exploreIdx !== -1) {
        const [exploreItem] = pool.splice(exploreIdx, 1);
        const reasons = [...(exploreItem.contextualReasons || [])];
        reasons.push('exploring a safe, delicious option outside your usual cuisine');
        result.push({
          ...exploreItem,
          isExploration: true,
          contextualReasons: reasons
        });
        explorationAdded++;
        continue;
      }
    }

    // Standard diversity loop-prevention check
    let candidateIdx = 0;
    if (result.length >= 2) {
      const prevNoun1 = getPrimaryNoun(result[result.length - 1].name);
      const prevNoun2 = getPrimaryNoun(result[result.length - 2].name);

      // If the last 2 items share the same primary noun, avoid a 3rd consecutive item
      if (prevNoun1 && prevNoun1 === prevNoun2) {
        const diverseIdx = pool.findIndex(f => getPrimaryNoun(f.name) !== prevNoun1);
        if (diverseIdx !== -1) {
          candidateIdx = diverseIdx;
        }
      }
    }

    const [item] = pool.splice(candidateIdx, 1);
    result.push(item);
  }

  return result;
}

/**
 * Executes the complete two-pass recommendation engine and prepares the response payload.
 * Connects confirmed medical restrictions and active fasting to Pass 1 hard exclusion,
 * applies unified contextual scoring in Pass 2, and surfaces unverified medical restrictions
 * for UI transparency.
 *
 * @param {Array<Object>} candidateFoods - Raw candidate foods pool
 * @param {Object} userProfile - Full user profile (with preferences & healthProfile)
 * @param {Object} context - Context signals or pre-built ContextProfile
 * @param {number} topN - Max results to return
 * @param {Object|null} behavioralProfile - Derived BehavioralProfile
 * @returns {{ foods: Array<Object>, totalEvaluated: number, passedExclusionCount: number, unverifiedFoodRestrictions: Array<string>, contextProfile: Object, behavioralProfile: Object|null }}
 */
function recommendFoods(candidateFoods, userProfile = {}, context = {}, topN = 30, behavioralProfile = null) {
  // Normalize context once per request
  const contextProfile = (context && context.mealPeriod && context.weather && context.season && context.fasting)
    ? context
    : buildContextProfile({ ...context, userProfile });

  const behProfile = behavioralProfile ||
    userProfile.behavioralProfile ||
    context.behavioralProfile ||
    (userProfile.userId ? getBehavioralProfileSync(userProfile.userId) : null) ||
    (userProfile.id ? getBehavioralProfileSync(userProfile.id) : null);

  // Extract confirmed medical restrictions (from Phase 2 & 3 medical engine output)
  const confirmedLimits = [
    ...(userProfile.healthProfile?.foodProfile?.foodsToLimit || []),
    ...(userProfile.activeFoodRestrictions || []),
    ...(userProfile.medicalProfile?.confirmedRestrictions || [])
  ];

  const allergies = userProfile.preferences?.allergies || userProfile.allergies || [];
  const healthGoals = userProfile.preferences?.healthGoals || userProfile.healthGoals || [];
  const preferredTags = [
    ...(userProfile.healthProfile?.foodProfile?.foodsToPrefer || []),
    ...(userProfile.preferredTags || []),
    ...(userProfile.preferredFoodTags || []),
    ...(userProfile.medicalProfile?.preferredFoodTags || []),
    ...(userProfile.foodsToPrefer || [])
  ];
  const dietType = userProfile.preferences?.dietType || userProfile.dietType || userProfile.preferences?.diet || userProfile.diet || '';

  const cuisines = userProfile.preferences?.cuisines || userProfile.cuisines || [];
  const minProteinOverride = userProfile.preferences?.minProtein || userProfile.minProteinOverride || null;
  const maxCaloriesOverride = userProfile.preferences?.maxCalories || userProfile.maxCaloriesOverride || null;
  const fasting = contextProfile.fasting;

  const sanitizedUserProfile = {
    allergies,
    activeFoodRestrictions: confirmedLimits,
    preferredTags,
    healthGoals,
    dietType,
    cuisines,
    minProteinOverride,
    maxCaloriesOverride,
    fasting,
    behavioralProfile: behProfile
  };

  // Pass 1: Unconditional Hard Exclusion (Safety + Fasting Constraints)
  const safeFoods = hardExclude(candidateFoods, sanitizedUserProfile, contextProfile);

  // Pass 2: Contextual Scoring & Ranking on safe output (with behavioral learning)
  const rankedFoods = rankAndScore(safeFoods, sanitizedUserProfile, contextProfile, behProfile);

  // Pass 3: Diversity Loop-Prevention & Controlled Safe Exploration
  const diverseAndExplored = applyDiversityAndExploration(rankedFoods, topN, behProfile, sanitizedUserProfile);

  // Extract unverified restrictions for UI warning surfacing
  const unverifiedRestrictions = userProfile.healthProfile?.foodProfile?.unverifiedFoodRestrictions ||
    userProfile.healthProfile?.unverifiedFoodRestrictions ||
    userProfile.unverifiedFoodRestrictions || [];

  return {
    foods: diverseAndExplored,
    totalEvaluated: candidateFoods.length,
    passedExclusionCount: safeFoods.length,
    unverifiedFoodRestrictions: unverifiedRestrictions,
    contextProfile,
    behavioralProfile: behProfile
  };
}

module.exports = {
  hardExclude,
  rankAndScore,
  applyDiversityAndExploration,
  recommendFoods
};
