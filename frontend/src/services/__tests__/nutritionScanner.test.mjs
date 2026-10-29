// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/nutritionScanner.test.mjs
//  Comprehensive verification suite for Food Nutrition Scanner
// ─────────────────────────────────────────────────────────────

import assert from 'assert';
import {
  normalizeOcrText,
  parseNutritionLabel,
  scaleNutrients,
  findDatabaseMatches
} from '../nutritionOcrService.js';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n🧪 Running Nutrition Scanner Unit & Regression Tests...\n');

// ── TEST 1: Clear Packaged-Food Nutrition Label ───────────────
it('Case 1: Parses clear packaged-food nutrition label accurately', () => {
  const label = `
NUTRITION FACTS
Serving Size 1 bar (45g)
Calories 210
Total Fat 8g
Saturated Fat 2.5g
Trans Fat 0g
Cholesterol 5mg
Sodium 140mg
Total Carbohydrate 26g
Dietary Fiber 3g
Total Sugars 12g
Protein 10g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.hasNutritionLabel, true, 'Must detect nutrition label');
  assert.strictEqual(result.isFoodPhotoOnly, false, 'Must not be marked as photo only');
  assert.strictEqual(result.servingBasis, 'per_serving', 'Must detect per_serving');
  assert.strictEqual(result.nutrients.calories.value, 210, 'Calories must be 210');
  assert.strictEqual(result.nutrients.protein.value, 10, 'Protein must be 10g');
  assert.strictEqual(result.nutrients.carbs.value, 26, 'Carbs must be 26g');
  assert.strictEqual(result.nutrients.fat.value, 8, 'Fat must be 8g');
  assert.strictEqual(result.nutrients.saturatedFat.value, 2.5, 'Preserves decimal saturated fat 2.5g');
  assert.strictEqual(result.nutrients.sodium.value, 140, 'Sodium must be 140mg');
  assert.strictEqual(result.nutrients.sodium.unit, 'mg', 'Sodium unit must be mg');
  assert.strictEqual(result.nutrients.cholesterol.value, 5, 'Cholesterol must be 5mg');
});

// ── TEST 2: Label With Decimal Values ─────────────────────────
it('Case 2: Preserves decimal values without rounding', () => {
  const label = `
Nutrition Information
Serving Size: 30g
Calories: 142.5 kcal
Protein: 3.8 g
Total Fat: 5.2 g
Saturated Fat: 1.4 g
Carbohydrates: 18.6 g
Sugars: 4.5 g
Dietary Fiber: 2.1 g
Sodium: 85 mg
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.nutrients.protein.value, 3.8, 'Preserves decimal protein 3.8');
  assert.strictEqual(result.nutrients.fat.value, 5.2, 'Preserves decimal fat 5.2');
  assert.strictEqual(result.nutrients.saturatedFat.value, 1.4, 'Preserves decimal saturated fat 1.4');
  assert.strictEqual(result.nutrients.carbs.value, 18.6, 'Preserves decimal carbs 18.6');
  assert.strictEqual(result.nutrients.fiber.value, 2.1, 'Preserves decimal fiber 2.1');
});

// ── TEST 3: Label With Both kcal and kJ ───────────────────────
it('Case 3: Correctly interprets energy in both kJ and kcal', () => {
  const label = `
Nutrition Facts
Per 100g
Energy: 1046 kJ / 250 kcal
Fat: 4.5 g
Carbohydrates: 45 g
Protein: 8.0 g
Sodium: 320 mg
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.servingBasis, 'per_100g', 'Identifies per 100g');
  assert.strictEqual(result.nutrients.calories.value, 250, 'Calories must be 250 kcal');
  assert.strictEqual(result.nutrients.energyKj.value, 1046, 'kJ must be 1046');
  assert.strictEqual(result.nutrients.calories.isCalculated, false, 'kcal was explicitly printed, not converted');
});

// ── TEST 4: Label with ONLY kJ (Explicit Conversion) ──────────
it('Case 4: Identifies energy with ONLY kJ and converts with explicit notice', () => {
  const label = `
Nutritional Information
Per 100g
Energy: 1674 kJ
Fat: 12 g
Carbohydrates: 50 g
Protein: 15 g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.nutrients.energyKj.value, 1674, 'Stores raw kJ');
  // 1674 / 4.184 ≈ 400 kcal
  assert.strictEqual(result.nutrients.calories.value, 400, 'Calculates 400 kcal from kJ');
  assert.strictEqual(result.nutrients.calories.isCalculated, true, 'Marks as calculated from kJ');
  assert(result.nutrients.calories.conversionNote.includes('1 kcal = 4.184 kJ'), 'Includes conversion formula');
});

