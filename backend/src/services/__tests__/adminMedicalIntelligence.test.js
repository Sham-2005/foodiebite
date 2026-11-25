// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/adminMedicalIntelligence.test.js
//  FoodieBite Admin Medical Report Intelligence Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();
const assert = require('assert');
const {
  buildStructuredTestResults,
  calculateSummaryCards,
  generateMedicalReportIntelligence,
  MEDICAL_DISCLAIMER
} = require('../medicalReportAiService');
const { getAllFoods } = require('../../ai/foodKnowledge');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('--- Admin Medical Report Intelligence Test Suite ---');
  console.log('======================================================\n');

  // ── GROUP 1: Structured Biomarker Lab Table Extraction ──────
  console.log('[1. STRUCTURED LAB RESULTS TABLE EXTRACTION]');

  await runTest('Converts analysis biomarkers into structured table entries with status labels', () => {
    const mockAnalysis = {
      biomarkers: {
        fastingBloodSugar: {
          value: 145,
          unit: 'mg/dL',
          status: 'high',
          referenceRange: { normal: [70, 99] },
          label: 'Fasting Blood Glucose',
          category: 'Glycemic'
        },
        hemoglobin: {
          value: 14.2,
          unit: 'g/dL',
          status: 'normal',
          referenceRange: { normal: [13.0, 17.0] },
          label: 'Hemoglobin',
          category: 'Hematology'
        },
        totalCholesterol: {
          value: 235,
          unit: 'mg/dL',
          status: 'high',
          referenceRange: { normal: [0, 200] },
          label: 'Total Cholesterol',
          category: 'Lipid'
        },
        vitaminD: {
          value: 18,
          unit: 'ng/mL',
          status: 'low',
          referenceRange: { normal: [30, 100] },
          label: 'Vitamin D (25-OH)',
          category: 'Micronutrient'
        }
      }
    };

    const table = buildStructuredTestResults(mockAnalysis);
    assert(Array.isArray(table), 'Expected table to be an array');
    assert.strictEqual(table.length, 4);

    const fbs = table.find(t => t.key === 'fastingBloodSugar');
    assert(fbs, 'Expected fastingBloodSugar entry');
    assert.strictEqual(fbs.test, 'Fasting Blood Glucose');
    assert.strictEqual(fbs.result, 145);
    assert.strictEqual(fbs.unit, 'mg/dL');
    assert.strictEqual(fbs.status, 'High');
    assert.strictEqual(fbs.referenceRange, '70 - 99 mg/dL');

    const hb = table.find(t => t.key === 'hemoglobin');
    assert.strictEqual(hb.status, 'Normal');

    const vitD = table.find(t => t.key === 'vitaminD');
    assert.strictEqual(vitD.status, 'Low');
  });

  await runTest('Extracts lab rows from raw OCR text fallback if analysis is sparse', () => {
    const emptyAnalysis = { biomarkers: {} };
    const rawOcr = 'Hemoglobin 13.5 g/dL (12.0 - 16.0)\nPlatelets 250 10^3/uL (150 - 450)';

    const table = buildStructuredTestResults(emptyAnalysis, rawOcr);
    assert(table.length >= 1, 'Expected at least 1 extracted row from OCR');
    assert(table.some(t => t.test.toLowerCase().includes('hemoglobin')), 'Expected hemoglobin row');
  });

  // ── GROUP 2: Summary Cards Computation ───────────────────────
  console.log('\n[2. SUMMARY CARDS METRICS COMPUTATION]');

  await runTest('Correctly tallies withinRange, outsideRange, and reviewCount metrics', () => {
    const mockTestResults = [
      { test: 'Biomarker 1', status: 'Normal' },
      { test: 'Biomarker 2', status: 'Normal' },
      { test: 'Biomarker 3', status: 'High' },
      { test: 'Biomarker 4', status: 'Low' },
      { test: 'Biomarker 5', status: 'Uncertain' }
    ];

    const cards = calculateSummaryCards(mockTestResults);
    assert.strictEqual(cards.totalTests, 5);
    assert.strictEqual(cards.withinRangeCount, 2);
    assert.strictEqual(cards.outsideRangeCount, 2); // High + Low
    assert.strictEqual(cards.reviewCount, 3);       // High + Low + Uncertain
  });

  // ── GROUP 3: Medical Intelligence Generation & Guardrails ───
  console.log('\n[3. MEDICAL AI INTELLIGENCE & GROUNDED RECOMMENDATIONS]');

  await runTest('Generates comprehensive non-diagnostic intelligence payload with grounded foods', async () => {
    const mockReport = {
      id: 'rep-test-uuid-001',
      report_name: 'Lipid & Metabolic Profile',
      raw_ocr_text: 'Fasting Blood Glucose: 135 mg/dL. Total Cholesterol: 220 mg/dL.',
      created_at: new Date().toISOString(),
      analysis: {
        biomarkers: {
          fastingGlucose: {
            value: 135,
            unit: 'mg/dL',
            status: 'high',
            referenceRange: { normal: [70, 99] },
            label: 'Fasting Glucose'
          },
          totalCholesterol: {
            value: 220,
            unit: 'mg/dL',
            status: 'high',
            referenceRange: { normal: [0, 200] },
            label: 'Total Cholesterol'
          }
        },
        findings: ['Elevated fasting glucose', 'Borderline elevated cholesterol'],
        foodProfile: {
          foodsToPrefer: ['Whole Grains', 'Oats', 'Leafy Greens'],
          foodsToLimit: ['Refined Sugars', 'Fried Snacks']
        }
      }
    };

    const userProfile = {
      id: 'usr-test-1',
      name: 'Alex Nutrition',
      dietType: 'Vegetarian',
      cuisines: ['Indian', 'Continental'],
      allergies: ['Peanuts'],
      healthGoals: ['Healthy Eating', 'Heart Health']
    };

    const result = await generateMedicalReportIntelligence(mockReport, userProfile);

    assert(result && result.success, 'Expected result.success === true');
    assert.strictEqual(result.reportId, 'rep-test-uuid-001');
    assert(result.summaryCards && result.summaryCards.totalTests >= 2);
    assert(result.summaryCards.outsideRangeCount >= 1);

    const ai = result.aiAnalysis;
    assert(ai, 'Expected aiAnalysis object');
    assert(typeof ai.summary === 'string' && ai.summary.length > 10, 'Expected narrative summary');
    assert(Array.isArray(ai.observations), 'Expected observations array');
    assert(typeof ai.generalInterpretation === 'string', 'Expected general interpretation');
    assert(typeof ai.nutritionConsiderations === 'string', 'Expected nutrition considerations');
    assert(typeof ai.healthcareGuidance === 'string', 'Expected healthcare guidance');

    // Disclaimer check
    assert.strictEqual(result.disclaimer, MEDICAL_DISCLAIMER);
    assert.strictEqual(ai.disclaimer, MEDICAL_DISCLAIMER);

    // Grounded food suggestions check
    assert(Array.isArray(ai.foodSuggestions) && ai.foodSuggestions.length > 0, 'Expected food suggestions');

    const allFoods = getAllFoods();
    const allFoodIds = new Set(allFoods.map(f => f.id));
    const allFoodNames = new Set(allFoods.map(f => f.name.toLowerCase()));

    for (const food of ai.foodSuggestions) {
      assert(food.foodName, 'Expected food name');
      assert(food.reason, 'Expected food rationale');
      const matchesDb = allFoodIds.has(food.foodId) || allFoodNames.has(food.foodName.toLowerCase());
      assert(matchesDb, `Suggested food "${food.foodName}" is not in FoodieBite database!`);
    }
  });

  await runTest('Strictly prevents definitive diagnosis or medicine prescription', async () => {
    const mockReport = {
      id: 'rep-test-safe-002',
      report_name: 'Metabolic Panel',
      raw_ocr_text: 'HbA1c: 6.8%. Glucose: 140 mg/dL.',
      analysis: {
        biomarkers: {
          hba1c: { value: 6.8, unit: '%', status: 'high', referenceRange: { normal: [4.0, 5.6] }, label: 'HbA1c' }
        }
      }
    };

    const userProfile = { dietType: 'Vegan', allergies: [] };
    const result = await generateMedicalReportIntelligence(mockReport, userProfile);
    const fullText = JSON.stringify(result.aiAnalysis).toLowerCase();

    assert(!fullText.includes('i diagnose you'), 'Forbidden clinical diagnosis found');
    assert(!fullText.includes('take 500mg'), 'Forbidden medication prescription found');
    assert(fullText.includes('healthcare') || fullText.includes('physician') || fullText.includes('doctor'), 'Expected healthcare provider referral');
  });

  // ── GROUP 4: Admin Controller & Route Exposure ──────────────
  console.log('\n[4. ADMIN CONTROLLER & ROUTE EXPOSURE]');

  await runTest('Admin controller exports all 5 medical report endpoints', () => {
    const adminController = require('../../controllers/adminController');
    assert.strictEqual(typeof adminController.getUserMedicalReports, 'function');
    assert.strictEqual(typeof adminController.getUserMedicalReportById, 'function');
    assert.strictEqual(typeof adminController.analyzeUserMedicalReport, 'function');
    assert.strictEqual(typeof adminController.viewUserMedicalReport, 'function');
    assert.strictEqual(typeof adminController.deleteUserMedicalReport, 'function');
  });

  console.log('\n======================================================');
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
