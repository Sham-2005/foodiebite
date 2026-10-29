/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/unitConversionService.test.js
 *  Unit Tests for Clinical Unit Normalization Service
 * ─────────────────────────────────────────────────────────────
 */

const { normalizeValue } = require('../unitConversionService');

function runUnitConversionTests() {
  console.log('--- Running Unit Conversion Tests ---');
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

  // 1. Glucose / Fasting Sugar (mmol/L -> mg/dL)
  const g1 = normalizeValue('fastingSugar', 5.55, 'mmol/L');
  assert(g1.converted === true, 'Fasting sugar 5.55 mmol/L marked as converted');
  assert(g1.unit === 'mg/dL', 'Fasting sugar unit converted to mg/dL');
  assert(Math.abs(g1.value - 100.0) < 0.2, `Fasting sugar converted value ~100 mg/dL (got ${g1.value})`);

  // 2. Glucose (mg/dL -> mg/dL unchanged)
  const g2 = normalizeValue('fastingSugar', 110, 'mg/dL');
  assert(g2.converted === false, 'Fasting sugar 110 mg/dL not converted');
  assert(g2.value === 110, 'Fasting sugar value unchanged');

  // 3. Creatinine (µmol/L -> mg/dL)
  const c1 = normalizeValue('creatinine', 88.4, 'µmol/L');
  assert(c1.converted === true, 'Creatinine 88.4 µmol/L marked as converted');
  assert(c1.value === 1.0, `Creatinine converted to 1.0 mg/dL (got ${c1.value})`);

  const c2 = normalizeValue('creatinine', 132.6, 'umol/L'); // ASCII micro symbol fallback
  assert(c2.converted === true, 'Creatinine umol/L ASCII symbol handled');
  assert(c2.value === 1.5, `Creatinine 132.6 umol/L converted to 1.5 mg/dL (got ${c2.value})`);

  // 4. Vitamin D (nmol/L -> ng/mL)
  const v1 = normalizeValue('vitaminD', 24.96, 'nmol/L');
  assert(v1.converted === true, 'Vitamin D 24.96 nmol/L marked as converted');
  assert(v1.value === 10.0, `Vitamin D converted to 10 ng/mL (got ${v1.value})`);

  // 5. Total Cholesterol (mmol/L -> mg/dL)
  const chol1 = normalizeValue('cholesterol', 5.17, 'mmol/L');
  assert(chol1.converted === true, 'Cholesterol 5.17 mmol/L converted');
  assert(Math.abs(chol1.value - 199.92) < 0.5, `Cholesterol converted to ~200 mg/dL (got ${chol1.value})`);

  // 6. HbA1c (mmol/mol -> %)
  const hba1c1 = normalizeValue('hba1c', 48, 'mmol/mol');
  assert(hba1c1.converted === true, 'HbA1c mmol/mol converted');
  assert(Math.abs(hba1c1.value - 6.54) < 0.1, `HbA1c 48 mmol/mol converted to ~6.54% (got ${hba1c1.value})`);

  // 7. Unrecognized unit error handling
  const err1 = normalizeValue('glucose', 100, 'invalid_unit_xyz');
  assert(err1.converted === false, 'Unrecognized unit not marked as converted');
  assert(err1.value === null, 'Unrecognized unit returns null value');
  assert(err1.error === 'unrecognized_unit', 'Unrecognized unit returns explicit error code');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runUnitConversionTests();
}

module.exports = { runUnitConversionTests };
