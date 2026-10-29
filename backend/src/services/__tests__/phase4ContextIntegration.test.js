/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/phase4ContextIntegration.test.js
 *  FoodieBite — Phase 4 Context-Aware Personalization Test Suite
 * ─────────────────────────────────────────────────────────────
 *
 *  TEST MATRIX:
 *  Test 1  — Hot weather: cooling/hydrating foods receive ranking boost
 *  Test 2  — Cold weather: warm/soup foods receive contextual preference
 *  Test 3  — Breakfast: breakfast-compatible foods receive ranking boost
 *  Test 4  — Dinner: dinner context is passed and scored correctly
 *  Test 5  — Active fasting: restricted foods are strictly excluded
 *  Test 6  — No fasting: fasting restrictions do not apply
 *  Test 7  — Medical + weather: weather score never overrides medical safety
 *  Test 8  — Allergy + weather: contextual score never overrides allergy exclusion
 *  Test 9  — Vegan + contextual score: animal products remain strictly excluded
 *  Test 10 — Unknown weather: recommendations succeed when weather is unavailable
 *  Test 11 — Unknown season: recommendations succeed without season data
 *  Test 12 — Missing meal type: recommendations succeed without meal type
 *  Test 13 — Missing availability: unknown availability is not penalized
 *  Test 14 — Repetition penalty: recently recommended foods receive deterministic penalty
 *  Test 15 — Cross-engine consistency: catalog and AI engines produce compatible safety decisions
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { recommendFoods, hardExclude, rankAndScore } = require('../recommendationEngine');
const { scoreFoodWithPriority, recommendFoods: aiRecommendFoods } = require('../../ai/recommendationEngine');
const { buildContextProfile, isFastingCompatible, detectMealPeriod, detectSeason, normalizeTemperatureCategory } = require('../contextService');
const { buildUserFoodProfile } = require('../profileBuilder');
const { normalizeOffProduct } = require('../foodNutrientNormalizer');