// ── TEST 5: Label With Missing Nutrients ───────────────────────
it('Case 5: Never invents or fabricates missing nutrients', () => {
  const label = `
Nutrition Facts
Serving Size: 1 cookie (25g)
Calories: 110
Total Fat: 4g
Total Carbohydrates: 16g
Protein: 1g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.nutrients.calories.value, 110);
  assert.strictEqual(result.nutrients.fat.value, 4);
  assert.strictEqual(result.nutrients.carbs.value, 16);
  assert.strictEqual(result.nutrients.protein.value, 1);
  // Missing fields must be undefined in nutrients and listed in missingFields
  assert.strictEqual(result.nutrients.transFat, undefined, 'Must not fabricate trans fat');
  assert.strictEqual(result.nutrients.cholesterol, undefined, 'Must not fabricate cholesterol');
  assert.strictEqual(result.nutrients.fiber, undefined, 'Must not fabricate fiber');
  assert.strictEqual(result.nutrients.sodium, undefined, 'Must not fabricate sodium');
  assert(result.missingFields.includes('Trans Fat'), 'Lists Trans Fat as missing');
  assert(result.missingFields.includes('Sodium'), 'Lists Sodium as missing');
});

// ── TEST 6: Sodium in Grams vs Milligrams ─────────────────────
it('Case 6: Accurately converts sodium listed in grams to milligrams', () => {
  const label = `
Nutrition Information
Per 100g
Energy: 320 kcal
Total Fat: 5g
Carbohydrate: 60g
Protein: 8g
Sodium: 0.45 g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.nutrients.sodium.value, 450, '0.45g sodium converted to 450mg');
  assert.strictEqual(result.nutrients.sodium.unit, 'mg', 'Unit normalized to mg');
  assert(result.nutrients.sodium.conversionNote.includes('0.45 g converted to 450 mg'), 'Has clear conversion note');
});

