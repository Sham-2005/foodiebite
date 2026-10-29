/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/phase3MedicalIntegration.test.js
 *  FoodieBite — Phase 3 Medical + Dietary Intelligence Integration Suite
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { analyzeReport } = require('../medicalAnalysisService');
const {
  normalizeNutrients,
  buildNutrientProfile,
  deriveConditionAndDietTags,
  normalizeOffProduct,
  NUTRIENT_THRESHOLDS
} = require('../foodNutrientNormalizer');
const { buildUserFoodProfile } = require('../profileBuilder');
const { recommendFoods, hardExclude, rankAndScore } = require('../recommendationEngine');
const { scoreFoodWithPriority } = require('../../ai/recommendationEngine');
const { buildMedicalContextSummary } = require('../../ai/medicalReportContext');
const { isDietCompatible } = require('../dietarySafetyService');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('\n======================================================');
console.log('--- Phase 3: Medical + Dietary Intelligence Suite ---');
console.log('======================================================\n');

// ═════════════════════════════════════════════════════════════
// 1. EXTENDED MEDICAL BIOMARKER EXTRACTION
// ═════════════════════════════════════════════════════════════
console.log('[1. EXTENDED BIOMARKER EXTRACTION & NORMALIZATION]');

runTest('Blood Pressure — combined format "BP: 120/80"', () => {
  const res = analyzeReport('BP: 120/80 mmHg', 'Routine checkup');
  assert(res.findings.some(f => f.key === 'systolicBp' && f.value === 120 && f.status === 'Normal'));
  assert(res.findings.some(f => f.key === 'diastolicBp' && f.value === 80 && f.status === 'Normal'));
});

runTest('Blood Pressure — format "Blood Pressure: 145 / 95"', () => {
  const res = analyzeReport('Blood Pressure: 145 / 95 mmHg', 'Annual exam');
  const sys = res.findings.find(f => f.key === 'systolicBp');
  const dia = res.findings.find(f => f.key === 'diastolicBp');
  assert(sys && sys.value === 145 && (sys.status === 'High' || sys.status === 'Critical'));
  assert(dia && dia.value === 95 && (dia.status === 'High' || dia.status === 'Critical'));
});

runTest('Blood Pressure — isolated labels "Systolic: 130" and "Diastolic: 85"', () => {
  const res = analyzeReport('Systolic BP: 130 mmHg\nDiastolic BP: 85 mmHg', 'Vitals check');
  assert(res.findings.some(f => f.key === 'systolicBp' && f.value === 130));
  assert(res.findings.some(f => f.key === 'diastolicBp' && f.value === 85));
});

runTest('Blood Pressure — dates or random slashes are NOT extracted as BP', () => {
  const res = analyzeReport('Date of Visit: 12/08/2025 Ratio: 12/80', 'General notes');
  assert(!res.findings.some(f => f.key === 'systolicBp'));
  assert(!res.findings.some(f => f.key === 'diastolicBp'));
});

runTest('Kidney & Liver biomarkers — eGFR, BUN, Bilirubin, ALP, Electrolytes', () => {
  const text = 'eGFR: 52 mL/min/1.73m2\nBUN: 26 mg/dL\nTotal Bilirubin: 1.6 mg/dL\nALP: 175 U/L\nSerum Sodium: 140 mmol/L\nSerum Potassium: 4.2 mmol/L';
  const res = analyzeReport(text, 'Comprehensive Panel');
  
  const egfr = res.findings.find(f => f.key === 'egfr');
  const bun = res.findings.find(f => f.key === 'bun');
  const bili = res.findings.find(f => f.key === 'bilirubin');
  const alp = res.findings.find(f => f.key === 'alp');
  const na = res.findings.find(f => f.key === 'sodium');
  const k = res.findings.find(f => f.key === 'potassium');

  assert(egfr && egfr.value === 52 && egfr.status === 'Low', 'eGFR extracted');
  assert(bun && bun.value === 26 && bun.status === 'High', 'BUN extracted');
  assert(bili && bili.value === 1.6 && bili.status === 'High', 'Bilirubin extracted');
  assert(alp && alp.value === 175 && alp.status === 'High', 'ALP extracted');
  assert(na && na.value === 140 && na.status === 'Normal', 'Sodium extracted');
  assert(k && k.value === 4.2 && k.status === 'Normal', 'Potassium extracted');
});