console.log('\n======================================================');
console.log('--- Phase 4: Context-Aware Personalization Suite ---');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// ── Mock Food Dataset for Testing ─────────────────────────────
const MOCK_FOODS = [
  {
    id: 'food_chilled_salad',
    name: 'Chilled Cucumber & Watermelon Salad',
    category: 'Salad / Fruit',
    mealTypes: ['lunch', 'evening_snack'],
    calories: 85,
    protein: 2,
    carbs: 18,
    fat: 0.5,
    fiber: 3,
    healthScore: 7.5,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: [],
    tags: ['cooling', 'hydrating', 'fruit'],
    contextTags: { weather: ['hot', 'summer'], mood: ['relaxing'] },
    seasonalTags: ['summer'],
    fastingTags: ['fruit', 'vrat_friendly'],
    availability: 'available'
  },
  {
    id: 'food_hot_lentil_soup',
    name: 'Steaming Ginger Lentil Soup',
    category: 'Soup',
    mealTypes: ['lunch', 'dinner'],
    calories: 160,
    protein: 9,
    carbs: 22,
    fat: 3,
    fiber: 5,
    healthScore: 8.0,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: [],
    tags: ['warm', 'comfort', 'soup'],
    contextTags: { weather: ['cold', 'winter', 'monsoon'], mood: ['comfort'] },
    seasonalTags: ['winter', 'monsoon'],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_oats_breakfast',
    name: 'Warm Cinnamon Oats Bowl',
    category: 'Breakfast / Cereals',
    mealTypes: ['breakfast'],
    calories: 190,
    protein: 7,
    carbs: 32,
    fat: 3,
    fiber: 5,
    healthScore: 8.5,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: [],
    tags: ['breakfast', 'high-fiber'],
    contextTags: { weather: ['winter', 'mild'], mood: ['relaxing'] },
    seasonalTags: ['winter', 'autumn'],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_dinner_biryani',
    name: 'Vegetable Dum Biryani',
    category: 'Rice / Main',
    mealTypes: ['dinner', 'lunch'],
    calories: 340,
    protein: 8,
    carbs: 56,
    fat: 8,
    fiber: 4,
    healthScore: 6.8,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: [],
    tags: ['dinner', 'filling'],
    contextTags: { weather: ['mild'], mood: ['happy'] },
    seasonalTags: [],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_wheat_roti',
    name: 'Whole Wheat Chapati',
    category: 'Grain / Bread',
    mealTypes: ['lunch', 'dinner'],
    calories: 80,
    protein: 3,
    carbs: 15,
    fat: 0.5,
    fiber: 2.2,
    healthScore: 7.0,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: ['gluten'],
    tags: ['staple'],
    contextTags: { weather: ['mild'] },
    seasonalTags: [],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_sabudana_khichdi',
    name: 'Sabudana Khichdi (Vrat Special)',
    category: 'Vrat / Breakfast',
    mealTypes: ['breakfast', 'evening_snack'],
    calories: 220,
    protein: 4,
    carbs: 42,
    fat: 6,
    fiber: 1.5,
    healthScore: 6.5,
    vegetarian: true,
    vegan: false,
    eggetarian: true,
    allergens: ['nuts'],
    tags: ['vrat', 'fasting_friendly'],
    contextTags: { weather: ['mild'] },
    seasonalTags: ['monsoon', 'autumn'],
    fastingTags: ['vrat_friendly', 'sabudana', 'potato'],
    availability: 'available'
  },
  {
    id: 'food_sugary_cold_beverage',
    name: 'Chilled Sweet Mango Shake',
    category: 'Beverage',
    mealTypes: ['evening_snack'],
    calories: 280,
    protein: 4,
    carbs: 52,
    sugar: 35,
    fat: 6,
    fiber: 1,
    healthScore: 4.0,
    conditionTags: {
      prefer: [],
      avoid: ['refined-sugar', 'high-sugar']
    },
    vegetarian: true,
    vegan: false,
    eggetarian: true,
    allergens: ['dairy'],
    tags: ['cooling', 'sweet'],
    contextTags: { weather: ['hot', 'summer'] },
    seasonalTags: ['summer'],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_peanut_chaat',
    name: 'Cold Roasted Peanut Chaat',
    category: 'Snack',
    mealTypes: ['evening_snack'],
    calories: 190,
    protein: 8,
    carbs: 10,
    fat: 14,
    healthScore: 7.0,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: ['peanuts'],
    tags: ['cooling', 'quick'],
    contextTags: { weather: ['hot', 'summer'] },
    seasonalTags: ['summer'],
    fastingTags: ['nuts'],
    availability: 'available'
  },
  {
    id: 'food_chicken_soup',
    name: 'Hot Chicken Noodle Soup',
    category: 'Poultry / Soup',
    mealTypes: ['dinner'],
    calories: 180,
    protein: 20,
    carbs: 12,
    fat: 5,
    healthScore: 8.0,
    vegetarian: false,
    vegan: false,
    eggetarian: false,
    allergens: ['gluten'],
    tags: ['warm', 'high-protein'],
    contextTags: { weather: ['cold', 'winter'] },
    seasonalTags: ['winter'],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_creamy_ice_cream',
    name: 'Chilled Dairy Vanilla Ice Cream',
    category: 'Dessert / Dairy',
    mealTypes: ['evening_snack', 'dinner'],
    calories: 250,
    protein: 4,
    carbs: 28,
    fat: 14,
    healthScore: 4.5,
    vegetarian: true,
    vegan: false,
    eggetarian: true,
    allergens: ['dairy'],
    tags: ['cooling', 'sweet'],
    contextTags: { weather: ['hot', 'summer'] },
    seasonalTags: ['summer'],
    fastingTags: [],
    availability: 'available'
  },
  {
    id: 'food_unknown_availability',
    name: 'Steamed Edamame Bowl',
    category: 'Snack / Protein',
    mealTypes: ['evening_snack', 'lunch'],
    calories: 120,
    protein: 11,
    carbs: 9,
    fat: 5,
    fiber: 5,
    healthScore: 8.5,
    vegetarian: true,
    vegan: true,
    eggetarian: true,
    allergens: ['soy'],
    tags: ['high-protein'],
    contextTags: { weather: ['mild'] },
    seasonalTags: [],
    fastingTags: [],
    availability: 'unknown'
  }
];

const STANDARD_USER = {
  id: 'user_test_std',
  dietType: 'vegetarian',
  allergies: [],
  activeFoodRestrictions: []
};

// ── TEST 1: Hot Weather ───────────────────────────────────────
runTest('Test 1 — Hot weather boosts cooling/hydrating foods', () => {
  const hotContext = buildContextProfile({
    weather: { temperature: 36, condition: 'Sunny' }
  });
  assert.strictEqual(hotContext.weather.category, 'hot');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, hotContext, 10);
  const saladItem = recResult.foods.find(f => f.id === 'food_chilled_salad');
  const soupItem = recResult.foods.find(f => f.id === 'food_hot_lentil_soup');

  assert(saladItem, 'Chilled salad must be in recommendations');
  assert(saladItem.recommendationScore > soupItem.recommendationScore,
    `Salad score (${saladItem.recommendationScore}) should exceed soup score (${soupItem.recommendationScore}) in hot weather`);
  assert(saladItem.contextualReasons.some(r => r.includes('hot weather') || r.includes('refreshing')),
    'Salad must list hot weather reason');
});

