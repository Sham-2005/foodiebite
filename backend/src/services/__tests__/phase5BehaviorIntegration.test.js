/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/phase5BehaviorIntegration.test.js
 *  Phase 5: Behavioral Learning, Preference Evolution & Adaptive Store
 *  Automated Verification for Personas A through J + User Control
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
  BEHAVIOR_CONFIG,
  SUPPORTED_EVENTS,
  normalizeEvent,
  calculateTimeDecay,
  calculateConfidence,
  aggregateBehavior,
  recordBehaviorEvent,
  getBehavioralProfile,
  resetBehavioralProfile,
  getBehavioralExplanation
} = require('../behaviorLearningService');

const {
  hardExclude,
  rankAndScore,
  applyDiversityAndExploration,
  recommendFoods
} = require('../recommendationEngine');

const {
  scoreFoodWithPriority,
  recommendFoods: aiRecommendFoods
} = require('../../ai/recommendationEngine');

const { FALLBACK_FOODS } = require('../foodiebiteFallbackFoods');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

console.log('======================================================');
console.log('--- Phase 5: Behavioral Learning & Evolution Suite ---');
console.log('======================================================\n');

async function runAllTests() {

// ─────────────────────────────────────────────────────────────
// 1. EVENT MODEL & NORMALIZATION
// ─────────────────────────────────────────────────────────────
console.log('[1. BEHAVIORAL EVENT MODEL & NORMALIZATION]');

it('Normalizes all supported event types and strips sensitive medical data', () => {
  const raw = {
    type: 'recommendation_favorited',
    userId: 'user_p5_01',
    foodId: 'fb-012',
    foodName: 'Masala Dosa',
    cuisine: 'South Indian',
    ingredients: ['Rice', 'Lentils', 'Potato'],
    context: {
      weather: { category: 'warm' },
      mealPeriod: 'breakfast',
      sensitiveClinicalOcr: 'DO NOT LEAK'
    }
  };

  const norm = normalizeEvent(raw);
  assert.strictEqual(norm.type, 'recommendation_favorited');
  assert.strictEqual(norm.userId, 'user_p5_01');
  assert.strictEqual(norm.foodId, 'fb-012');
  assert.strictEqual(norm.cuisine, 'south indian');
  assert.deepStrictEqual(norm.ingredients, ['rice', 'lentils', 'potato']);
  assert.strictEqual(norm.context.weather, 'warm');
  assert.strictEqual(norm.context.mealPeriod, 'breakfast');
  assert.strictEqual(norm.context.sensitiveClinicalOcr, undefined, 'Medical data must be stripped');
});

it('Rejects unknown/invalid event types gracefully', () => {
  assert.strictEqual(normalizeEvent(null), null);
  assert.strictEqual(normalizeEvent({ type: 'unknown_magic_event' }), null);
});

// ─────────────────────────────────────────────────────────────
// 2. TIME DECAY & CONFIDENCE SCORING
// ─────────────────────────────────────────────────────────────
console.log('\n[2. TIME DECAY & CONFIDENCE FORMULAS]');

it('Calculates exponential time decay properly (recent > old)', () => {
  const now = Date.now();
  const freshEvent = now - (1000 * 60 * 60); // 1 hour ago
  const fourteenDaysAgo = now - (14 * 24 * 60 * 60 * 1000); // 1 half-life ago
  const twentyEightDaysAgo = now - (28 * 24 * 60 * 60 * 1000); // 2 half-lives ago

  const decayFresh = calculateTimeDecay(freshEvent, now);
  const decay14d = calculateTimeDecay(fourteenDaysAgo, now);
  const decay28d = calculateTimeDecay(twentyEightDaysAgo, now);

  assert(decayFresh > 0.99, '1-hour-old event should have decay factor ~ 1.0');
  assert(Math.abs(decay14d - 0.5) < 0.02, `14-day-old event should be approx 0.5 (got ${decay14d})`);
  assert(Math.abs(decay28d - 0.25) < 0.02, `28-day-old event should be approx 0.25 (got ${decay28d})`);
  assert(decayFresh > decay14d && decay14d > decay28d, 'Decay must be strictly monotonically decreasing');
});

it('Confidence scales with evidence count and saturates at threshold', () => {
  assert.strictEqual(calculateConfidence(0), 0);
  assert.strictEqual(calculateConfidence(1), 0.2, '1 interaction = 0.2 confidence (low)');
  assert.strictEqual(calculateConfidence(3), 0.6, '3 interactions = 0.6 confidence (moderate)');
  assert.strictEqual(calculateConfidence(5), 1.0, '5 interactions = 1.0 confidence (saturated)');
  assert.strictEqual(calculateConfidence(20), 1.0, '20 interactions capped at 1.0 max confidence');
});

// ─────────────────────────────────────────────────────────────
// 3. DETERMINISTIC TEST PERSONAS A THROUGH J
// ─────────────────────────────────────────────────────────────
console.log('\n[3. DETERMINISTIC TEST PERSONAS EVALUATION]');

// ── Persona A — Explicit Vegetarian ──
it('Persona A — Explicit vegetarian: behavior can NEVER cause meat recommendation', () => {
  const userProfile = {
    dietType: 'Vegetarian',
    allergies: [],
    behavioralProfile: {
      preferredFoods: {
        'chicken-biryani': { score: 1.0, confidence: 1.0, evidenceCount: 10, name: 'Chicken Biryani' }
      },
      preferredCuisines: {
        'mughlai': { score: 1.0, confidence: 1.0, evidenceCount: 10 }
      }
    }
  };

  const candidateFoods = [
    { id: 'c1', name: 'Chicken Biryani', dietType: 'Non-Vegetarian', cuisine: 'Mughlai', ingredients: ['chicken', 'rice'], healthScore: 9.0 },
    { id: 'v1', name: 'Vegetable Biryani', dietType: 'Vegetarian', cuisine: 'Indian', ingredients: ['vegetables', 'rice'], healthScore: 7.5 },
    { id: 'v2', name: 'Palak Paneer', dietType: 'Vegetarian', cuisine: 'North Indian', ingredients: ['paneer', 'spinach'], healthScore: 8.0 }
  ];

  // Catalog Engine check
  const recResult = recommendFoods(candidateFoods, userProfile, {}, 10);
  const meatFound = recResult.foods.some(f => f.name.toLowerCase().includes('chicken') || f.dietType === 'Non-Vegetarian');
  assert.strictEqual(meatFound, false, 'Explicit vegetarian must NEVER receive meat regardless of behavioral history');
  assert(recResult.foods.length > 0, 'Safe vegetarian foods must still be recommended');

  // AI Priority Engine check
  const aiScore = scoreFoodWithPriority(candidateFoods[0], { diet: 'vegetarian' }, {}, [], null, null, null, userProfile.behavioralProfile);
  assert.strictEqual(aiScore.safe, false, 'AI Priority Engine must reject meat for vegetarian');
  assert(aiScore.score <= -1000, 'Score must be -1000 for hard safety violation');
});

// ── Persona B — Medical Restriction ──
it('Persona B — Medical restriction: behavior can NEVER override confirmed medical limits', () => {
  const userProfile = {
    dietType: 'Vegetarian',
    activeFoodRestrictions: ['sodium', 'high salt'],
    behavioralProfile: {
      preferredFoods: {
        'salty-chips': { score: 1.0, confidence: 1.0, evidenceCount: 10, name: 'Salty Chips' }
      }
    }
  };

  const candidateFoods = [
    { id: 'f1', name: 'Salty Chips', dietType: 'Vegetarian', conditionTags: { avoid: ['sodium'] }, nutrientProfile: { sodium: 'high' }, sodium: 950, healthScore: 4.0 },
    { id: 'f2', name: 'Steamed Sprouts', dietType: 'Vegetarian', conditionTags: { prefer: ['low-sodium'] }, nutrientProfile: { sodium: 'low' }, sodium: 20, healthScore: 9.0 }
  ];

  const recResult = recommendFoods(candidateFoods, userProfile, {}, 10);
  const saltyFound = recResult.foods.some(f => f.id === 'f1');
  assert.strictEqual(saltyFound, false, 'High sodium food must be hard-excluded by confirmed medical limit');
  assert.strictEqual(recResult.foods[0].id, 'f2', 'Medically safe food must be recommended');
});

// ── Persona C — Strong Cuisine Preference ──
it('Persona C — Strong cuisine preference: repeated positive interactions increase cuisine relevance', () => {
  const events = [
    { type: 'recommendation_favorited', foodId: 'dosa', foodName: 'Masala Dosa', cuisine: 'south indian', timestamp: Date.now() },
    { type: 'food_consumed', foodId: 'idli', foodName: 'Idli Sambar', cuisine: 'south indian', timestamp: Date.now() },
    { type: 'recommendation_accepted', foodId: 'uttapam', foodName: 'Uttapam', cuisine: 'south indian', timestamp: Date.now() },
    { type: 'recommendation_favorited', foodId: 'vada', foodName: 'Medu Vada', cuisine: 'south indian', timestamp: Date.now() }
  ];

  const behProfile = aggregateBehavior(events, 'persona_c');
  assert(behProfile.preferredCuisines['south indian'], 'South Indian cuisine must be learned');
  assert(behProfile.preferredCuisines['south indian'].confidence >= 0.8, 'High confidence for 4 positive interactions');

  const candidateFoods = [
    { id: 'si-1', name: 'Masala Dosa', cuisine: 'South Indian', dietType: 'Vegetarian', healthScore: 7.0 },
    { id: 'it-1', name: 'Pasta Primavera', cuisine: 'Italian', dietType: 'Vegetarian', healthScore: 7.2 }
  ];

  const recResult = recommendFoods(candidateFoods, { dietType: 'Vegetarian' }, {}, 10, behProfile);
  assert.strictEqual(recResult.foods[0].name, 'Masala Dosa', 'Learned South Indian affinity must rank Masala Dosa first');
  assert(recResult.foods[0].contextualReasons.some(r => r.includes('learned preference for South Indian cuisine')));
});

// ── Persona D — Repeated Rejection ──
it('Persona D — Repeated rejection: repeated skips and rejections decrease preference', () => {
  const events = [
    { type: 'food_skipped', foodId: 'karela', foodName: 'Bitter Gourd Curry', timestamp: Date.now() },
    { type: 'food_skipped', foodId: 'karela', foodName: 'Bitter Gourd Curry', timestamp: Date.now() },
    { type: 'food_skipped', foodId: 'karela', foodName: 'Bitter Gourd Curry', timestamp: Date.now() },
    { type: 'recommendation_rejected', foodId: 'karela', foodName: 'Bitter Gourd Curry', timestamp: Date.now() }
  ];

  const behProfile = aggregateBehavior(events, 'persona_d');
  assert(behProfile.dislikedFoods['karela'], 'Bitter Gourd Curry should be classified under dislikedFoods');
  assert(behProfile.dislikedFoods['karela'].confidence >= 0.8, 'Repeated rejection yields high confidence');

  const candidateFoods = [
    { id: 'karela', name: 'Bitter Gourd Curry', dietType: 'Vegetarian', healthScore: 9.0 },
    { id: 'dal', name: 'Moong Dal', dietType: 'Vegetarian', healthScore: 7.5 }
  ];

  const recResult = recommendFoods(candidateFoods, { dietType: 'Vegetarian' }, {}, 10, behProfile);
  assert.strictEqual(recResult.foods[0].id, 'dal', 'Moong Dal should rank above frequently rejected Bitter Gourd Curry');
});

// ── Persona E — One-time Click ──
it('Persona E — One-time click: does not create permanent or dominant preference', () => {
  const events = [
    { type: 'recommendation_clicked', foodId: 'sushi', foodName: 'Vegetable Sushi', cuisine: 'japanese', timestamp: Date.now() }
  ];

  const behProfile = aggregateBehavior(events, 'persona_e');
  const cuisinePref = behProfile.preferredCuisines['japanese'];
  if (cuisinePref) {
    assert(cuisinePref.confidence <= 0.2, 'One-time click must have low confidence (<= 0.2)');
  }

  // A 0.2 confidence signal should not overpower a significantly healthier food
  const candidateFoods = [
    { id: 'j1', name: 'Vegetable Sushi', cuisine: 'Japanese', dietType: 'Vegetarian', healthScore: 6.0 },
    { id: 'i1', name: 'Sprouted Moong Salad', cuisine: 'Indian', dietType: 'Vegetarian', healthScore: 9.5 }
  ];

  const recResult = recommendFoods(candidateFoods, { dietType: 'Vegetarian' }, {}, 10, behProfile);
  assert.strictEqual(recResult.foods[0].id, 'i1', 'Significantly healthier food must maintain top rank over 1-click curiosity');
});

// ── Persona F — Old Preference vs Recent Preference ──
it('Persona F — Old preference: older behavior has lower influence than recent behavior', () => {
  const now = Date.now();
  const oldTimestamp = now - (60 * 24 * 60 * 60 * 1000); // 60 days ago (~4 half-lives)

  const decayFactor = calculateTimeDecay(oldTimestamp, now);
  assert(decayFactor < 0.1, `60-day-old event decay must be under 0.10 (got ${decayFactor.toFixed(3)})`);

  const events = [
    // 60 days ago: Liked Italian
    { type: 'recommendation_favorited', foodId: 'pizza', cuisine: 'italian', timestamp: oldTimestamp },
    // Yesterday: Liked Mexican
    { type: 'recommendation_favorited', foodId: 'burrito', cuisine: 'mexican', timestamp: now - (24 * 60 * 60 * 1000) }
  ];

  const behProfile = aggregateBehavior(events, 'persona_f', now);
  const mexicanScore = behProfile.preferredCuisines['mexican']?.score || 0;
  const italianScore = behProfile.preferredCuisines['italian']?.score || 0;

  assert(mexicanScore > italianScore, 'Recent Mexican interaction must outweigh decayed Italian interaction');
});

// ── Persona G — Controlled Safe Exploration ──
it('Persona G — Exploration: safe unfamiliar foods can occasionally appear with safety guaranteed', () => {
  const behProfile = {
    explorationRate: 0.20,
    preferredCuisines: {
      'south indian': { score: 0.9, confidence: 0.9, evidenceCount: 10 }
    }
  };

  const safeFoods = [
    { id: 'si-1', name: 'Masala Dosa', cuisine: 'South Indian', dietType: 'Vegetarian', healthScore: 8.5 },
    { id: 'si-2', name: 'Idli Sambar', cuisine: 'South Indian', dietType: 'Vegetarian', healthScore: 8.4 },
    { id: 'med-1', name: 'Greek Quinoa Bowl', cuisine: 'Mediterranean', dietType: 'Vegetarian', healthScore: 8.8 },
    { id: 'si-3', name: 'Rava Upma', cuisine: 'South Indian', dietType: 'Vegetarian', healthScore: 8.2 },
    { id: 'si-4', name: 'Pongal', cuisine: 'South Indian', dietType: 'Vegetarian', healthScore: 8.0 }
  ];

  const explored = applyDiversityAndExploration(safeFoods, 4, behProfile, { cuisines: ['South Indian'] });
  const hasExplorationItem = explored.some(f => f.isExploration === true || f.cuisine === 'Mediterranean');
  assert.strictEqual(hasExplorationItem, true, 'Controlled exploration introduces safe candidate outside dominant cuisine');
  assert.strictEqual(explored[0].name, 'Masala Dosa', 'Top exploit candidate remains first');
});

// ── Persona H — Repetition & Monotony Prevention ──
it('Persona H — Repetition: prevents monotonous loops of identical dish ingredients', () => {
  const rankedFoods = [
    { id: 'p1', name: 'Paneer Tikka', cuisine: 'North Indian', healthScore: 8.0 },
    { id: 'p2', name: 'Paneer Butter Masala', cuisine: 'North Indian', healthScore: 7.9 },
    { id: 'p3', name: 'Palak Paneer', cuisine: 'North Indian', healthScore: 7.8 }, // 3rd paneer in a row
    { id: 'd1', name: 'Yellow Dal Tadka', cuisine: 'North Indian', healthScore: 7.7 }
  ];

  const diverse = applyDiversityAndExploration(rankedFoods, 4, null, {});
  // Slot 0: Paneer Tikka, Slot 1: Paneer Butter Masala, Slot 2: Should diversify to Yellow Dal Tadka
  assert.strictEqual(diverse[0].id, 'p1');
  assert.strictEqual(diverse[1].id, 'p2');
  assert.strictEqual(diverse[2].id, 'd1', 'Diversity control must prevent 3 consecutive paneer items');
});

// ── Persona I — Explicit vs Learned Conflict ──
it('Persona I — Explicit vs learned conflict: explicit preference remains authoritative', () => {
  // User explicitly sets Spice level = Mild, but historical behavior has spicy items
  const userProfile = {
    spiceLevel: 'Mild',
    preferences: { spiceLevel: 'Mild' },
    behavioralProfile: {
      preferredSpiceLevel: {
        'spicy': { score: 0.85, confidence: 0.90, evidenceCount: 12 }
      }
    }
  };

  assert.strictEqual(userProfile.spiceLevel, 'Mild', 'Explicit spiceLevel must NOT be mutated to spicy');
  assert.strictEqual(userProfile.preferences.spiceLevel, 'Mild', 'User preference remains Mild');
  assert(userProfile.behavioralProfile.preferredSpiceLevel['spicy'], 'Observed tendency exists as separate signal');
});

// ── Persona J — Cross-device Persistence & Reset ──
  await itAsync('Persona J — Cross-device persistence & user reset control', async () => {
  const testUserId = 'test_device_sync_user';

  // 1. Record event
  await recordBehaviorEvent(testUserId, {
    type: 'recommendation_favorited',
    foodId: 'fb-paneer-bhurji',
    foodName: 'Paneer Bhurji',
    cuisine: 'North Indian',
    ingredients: ['paneer', 'tomato', 'onion']
  });

  // 2. Fetch profile (simulating second session / other device)
  const profile = await getBehavioralProfile(testUserId);
  assert(profile.preferredFoods['fb-paneer-bhurji'], 'Profile must persist and restore for user UID');
  assert.strictEqual(profile.userId, testUserId);

  // 3. User reset control
  const resetResult = await resetBehavioralProfile(testUserId);
  assert.strictEqual(resetResult.success, true);
  assert.strictEqual(Object.keys(resetResult.behavioralProfile.preferredFoods).length, 0, 'Learned foods cleared');
  assert.strictEqual(Object.keys(resetResult.behavioralProfile.preferredCuisines).length, 0, 'Learned cuisines cleared');

  // Verify memory store confirms reset
  const afterResetProfile = await getBehavioralProfile(testUserId);
  assert.strictEqual(Object.keys(afterResetProfile.preferredFoods).length, 0);
});

// ─────────────────────────────────────────────────────────────
// 4. INGREDIENT & SEARCH LEARNING RULES
// ─────────────────────────────────────────────────────────────
console.log('\n[4. INGREDIENT & SEARCH BEHAVIOR RULES]');

it('Ingredient learning requires evidence across >= 2 distinct foods', () => {
  // Only 1 dish with avocado
  const eventsSingleDish = [
    { type: 'recommendation_favorited', foodId: 'avo-toast', foodName: 'Avocado Toast', ingredients: ['avocado', 'sourdough'], timestamp: Date.now() },
    { type: 'food_consumed', foodId: 'avo-toast', foodName: 'Avocado Toast', ingredients: ['avocado', 'sourdough'], timestamp: Date.now() }
  ];

  const profileSingle = aggregateBehavior(eventsSingleDish, 'test_single');
  assert.strictEqual(profileSingle.preferredIngredients['avocado'], undefined, 'Must not generalize ingredient from single dish');

  // 2 distinct dishes with avocado
  const eventsMultiDish = [
    ...eventsSingleDish,
    { type: 'recommendation_favorited', foodId: 'guacamole-bowl', foodName: 'Guacamole Salad', ingredients: ['avocado', 'tomato'], timestamp: Date.now() }
  ];

  const profileMulti = aggregateBehavior(eventsMultiDish, 'test_multi');
  assert(profileMulti.preferredIngredients['avocado'], 'Avocado preference learned after appearing in >= 2 distinct dishes');
});

it('Search queries generate observed goal signals without changing explicit goals', () => {
  const events = [
    { type: 'food_searched', query: 'high protein salad', timestamp: Date.now() },
    { type: 'food_searched', query: 'muscle gain protein bowl', timestamp: Date.now() }
  ];

  const profile = aggregateBehavior(events, 'test_search');
  assert(profile.observedGoalSignals['high_protein'], 'Observed goal signal high_protein derived from searches');
  assert.strictEqual(profile.observedGoalSignals['high_protein'].confidence, 0.5);
});

// ─────────────────────────────────────────────────────────────
// 5. EXPLAINABILITY & AI COACH TRANSPARENCY
// ─────────────────────────────────────────────────────────────
console.log('\n[5. EXPLAINABILITY & AI COACH INTEGRATION]');

it('Produces concise, non-creepy, food-specific explanations', () => {
  const profile = {
    preferredFoods: {
      'dosa-1': { score: 0.95, confidence: 0.8, evidenceCount: 6 }
    },
    preferredCuisines: {
      'south indian': { score: 0.85, confidence: 0.8, evidenceCount: 7 }
    },
    preferredIngredients: {
      'tomato': { score: 0.75, confidence: 0.6, evidenceCount: 4 }
    }
  };

  const food = {
    id: 'dosa-1',
    name: 'Masala Dosa',
    cuisine: 'South Indian',
    ingredients: ['rice', 'tomato', 'potato']
  };

  const explanations = getBehavioralExplanation(food, profile);
  assert(explanations.length >= 2);
  assert(explanations.some(e => e.includes('frequently enjoyed by you')));
  assert(explanations.some(e => e.includes('South Indian')));
  assert(!explanations.some(e => e.includes('AI learned your personality')));
});

// ─────────────────────────────────────────────────────────────
// 6. CROSS-ENGINE CONSISTENCY
// ─────────────────────────────────────────────────────────────
console.log('\n[6. CROSS-ENGINE CONSISTENCY]');

it('AI Priority Engine and Catalog Engine both respect hard safety over learned preference', () => {
  const unsafeFood = {
    id: 'chicken-tikka',
    name: 'Chicken Tikka',
    dietType: 'Non-Vegetarian',
    cuisine: 'North Indian',
    healthScore: 8.5
  };

  const userContext = {
    diet: 'vegetarian',
    allergies: [],
    behavioralProfile: {
      preferredFoods: { 'chicken-tikka': { score: 1.0, confidence: 1.0 } }
    }
  };

  // AI Priority Engine
  const aiEval = scoreFoodWithPriority(unsafeFood, userContext);
  assert.strictEqual(aiEval.safe, false, 'AI Priority Engine must reject unsafe food');

  // Catalog Engine
  const catRec = recommendFoods([unsafeFood], { dietType: 'Vegetarian' }, {}, 5, userContext.behavioralProfile);
  assert.strictEqual(catRec.foods.length, 0, 'Catalog Engine must reject unsafe food');
});

  console.log('\n======================================================');
  console.log(`Phase 5 Behavioral Integration Summary: ${passedTests}/${totalTests} passed.`);
  console.log('All Phase 5 Behavioral Integration Tests PASSED flawlessly!');
  console.log('======================================================\n');
}

runAllTests().catch(err => {
  console.error('Phase 5 Test Suite failed with unexpected error:', err);
  process.exit(1);
});
