/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/unitConversionService.js
 *  FoodieBite — Clinical Unit Normalization Service (Phase 1)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Normalizes clinical lab report values to canonical storage units.
 *  Uses exact medical conversion formulas and explicit unit handling.
 * ─────────────────────────────────────────────────────────────
 */

const { CANONICAL_UNITS, getCanonicalUnit } = require('../config/canonicalUnits');

/**
 * Standard unit alias normalizer for case & symbol variations
 */
function normalizeUnitString(unitStr) {
  if (!unitStr || typeof unitStr !== 'string') return '';
  let u = unitStr.trim().toLowerCase();
  // Normalize micro symbol variations
  u = u.replace(/μ|u/g, 'µ');
  // Normalize slash spacing
  u = u.replace(/\s*\/\s*/g, '/');
  // Standardize common case representations
  if (u === 'mg/dl') return 'mg/dL';
  if (u === 'g/dl') return 'g/dL';
  if (u === 'ng/ml') return 'ng/mL';
  if (u === 'pg/ml') return 'pg/mL';
  if (u === 'miu/l' || u === 'miu/l') return 'mIU/L';
  if (u === 'mmol/l') return 'mmol/L';
  if (u === 'µmol/l' || u === 'umol/l') return 'µmol/L';
  if (u === 'nmol/l') return 'nmol/L';
  if (u === 'pmol/l') return 'pmol/L';
  if (u === 'g/l') return 'g/L';
  if (u === 'u/l' || u === 'iu/l') return 'U/L';
  if (u === 'kg/m2' || u === 'kg/m²') return 'kg/m²';
  if (u === '%') return '%';
  if (u === 'mmol/mol') return 'mmol/mol';
  if (u === 'mmhg' || u === 'mm hg') return 'mmHg';
  if (u === 'ml/min' || u === 'ml/min/1.73m2' || u === 'ml/min/1.73m²' || u.startsWith('ml/min')) return 'mL/min/1.73m²';
  if (u === 'meq/l') return 'mmol/L';
  return unitStr.trim();
}

/**
 * Clinical Unit Converters per Biomarker Key
 */
const CONVERTERS = {
  // Blood Glucose / Sugar (Canonical: mg/dL)
  fastingSugar: {
    'mmol/L': (val) => val * 18.0182,
    'mg/dL': (val) => val
  },
  randomSugar: {
    'mmol/L': (val) => val * 18.0182,
    'mg/dL': (val) => val
  },
  glucose: {
    'mmol/L': (val) => val * 18.0182,
    'mg/dL': (val) => val
  },

  // HbA1c (Canonical: %)
  hba1c: {
    '%': (val) => val,
    'mmol/mol': (val) => val * 0.09148 + 2.152
  },

  // Lipids (Canonical: mg/dL)
  cholesterol: {
    'mmol/L': (val) => val * 38.67,
    'mg/dL': (val) => val
  },
  hdl: {
    'mmol/L': (val) => val * 38.67,
    'mg/dL': (val) => val
  },
  ldl: {
    'mmol/L': (val) => val * 38.67,
    'mg/dL': (val) => val
  },
  triglycerides: {
    'mmol/L': (val) => val * 88.57,
    'mg/dL': (val) => val
  },

  // Renal / Kidney (Canonical: mg/dL)
  creatinine: {
    'µmol/L': (val) => val / 88.4,
    'umol/L': (val) => val / 88.4,
    'mg/dL': (val) => val
  },
  uricAcid: {
    'µmol/L': (val) => val / 59.48,
    'umol/L': (val) => val / 59.48,
    'mg/dL': (val) => val
  },
  urea: {
    'mmol/L': (val) => val * 6.006,
    'mg/dL': (val) => val
  },

  // Hematology (Canonical: g/dL)
  hemoglobin: {
    'g/L': (val) => val / 10,
    'mmol/L': (val) => val * 1.61,
    'g/dL': (val) => val
  },

  // Vitamins & Ferritin
  vitaminD: {
    'nmol/L': (val) => val / 2.496,
    'µg/L': (val) => val,
    'ug/L': (val) => val,
    'ng/mL': (val) => val
  },
  vitaminB12: {
    'pmol/L': (val) => val * 1.355,
    'ng/L': (val) => val,
    'pg/mL': (val) => val
  },
  ferritin: {
    'µg/L': (val) => val,
    'ug/L': (val) => val,
    'ng/mL': (val) => val
  },

  // Thyroid (Canonical: mIU/L)
  tsh: {
    'µIU/mL': (val) => val,
    'uIU/mL': (val) => val,
    'mU/L': (val) => val,
    'mIU/mL': (val) => val * 1000,
    'mIU/L': (val) => val
  },
  t3: {
    'nmol/L': (val) => val * 65.1,
    'ng/dL': (val) => val
  },
  t4: {
    'nmol/L': (val) => val * 0.0777,
    'mcg/dL': (val) => val,
    'µg/dL': (val) => val,
    'ug/dL': (val) => val
  },

  // Liver Enzymes (Canonical: U/L)
  sgot: {
    'IU/L': (val) => val,
    'µkat/L': (val) => val * 60,
    'ukat/L': (val) => val * 60,
    'U/L': (val) => val
  },
  sgpt: {
    'IU/L': (val) => val,
    'µkat/L': (val) => val * 60,
    'ukat/L': (val) => val * 60,
    'U/L': (val) => val
  },

  // BMI (Canonical: kg/m²)
  bmi: {
    'kg/m2': (val) => val,
    'kg/m²': (val) => val
  },

  // Additional Liver Enzymes
  bilirubin: {
    'µmol/L': (val) => val / 17.1,
    'umol/L': (val) => val / 17.1,
    'mg/dL': (val) => val
  },
  alp: {
    'IU/L': (val) => val,
    'U/L': (val) => val
  },

  // Blood Pressure (Canonical: mmHg)
  systolicBp: {
    'mmHg': (val) => val
  },
  diastolicBp: {
    'mmHg': (val) => val
  },

  // Kidney Function (Canonical: mL/min/1.73m², mg/dL)
  egfr: {
    'mL/min/1.73m²': (val) => val,
    'ml/min/1.73m²': (val) => val,
    'ml/min': (val) => val
  },
  bun: {
    'mmol/L': (val) => val * 2.8,
    'mg/dL': (val) => val
  },

  // Electrolytes (Canonical: mmol/L)
  sodium: {
    'mEq/L': (val) => val,
    'mmol/L': (val) => val
  },
  potassium: {
    'mEq/L': (val) => val,
    'mmol/L': (val) => val
  }
};