// ── TEST 2: Cold Weather ──────────────────────────────────────
runTest('Test 2 — Cold weather prefers warming soup foods', () => {
  const coldContext = buildContextProfile({
    weather: { temperature: 8, condition: 'Chilly' }
  });
  assert.strictEqual(coldContext.weather.category, 'cold');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, coldContext, 10);
  const saladItem = recResult.foods.find(f => f.id === 'food_chilled_salad');
  const soupItem = recResult.foods.find(f => f.id === 'food_hot_lentil_soup');

  assert(soupItem, 'Lentil soup must be in recommendations');
  assert(soupItem.recommendationScore > saladItem.recommendationScore,
    `Soup score (${soupItem.recommendationScore}) should exceed salad score (${saladItem.recommendationScore}) in cold weather`);
  assert(soupItem.contextualReasons.some(r => r.includes('cold weather') || r.includes('warm and nourishing')),
    'Soup must list cold weather reason');
});

// ── TEST 3: Breakfast ─────────────────────────────────────────
runTest('Test 3 — Breakfast context prioritizes breakfast-compatible foods', () => {
  const bfastContext = buildContextProfile({
    mealPeriod: 'breakfast',
    weather: { temperature: 22 }
  });
  assert.strictEqual(bfastContext.mealPeriod, 'breakfast');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, bfastContext, 10);
  const oats = recResult.foods.find(f => f.id === 'food_oats_breakfast');
  const biryani = recResult.foods.find(f => f.id === 'food_dinner_biryani');

  assert(oats, 'Breakfast oats must be recommended');
  assert(oats.recommendationScore > biryani.recommendationScore,
    `Oats score (${oats.recommendationScore}) should exceed dinner biryani (${biryani.recommendationScore}) at breakfast`);
  assert(oats.contextualReasons.some(r => r.includes('breakfast')),
    'Oats must list breakfast suitability reason');
});

// ── TEST 4: Dinner ────────────────────────────────────────────
runTest('Test 4 — Dinner context prioritizes dinner meals', () => {
  const dinnerContext = buildContextProfile({
    mealPeriod: 'dinner',
    weather: { temperature: 22 }
  });
  assert.strictEqual(dinnerContext.mealPeriod, 'dinner');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, dinnerContext, 10);
  const biryani = recResult.foods.find(f => f.id === 'food_dinner_biryani');
  assert(biryani, 'Dinner biryani must be recommended');
  assert(biryani.contextualReasons.some(r => r.includes('dinner')),
    'Biryani must list dinner suitability reason');
});

// ── TEST 5: Active Fasting ────────────────────────────────────
runTest('Test 5 — Active fasting excludes restricted foods', () => {
  const fastingContext = buildContextProfile({
    fasting: {
      active: true,
      type: 'navratri' // Navratri restricts grains, meat, onion/garlic
    }
  });
  assert.strictEqual(fastingContext.fasting.active, true);

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, fastingContext, 10);
  const returnedIds = recResult.foods.map(f => f.id);

  assert(!returnedIds.includes('food_wheat_roti'), 'Wheat roti must be EXCLUDED during Navratri fasting');
  assert(!returnedIds.includes('food_hot_lentil_soup'), 'Grains/pulses restricted in vrat should not pass');
  assert(returnedIds.includes('food_sabudana_khichdi'), 'Sabudana khichdi (vrat friendly) must be allowed');
  assert(returnedIds.includes('food_chilled_salad'), 'Fruit salad must be allowed');
});

// ── TEST 6: No Fasting ────────────────────────────────────────
runTest('Test 6 — No fasting allows standard grains and meals', () => {
  const noFastingContext = buildContextProfile({
    fasting: { active: false }
  });
  assert.strictEqual(noFastingContext.fasting.active, false);

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, noFastingContext, 10);
  const returnedIds = recResult.foods.map(f => f.id);

  assert(returnedIds.includes('food_wheat_roti'), 'Wheat roti must NOT be excluded when fasting is inactive');
  assert(returnedIds.includes('food_hot_lentil_soup'), 'Lentil soup must be permitted when fasting is inactive');
});

