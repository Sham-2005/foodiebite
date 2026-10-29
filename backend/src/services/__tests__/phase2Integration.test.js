// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/phase2Integration.test.js
//  Phase 2 — Unified User Food Profile & AI Integration Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

const assert = require('assert');
const { buildUserFoodProfile } = require('../profileBuilder');
const { hardExclude, rankAndScore, recommendFoods: catalogRecommendFoods } = require('../recommendationEngine');
const { scoreFoodWithPriority, recommendFoods: aiRecommendFoods } = require('../../ai/recommendationEngine');
const { buildMedicalContextSummary } = require('../../ai/medicalReportContext');
const { FALLBACK_FOODS } = require('../foodiebiteFallbackFoods');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('--- Phase 2: Unified Profile & AI Integration Suite ---');
console.log('======================================================\n');

// ── GROUP 1: Profile Builder & Calculations ──────────────────
console.log('[1. PROFILE BUILDER & COMPUTED TARGETS]');

runTest('Computes correct BMI, BMR, TDEE, and Protein target for active male', () => {
  const rawUser = {
    id: 'user_101',
    name: 'Alex Rivera',
    age: 28,
    gender: 'male',
    weight: 75,
    height: 180,
    activityLevel: 'moderately_active',
    preferences: {
      dietType: 'Non Vegetarian',
      healthGoals: ['muscle_gain'],
      cuisines: ['italian', 'mexican'],
      allergies: ['peanuts'],
      minProtein: 25,
      maxCalories: 600
    }
  };

  const profile = buildUserFoodProfile(rawUser);

  // BMI: 75 / (1.8^2) = 23.1
  assert.strictEqual(profile.bmi, 23.1, 'BMI should be 23.1');
  // BMR: 10*75 + 6.25*180 - 5*28 + 5 = 750 + 1125 - 140 + 5 = 1740
  assert.strictEqual(profile.bmr, 1740, 'BMR should be 1740');
  // TDEE: 1740 * 1.55 = 2697
  assert.strictEqual(profile.dailyCalorieTarget, 2697, 'Daily calories should be 2697');
  // Protein: 75 * 1.6 = 120g
  assert.strictEqual(profile.dailyProteinTarget, 120, 'Daily protein should be 120g');
  assert.strictEqual(profile.dietType, 'non-vegetarian', 'Diet type normalized');
  assert.strictEqual(profile.maxCaloriesOverride, 600, 'Max calories override preserved');
  assert.strictEqual(profile.minProteinOverride, 25, 'Min protein override preserved');
});

runTest('Splits medical healthProfile into confirmed vs informational restrictions', () => {
  const userWithMedical = {
    id: 'user_med',
    healthProfile: {
      foodProfile: {
        foodsToLimit: ['Grapefruit', 'Sodium'],
        unverifiedFoodRestrictions: ['Nightshades', 'Gluten'],
        foodsToPrefer: ['Spinach', 'Berries']
      },
      wellnessConcerns: [
        { concern: 'Elevated LDL Cholesterol', severity: 'MODERATE', confidence: 'HIGH' },
        { concern: 'Possible Mild Vitamin D Deficiency', severity: 'LOW', confidence: 'MEDIUM' }
      ]
    }
  };

  const profile = buildUserFoodProfile(userWithMedical);
  assert.deepStrictEqual(profile.activeFoodRestrictions, ['grapefruit', 'sodium']);
  assert.deepStrictEqual(profile.informationalRestrictions, ['nightshades', 'gluten']);
  assert.deepStrictEqual(profile.foodsToPrefer, ['Spinach', 'Berries']);
  assert.strictEqual(profile.wellnessSummary.length, 1, 'Only HIGH confidence concerns in wellnessSummary');
  assert.ok(profile.wellnessSummary[0].includes('Elevated LDL Cholesterol'));
});

// ── GROUP 2: Medical Summary Abstraction ─────────────────────
console.log('\n[2. MEDICAL SUMMARY ABSTRACTION INTERFACE]');

runTest('buildMedicalContextSummary creates safe string without sensitive diagnostic leaks', () => {
  const profile = buildUserFoodProfile({
    age: 35,
    gender: 'female',
    weight: 62,
    height: 165,
    activityLevel: 'lightly_active',
    healthProfile: {
      foodProfile: {
        foodsToLimit: ['Salt', 'Processed Sugar'],
        foodsToPrefer: ['Oats', 'Walnuts']
      },
      wellnessConcerns: [
        { concern: 'Pre-hypertension', severity: 'MILD', confidence: 'HIGH' }
      ]
    }
  });

  const summary = buildMedicalContextSummary(profile);
  assert.ok(typeof summary === 'string', 'Summary is string');
  assert.ok(summary.includes('BMI: 22.8'), 'Summary includes computed BMI');
  assert.ok(summary.includes('Foods to avoid (medical): salt, processed sugar'), 'Summary includes foods to avoid');
  assert.ok(summary.includes('Foods to prefer (medical): Oats, Walnuts'), 'Summary includes preferred foods');
  assert.ok(summary.includes('Pre-hypertension'), 'Summary includes confirmed wellness note');
});

// ── GROUP 3: Catalog Recommendation Engine (Pass 1 & Pass 2) ──
console.log('\n[3. CATALOG RECOMMENDATIONS INTEGRATION]');

