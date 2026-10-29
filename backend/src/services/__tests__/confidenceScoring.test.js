/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/confidenceScoring.test.js
 *  Unit Tests for Phase 2 Confidence Scoring & Safety Gating Rules
 * ─────────────────────────────────────────────────────────────
 */

const { analyzeReport } = require('../medicalAnalysisService');
const { CONFIDENCE_LEVELS, CONFIDENCE_REASONS } = require('../../config/confidenceLevels');

function runConfidenceScoringTests() {
  console.log('--- Running Phase 2 Confidence Scoring Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      failed++;
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // 1. High confidence clean digital PDF extraction
  const res1 = analyzeReport('Fasting Blood Sugar: 95 mg/dL, HbA1c: 5.4 %', '', { documentType: 'digital_pdf' });
  assert(res1.findings.length === 2, 'Clean digital PDF extracts 2 verified findings');
  assert(res1.findings[0].confidence === CONFIDENCE_LEVELS.HIGH, 'Fasting sugar confidence is HIGH');
  assert(res1.findings[0].confidenceReason === CONFIDENCE_REASONS.EXACT_LABEL_MATCH, 'Fasting sugar reason is EXACT_LABEL_MATCH');
  assert(res1.unverifiedFindings.length === 0, 'No unverified findings for clean digital PDF');

  // 2. Medium confidence unit-inferred extraction (missing unit suffix)
  const res2 = analyzeReport('Fasting Blood Sugar 95, HbA1c 5.4', '', { documentType: 'digital_pdf' });
  assert(res2.findings.length === 2, 'Unit-inferred report extracts 2 findings');
  assert(res2.findings[0].confidence === CONFIDENCE_LEVELS.MEDIUM, 'Inferred unit gives MEDIUM confidence');
  assert(res2.findings[0].confidenceReason === CONFIDENCE_REASONS.UNIT_INFERRED, 'Reason is UNIT_INFERRED');

  // 3. HARD RULE 1: Unrecognized unit forced to LOW confidence
  const res3 = analyzeReport('Fasting Blood Sugar: 132 unknown_xyz_unit', '', { documentType: 'digital_pdf' });
  assert(res3.unverifiedFindings.length === 1, 'Unrecognized unit reading placed in unverifiedFindings');
  assert(res3.unverifiedFindings[0].confidence === CONFIDENCE_LEVELS.LOW, 'Unrecognized unit forced to LOW confidence');
  assert(res3.unverifiedFindings[0].confidenceReason === CONFIDENCE_REASONS.UNIT_UNRECOGNIZED, 'Reason is UNIT_UNRECOGNIZED');

  // 4. HARD RULE 2: Handwritten / Low Quality document forced to LOW confidence
  const res4 = analyzeReport('Fasting Blood Sugar: 132 mg/dL', '', { documentType: 'handwritten' });
  assert(res4.findings.length === 0, 'Handwritten document has 0 verified findings');
  assert(res4.unverifiedFindings.length === 1, 'Handwritten document biomarker placed in unverifiedFindings');
  assert(res4.unverifiedFindings[0].confidence === CONFIDENCE_LEVELS.LOW, 'Handwritten extraction forced to LOW confidence');
  assert(res4.unverifiedFindings[0].confidenceReason === CONFIDENCE_REASONS.LOW_QUALITY_SOURCE, 'Reason is LOW_QUALITY_SOURCE');

  // 5. TASK 3 HEALTH SCORE GATING TEST
  // Fasting sugar 132 mg/dL on clean PDF would deduct 30 points.
  // On unrecognized unit (LOW confidence), it MUST BE EXCLUDED from scoring deductions!
  assert(res3.healthScores.categories.bloodSugar === 100, 'Low confidence blood sugar excluded from health score deduction (remains 100)');
  assert(res3.healthScores.overall === 100, 'Overall health score remains 100 for unverified low-confidence reading');

  // 6. TASK 3 SAFETY-CRITICAL FOOD RESTRICTION RULE TEST
  // Unverified low-confidence Fasting sugar 132 mg/dL (on handwritten doc) MUST NOT place Refined Sugar into foodsToLimit!
  assert(!res4.foodProfile.foodsToLimit.includes('Refined Sugar'), 'Low-confidence Fasting sugar 132 mg/dL does NOT trigger automatic food limits');
  assert(res4.foodProfile.unverifiedFoodRestrictions.length === 1, 'Low-confidence Fasting sugar triggers unverifiedFoodRestrictions warning entry');
  assert(res4.foodProfile.unverifiedFoodRestrictions[0].potentialLimits.includes('Refined Sugar'), 'Unverified restriction lists potential food limits for user review');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runConfidenceScoringTests();
}

module.exports = { runConfidenceScoringTests };