/**
 * Main normalization entry point.
 * Converts raw lab report values to canonical units.
 *
 * @param {string} biomarkerKey - Key of the biomarker (e.g., 'glucose', 'creatinine')
 * @param {number} rawValue - Raw numerical value extracted from report
 * @param {string} [rawUnit] - Raw unit string extracted from report
 * @returns {{ value: number|null, unit: string, converted: boolean, error?: string }}
 */
function normalizeValue(biomarkerKey, rawValue, rawUnit = '') {
  const canonicalUnit = getCanonicalUnit(biomarkerKey);
  if (!canonicalUnit) {
    return { value: rawValue, unit: rawUnit || '', converted: false };
  }

  const numVal = parseFloat(rawValue);
  if (isNaN(numVal)) {
    return { value: null, unit: rawUnit || canonicalUnit, converted: false, error: 'invalid_number' };
  }

  // If raw unit is missing/empty, assume canonical unit as default (legacy safety)
  if (!rawUnit || !rawUnit.trim()) {
    return { value: numVal, unit: canonicalUnit, converted: false };
  }

  const normRawUnit = normalizeUnitString(rawUnit);
  const normCanonicalUnit = normalizeUnitString(canonicalUnit);

  // Direct match with canonical unit
  if (normRawUnit === normCanonicalUnit) {
    return { value: numVal, unit: canonicalUnit, converted: false };
  }

  // Check converter map for biomarker
  const biomarkerConverters = CONVERTERS[biomarkerKey];
  if (biomarkerConverters) {
    // Look up exact or normalized unit matching key
    for (const [unitKey, convertFn] of Object.entries(biomarkerConverters)) {
      if (normalizeUnitString(unitKey) === normRawUnit) {
        const convertedVal = convertFn(numVal);
        // Round to 2 decimal places for clean clinical display
        const roundedVal = Math.round(convertedVal * 100) / 100;
        return { value: roundedVal, unit: canonicalUnit, converted: true };
      }
    }
  }

  // Unrecognized unit variant for this biomarker
  return {
    value: null,
    unit: rawUnit,
    converted: false,
    error: 'unrecognized_unit'
  };
}

module.exports = {
  normalizeValue,
  normalizeUnitString,
  CONVERTERS
};