runTest('Missing biomarkers are strictly absent/null, never inferred or faked', () => {
  const res = analyzeReport('Fasting Blood Glucose: 95 mg/dL', 'Simple glucose check');
  assert.strictEqual(res.biomarkers.systolicBp, undefined);
  assert.strictEqual(res.biomarkers.egfr, undefined);
  assert.strictEqual(res.biomarkers.creatinine, undefined);
});

// ═════════════════════════════════════════════════════════════
// 2. OPENFOODFACTS MEDICAL NORMALIZATION (SECTION 23)
// ═════════════════════════════════════════════════════════════
console.log('\n[2. OPENFOODFACTS MEDICAL NUTRIENT NORMALIZATION]');

runTest('Complete nutrition data produces accurate nutrientProfile & conditionTags', () => {
  const raw = {
    product_name: 'Organic Rolled Oats',
    nutriments: {
      'energy-kcal_100g': 365,
      proteins_100g: 13.5,
      carbohydrates_100g: 62.0,
      fat_100g: 6.5,
      'saturated-fat_100g': 1.1,
      fiber_100g: 10.0,
      sugars_100g: 1.0,
      sodium_100g: 0.02
    }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.calories, 365);
  assert.strictEqual(norm.nutrition.protein, 13.5);
  assert.strictEqual(norm.nutrition.sodium, 20); // 0.02g -> 20mg
  assert.strictEqual(norm.nutrientProfile.protein, 'high');
  assert.strictEqual(norm.nutrientProfile.fiber, 'high');
  assert.strictEqual(norm.nutrientProfile.sodium, 'low');
  assert.strictEqual(norm.nutrientProfile.saturatedFat, 'low');
  assert.strictEqual(norm.nutrientProfile.sugar, 'low');

  assert(norm.conditionTags.prefer.includes('low-sodium'));
  assert(norm.conditionTags.prefer.includes('high-fiber'));
  assert(norm.conditionTags.prefer.includes('low-saturated-fat'));
  assert(norm.conditionTags.prefer.includes('low-gi'));
  assert.strictEqual(norm.conditionTags.avoid.length, 0);
});

runTest('Missing sodium leaves sodium as null and NEVER produces low-sodium tag', () => {
  const raw = {
    product_name: 'Unknown Sodium Bar',
    nutriments: { fiber_100g: 8.0, sugars_100g: 2.0 }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.sodium, null);
  assert.strictEqual(norm.nutrientProfile.sodium, null);
  assert(!norm.conditionTags.prefer.includes('low-sodium'), 'Must NOT generate low-sodium tag when sodium is missing');
  assert(!norm.conditionTags.avoid.includes('high-sodium'), 'Must NOT generate high-sodium tag when sodium is missing');
});

runTest('Missing fiber leaves fiber as null and NEVER produces high-fiber tag', () => {
  const raw = {
    product_name: 'Unknown Fiber Drink',
    nutriments: { 'energy-kcal_100g': 100 }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.fiber, null);
  assert.strictEqual(norm.nutrientProfile.fiber, null);
  assert(!norm.conditionTags.prefer.includes('high-fiber'));
});

runTest('Missing sugar leaves sugar as null and NEVER produces low-sugar or low-gi tag', () => {
  const raw = {
    product_name: 'Unknown Sugar Snack',
    nutriments: { fiber_100g: 7.0 }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.sugar, null);
  assert.strictEqual(norm.nutrientProfile.sugar, null);
  assert(!norm.conditionTags.prefer.includes('low-sugar'));
});

runTest('Missing saturated fat leaves saturatedFat as null and NEVER produces low-saturated-fat tag', () => {
  const raw = {
    product_name: 'Unknown Fat Food',
    nutriments: { proteins_100g: 15 }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.saturatedFat, null);
  assert(!norm.conditionTags.prefer.includes('low-saturated-fat'));
});