// ── TEST 7: Salt to Sodium Conversion ─────────────────────────
it('Case 7: Handles salt labeling when sodium is absent with explicit note', () => {
  const label = `
Nutrition Facts
Per 100g
Calories: 240
Total Fat: 3g
Carbohydrates: 42g
Protein: 7g
Salt: 1.25 g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.nutrients.salt.value, 1.25, 'Captures salt value');
  // 1.25g salt * 400 = 500mg sodium
  assert.strictEqual(result.nutrients.sodium.value, 500, 'Calculates 500mg sodium from salt');
  assert.strictEqual(result.nutrients.sodium.isCalculated, true, 'Marks sodium as calculated');
  assert(result.nutrients.sodium.conversionNote.includes('Salt ÷ 2.5'), 'Includes salt formula');
});

// ── TEST 8: Serving Size Scaling ──────────────────────────────
it('Case 8: Calculates scaled nutrient values accurately when portion is adjusted', () => {
  const originalNutrients = {
    calories: { label: 'Calories', value: 200, unit: 'kcal' },
    protein: { label: 'Protein', value: 10, unit: 'g' },
    carbs: { label: 'Total Carbohydrates', value: 30, unit: 'g' },
    fat: { label: 'Total Fat', value: 5, unit: 'g' },
    sodium: { label: 'Sodium', value: 150, unit: 'mg' }
  };
  // Base 50g scaled to 100g (2x)
  const scaled2x = scaleNutrients(originalNutrients, 50, 100);
  assert.strictEqual(scaled2x.calories.value, 400, 'Calories scaled to 400');
  assert.strictEqual(scaled2x.protein.value, 20, 'Protein scaled to 20');
  assert.strictEqual(scaled2x.carbs.value, 60, 'Carbs scaled to 60');
  assert.strictEqual(scaled2x.fat.value, 10, 'Fat scaled to 10');
  assert.strictEqual(scaled2x.sodium.value, 300, 'Sodium scaled to 300');
  assert.strictEqual(scaled2x.calories.isCalculated, true, 'Flags as calculated');
  assert.strictEqual(scaled2x.calories.originalValue, 200, 'Preserves original 200');

  // Base 100g scaled to 30g (0.3x)
  const scaled03x = scaleNutrients(originalNutrients, 100, 30);
  assert.strictEqual(scaled03x.calories.value, 60, 'Calories scaled to 60');
  assert.strictEqual(scaled03x.protein.value, 3, 'Protein scaled to 3');
});

// ── TEST 9: Unknown Serving Basis Notice ──────────────────────
it('Case 9: Flags unknown serving basis without silently assuming per 100g', () => {
  const label = `
Nutritional Value:
Calories: 180
Protein: 6g
Carbohydrates: 24g
Fat: 4g
`;
  const result = parseNutritionLabel(label);
  assert.strictEqual(result.servingBasis, 'unknown', 'Serving basis must be flagged unknown');
  assert.strictEqual(result.servingSize, null, 'Serving size is null');
});

// ── TEST 10: Scenario B - Photo of Prepared Food Without Label ─
it('Case 10: Scenario B - Identifies ordinary food photo without label and provides DB search', () => {
  const mealPhotoText = `
Mediterranean Bistro
Fresh Greek Salad with Feta & Olives
Enjoy with warm pita bread
`;
  const result = parseNutritionLabel(mealPhotoText);
  assert.strictEqual(result.hasNutritionLabel, false, 'Does not claim nutrition label is present');
  assert.strictEqual(result.isFoodPhotoOnly, true, 'Identified as food photo without label');
  // Must have 0 fabricated nutrients
  assert.strictEqual(Object.keys(result.nutrients).length, 0, 'Does not fabricate nutrient values');
  // Database matches must exist
  const matches = findDatabaseMatches('Salad', 3);
  assert(matches.length > 0, 'Finds database recommendations');
  assert(matches[0].name.toLowerCase().includes('salad') || matches[0].name.length > 0);
});

// ── TEST 11: OCR Typos & Normalization ────────────────────────
it('Case 11: Normalizes common OCR misread spellings', () => {
  const typoLabel = `
NUTRITI0N FACTS
Servlng Slze: 50 g
Calor1es: 220
Pr0tein: 8 g
Carbohvdrate: 32 g
Dietarv Flbre: 4 g
Sodlum: 180 mg
`;
  const result = parseNutritionLabel(typoLabel);
  assert.strictEqual(result.hasNutritionLabel, true, 'Recognizes despite OCR typos');
  assert.strictEqual(result.nutrients.calories.value, 220);
  assert.strictEqual(result.nutrients.protein.value, 8);
  assert.strictEqual(result.nutrients.carbs.value, 32);
  assert.strictEqual(result.nutrients.fiber.value, 4);
  assert.strictEqual(result.nutrients.sodium.value, 180);
});

console.log(`\n📊 Test Results: ${passed} / ${total} passed (${Math.round((passed / total) * 100)}%)\n`);
if (passed === total) {
  console.log('✅ ALL NUTRITION SCANNER TESTS PASSED PERFECTLY!\n');
} else {
  process.exit(1);
}
