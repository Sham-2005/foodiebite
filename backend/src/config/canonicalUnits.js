/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/config/canonicalUnits.js
 *  FoodieBite — Canonical Units Registry (Phase 0 Foundation)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Documents and enforces the single canonical unit for every biomarker
 *  extracted and processed by the FoodieBite medical analysis engine.
 *
 *  IMPORTANT:
 *  All biomarker values stored, scored, or compared across the medical
 *  rules engine and food recommendation engine MUST be normalized to these
 *  canonical units in Phase 1 and beyond.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Single source of truth mapping of biomarker key to its canonical unit of measurement.
 * Enumerate every biomarker parsed in medicalAnalysisService.js.
 */
const CANONICAL_UNITS = Object.freeze({
  // Blood Sugar & Glycemic Control
  fastingSugar: 'mg/dL',
  randomSugar: 'mg/dL',
  glucose: 'mg/dL',
  hba1c: '%',

  // Blood & Hematology
  hemoglobin: 'g/dL',
  ferritin: 'ng/mL',

  // Micronutrients & Vitamins
  vitaminD: 'ng/mL',
  vitaminB12: 'pg/mL',

  // Lipid Profile & Heart Health
  cholesterol: 'mg/dL',
  hdl: 'mg/dL',
  ldl: 'mg/dL',
  triglycerides: 'mg/dL',

  // Renal & Kidney Health
  creatinine: 'mg/dL',
  uricAcid: 'mg/dL',
  urea: 'mg/dL',

  // Body Composition
  bmi: 'kg/m²',

  // Thyroid Function
  tsh: 'mIU/L',
  t3: 'ng/dL',
  t4: 'mcg/dL',

  // Liver Function
  sgot: 'U/L',
  sgpt: 'U/L',
  bilirubin: 'mg/dL',
  alp: 'U/L',

  // Blood Pressure & Cardiovascular
  systolicBp: 'mmHg',
  diastolicBp: 'mmHg',

  // Kidney Function & Electrolytes
  egfr: 'mL/min/1.73m²',
  bun: 'mg/dL',
  sodium: 'mmol/L',
  potassium: 'mmol/L'
});

/**
 * Returns the canonical unit for a given biomarker key.
 *
 * @param {string} biomarkerKey - The biomarker key (e.g., 'fastingSugar', 'hba1c', 'vitaminD')
 * @returns {string|null} Canonical unit string or null if biomarker is unknown
 */
function getCanonicalUnit(biomarkerKey) {
  return CANONICAL_UNITS[biomarkerKey] || null;
}

module.exports = {
  CANONICAL_UNITS,
  getCanonicalUnit
};