runTest('Zero value (0) is correctly distinguished from missing (null)', () => {
  const rawZero = { product_name: 'Zero Sugar Drink', nutriments: { sugars_100g: 0, sodium_100g: 0 } };
  const rawMissing = { product_name: 'Missing Sugar Drink', nutriments: {} };

  const normZero = normalizeOffProduct(rawZero);
  const normMissing = normalizeOffProduct(rawMissing);

  assert.strictEqual(normZero.nutrition.sugar, 0);
  assert.strictEqual(normZero.nutrition.sodium, 0);
  assert.strictEqual(normZero.nutrientProfile.sugar, 'low');
  assert.strictEqual(normZero.nutrientProfile.sodium, 'low');
  assert(normZero.conditionTags.prefer.includes('low-sodium'));

  assert.strictEqual(normMissing.nutrition.sugar, null);
  assert.strictEqual(normMissing.nutrition.sodium, null);
  assert.strictEqual(normMissing.nutrientProfile.sugar, null);
  assert.strictEqual(normMissing.nutrientProfile.sodium, null);
  assert(!normMissing.conditionTags.prefer.includes('low-sodium'));
});

runTest('Malformed and string nutrient values are safely handled without crash', () => {
  const raw = {
    product_name: 'Malformed Item',
    nutriments: {
      'energy-kcal_100g': '250 kcal',
      proteins_100g: '12.4g',
      fat_100g: 'invalid',
      sugars_100g: NaN,
      sodium_100g: null
    }
  };
  const norm = normalizeOffProduct(raw);
  assert.strictEqual(norm.nutrition.calories, 250);
  assert.strictEqual(norm.nutrition.protein, 12.4);
  assert.strictEqual(norm.nutrition.fat, null);
  assert.strictEqual(norm.nutrition.sugar, null);
  assert.strictEqual(norm.nutrition.sodium, null);
});

runTest('Salt to sodium unit conversion works seamlessly', () => {
  const rawWithSalt = {
    product_name: 'Pretzel',
    nutriments: { salt_100g: 2.0 } // 2g salt ≈ 800mg sodium (high sodium)
  };
  const norm = normalizeOffProduct(rawWithSalt);
  assert.strictEqual(norm.nutrition.sodium, 800);
  assert.strictEqual(norm.nutrientProfile.sodium, 'high');
  assert(norm.conditionTags.avoid.includes('high-sodium'));
});

// ═════════════════════════════════════════════════════════════
// 3. PERSONA TEST CASES (SECTION 22)
// ═════════════════════════════════════════════════════════════
console.log('\n[3. CLINICAL PERSONAS EVALUATION]');

const candidateFoods = [
  normalizeOffProduct({
    id: 'f_steel_cut_oats',
    product_name: 'Steel Cut Oats with Seeds',
    nutriments: {
      'energy-kcal_100g': 220,
      proteins_100g: 8.0,
      carbohydrates_100g: 35.0,
      fiber_100g: 7.5,
      sugars_100g: 1.5,
      'saturated-fat_100g': 0.8,
      sodium_100g: 0.03
    },
    dietTags: ['vegetarian', 'vegan']
  }),
  normalizeOffProduct({
    id: 'f_sugary_pastry',
    product_name: 'Glazed Cinnamon Pastry',
    nutriments: {
      'energy-kcal_100g': 420,
      proteins_100g: 3.0,
      carbohydrates_100g: 58.0,
      fiber_100g: 1.0,
      sugars_100g: 28.0,
      'saturated-fat_100g': 8.5,
      sodium_100g: 0.25
    },
    dietTags: ['vegetarian']
  }),
  normalizeOffProduct({
    id: 'f_salted_chips',
    product_name: 'Extra Salted Potato Crisps',
    nutriments: {
      'energy-kcal_100g': 530,
      proteins_100g: 6.0,
      carbohydrates_100g: 50.0,
      fiber_100g: 3.0,
      sugars_100g: 0.5,
      'saturated-fat_100g': 4.5,
      sodium_100g: 0.85 // 850mg sodium (high sodium)
    },
    dietTags: ['vegetarian', 'vegan']
  }),
  normalizeOffProduct({
    id: 'f_lentil_stew',
    product_name: 'Hearty Lentil & Spinach Stew',
    nutriments: {
      'energy-kcal_100g': 180,
      proteins_100g: 11.0,
      carbohydrates_100g: 24.0,
      fiber_100g: 8.0,
      sugars_100g: 2.0,
      'saturated-fat_100g': 0.5,
      sodium_100g: 0.08 // 80mg sodium (low sodium)
    },
    dietTags: ['vegetarian', 'vegan']
  })
];