// ── TEST 7: Medical + Weather Safety ──────────────────────────
runTest('Test 7 — Hot weather contextual score NEVER overrides confirmed medical restriction', () => {
  const diabeticUser = {
    id: 'user_diabetic',
    dietType: 'vegetarian',
    allergies: [],
    activeFoodRestrictions: ['refined-sugar'] // Confirmed medical restriction
  };

  // Weather is very hot, which normally boosts chilled sweet mango shake
  const hotContext = buildContextProfile({
    weather: { temperature: 38, condition: 'Sunny' }
  });

  const recResult = recommendFoods(MOCK_FOODS, diabeticUser, hotContext, 10);
  const returnedIds = recResult.foods.map(f => f.id);

  assert(!returnedIds.includes('food_sugary_cold_beverage'),
    'CRITICAL: Sugary cold beverage must be EXCLUDED despite maximum hot weather score!');
});

// ── TEST 8: Allergy + Weather Safety ──────────────────────────
runTest('Test 8 — Hot weather contextual score NEVER overrides peanut allergy', () => {
  const allergicUser = {
    id: 'user_allergic',
    dietType: 'vegetarian',
    allergies: ['peanuts'],
    activeFoodRestrictions: []
  };

  const hotContext = buildContextProfile({
    weather: { temperature: 36, condition: 'Sunny' }
  });

  const recResult = recommendFoods(MOCK_FOODS, allergicUser, hotContext, 10);
  const returnedIds = recResult.foods.map(f => f.id);

  assert(!returnedIds.includes('food_peanut_chaat'),
    'CRITICAL: Peanut chaat must be EXCLUDED despite maximum hot weather score!');
});

// ── TEST 9: Vegan + Contextual Score ──────────────────────────
runTest('Test 9 — Hot weather contextual score NEVER overrides vegan diet restriction', () => {
  const veganUser = {
    id: 'user_vegan',
    dietType: 'vegan',
    allergies: [],
    activeFoodRestrictions: []
  };

  const hotContext = buildContextProfile({
    weather: { temperature: 35, condition: 'Sunny' }
  });

  const recResult = recommendFoods(MOCK_FOODS, veganUser, hotContext, 10);
  const returnedIds = recResult.foods.map(f => f.id);

  assert(!returnedIds.includes('food_creamy_ice_cream'),
    'CRITICAL: Dairy ice cream must be EXCLUDED for vegan user despite hot weather score!');
});

// ── TEST 10: Unknown Weather ──────────────────────────────────
runTest('Test 10 — Unknown weather handles gracefully without failure', () => {
  const unknownWeatherContext = buildContextProfile({
    weather: null
  });
  assert.strictEqual(unknownWeatherContext.weather.temperature, null);
  assert.strictEqual(unknownWeatherContext.weather.category, null);

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, unknownWeatherContext, 10);
  assert(recResult.foods.length > 0, 'Recommendations must succeed when weather is unknown');
  assert(recResult.contextProfile, 'Result must contain contextProfile');
});

// ── TEST 11: Unknown Season ───────────────────────────────────
runTest('Test 11 — Unknown season defaults or falls back gracefully', () => {
  const noSeasonContext = buildContextProfile({
    currentTime: 'invalid-date-string',
    season: null
  });
  assert(noSeasonContext.season.name, 'Season name must have safe fallback');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, noSeasonContext, 10);
  assert(recResult.foods.length > 0, 'Recommendations must succeed when season is missing/invalid');
});

// ── TEST 12: Missing Meal Type ────────────────────────────────
runTest('Test 12 — Missing explicit meal type uses deterministic time detection', () => {
  // 08:30 UTC
  const morningContext = buildContextProfile({
    currentTime: '2026-10-01T08:30:00.000Z',
    mealPeriod: null
  });
  assert(morningContext.mealPeriod, 'Meal period must be automatically detected');

  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, morningContext, 10);
  assert(recResult.foods.length > 0, 'Recommendations must succeed with auto-detected meal period');
});

// ── TEST 13: Missing Availability ─────────────────────────────
runTest('Test 13 — Unknown availability is NOT treated as unavailable', () => {
  const ctx = buildContextProfile({});
  const recResult = recommendFoods(MOCK_FOODS, STANDARD_USER, ctx, 10);
  const edamame = recResult.foods.find(f => f.id === 'food_unknown_availability');

  assert(edamame, 'Food with unknown availability must NOT be excluded');
  assert.strictEqual(edamame.availability, 'unknown', 'Availability must remain unknown without fabrication');
});

