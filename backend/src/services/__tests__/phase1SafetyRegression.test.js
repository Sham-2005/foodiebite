/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/phase1SafetyRegression.test.js
 *  Phase 1 Safety Regression Test Suite
 *  Verifies:
 *    - Persona 1: Vegan (no meat, fish, seafood, eggs, dairy)
 *    - Persona 2: Vegetarian (no meat, fish, seafood)
 *    - Persona 3: Eggetarian (no meat, fish, seafood; eggs allowed)
 *    - Persona 4: Allergy (peanut allergy strictly excludes peanuts)
 *    - Persona 5: Muscle Gain (high-protein foods not hidden / well ranked)
 *    - Persona 6: Normal User (non-vegetarian recommendations work)
 *    - Fallback Resilience & Medical Engine Integrity
 * ─────────────────────────────────────────────────────────────
 */

const assert = require('assert');
const { recommendFoods, hardExclude } = require('../recommendationEngine');
const { isDietCompatible, MEAT_FISH_KEYWORDS, EGG_KEYWORDS } = require('../dietarySafetyService');
const { FALLBACK_FOODS } = require('../foodiebiteFallbackFoods');
const { getStaticFallbackList, applyHealthProfileRanking } = require('../../controllers/foodController');
const { getAllFoods } = require('../../ai/foodKnowledge');
const { scoreFoodWithPriority, recommendFoods: recommendAiFoods } = require('../../ai/recommendationEngine');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('--- Phase 1: Dietary Safety & Regression Test Suite ---');
console.log('======================================================\n');

// ─────────────────────────────────────────────────────────────
// PERSONA 1 — Vegan
// ─────────────────────────────────────────────────────────────
console.log('[PERSONA 1 — Vegan]');
runTest('Vegan excludes all meat, fish, seafood, eggs, and dairy in catalog engine', () => {
  const userProfile = {
    preferences: { dietType: 'Vegan', healthGoals: [] },
    allergies: []
  };

  const result = recommendFoods(FALLBACK_FOODS, userProfile, {}, 50);
  assert(result.foods.length > 0, 'Should return vegan foods');

  for (const food of result.foods) {
    const nameLower = food.name.toLowerCase();
    
    // Check no meat or fish
    const hasMeat = MEAT_FISH_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasMeat, `Vegan received meat/fish food: ${food.name}`);

    // Check no eggs
    const hasEgg = EGG_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasEgg, `Vegan received egg food: ${food.name}`);

    // Check no dairy
    const dairyKeywords = ['milk', 'cheese', 'butter', 'ghee', 'paneer', 'yogurt', 'curd', 'cream'];
    const hasDairy = dairyKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasDairy, `Vegan received dairy food: ${food.name}`);

    // Specifically verify salmon is excluded
    assert(!nameLower.includes('salmon'), `Vegan received salmon: ${food.name}`);
    assert(!nameLower.includes('sardine'), `Vegan received sardine: ${food.name}`);
  }
});

runTest('Vegan excludes meat, fish, eggs, dairy in AI priority engine', () => {
  const veganRecs = recommendAiFoods({
    userContext: { id: 'test_vegan', diet: 'vegan', allergies: [] },
    requestConstraints: { dietType: 'vegan' },
    limit: 10
  });

  assert(veganRecs.recommendedFoods.length > 0, 'Should return recommended foods for vegan');
  for (const food of veganRecs.recommendedFoods) {
    const nameLower = food.name.toLowerCase();
    const hasMeat = MEAT_FISH_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasMeat, `AI engine recommended meat/fish to vegan: ${food.name}`);
    const hasEgg = EGG_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasEgg, `AI engine recommended egg to vegan: ${food.name}`);
  }
});