runTest('Persona A — Glucose: prefers high-fiber/lower-glycemic, avoids refined-sugar', () => {
  const profile = buildUserFoodProfile({
    id: 'user_persona_a',
    dietType: 'Vegetarian',
    preferences: { healthGoals: ['healthy_eating'] },
    healthProfile: {
      findings: [
        { key: 'hba1c', value: 7.4, status: 'Critical', confidence: 'high' }
      ],
      wellnessConcerns: [
        { biomarker: 'HbA1c', concern: 'High HbA1c', tag: 'diabetic', severity: 'high', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['Refined Sugar', 'Sweets'],
        foodsToPrefer: ['Whole Grains', 'Oat Bran']
      }
    }
  });

  const recResult = recommendFoods(candidateFoods, profile);
  const recs = recResult.foods;
  assert(recs.length > 0);
  // Steel cut oats and lentil stew must rank above sugary pastry
  const oatsIdx = recs.findIndex(f => f.id === 'f_steel_cut_oats');
  const pastryIdx = recs.findIndex(f => f.id === 'f_sugary_pastry');
  assert(oatsIdx !== -1, 'Oats should be present');
  assert(pastryIdx === -1 || oatsIdx < pastryIdx, 'High-fiber low-gi food must rank higher than high-sugar pastry');
});

runTest('Persona B — Cholesterol: saturated fat & fiber signals influence ranking', () => {
  const profile = buildUserFoodProfile({
    id: 'user_persona_b',
    dietType: 'Vegetarian',
    healthProfile: {
      findings: [
        { key: 'ldl', value: 165, status: 'Critical', confidence: 'high' }
      ],
      wellnessConcerns: [
        { biomarker: 'LDL Cholesterol', concern: 'High LDL', tag: 'high-ldl', severity: 'high', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['Fried Foods', 'Butter', 'Saturated Fats'],
        foodsToPrefer: ['Oats', 'Walnuts', 'Salmon']
      }
    }
  });

  const recResult = recommendFoods(candidateFoods, profile);
  const recs = recResult.foods;
  // High-saturated-fat pastry should be excluded or ranked at bottom
  const pastry = recs.find(f => f.id === 'f_sugary_pastry');
  const stew = recs.find(f => f.id === 'f_lentil_stew');
  assert(stew, 'Lentil stew must be present');
  assert(!pastry || stew.recommendationScore > pastry.recommendationScore, 'Low saturated fat / high fiber must score higher');
});

runTest('Persona C — Blood Pressure: sodium awareness filters or ranks down high-sodium foods', () => {
  const profile = buildUserFoodProfile({
    id: 'user_persona_c',
    dietType: 'Vegetarian',
    healthProfile: {
      findings: [
        { key: 'systolicBp', value: 148, status: 'High', confidence: 'high' },
        { key: 'diastolicBp', value: 92, status: 'Critical', confidence: 'high' }
      ],
      wellnessConcerns: [
        { biomarker: 'Systolic Blood Pressure', concern: 'Elevated Systolic Blood Pressure', tag: 'hypertension', severity: 'high', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['high-sodium', 'High-Sodium Foods', 'Salted Snacks'],
        foodsToPrefer: ['Leafy Greens', 'Oats']
      }
    }
  });

  const recResult = recommendFoods(candidateFoods, profile);
  const recs = recResult.foods;
  // Salted chips have high sodium (> 600mg), should be excluded or ranked lowest
  const chipsInRecs = recs.find(f => f.id === 'f_salted_chips');
  assert(!chipsInRecs, 'High-sodium chips must be excluded for confirmed hypertension restriction');
});

runTest('Persona D — Kidney: strictly supported dietary rules without blanket protein ban', () => {
  const profile = buildUserFoodProfile({
    id: 'user_persona_d',
    dietType: 'Vegetarian',
    healthProfile: {
      findings: [
        { key: 'egfr', value: 55, status: 'Low', confidence: 'high' }
      ],
      wellnessConcerns: [
        { biomarker: 'eGFR', concern: 'Reduced eGFR', tag: 'kidney-disease', severity: 'moderate', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['high-sodium'],
        foodsToPrefer: ['Cauliflower', 'Blueberries', 'Olive Oil']
      }
    }
  });

  const recResult = recommendFoods(candidateFoods, profile);
  const recs = recResult.foods;
  // Lentil stew has 11g protein — should NOT be excluded because mild eGFR does NOT ban protein
  const stew = recs.find(f => f.id === 'f_lentil_stew');
  assert(stew, 'Moderate protein healthy food should not be excluded for mild kidney finding');
});

runTest('Persona E — No Medical Report: normal recommendations continue without error', () => {
  const profile = buildUserFoodProfile({
    id: 'user_persona_e',
    dietType: 'Vegetarian',
    healthProfile: null
  });

  const recResult = recommendFoods(candidateFoods, profile);
  const recs = recResult.foods;
  assert(Array.isArray(recs) && recs.length > 0);
  assert(recs.every(f => f.recommendationScore !== undefined));
});

// ═════════════════════════════════════════════════════════════
// 4. MEDICAL SAFETY & GATING (SECTION 24)
// ═════════════════════════════════════════════════════════════
console.log('\n[4. MEDICAL SAFETY & CONFIDENCE GATING]');

runTest('High-confidence restriction causes active safety exclusion', () => {
  const profile = buildUserFoodProfile({
    id: 'user_high_conf',
    healthProfile: {
      findings: [{ key: 'fastingSugar', value: 135, status: 'Critical', confidence: 'high' }],
      foodProfile: { foodsToLimit: ['refined-sugar'], unverifiedFoodRestrictions: [] }
    }
  });
  const excluded = hardExclude(candidateFoods, profile);
  assert(!excluded.some(f => f.id === 'f_sugary_pastry'), 'High-sugar pastry should be excluded');
});

runTest('Low-confidence finding does NOT cause hard exclusion', () => {
  const profile = buildUserFoodProfile({
    id: 'user_low_conf',
    healthProfile: {
      findings: [],
      unverifiedFindings: [{ key: 'fastingSugar', value: 135, status: 'Critical', confidence: 'low' }],
      foodProfile: { foodsToLimit: [], unverifiedFoodRestrictions: ['refined-sugar'] }
    }
  });
  const excluded = hardExclude(candidateFoods, profile);
  assert(excluded.some(f => f.id === 'f_sugary_pastry'), 'Low-confidence finding must NOT hard exclude foods');
});

runTest('Missing medical profile does not throw and allows normal foods', () => {
  const excluded = hardExclude(candidateFoods, {});
  assert.strictEqual(excluded.length, candidateFoods.length);
});

// ═════════════════════════════════════════════════════════════
// 5. CROSS-ENGINE CONSISTENCY (SECTION 25)
// ═════════════════════════════════════════════════════════════
console.log('\n[5. CROSS-ENGINE CONSISTENCY TEST]');

runTest('AI engine and Catalog engine interpret diet, allergies, and medical tags consistently', () => {
  const userFoodProfile = buildUserFoodProfile({
    id: 'cross_engine_user',
    dietType: 'Vegetarian',
    allergies: ['nuts'],
    preferences: { cuisines: ['South Indian'] },
    healthProfile: {
      findings: [
        { key: 'systolicBp', value: 145, status: 'High', confidence: 'high' }
      ],
      wellnessConcerns: [
        { biomarker: 'Systolic BP', concern: 'Elevated BP', tag: 'hypertension', severity: 'high', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['high-sodium'],
        foodsToPrefer: ['high-fiber', 'low-sodium']
      }
    }
  });

  const testPool = [
    {
      id: 'f_chicken_curry',
      name: 'South Indian Chicken Curry',
      dietType: 'non-vegetarian',
      dietTags: ['non-vegetarian'],
      conditionTags: { prefer: [], avoid: [] }
    },
    {
      id: 'f_sambar_idli',
      name: 'South Indian Sambar Idli',
      dietType: 'vegetarian',
      dietTags: ['vegetarian', 'vegan'],
      conditionTags: { prefer: ['low-sodium', 'high-fiber'], avoid: [] }
    },
    {
      id: 'f_salted_pickle',
      name: 'Spicy Salted Lemon Pickle',
      dietType: 'vegetarian',
      dietTags: ['vegetarian'],
      conditionTags: { prefer: [], avoid: ['high-sodium'] }
    }
  ];

  // 1. Catalog Engine:
  const catalogRecResult = recommendFoods(testPool, userFoodProfile);
  const catalogRecs = catalogRecResult.foods;
  assert(!catalogRecs.some(f => f.id === 'f_chicken_curry'), 'Catalog must exclude non-veg for vegetarian');
  assert(!catalogRecs.some(f => f.id === 'f_salted_pickle'), 'Catalog must exclude high-sodium for confirmed hypertension');
  assert(catalogRecs.some(f => f.id === 'f_sambar_idli'), 'Catalog must recommend safe vegetarian sambar idli');

  // 2. AI Priority Engine:
  const aiScoreChicken = scoreFoodWithPriority(testPool[0], { _userFoodProfile: userFoodProfile });
  const aiScoreIdli = scoreFoodWithPriority(testPool[1], { _userFoodProfile: userFoodProfile });
  const aiScorePickle = scoreFoodWithPriority(testPool[2], { _userFoodProfile: userFoodProfile });

  assert.strictEqual(aiScoreChicken.safe, false, 'AI engine must mark chicken unsafe for vegetarian');
  assert.strictEqual(aiScorePickle.safe, false, 'AI engine must mark high-sodium pickle unsafe for confirmed hypertension');
  assert.strictEqual(aiScoreIdli.safe, true, 'AI engine must mark sambar idli safe');
  assert(aiScoreIdli.score > 50, 'Sambar idli must receive positive score boost');
});

// ═════════════════════════════════════════════════════════════
// 6. MEDICAL PRIVACY & SAFE AI CONTEXT (SECTIONS 18, 20)
// ═════════════════════════════════════════════════════════════
console.log('\n[6. MEDICAL PRIVACY & SAFE AI CONTEXT]');

runTest('buildMedicalContextSummary never leaks raw OCR text, diagnoses, or PDF content', () => {
  const profile = buildUserFoodProfile({
    id: 'user_privacy',
    healthProfile: {
      wellnessConcerns: [
        { concern: 'Elevated Systolic Blood Pressure', severity: 'moderate', confidence: 'HIGH' }
      ],
      foodProfile: {
        foodsToLimit: ['high-sodium'],
        foodsToPrefer: ['Leafy Greens']
      }
    }
  });

  const summary = buildMedicalContextSummary(profile);
  assert(summary, 'Context summary should exist');
  assert(!summary.includes('OCR'), 'No OCR reference');
  assert(!summary.includes('rawOcrText'), 'No raw text');
  assert(!summary.includes('Doctor'), 'No clinical identifiers');
  assert(summary.includes('Foods to avoid (medical): high-sodium'));
  assert(summary.includes('Foods to prefer (medical): Leafy Greens'));
});

console.log('\n======================================================');
console.log(`Phase 3 Medical Integration Summary: ${passedTests}/${totalTests} passed.`);
console.log('All Phase 3 Medical Integration Tests PASSED flawlessly!');
console.log('======================================================\n');
