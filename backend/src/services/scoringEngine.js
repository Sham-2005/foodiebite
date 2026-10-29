/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/scoringEngine.js
 *  FoodieBite — Transparent Modular Recommendation Scoring Engine
 * ─────────────────────────────────────────────────────────────
 *
 * Provides a 0–100 normalized scoring system with configurable,
 * modular weighting for dietary compatibility, safety, health goals,
 * cuisine, spice, weather, seasonality, fasting, favorites/history, and availability.
 *
 * Derives transparent, factor-driven explanations directly from scoring factors.
 */

'use strict';

const { isDietCompatible } = require('./dietarySafetyService');
const { buildContextProfile, isFastingCompatible } = require('./contextService');

// Default Configurable Weighting (Sum of soft weights = 1.00 / 100%)
const DEFAULT_SCORING_WEIGHTS = {
  dietCompatibility: 0.25,        // 25% — Strict diet compatibility
  healthGoalMatch: 0.20,          // 20% — Health goals alignment
  cuisinePreference: 0.10,        // 10% — Preferred cuisine match
  spicePreference: 0.05,          // 5%  — Spice level preference
  weatherSuitability: 0.10,       // 10% — Weather category/condition suitability
  seasonalSuitability: 0.10,      // 10% — In-season suitability
  fastingCompatibility: 0.05,     // 5%  — Fasting-friendly dish boost
  personalHistoryFavorites: 0.10, // 10% — History, favorites, behavioral learning
  availability: 0.10              // 10% — Stock / vendor availability
};

let currentScoringWeights = { ...DEFAULT_SCORING_WEIGHTS };

/**
 * Configure scoring weights dynamically.
 * @param {Object} newWeights - Partial or full weight overrides
 */
function setScoringWeights(newWeights = {}) {
  currentScoringWeights = {
    ...currentScoringWeights,
    ...newWeights
  };
  return currentScoringWeights;
}

/**
 * Get current configured scoring weights.
 */
function getScoringWeights() {
  return { ...currentScoringWeights };
}

/**
 * Reset scoring weights to factory defaults.
 */
function resetScoringWeights() {
  currentScoringWeights = { ...DEFAULT_SCORING_WEIGHTS };
  return currentScoringWeights;
}

/**
 * Evaluates a candidate food item against user context and environmental context.
 * Computes a normalized score [0, 100] and human-readable, factor-driven explanation bullets.
 *
 * @param {Object} food - Candidate food item
 * @param {Object} userContext - Structured user context
 * @param {Object} contextProfile - Normalized environmental context
 * @param {Object|null} behavioralProfile - Learned behavioral profile
 * @param {Object} weightOverrides - Optional per-request weight overrides
 * @returns {{ totalScore: number, subScores: Object, weightedScores: Object, explanationFactors: Array<string>, explanationText: string }}
 */