// ─────────────────────────────────────────────────────────────
// PERSONA 2 — Vegetarian
// ─────────────────────────────────────────────────────────────
console.log('\n[PERSONA 2 — Vegetarian]');
runTest('Vegetarian excludes all meat, fish, and seafood', () => {
  const userProfile = {
    preferences: { dietType: 'Vegetarian', healthGoals: [] },
    allergies: []
  };

  const result = recommendFoods(FALLBACK_FOODS, userProfile, {}, 50);
  assert(result.foods.length > 0, 'Should return vegetarian foods');

  for (const food of result.foods) {
    const nameLower = food.name.toLowerCase();
    const hasMeat = MEAT_FISH_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasMeat, `Vegetarian received meat/fish food: ${food.name}`);
    assert(!nameLower.includes('salmon'), `Vegetarian received salmon: ${food.name}`);
    assert(!nameLower.includes('chicken'), `Vegetarian received chicken: ${food.name}`);
  }
});

runTest('Vegetarian in AI engine strictly excludes chicken, fish, mutton', () => {
  const vegRecs = recommendAiFoods({
    userContext: { id: 'test_veg', diet: 'vegetarian', allergies: [] },
    requestConstraints: { dietType: 'vegetarian' },
    limit: 10
  });

  assert(vegRecs.recommendedFoods.length > 0, 'Should return vegetarian recs');
  for (const food of vegRecs.recommendedFoods) {
    const nameLower = food.name.toLowerCase();
    const hasMeat = MEAT_FISH_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasMeat, `AI engine gave meat to vegetarian: ${food.name}`);
  }
});

// ─────────────────────────────────────────────────────────────
// PERSONA 3 — Eggetarian
// ─────────────────────────────────────────────────────────────
console.log('\n[PERSONA 3 — Eggetarian]');
runTest('Eggetarian excludes meat and fish, but allows eggs', () => {
  const userProfile = {
    preferences: { dietType: 'Eggetarian', healthGoals: [] },
    allergies: []
  };

  // Test with full pool including egg and meat items
  const allAiFoods = getAllFoods();
  const safeFoods = hardExclude(allAiFoods, userProfile);

  // Check no meat or fish in safeFoods
  for (const food of safeFoods) {
    const nameLower = food.name.toLowerCase();
    const hasMeat = MEAT_FISH_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower));
    assert(!hasMeat, `Eggetarian received meat/fish food: ${food.name}`);
  }

  // Verify egg dishes ARE allowed
  const eggFood = safeFoods.find(f => f.id === 'boiled_egg' || f.id === 'omelette');
  assert(eggFood, 'Eggetarian should allow boiled eggs / omelettes');
  assert(isDietCompatible(eggFood, 'Eggetarian'), 'isDietCompatible should return true for boiled_egg on Eggetarian diet');

  // Verify salmon is NOT allowed
  const salmonFood = allAiFoods.find(f => f.id === 'grilled_salmon');
  if (salmonFood) {
    assert(!isDietCompatible(salmonFood, 'Eggetarian'), 'Salmon must NOT be compatible with Eggetarian');
  }
});

// ─────────────────────────────────────────────────────────────
// PERSONA 4 — Allergy (Nut / Peanut)
// ─────────────────────────────────────────────────────────────
console.log('\n[PERSONA 4 — Allergy]');
runTest('Peanut/nut allergy strictly excludes all nut products', () => {
  const userProfile = {
    preferences: { dietType: 'Vegetarian', healthGoals: [] },
    allergies: ['peanuts', 'nuts']
  };

  const result = recommendFoods(FALLBACK_FOODS, userProfile, {}, 40);
  assert(result.foods.length > 0, 'Should return allergy-safe foods');

  for (const food of result.foods) {
    const allergens = (food.allergens || []).map(a => a.toLowerCase());
    assert(!allergens.includes('peanuts'), `Food ${food.name} contains peanut allergen`);
    assert(!allergens.includes('nuts'), `Food ${food.name} contains nut allergen`);
  }
});