// ── TEST 14: Diversity and Repetition Penalty ─────────────────
runTest('Test 14 — Recently recommended foods receive deterministic repetition penalty', () => {
  const freshContext = buildContextProfile({
    recentRecommendations: []
  });
  const repeatedContext = buildContextProfile({
    recentRecommendations: ['food_chilled_salad'] // Recommended immediately before
  });

  const freshResult = recommendFoods(MOCK_FOODS, STANDARD_USER, freshContext, 10);
  const repeatResult = recommendFoods(MOCK_FOODS, STANDARD_USER, repeatedContext, 10);

  const freshSalad = freshResult.foods.find(f => f.id === 'food_chilled_salad');
  const repeatedSalad = repeatResult.foods.find(f => f.id === 'food_chilled_salad');

  assert(freshSalad && repeatedSalad, 'Both results must contain salad');
  assert(repeatedSalad.recommendationScore < freshSalad.recommendationScore,
    `Repeated salad score (${repeatedSalad.recommendationScore}) must be strictly less than fresh score (${freshSalad.recommendationScore})`);
  assert.strictEqual(freshSalad.recommendationScore - repeatedSalad.recommendationScore, 25,
    'Top-3 recent repetition penalty should equal exactly 25 points');
});

// ── TEST 15: Cross-Engine Consistency ─────────────────────────
runTest('Test 15 — Cross-engine safety consistency (Catalog vs AI engine)', () => {
  const userDoc = {
    id: 'user_cross_engine',
    preferences: {
      dietType: 'Vegan',
      allergies: ['peanuts'],
      fasting: { active: true, type: 'navratri' }
    },
    healthProfile: {
      foodProfile: {
        foodsToLimit: ['refined-sugar']
      }
    }
  };

  const unifiedProfile = buildUserFoodProfile(userDoc);
  const contextProfile = buildContextProfile({
    weather: { temperature: 35 },
    fasting: unifiedProfile.fasting,
    userProfile: unifiedProfile
  });

  // Evaluate candidate foods in Catalog Engine
  const catalogResult = recommendFoods(MOCK_FOODS, unifiedProfile, contextProfile, 20);
  const catalogSafeIds = catalogResult.foods.map(f => f.id);

  // Evaluate candidate foods in AI Engine
  const aiResults = MOCK_FOODS.map(food => {
    return {
      food,
      eval: scoreFoodWithPriority(
        food,
        { ...userDoc.preferences, _userFoodProfile: unifiedProfile },
        {},
        [],
        null,
        null,
        contextProfile
      )
    };
  });
  const aiSafeIds = aiResults.filter(r => r.eval.safe).map(r => r.food.id);

  // Cross-engine verification:
  // 1. Neither engine allows non-vegan (chicken, ice cream)
  assert(!catalogSafeIds.includes('food_chicken_soup'), 'Catalog must exclude chicken');
  assert(!aiSafeIds.includes('food_chicken_soup'), 'AI must exclude chicken');
  assert(!catalogSafeIds.includes('food_creamy_ice_cream'), 'Catalog must exclude ice cream');
  assert(!aiSafeIds.includes('food_creamy_ice_cream'), 'AI must exclude ice cream');

  // 2. Neither engine allows peanut allergen
  assert(!catalogSafeIds.includes('food_peanut_chaat'), 'Catalog must exclude peanut chaat');
  assert(!aiSafeIds.includes('food_peanut_chaat'), 'AI must exclude peanut chaat');

  // 3. Neither engine allows confirmed medical limit (refined-sugar)
  assert(!catalogSafeIds.includes('food_sugary_cold_beverage'), 'Catalog must exclude sugary cold beverage');
  assert(!aiSafeIds.includes('food_sugary_cold_beverage'), 'AI must exclude sugary cold beverage');

  // 4. Neither engine allows grain during navratri fasting (wheat roti)
  assert(!catalogSafeIds.includes('food_wheat_roti'), 'Catalog must exclude wheat roti during fasting');
  assert(!aiSafeIds.includes('food_wheat_roti'), 'AI must exclude wheat roti during fasting');

  // 5. Permitted items are considered safe by both engines
  assert(catalogSafeIds.includes('food_chilled_salad'), 'Catalog must allow fruit salad');
  assert(aiSafeIds.includes('food_chilled_salad'), 'AI must allow fruit salad');
});

console.log('\n======================================================');
console.log(`Phase 4 Context Integration Summary: ${passed} passed, ${failed} failed.`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