runTest('Pass 1 hard excludes confirmed medical restrictions and allergies', () => {
  const profile = buildUserFoodProfile({
    preferences: {
      dietType: 'Vegetarian',
      allergies: ['peanuts']
    },
    healthProfile: {
      foodProfile: {
        foodsToLimit: ['high-sodium'],
      }
    }
  });

  const testFoods = [
    { id: 'f1', name: 'Peanut Butter Salad', allergens: ['peanuts'], conditionTags: { avoid: [] } },
    { id: 'f2', name: 'High Salt Chips', allergens: [], conditionTags: { avoid: ['high-sodium'] } },
    { id: 'f3', name: 'Steamed Edamame Bowl', allergens: ['soy'], conditionTags: { avoid: [], prefer: ['high-protein'] }, healthScore: 8.5 },
  ];

  const safe = hardExclude(testFoods, profile);
  assert.strictEqual(safe.length, 1, 'Only non-conflicting food passes');
  assert.strictEqual(safe[0].id, 'f3');
});

runTest('Pass 2 boosts preferred cuisines and protein target override', () => {
  const profile = buildUserFoodProfile({
    preferences: {
      dietType: 'Vegetarian',
      cuisines: ['Indian'],
      minProtein: 15
    }
  });

  const testFoods = [
    { id: 'f1', name: 'Indian Dal Makhani', cuisine: 'Indian', protein: 18, healthScore: 7.0 },
    { id: 'f2', name: 'Generic Salad', cuisine: 'Continental', protein: 4, healthScore: 7.0 },
  ];

  const scored = rankAndScore(testFoods, profile);
  assert.ok(scored[0].id === 'f1', 'Indian food with high protein ranks first');
  assert.ok(scored[0].recommendationScore > scored[1].recommendationScore, 'Indian food has higher score');
});

// ── GROUP 4: AI Priority Recommendation Engine ──────────────
console.log('\n[4. AI PRIORITY RECOMMENDATION ENGINE INTEGRATION]');

runTest('scoreFoodWithPriority strictly blocks confirmed medical restrictions', () => {
  const userFoodProfile = buildUserFoodProfile({
    healthProfile: {
      foodProfile: {
        foodsToLimit: ['grapefruit']
      }
    }
  });

  const foodWithGrapefruit = {
    id: 'gf_salad',
    name: 'Fresh Grapefruit Citrus Salad',
    mealTypes: ['breakfast', 'snack'],
    calories: 120,
    protein: 2,
    cuisine: 'Mediterranean'
  };

  const evalResult = scoreFoodWithPriority(foodWithGrapefruit, { _userFoodProfile: userFoodProfile });
  assert.strictEqual(evalResult.safe, false, 'Grapefruit must be marked unsafe');
  assert.strictEqual(evalResult.score, -1000, 'Hard exclusion score is -1000');
});

runTest('scoreFoodWithPriority respects minProtein and maxCalories from profile', () => {
  const userFoodProfile = buildUserFoodProfile({
    preferences: {
      minProtein: 20,
      maxCalories: 300
    }
  });

  const highCalFood = {
    id: 'heavy_meal',
    name: 'Double Cheese Pasta',
    mealTypes: ['dinner'],
    calories: 650,
    protein: 22,
    cuisine: 'Italian'
  };

  const highProtLightFood = {
    id: 'light_chicken',
    name: 'Grilled Herb Chicken Salad',
    mealTypes: ['lunch'],
    calories: 260,
    protein: 28,
    cuisine: 'American'
  };

  const evalHeavy = scoreFoodWithPriority(highCalFood, { _userFoodProfile: userFoodProfile });
  assert.strictEqual(evalHeavy.score, -300, 'Exceeds calorie limit penalty');

  const evalLight = scoreFoodWithPriority(highProtLightFood, { _userFoodProfile: userFoodProfile });
  assert.ok(evalLight.score > 0, 'Light high protein food receives positive score');
  assert.ok(evalLight.reasons.some(r => r.includes('meets protein target')), 'Includes meets protein target rationale');
});

runTest('scoreFoodWithPriority boosts preferred cuisines from profile', () => {
  const userFoodProfile = buildUserFoodProfile({
    preferences: {
      cuisines: ['Mexican']
    }
  });

  const mexicanFood = {
    id: 'bean_taco',
    name: 'Black Bean Street Taco',
    mealTypes: ['lunch'],
    calories: 220,
    protein: 8,
    cuisine: 'Mexican'
  };

  const evalMexican = scoreFoodWithPriority(mexicanFood, { _userFoodProfile: userFoodProfile });
  assert.ok(evalMexican.reasons.some(r => r.includes('preferred Mexican cuisine')), 'Boosts preferred cuisine');
});

// ── SUMMARY REPORT ───────────────────────────────────────────
console.log('\n======================================================');
console.log(`Phase 2 Integration Summary: ${passedTests}/${totalTests} passed.`);
if (passedTests === totalTests) {
  console.log('All Phase 2 Integration Tests PASSED flawlessly!');
} else {
  console.error(`FAILURES DETECTED: ${totalTests - passedTests} test(s) failed.`);
  process.exit(1);
}
console.log('======================================================\n');