// ─────────────────────────────────────────────────────────────
// PERSONA 5 — Muscle Gain (High Protein Not Excluded)
// ─────────────────────────────────────────────────────────────
console.log('\n[PERSONA 5 — Muscle Gain]');
runTest('Muscle gain persona receives high-protein foods without arbitrary exclusion', () => {
  const userProfile = {
    preferences: { dietType: 'Vegetarian', healthGoals: ['muscle_gain'] },
    healthGoals: ['muscle_gain'],
    allergies: []
  };

  const result = recommendFoods(FALLBACK_FOODS, userProfile, {}, 30);
  assert(result.foods.length > 0, 'Should return foods for muscle gain');

  // Verify high protein foods (protein >= 10g) exist in the returned list
  const highProteinFoods = result.foods.filter(f => f.protein >= 10);
  assert(highProteinFoods.length > 0, 'High-protein foods must NOT be removed from muscle gain recommendations');
});

// ─────────────────────────────────────────────────────────────
// PERSONA 6 — Normal User (Non-Vegetarian)
// ─────────────────────────────────────────────────────────────
console.log('\n[PERSONA 6 — Normal User]');
runTest('Non-vegetarian user receives recommendations normally without restriction', () => {
  const userProfile = {
    preferences: { dietType: 'Non-Vegetarian', healthGoals: [] },
    allergies: []
  };

  const result = recommendFoods(FALLBACK_FOODS, userProfile, {}, 30);
  assert(result.foods.length > 0, 'Should return recommendations for normal user');
  assert(result.foods.length === 30, 'Should return full count requested');
});

// ─────────────────────────────────────────────────────────────
// FALLBACK & RUNTIME ERROR CHECKS (Task 3)
// ─────────────────────────────────────────────────────────────
console.log('\n[FALLBACK RESILIENCE & RUNTIME CHECKS]');
runTest('getStaticFallbackList returns valid array without throwing', () => {
  const fallbackList = getStaticFallbackList({ dietType: 'Vegetarian' }, 20);
  assert(Array.isArray(fallbackList), 'Fallback list must be an array');
  assert(fallbackList.length > 0, 'Fallback list should contain items');
  assert(fallbackList[0].id && fallbackList[0].name, 'Fallback item must have id and name');
});

runTest('applyHealthProfileRanking executes safely with and without healthProfile', () => {
  const baseList = getStaticFallbackList({ dietType: 'Vegetarian' }, 10);
  const withoutProfile = applyHealthProfileRanking(baseList, null);
  assert(Array.isArray(withoutProfile), 'Should return array when healthProfile is null');
  assert.strictEqual(withoutProfile.length, 10, 'Should preserve item count');

  const withProfile = applyHealthProfileRanking(baseList, {
    foodProfile: { foodsToPrefer: ['high-protein'], foodsToLimit: [] }
  });
  assert(Array.isArray(withProfile), 'Should return array when healthProfile is provided');
  assert.strictEqual(withProfile.length, 10, 'Should preserve item count with healthProfile');
});

// ─────────────────────────────────────────────────────────────
// MEDICAL ENGINE INTEGRITY (Task 8)
// ─────────────────────────────────────────────────────────────
console.log('\n[MEDICAL ENGINE INTEGRITY]');
runTest('Confirmed restrictions exclude foods while unverified do not', () => {
  const profileWithConfirmed = {
    dietType: 'Vegetarian',
    activeFoodRestrictions: ['sodium'],
    healthProfile: {
      foodProfile: { foodsToLimit: ['sodium'] },
      unverifiedFoodRestrictions: [{ reason: 'unverified low-confidence test' }]
    }
  };

  const result = recommendFoods(FALLBACK_FOODS, profileWithConfirmed, {}, 30);
  for (const food of result.foods) {
    const avoid = (food.conditionTags?.avoid || []).map(t => t.toLowerCase());
    assert(!avoid.includes('sodium'), `Food with avoided sodium surfaced: ${food.name}`);
  }

  assert(result.unverifiedFoodRestrictions.length > 0, 'Unverified food restrictions must be preserved in payload');
});

console.log('\n======================================================');
console.log(`Phase 1 Safety Regression Summary: ${passedTests} passed, ${failedTests} failed.`);
console.log('======================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