function calculateTransparentScore(food, userContext = {}, contextProfile = null, behavioralProfile = null, weightOverrides = {}) {
  if (!food || typeof food !== 'object') {
    return {
      totalScore: 0,
      subScores: {},
      weightedScores: {},
      explanationFactors: [],
      explanationText: 'Invalid food item'
    };
  }

  const weights = {
    ...currentScoringWeights,
    ...weightOverrides
  };

  const ctx = contextProfile || buildContextProfile({ userProfile: userContext });
  const beh = behavioralProfile || userContext.behavioralProfile || ctx.behavioralProfile || null;

  const subScores = {
    dietCompatibility: 0,
    healthGoalMatch: 0,
    cuisinePreference: 0,
    spicePreference: 0,
    weatherSuitability: 0,
    seasonalSuitability: 0,
    fastingCompatibility: 0,
    personalHistoryFavorites: 0,
    availability: 0
  };

  const explanationFactors = [];

  // ── 1. Diet Compatibility (Weight: 25%) ──────────────────────────────
  const diet = userContext.dietType || userContext.preferences?.dietType || userContext.diet || '';
  if (diet) {
    if (isDietCompatible(food, diet)) {
      subScores.dietCompatibility = 1.0;
      const displayDiet = diet.charAt(0).toUpperCase() + diet.slice(1);
      explanationFactors.push(`Matches your ${displayDiet} diet preference`);
    } else {
      subScores.dietCompatibility = 0.0;
    }
  } else {
    subScores.dietCompatibility = 0.8;
  }

  // ── 2. Health Goal Match & Medical Preference Tags (Weight: 20%) ────
  const healthGoals = (userContext.healthGoals || userContext.preferences?.healthGoals || []).map(g => String(g).toLowerCase().trim());
  const preferTags = [
    ...(userContext.preferredTags || []),
    ...(userContext.preferredFoodTags || []),
    ...(userContext.medicalProfile?.preferredFoodTags || []),
    ...(userContext.foodProfile?.foodsToPrefer || []),
    ...(userContext.foodsToPrefer || [])
  ].map(t => String(t).toLowerCase().trim());

  let goalScore = 0;
  let factorCount = 0;

  // Medical prefer tags boost
  const foodPrefer = (food.conditionTags?.prefer || []).map(p => String(p).toLowerCase().trim());
  for (const tag of preferTags) {
    if (foodPrefer.includes(tag)) {
      goalScore += 1.0;
      factorCount++;
      explanationFactors.push(`Matches medical wellness consideration (${tag})`);
    }
  }

  if (healthGoals.length > 0) {
    for (const goal of healthGoals) {
      if (goal === 'muscle_gain' || goal === 'high_protein') {
        if (food.protein >= 15 || food.nutrientProfile?.protein === 'high') {
          goalScore += 1.0;
          explanationFactors.push(`High protein (${food.protein || '15+'}g) fits Muscle Gain goal`);
          factorCount++;
        } else if (food.protein >= 8) {
          goalScore += 0.5;
          factorCount++;
        }
      } else if (goal === 'weight_loss' || goal === 'low_calorie') {
        if ((food.calories && food.calories <= 300) || (food.fiber && food.fiber >= 4.0)) {
          goalScore += 1.0;
          explanationFactors.push(`Nutrient dense & light calories (${food.calories || 250} kcal) fits Weight Loss goal`);
          factorCount++;
        } else if (food.calories && food.calories <= 450) {
          goalScore += 0.5;
          factorCount++;
        }
      } else if (goal === 'diabetic_friendly' || goal === 'low_sugar') {
        if ((food.sugar !== undefined && food.sugar <= 5) || food.conditionTags?.prefer?.includes('low-gi')) {
          goalScore += 1.0;
          explanationFactors.push(`Low sugar & low GI fits Diabetic-Friendly goal`);
          factorCount++;
        }
      } else if (goal === 'healthy_eating' || goal === 'balanced') {
        if ((food.healthScore && food.healthScore >= 7.0) || (food.fiber && food.fiber >= 3.0)) {
          goalScore += 1.0;
          explanationFactors.push(`High health rating (${food.healthScore || '7+'}/10) supports Healthy Eating goal`);
          factorCount++;
        }
      }
    }
  }

  subScores.healthGoalMatch = factorCount > 0 ? Math.min(1.0, goalScore / factorCount) : (food.healthScore ? food.healthScore / 10 : 0.7);

  // ── 3. Cuisine Preference (Weight: 10%) ─────────────────────────────
  const userCuisines = (userContext.cuisinePreferences || userContext.cuisines || userContext.preferences?.cuisines || []).map(c => String(c).toLowerCase().replace(/_/g, ' ').trim());
  const foodCuisine = (food.cuisine || '').toLowerCase().replace(/_/g, ' ').trim();

  if (userCuisines.length > 0 && foodCuisine) {
    if (userCuisines.some(c => foodCuisine.includes(c) || c.includes(foodCuisine))) {
      subScores.cuisinePreference = 1.0;
      const displayCuisine = food.cuisine.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      explanationFactors.push(`Matches preferred ${displayCuisine} cuisine`);
    } else {
      subScores.cuisinePreference = 0.3;
    }
  }

  if (beh && beh.preferredCuisines && foodCuisine) {
    let matchedLearnedCuisine = false;
    for (const [c, cData] of Object.entries(beh.preferredCuisines)) {
      const normC = c.toLowerCase().replace(/_/g, ' ').trim();
      if (foodCuisine.includes(normC) || normC.includes(foodCuisine)) {
        subScores.cuisinePreference = Math.min(1.0, (cData.confidence || 0.5));
        const displayCuisine = c.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        explanationFactors.push(`matches learned preference for ${displayCuisine} cuisine`);
        matchedLearnedCuisine = true;
        break;
      }
    }
    if (!matchedLearnedCuisine && userCuisines.length === 0) {
      subScores.cuisinePreference = 0.5;
    }
  } else if (userCuisines.length === 0) {
    subScores.cuisinePreference = 0.6;
  }

  // ── 4. Spice Preference (Weight: 5%) ────────────────────────────────
  const targetSpice = (userContext.spiceLevel || userContext.preferences?.spiceLevel || 'medium').toLowerCase();
  const foodSpice = (food.spiceLevel || 'medium').toLowerCase();

  if (targetSpice === foodSpice) {
    subScores.spicePreference = 1.0;
    explanationFactors.push(`Fits your ${targetSpice}-spice preference`);
  } else if (
    (targetSpice === 'low' && (foodSpice === 'mild' || foodSpice === 'medium')) ||
    (targetSpice === 'medium' && (foodSpice === 'spicy' || foodSpice === 'low'))
  ) {
    subScores.spicePreference = 0.6;
  } else if (targetSpice === 'low' && foodSpice === 'spicy') {
    subScores.spicePreference = 0.1;
  } else {
    subScores.spicePreference = 0.5;
  }

  // ── 5. Weather & Meal Suitability (Weight: 10%) ─────────────────────
  const weatherCategory = ctx.weather?.category || 'mild';
  const foodWeatherTags = [
    ...(food.contextTags?.weather || []),
    ...(food.weather || []),
    ...(food.weatherTags || [])
  ].map(w => String(w).toLowerCase().trim());

  if (weatherCategory === 'hot' || weatherCategory === 'warm') {
    const isCooling = foodWeatherTags.includes('summer') || foodWeatherTags.includes('hot') ||
                      (food.tags && food.tags.includes('cooling')) ||
                      /salad|fruit|curd|yogurt|cucumber|melon|coconut|juice|smoothie/i.test(food.name || '');
    if (isCooling) {
      subScores.weatherSuitability = 1.0;
      explanationFactors.push(`refreshing and hydrating for hot weather`);
    } else {
      subScores.weatherSuitability = 0.5;
    }
  } else if (weatherCategory === 'cold' || weatherCategory === 'cool') {
    const isWarming = foodWeatherTags.includes('winter') || foodWeatherTags.includes('cold') ||
                      (food.tags && food.tags.includes('warm')) ||
                      /soup|stew|ginger|turmeric|hot|dal|khichdi|broth|curry/i.test(food.name || '');
    if (isWarming) {
      subScores.weatherSuitability = 1.0;
      explanationFactors.push(`warm and nourishing for cold weather`);
    } else {
      subScores.weatherSuitability = 0.5;
    }
  } else if (ctx.weather?.isRainy || ctx.weather?.conditionCategory === 'rainy') {
    const isComfort = /soup|tea|khichdi|warm|comfort|broth/i.test(food.name || '');
    if (isComfort) {
      subScores.weatherSuitability = 1.0;
      explanationFactors.push(`comforting option suited for rainy weather`);
    } else {
      subScores.weatherSuitability = 0.6;
    }
  } else {
    subScores.weatherSuitability = 0.7;
  }

  // Meal Period Check
  if (ctx.mealPeriod) {
    const period = ctx.mealPeriod.toLowerCase();
    const foodMealTypes = (food.mealTypes || []).map(m => String(m).toLowerCase());
    const fCat = (food.category || '').toLowerCase();
    const fCats = (food.categories || []).map(c => String(c).toLowerCase());
    const fTags = (food.tags || []).map(t => String(t).toLowerCase());

    let matchesMeal = foodMealTypes.includes(period) || fTags.includes(period);

    if (!matchesMeal) {
      if (period === 'breakfast') {
        matchesMeal = fCat.includes('breakfast') || fCat.includes('cereal') ||
                      fCats.some(c => c.includes('breakfast') || c.includes('cereal')) ||
                      foodMealTypes.includes('morning');
      } else if (period === 'morning_snack' || period === 'evening_snack') {
        matchesMeal = foodMealTypes.includes('snack') || fCat.includes('snack') ||
                      fCat.includes('nut') || fCat.includes('fruit') ||
                      fCats.some(c => c.includes('snack'));
      } else if (period === 'lunch') {
        matchesMeal = foodMealTypes.includes('lunch') || fCat.includes('meal') ||
                      fCat.includes('curry') || fCat.includes('rice') || fCat.includes('bread');
      } else if (period === 'dinner') {
        matchesMeal = foodMealTypes.includes('dinner') || fCat.includes('curry') ||
                      fCat.includes('dal') || fCat.includes('soup') || fTags.includes('dinner');
      }
    }

    if (matchesMeal) {
      const displayPeriod = period.replace('_', ' ');
      explanationFactors.push(`ideal choice for ${displayPeriod}`);
      subScores.weatherSuitability = Math.min(1.0, subScores.weatherSuitability + 0.2);
    }
  }

  // ── 6. Seasonal Suitability (Weight: 10%) ───────────────────────────
  const seasonName = ctx.season?.name ? ctx.season.name.toLowerCase() : null;
  if (seasonName) {
    const foodSeasonalTags = [
      ...(food.seasonalTags || []),
      ...(food.contextTags?.weather || []),
      ...(food.weather || [])
    ].map(s => String(s).toLowerCase().trim());

    if (foodSeasonalTags.includes(seasonName)) {
      subScores.seasonalSuitability = 1.0;
      explanationFactors.push(`in-season ${seasonName.charAt(0).toUpperCase() + seasonName.slice(1)} food`);
    } else {
      subScores.seasonalSuitability = 0.6;
    }
  } else {
    subScores.seasonalSuitability = 0.7;
  }

  // ── 7. Fasting Compatibility (Weight: 5%) ───────────────────────────
  if (ctx.fasting?.active) {
    const fastingCheck = isFastingCompatible(food, ctx.fasting);
    if (fastingCheck.compatible) {
      subScores.fastingCompatibility = 1.0;
      explanationFactors.push(`Matches active ${ctx.fasting.type || 'religious'} fasting guidelines`);
    } else {
      subScores.fastingCompatibility = 0.0;
    }
  } else {
    subScores.fastingCompatibility = 1.0;
  }

  // ── 8. Personal History & Favorites (Weight: 10%) ────────────────────
  let historyScore = 0.5;
  const favFoods = (userContext.favoriteFoods || userContext.favorites || []).map(f => String(f).toLowerCase().trim());
  const foodId = String(food.id || '').toLowerCase().trim();
  const foodName = String(food.name || '').toLowerCase().trim();

  if (favFoods.some(f => f === foodId || foodName.includes(f))) {
    historyScore = 1.0;
    explanationFactors.push(`Saved in your Favorites`);
  } else if (beh) {
    if (beh.preferredFoods && (beh.preferredFoods[foodId] || beh.preferredFoods[foodName])) {
      const pf = beh.preferredFoods[foodId] || beh.preferredFoods[foodName];
      historyScore = Math.min(1.0, 0.6 + (pf.confidence || 0.4));
      explanationFactors.push(`frequently chosen by you`);
    } else if (beh.dislikedFoods && (beh.dislikedFoods[foodId] || beh.dislikedFoods[foodName])) {
      historyScore = 0.1;
    }
  }

  subScores.personalHistoryFavorites = Math.max(0, Math.min(1.0, historyScore));

  // ── 9. Availability (Weight: 10%) ────────────────────────────────────
  if (food.availability === 'available' || food.availability === undefined || food.availability === null) {
    subScores.availability = 1.0;
  } else if (food.availability === 'unknown') {
    subScores.availability = 0.7;
  } else if (food.availability === 'unavailable') {
    subScores.availability = 0.0;
  }

  // ── Calculate Weighted Total Score (0 - 100) ────────────────────────
  let rawWeightedSum = 0;
  let totalWeightSum = 0;
  const weightedScores = {};

  for (const [key, weight] of Object.entries(weights)) {
    const sub = subScores[key] !== undefined ? subScores[key] : 0.5;
    const pts = sub * weight * 100;
    weightedScores[key] = Math.round(pts * 10) / 10;
    rawWeightedSum += pts;
    totalWeightSum += weight * 100;
  }

  // Repetition penalty: exact 25 point deduction for top-3 recent items
  let repetitionPenaltyPoints = 0;
  const recentList = Array.isArray(ctx.recentRecommendations) ? ctx.recentRecommendations : [];
  if (recentList.length > 0) {
    const matchIndex = recentList.map(r => String(r).toLowerCase().trim()).lastIndexOf(foodId);
    if (matchIndex !== -1) {
      const turnsAgo = recentList.length - 1 - matchIndex;
      if (turnsAgo < 3) {
        repetitionPenaltyPoints = 25;
      } else if (turnsAgo < 10) {
        repetitionPenaltyPoints = 12;
      }
    }
  }

  const normalizedTotalScore = totalWeightSum > 0
    ? Math.max(0, Math.min(100, Math.round((rawWeightedSum / totalWeightSum) * 100) - repetitionPenaltyPoints))
    : 50;

  const explanationText = explanationFactors.length > 0
    ? `Recommended because:\n• ` + explanationFactors.slice(0, 5).join('\n• ')
    : `Recommended based on overall nutrition and health balance.`;

  return {
    totalScore: normalizedTotalScore,
    subScores,
    weightedScores,
    explanationFactors,
    explanationText
  };
}

module.exports = {
  DEFAULT_SCORING_WEIGHTS,
  setScoringWeights,
  getScoringWeights,
  resetScoringWeights,
  calculateTransparentScore
};
