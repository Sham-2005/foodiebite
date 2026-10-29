// ─────────────────────────────────────────────────────────────
//  src/services/medicalAnalysisService.js
//  Biomarker Extraction Engine + Reference Range Analyzer
//  + Health Score Generator + Wellness Condition Inference
//
//  Refactored in Phase 1: Uses unitConversionService & biomarkerRules config.
//  Updated in Phase 2: Confidence scoring layer, Health Score gating,
//  and Safety-Critical food restriction verification rules.
// ─────────────────────────────────────────────────────────────

const { normalizeValue } = require('./unitConversionService');
const { biomarkerRules } = require('../config/ruleConfigLoader');
const { CONFIDENCE_LEVELS, CONFIDENCE_REASONS } = require('../config/confidenceLevels');

// ═══════════════════════════════════════════════════════════════
//  LEGACY REFERENCE RANGES SHIM
// ═══════════════════════════════════════════════════════════════

const REFERENCE_RANGES = {
  fastingSugar: { label: 'Fasting Blood Sugar', unit: 'mg/dL', normal: [70, 99], high: [100, 125], critical: [126, Infinity], low: [-Infinity, 69], category: 'bloodSugar' },
  randomSugar:  { label: 'Random Blood Sugar',  unit: 'mg/dL', normal: [70, 139], high: [140, 199], critical: [200, Infinity], low: [-Infinity, 69], category: 'bloodSugar' },
  hba1c:        { label: 'HbA1c',              unit: '%',     normal: [0, 5.6], high: [5.7, 6.4], critical: [6.5, Infinity], low: [-Infinity, -1], category: 'bloodSugar' },
  hemoglobin:   { label: 'Hemoglobin',         unit: 'g/dL',  normal: [12.0, 17.5], low: [10.0, 11.9], critical: [-Infinity, 9.9], high: [17.6, Infinity], category: 'nutrition' },
  vitaminD:     { label: 'Vitamin D',          unit: 'ng/mL', normal: [20, 50], low: [12, 19.9], critical: [-Infinity, 11.9], high: [50.1, Infinity], category: 'vitamins' },
  vitaminB12:   { label: 'Vitamin B12',        unit: 'pg/mL', normal: [200, 900], low: [100, 199], critical: [-Infinity, 99], high: [900.1, Infinity], category: 'vitamins' },
  cholesterol:  { label: 'Total Cholesterol',  unit: 'mg/dL', normal: [0, 199], high: [200, 239], critical: [240, Infinity], low: [-Infinity, -1], category: 'heartHealth' },
  hdl:          { label: 'HDL Cholesterol',    unit: 'mg/dL', normal: [40, Infinity], low: [0, 39], critical: [-Infinity, -1], high: [-Infinity, -1], category: 'heartHealth' },
  ldl:          { label: 'LDL Cholesterol',    unit: 'mg/dL', normal: [0, 99], high: [100, 159], critical: [160, Infinity], low: [-Infinity, -1], category: 'heartHealth' },
  triglycerides:{ label: 'Triglycerides',      unit: 'mg/dL', normal: [0, 149], high: [150, 199], critical: [200, Infinity], low: [-Infinity, -1], category: 'heartHealth' },
  creatinine:   { label: 'Creatinine',         unit: 'mg/dL', normal: [0.7, 1.2], high: [1.3, 1.9], critical: [2.0, Infinity], low: [-Infinity, 0.69], category: 'kidneyHealth' },
  uricAcid:     { label: 'Uric Acid',          unit: 'mg/dL', normal: [3.4, 6.8], high: [6.9, 9.0], critical: [9.1, Infinity], low: [-Infinity, 3.39], category: 'kidneyHealth' },
  bmi:          { label: 'BMI',                unit: 'kg/m²', normal: [18.5, 24.9], high: [25.0, 29.9], critical: [30.0, Infinity], low: [-Infinity, 18.4], category: 'weight' },
  tsh:          { label: 'TSH (Thyroid)',      unit: 'mIU/L', normal: [0.4, 4.5], high: [4.6, 10.0], critical: [10.1, Infinity], low: [-Infinity, 0.39], category: 'nutrition' },
  sgot:         { label: 'SGOT / AST',         unit: 'U/L',   normal: [0, 40], high: [41, 80], critical: [81, Infinity], low: [-Infinity, -1], category: 'liverHealth' },
  sgpt:         { label: 'SGPT / ALT',         unit: 'U/L',   normal: [0, 40], high: [41, 80], critical: [81, Infinity], low: [-Infinity, -1], category: 'liverHealth' },
  bilirubin:    { label: 'Total Bilirubin',    unit: 'mg/dL', normal: [0, 1.2], high: [1.3, 2.5], critical: [2.6, Infinity], low: [-Infinity, -1], category: 'liverHealth' },
  alp:          { label: 'Alkaline Phosphatase (ALP)', unit: 'U/L', normal: [44, 147], high: [148, 300], critical: [301, Infinity], low: [-Infinity, 43], category: 'liverHealth' },
  ferritin:     { label: 'Ferritin',           unit: 'ng/mL', normal: [12, 150], low: [0, 11.9], critical: [-Infinity, -1], high: [150.1, Infinity], category: 'nutrition' },
  systolicBp:   { label: 'Systolic Blood Pressure', unit: 'mmHg', normal: [90, 120], high: [121, 139], critical: [140, Infinity], low: [-Infinity, 89], category: 'heartHealth' },
  diastolicBp:  { label: 'Diastolic Blood Pressure', unit: 'mmHg', normal: [60, 80], high: [81, 89], critical: [90, Infinity], low: [-Infinity, 59], category: 'heartHealth' },
  egfr:         { label: 'Estimated GFR (eGFR)', unit: 'mL/min/1.73m²', normal: [60, Infinity], low: [30, 59.9], critical: [-Infinity, 29.9], high: [-Infinity, -1], category: 'kidneyHealth' },
  bun:          { label: 'Blood Urea Nitrogen', unit: 'mg/dL', normal: [7, 20], high: [21, 30], critical: [31, Infinity], low: [-Infinity, 6.9], category: 'kidneyHealth' },
  sodium:       { label: 'Serum Sodium',       unit: 'mmol/L', normal: [135, 145], high: [146, Infinity], critical: [155, Infinity], low: [-Infinity, 134.9], category: 'kidneyHealth' },
  potassium:    { label: 'Serum Potassium',    unit: 'mmol/L', normal: [3.5, 5.0], high: [5.1, Infinity], critical: [6.0, Infinity], low: [-Infinity, 3.4], category: 'kidneyHealth' }
};

// ═══════════════════════════════════════════════════════════════
//  BIOMARKER EXTRACTION PATTERNS
// ═══════════════════════════════════════════════════════════════

const BIOMARKER_PATTERNS = [
  { key: 'fastingSugar',   patterns: [/fasting\s*(?:blood\s*)?(?:sugar|glucose)[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /fbg[^0-9]{0,10}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'randomSugar',   patterns: [/random\s*(?:blood\s*)?(?:sugar|glucose)[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /rbs[^0-9]{0,10}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'hba1c',         patterns: [/hb\s*a1\s*c[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /glycated\s*hemoglobin[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /a1c[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'hemoglobin',    patterns: [/(?<!\w)h(?:ae|e)moglobin[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /(?<!\w)hb\b[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'vitaminD',      patterns: [/vitamin\s*d(?:\s*3)?[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /25[\s-]*oh[\s-]*d[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'vitaminB12',    patterns: [/vitamin\s*b[\s-]?12[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /cobalamin[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'cholesterol',   patterns: [/(?:total\s*)?cholesterol[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'hdl',           patterns: [/hdl[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /hdl[\s-]*cholesterol[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'ldl',           patterns: [/ldl[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /ldl[\s-]*cholesterol[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'triglycerides', patterns: [/triglycerides?[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /tg\b[^0-9]{0,12}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'creatinine',    patterns: [/creatinine[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /s\.?\s*creat[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'uricAcid',      patterns: [/uric\s*acid[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'bmi',           patterns: [/\bbmi\b[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³2²]+)?/i, /body\s*mass\s*index[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³2²]+)?/i] },
  { key: 'tsh',           patterns: [/\btsh\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /thyroid\s*stimulating[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'sgot',          patterns: [/sgot[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /\bast\b[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'sgpt',          patterns: [/sgpt[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /\balt\b[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'bilirubin',     patterns: [/(?:total\s*)?bilirubin[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /s\.?\s*bilirubin[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'alp',           patterns: [/(?:alkaline\s*phosphatase|\balp\b)[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'egfr',          patterns: [/(?:e[\s-]?gfr|estimated\s*gfr)\s*[:\-]?\s*(?:[><]\s*)?(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³2²]+)?/i] },
  { key: 'bun',           patterns: [/\bbun\b[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i, /blood\s*urea\s*nitrogen[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'sodium',        patterns: [/(?:serum\s*)?sodium[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'potassium',     patterns: [/(?:serum\s*)?potassium[^0-9]{0,15}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] },
  { key: 'ferritin',      patterns: [/ferritin[^0-9]{0,20}(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?/i] }
];

// ═══════════════════════════════════════════════════════════════
//  WELLNESS CONDITIONS & FOOD RULES SHIMS
// ═══════════════════════════════════════════════════════════════

const WELLNESS_CONDITIONS = {
  bloodSugar: { High: { concern: 'Elevated Blood Sugar', tag: 'Hyperglycemia / Diabetes Risk', severity: 'moderate' }, Critical: { concern: 'High Blood Sugar', tag: 'Hyperglycemia / Diabetes Risk', severity: 'high' }, Low: { concern: 'Low Blood Sugar', tag: 'Possible Hypoglycemia Risk', severity: 'moderate' } },
  hba1c: { High: { concern: 'Elevated HbA1c', tag: 'Hyperglycemia / Diabetes Risk', severity: 'moderate' }, Critical: { concern: 'High HbA1c', tag: 'Hyperglycemia / Diabetes Risk', severity: 'high' } },
  hemoglobin: { Low: { concern: 'Low Hemoglobin', tag: 'Anemia Risk / Iron Deficiency', severity: 'moderate' }, Critical: { concern: 'Very Low Hemoglobin', tag: 'Anemia Risk / Iron Deficiency', severity: 'high' } },
  vitaminD: { Low: { concern: 'Low Vitamin D', tag: 'Vitamin D Deficiency Risk', severity: 'moderate' }, Critical: { concern: 'Very Low Vitamin D', tag: 'Vitamin D Deficiency Risk', severity: 'high' } },
  vitaminB12: { Low: { concern: 'Low Vitamin B12', tag: 'Vitamin B12 Deficiency Risk', severity: 'moderate' }, Critical: { concern: 'Very Low Vitamin B12', tag: 'Vitamin B12 Deficiency Risk', severity: 'high' } },
  cholesterol: { High: { concern: 'Elevated Cholesterol', tag: 'Hypercholesterolemia / Cardiovascular Risk', severity: 'moderate' }, Critical: { concern: 'High Cholesterol', tag: 'Hypercholesterolemia / Cardiovascular Risk', severity: 'high' } },
  ldl: { High: { concern: 'Elevated LDL', tag: 'Hypercholesterolemia / Cardiovascular Risk', severity: 'moderate' }, Critical: { concern: 'High LDL Cholesterol', tag: 'Hypercholesterolemia / Cardiovascular Risk', severity: 'high' } },
  triglycerides: { High: { concern: 'Elevated Triglycerides', tag: 'Possible Heart Health Concern', severity: 'moderate' }, Critical: { concern: 'High Triglycerides', tag: 'Possible Heart Health Concern', severity: 'high' } },
  creatinine: { High: { concern: 'Elevated Creatinine', tag: 'Possible Kidney Function Concern', severity: 'moderate' }, Critical: { concern: 'High Creatinine', tag: 'Possible Kidney Function Concern', severity: 'high' } },
  uricAcid: { High: { concern: 'Elevated Uric Acid', tag: 'Possible Gout Risk', severity: 'moderate' }, Critical: { concern: 'High Uric Acid', tag: 'Possible Gout Risk', severity: 'high' } },
  bmi: { Low: { concern: 'Low BMI', tag: 'Possible Underweight Concern', severity: 'moderate' }, High: { concern: 'Elevated BMI', tag: 'Possible Overweight Concern', severity: 'moderate' }, Critical: { concern: 'High BMI', tag: 'Possible Obesity Risk (Lifestyle Indicator)', severity: 'high' } },
  tsh: { High: { concern: 'Elevated TSH', tag: 'Possible Hypothyroid Wellness Concern', severity: 'moderate' }, Low: { concern: 'Low TSH', tag: 'Possible Hyperthyroid Wellness Concern', severity: 'moderate' } },
  liverHealth: { High: { concern: 'Elevated Liver Enzymes', tag: 'Possible Liver Function Concern', severity: 'moderate' }, Critical: { concern: 'High Liver Enzymes', tag: 'Possible Liver Function Concern', severity: 'high' } },
  ferritin: { Low: { concern: 'Low Ferritin', tag: 'Anemia Risk / Iron Deficiency', severity: 'moderate' } },
  systolicBp: { High: { concern: 'Elevated Systolic Blood Pressure', tag: 'Hypertension / Cardiovascular Risk', severity: 'moderate' }, Critical: { concern: 'Stage 2 / High Systolic Blood Pressure', tag: 'Hypertension / Cardiovascular Risk', severity: 'high' } },
  diastolicBp: { High: { concern: 'Elevated Diastolic Blood Pressure', tag: 'Hypertension / Cardiovascular Risk', severity: 'moderate' }, Critical: { concern: 'Stage 2 / High Diastolic Blood Pressure', tag: 'Hypertension / Cardiovascular Risk', severity: 'high' } },
  egfr: { Low: { concern: 'Reduced eGFR', tag: 'Possible Kidney Function Concern', severity: 'moderate' }, Critical: { concern: 'Severely Reduced eGFR', tag: 'Possible Kidney Function Concern', severity: 'high' } },
  bun: { High: { concern: 'Elevated Blood Urea Nitrogen', tag: 'Possible Kidney Function Concern', severity: 'moderate' }, Critical: { concern: 'High Blood Urea Nitrogen', tag: 'Possible Kidney Function Concern', severity: 'high' } },
  bilirubin: { High: { concern: 'Elevated Bilirubin', tag: 'Possible Liver Function Concern', severity: 'moderate' }, Critical: { concern: 'High Bilirubin', tag: 'Possible Liver Function Concern', severity: 'high' } },
  alp: { High: { concern: 'Elevated Alkaline Phosphatase', tag: 'Possible Liver Function Concern', severity: 'moderate' }, Critical: { concern: 'High Alkaline Phosphatase', tag: 'Possible Liver Function Concern', severity: 'high' } },
  sodium: { High: { concern: 'Elevated Serum Sodium', tag: 'Possible Electrolyte Imbalance', severity: 'moderate' }, Low: { concern: 'Low Serum Sodium', tag: 'Possible Electrolyte Imbalance', severity: 'moderate' } },
  potassium: { High: { concern: 'Elevated Serum Potassium', tag: 'Possible Electrolyte Imbalance', severity: 'moderate' }, Low: { concern: 'Low Serum Potassium', tag: 'Possible Electrolyte Imbalance', severity: 'moderate' } }
};

const FOOD_RULES = {
  highBloodSugar: { restrictFoods: ['Refined Sugar', 'White Bread', 'Sweets', 'Carbonated Drinks', 'Fruit Juices', 'White Rice'], recommendFoods: ['Whole Grains', 'Oat Bran', 'Broccoli', 'Chia Seeds', 'Bitter Gourd', 'Fenugreek', 'Almonds'], recommendNutrients: ['fiber', 'chromium', 'magnesium'] },
  lowHemoglobin: { restrictFoods: ['Tea (with meals)', 'Coffee (with meals)', 'Calcium supplements at mealtime'], recommendFoods: ['Spinach', 'Dates', 'Beetroot', 'Lentils', 'Pomegranate', 'Fortified Cereal', 'Tofu'], recommendNutrients: ['iron', 'vitaminC', 'folate'] },
  highCholesterol: { restrictFoods: ['Fried Foods', 'Processed Snacks', 'Butter', 'Saturated Fats', 'Trans Fats', 'Red Meat'], recommendFoods: ['Oats', 'Walnuts', 'Almonds', 'Salmon', 'Olive Oil', 'Avocado', 'Flaxseeds', 'Garlic'], recommendNutrients: ['omega3', 'fiber', 'plantSterols'] },
  lowVitaminD: { restrictFoods: [], recommendFoods: ['Fortified Milk', 'Egg Yolk', 'Salmon', 'Mushrooms (sun-exposed)', 'Fortified Cereals'], recommendNutrients: ['vitaminD', 'calcium'] },
  lowVitaminB12: { restrictFoods: [], recommendFoods: ['Eggs', 'Dairy Products', 'Fortified Plant Milk', 'Nutritional Yeast', 'Tempeh'], recommendNutrients: ['vitaminB12', 'iron'] },
  kidneyFunctionConcern: { restrictFoods: ['High-Protein Diets', 'Processed Meats', 'High-Sodium Foods', 'Phosphorus-rich Foods', 'Potassium supplements'], recommendFoods: ['Cauliflower', 'Blueberries', 'Red Grapes', 'Egg Whites', 'Olive Oil'], recommendNutrients: ['antioxidants'] },
  highBMI: { restrictFoods: ['Deep Fried Foods', 'Sugary Beverages', 'Processed Foods', 'High Calorie Snacks'], recommendFoods: ['Leafy Greens', 'Vegetables', 'Whole Grains', 'Lean Protein', 'Fruits (low glycemic)'], recommendNutrients: ['fiber', 'protein', 'water'] },
  liverConcern: { restrictFoods: ['Alcohol', 'Fried Foods', 'High-Fat Foods', 'Processed Meats', 'Excess Sugar'], recommendFoods: ['Coffee', 'Green Tea', 'Broccoli', 'Turmeric', 'Walnuts', 'Berries'], recommendNutrients: ['antioxidants', 'vitaminE'] },
  hypertension: { restrictFoods: ['High-Sodium Foods', 'Salted Snacks', 'Pickles', 'Canned Soups', 'Processed Meats'], recommendFoods: ['Leafy Greens', 'Bananas', 'Berries', 'Beets', 'Oats', 'Garlic', 'Greek Yogurt'], recommendNutrients: ['potassium', 'magnesium', 'fiber'] }
};

const SCORE_DEDUCTIONS = { Normal: 0, Low: 15, High: 15, Critical: 30 };

// ═══════════════════════════════════════════════════════════════
//  CORE ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════

function classifyBiomarker(key, value) {
  const bioDef = biomarkerRules.biomarkers[key];
  if (!bioDef || !bioDef.ranges) return 'Normal';

  for (const range of bioDef.ranges) {
    if (range.max === null || value <= range.max) {
      return range.status;
    }
  }
  return 'Normal';
}

/**
 * Extract and normalize all biomarker values with confidence scoring.
 */
function extractBiomarkers(text, options = {}) {
  const documentType = options.documentType || 'digital_pdf';
  const ocrSource = options.ocrSource || (documentType === 'digital_pdf' ? 'pdf-parse' : 'tesseract');
  const biomarkers = {};

  // ── CONTEXTUAL BLOOD PRESSURE EXTRACTION ──────────────────────
  // Formats: "120/80 mmHg", "BP: 120/80", "Blood Pressure: 120 / 80", "Systolic: 120", "Diastolic: 80"
  let bpExtracted = false;
  const bpCombinedPatterns = [
    /(?:(?:blood\s*pressure|b\.?p\.?|arterial\s*pressure)(?:\s*\([^)]*\))?\s*[:=\-]?\s*)(\d{2,3})\s*[\/]\s*(\d{2,3})\s*(mm\s*Hg|mmHg)?/i,
    /(\d{2,3})\s*[\/]\s*(\d{2,3})\s*(mm\s*Hg|mmHg)\b/i
  ];

  for (const bpPat of bpCombinedPatterns) {
    const bpMatch = text.match(bpPat);
    if (bpMatch && bpMatch[1] && bpMatch[2]) {
      const rawSys = parseFloat(bpMatch[1]);
      const rawDia = parseFloat(bpMatch[2]);
      const rawUnit = bpMatch[3] ? bpMatch[3].trim() : '';

      // Plausibility verification
      if (rawSys >= 60 && rawSys <= 260 && rawDia >= 40 && rawDia <= 150 && rawSys > rawDia) {
        const sysNorm = normalizeValue('systolicBp', rawSys, rawUnit || 'mmHg');
        const diaNorm = normalizeValue('diastolicBp', rawDia, rawUnit || 'mmHg');

        let confidence = CONFIDENCE_LEVELS.HIGH;
        let confidenceReason = CONFIDENCE_REASONS.EXACT_LABEL_MATCH;

        if (documentType === 'handwritten' || documentType === 'low_quality') {
          confidence = CONFIDENCE_LEVELS.LOW;
          confidenceReason = CONFIDENCE_REASONS.LOW_QUALITY_SOURCE;
        } else if (documentType === 'printed_scanned' || ocrSource === 'tesseract') {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.OCR_EXTRACTION;
        } else if (!rawUnit) {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.UNIT_INFERRED;
        }

        console.log(`[Biomarker Extraction] Key: systolicBp, Value: ${sysNorm.value}, RawUnit: "${rawUnit}", Confidence: ${confidence}, Reason: ${confidenceReason}, DocType: ${documentType}`);
        console.log(`[Biomarker Extraction] Key: diastolicBp, Value: ${diaNorm.value}, RawUnit: "${rawUnit}", Confidence: ${confidence}, Reason: ${confidenceReason}, DocType: ${documentType}`);

        biomarkers.systolicBp = {
          value: sysNorm.value,
          unit: sysNorm.unit,
          rawValue: rawSys,
          rawUnit: rawUnit,
          converted: sysNorm.converted,
          confidence,
          confidenceReason,
          conversionError: sysNorm.error || null
        };

        biomarkers.diastolicBp = {
          value: diaNorm.value,
          unit: diaNorm.unit,
          rawValue: rawDia,
          rawUnit: rawUnit,
          converted: diaNorm.converted,
          confidence,
          confidenceReason,
          conversionError: diaNorm.error || null
        };

        bpExtracted = true;
        break;
      }
    }
  }

  // Check isolated systolic / diastolic if combined format not present
  if (!bpExtracted) {
    const sysMatch = text.match(/(?:systolic(?:\s*blood\s*pressure|\s*bp)?(?:\s*\([^)]*\))?\s*[:=\-]?\s*)(\d{2,3})\s*(mm\s*Hg|mmHg)?/i);
    if (sysMatch && sysMatch[1]) {
      const rawSys = parseFloat(sysMatch[1]);
      const rawUnit = sysMatch[2] ? sysMatch[2].trim() : '';
      if (rawSys >= 60 && rawSys <= 260) {
        const sysNorm = normalizeValue('systolicBp', rawSys, rawUnit || 'mmHg');
        let confidence = CONFIDENCE_LEVELS.HIGH;
        let confidenceReason = CONFIDENCE_REASONS.EXACT_LABEL_MATCH;
        if (documentType === 'handwritten' || documentType === 'low_quality') {
          confidence = CONFIDENCE_LEVELS.LOW;
          confidenceReason = CONFIDENCE_REASONS.LOW_QUALITY_SOURCE;
        } else if (documentType === 'printed_scanned' || ocrSource === 'tesseract') {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.OCR_EXTRACTION;
        } else if (!rawUnit) {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.UNIT_INFERRED;
        }

        console.log(`[Biomarker Extraction] Key: systolicBp, Value: ${sysNorm.value}, RawUnit: "${rawUnit}", Confidence: ${confidence}, Reason: ${confidenceReason}, DocType: ${documentType}`);
        biomarkers.systolicBp = {
          value: sysNorm.value,
          unit: sysNorm.unit,
          rawValue: rawSys,
          rawUnit: rawUnit,
          converted: sysNorm.converted,
          confidence,
          confidenceReason,
          conversionError: sysNorm.error || null
        };
      }
    }

    const diaMatch = text.match(/(?:diastolic(?:\s*blood\s*pressure|\s*bp)?(?:\s*\([^)]*\))?\s*[:=\-]?\s*)(\d{2,3})\s*(mm\s*Hg|mmHg)?/i);
    if (diaMatch && diaMatch[1]) {
      const rawDia = parseFloat(diaMatch[1]);
      const rawUnit = diaMatch[2] ? diaMatch[2].trim() : '';
      if (rawDia >= 40 && rawDia <= 150) {
        const diaNorm = normalizeValue('diastolicBp', rawDia, rawUnit || 'mmHg');
        let confidence = CONFIDENCE_LEVELS.HIGH;
        let confidenceReason = CONFIDENCE_REASONS.EXACT_LABEL_MATCH;
        if (documentType === 'handwritten' || documentType === 'low_quality') {
          confidence = CONFIDENCE_LEVELS.LOW;
          confidenceReason = CONFIDENCE_REASONS.LOW_QUALITY_SOURCE;
        } else if (documentType === 'printed_scanned' || ocrSource === 'tesseract') {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.OCR_EXTRACTION;
        } else if (!rawUnit) {
          confidence = CONFIDENCE_LEVELS.MEDIUM;
          confidenceReason = CONFIDENCE_REASONS.UNIT_INFERRED;
        }

        console.log(`[Biomarker Extraction] Key: diastolicBp, Value: ${diaNorm.value}, RawUnit: "${rawUnit}", Confidence: ${confidence}, Reason: ${confidenceReason}, DocType: ${documentType}`);
        biomarkers.diastolicBp = {
          value: diaNorm.value,
          unit: diaNorm.unit,
          rawValue: rawDia,
          rawUnit: rawUnit,
          converted: diaNorm.converted,
          confidence,
          confidenceReason,
          conversionError: diaNorm.error || null
        };
      }
    }
  }

  for (const { key, patterns } of BIOMARKER_PATTERNS) {
    if (biomarkers[key]) continue;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const rawVal = parseFloat(match[1]);
        const rawUnit = match[2] ? match[2].trim() : '';

        if (!isNaN(rawVal) && rawVal > 0 && rawVal < 100000) {
          const normResult = normalizeValue(key, rawVal, rawUnit);

          // ── CONFIDENCE EVALUATION MATRIX ──────────────────
          let confidence = CONFIDENCE_LEVELS.HIGH;
          let confidenceReason = CONFIDENCE_REASONS.EXACT_LABEL_MATCH;

          if (normResult.error === 'unrecognized_unit') {
            // HARD RULE 1: Unrecognized unit forced to LOW confidence
            confidence = CONFIDENCE_LEVELS.LOW;
            confidenceReason = CONFIDENCE_REASONS.UNIT_UNRECOGNIZED;
          } else if (documentType === 'handwritten' || documentType === 'low_quality') {
            // HARD RULE 2: Low quality / handwritten document forced to LOW confidence
            confidence = CONFIDENCE_LEVELS.LOW;
            confidenceReason = CONFIDENCE_REASONS.LOW_QUALITY_SOURCE;
          } else if (documentType === 'printed_scanned' || ocrSource === 'tesseract') {
            confidence = CONFIDENCE_LEVELS.MEDIUM;
            confidenceReason = CONFIDENCE_REASONS.OCR_EXTRACTION;
          } else if (!rawUnit || !rawUnit.trim()) {
            // Digital PDF but missing unit (inferred)
            confidence = CONFIDENCE_LEVELS.MEDIUM;
            confidenceReason = CONFIDENCE_REASONS.UNIT_INFERRED;
          }

          // TASK 5 LOGGING
          console.log(`[Biomarker Extraction] Key: ${key}, Value: ${normResult.value}, RawUnit: "${rawUnit}", Confidence: ${confidence}, Reason: ${confidenceReason}, DocType: ${documentType}`);

          biomarkers[key] = {
            value: normResult.value,
            unit: normResult.unit,
            rawValue: rawVal,
            rawUnit: rawUnit,
            converted: normResult.converted,
            confidence,
            confidenceReason,
            conversionError: normResult.error || null
          };
          break;
        }
      }
    }
  }

  return biomarkers;
}

/**
 * Generate structured findings array including confidence scoring metadata.
 */
function generateFindings(biomarkers) {
  return Object.entries(biomarkers).map(([key, bioData]) => {
    const bioDef = biomarkerRules.biomarkers[key];
    const status = bioData.value !== null ? classifyBiomarker(key, bioData.value) : 'Unknown';

    return {
      biomarker: bioDef ? bioDef.label : key,
      key,
      value: bioData.value,
      unit: bioDef ? bioDef.unit : bioData.unit,
      rawValue: bioData.rawValue,
      rawUnit: bioData.rawUnit,
      converted: bioData.converted,
      confidence: bioData.confidence,
      confidenceReason: bioData.confidenceReason,
      status,
      referenceRange: bioDef ? formatConfigRange(bioDef) : 'Unknown',
      category: bioDef ? bioDef.category : 'other'
    };
  });
}

function formatConfigRange(bioDef) {
  if (!bioDef.ranges || bioDef.ranges.length === 0) return 'Unknown';
  const normalRange = bioDef.ranges.find(r => r.status === 'Normal');
  if (!normalRange) return `Canonical unit: ${bioDef.unit}`;

  const rangeIdx = bioDef.ranges.indexOf(normalRange);
  const minVal = rangeIdx > 0 ? bioDef.ranges[rangeIdx - 1].max : 0;
  const maxVal = normalRange.max;

  if (minVal === 0) return `< ${maxVal} ${bioDef.unit}`;
  if (maxVal === null) return `> ${minVal} ${bioDef.unit}`;
  return `${minVal} – ${maxVal} ${bioDef.unit}`;
}

/**
 * Generate wellness concern list from findings.
 */
function inferWellnessConcerns(findings) {
  const concerns = [];
  for (const finding of findings) {
    if (finding.status === 'Normal' || finding.status === 'Unknown') continue;

    const bioDef = biomarkerRules.biomarkers[finding.key];
    if (bioDef && bioDef.ranges) {
      const matchedRange = bioDef.ranges.find(r => r.status === finding.status);
      if (matchedRange && matchedRange.concern) {
        concerns.push({
          biomarker: finding.biomarker,
          status: finding.status,
          concern: matchedRange.concern,
          tag: matchedRange.tag ? getWellnessTagDisplay(matchedRange.tag) : `${finding.status} ${finding.biomarker}`,
          severity: matchedRange.severity || 'low',
          confidence: finding.confidence,
          confidenceReason: finding.confidenceReason
        });
        continue;
      }
    }

    const condGroup = WELLNESS_CONDITIONS[finding.key] || WELLNESS_CONDITIONS[finding.category];
    if (condGroup) {
      const cond = condGroup[finding.status];
      if (cond) {
        concerns.push({
          biomarker: finding.biomarker,
          status: finding.status,
          concern: cond.concern,
          tag: cond.tag,
          severity: cond.severity || 'low',
          confidence: finding.confidence,
          confidenceReason: finding.confidenceReason
        });
      }
    }
  }
  return concerns;
}

function getWellnessTagDisplay(tagKey) {
  const tagDisplays = {
    'prediabetic': 'Hyperglycemia / Diabetes Risk',
    'diabetic': 'Hyperglycemia / Diabetes Risk',
    'hypoglycemia': 'Possible Hypoglycemia Risk',
    'anemia': 'Anemia Risk / Iron Deficiency',
    'vitamin-d-deficient': 'Vitamin D Deficiency Risk',
    'vitamin-b12-deficient': 'Vitamin B12 Deficiency Risk',
    'high-cholesterol': 'Hypercholesterolemia / Cardiovascular Risk',
    'high-ldl': 'Hypercholesterolemia / Cardiovascular Risk',
    'high-triglycerides': 'Possible Heart Health Concern',
    'kidney-disease': 'Possible Kidney Function Concern',
    'gout-risk': 'Possible Gout Risk',
    'underweight': 'Possible Underweight Concern',
    'overweight': 'Possible Overweight Concern',
    'obesity-risk': 'Possible Obesity Risk (Lifestyle Indicator)',
    'hypothyroid': 'Possible Hypothyroid Wellness Concern',
    'hyperthyroid': 'Possible Hyperthyroid Wellness Concern',
    'liver-concern': 'Possible Liver Function Concern',
    'iron-deficiency': 'Anemia Risk / Iron Deficiency',
    'dehydration-concern': 'Possible Dehydration Concern',
    'hypertension': 'Hypertension / Cardiovascular Risk',
    'electrolyte-concern': 'Possible Electrolyte Imbalance'
  };
  return tagDisplays[tagKey] || tagKey;
}

/**
 * Generate food restrictions with TASK 3 SAFETY GATING rules.
 * Low confidence findings are NOT added to foodsToLimit automatically.
 */
function buildFoodProfile(allFindings) {
  const restrict = new Set();
  const recommend = new Set();
  const nutrients = new Set();
  const unverifiedFoodRestrictions = [];

  // TASK 3 SAFETY GATING: Separate verified (high/medium) from low confidence
  const verifiedFindings = allFindings.filter(f => f.confidence !== CONFIDENCE_LEVELS.LOW);
  const lowConfidenceFindings = allFindings.filter(f => f.confidence === CONFIDENCE_LEVELS.LOW);

  // 1. Process Verified Findings normally into foodsToLimit / foodsToPrefer
  for (const f of verifiedFindings.filter(f => f.status !== 'Normal' && f.status !== 'Unknown')) {
    const rules = getFoodRuleForBiomarker(f);
    if (rules) {
      rules.restrictFoods.forEach(r => restrict.add(r));
      rules.recommendFoods.forEach(r => recommend.add(r));
      rules.recommendNutrients.forEach(n => nutrients.add(n));
    }
  }

  // 2. Process Low Confidence Findings: DO NOT apply to foodsToLimit! Place in unverifiedFoodRestrictions.
  for (const f of lowConfidenceFindings.filter(f => f.status !== 'Normal' && f.status !== 'Unknown')) {
    const rules = getFoodRuleForBiomarker(f);
    if (rules && rules.restrictFoods && rules.restrictFoods.length > 0) {
      unverifiedFoodRestrictions.push({
        biomarker: f.biomarker,
        key: f.key,
        value: f.value,
        unit: f.unit,
        status: f.status,
        confidence: f.confidence,
        confidenceReason: f.confidenceReason,
        potentialLimits: rules.restrictFoods,
        warning: `Unverified low-confidence reading for ${f.biomarker} (${f.value} ${f.unit}). Food limits were not applied automatically — please verify report against your doctor's advice.`
      });
    }
  }

  return {
    foodsToLimit: [...restrict],
    foodsToPrefer: [...recommend],
    recommendedNutrients: [...nutrients],
    unverifiedFoodRestrictions
  };
}

function getFoodRuleForBiomarker(f) {
  if ((f.key === 'fastingSugar' || f.key === 'randomSugar' || f.key === 'hba1c') && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.highBloodSugar;
  } else if (f.key === 'hemoglobin' && (f.status === 'Low' || f.status === 'Critical')) {
    return FOOD_RULES.lowHemoglobin;
  } else if ((f.key === 'cholesterol' || f.key === 'ldl') && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.highCholesterol;
  } else if (f.key === 'vitaminD' && (f.status === 'Low' || f.status === 'Critical')) {
    return FOOD_RULES.lowVitaminD;
  } else if (f.key === 'vitaminB12' && (f.status === 'Low' || f.status === 'Critical')) {
    return FOOD_RULES.lowVitaminB12;
  } else if ((f.key === 'creatinine' || f.key === 'uricAcid' || f.key === 'bun') && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.kidneyFunctionConcern;
  } else if (f.key === 'egfr' && (f.status === 'Low' || f.status === 'Critical')) {
    return FOOD_RULES.kidneyFunctionConcern;
  } else if ((f.key === 'systolicBp' || f.key === 'diastolicBp') && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.hypertension;
  } else if (f.key === 'bmi' && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.highBMI;
  } else if ((f.key === 'sgot' || f.key === 'sgpt' || f.key === 'bilirubin' || f.key === 'alp') && (f.status === 'High' || f.status === 'Critical')) {
    return FOOD_RULES.liverConcern;
  }
  return null;
}

/**
 * TASK 3 HEALTH SCORE GATING:
 * Deductions apply ONLY for High and Medium confidence findings.
 * Low confidence findings are excluded from score calculations.
 */
function calculateHealthScores(allFindings) {
  const categories = {
    bloodSugar:  100,
    heartHealth: 100,
    vitamins:    100,
    nutrition:   100,
    weight:      100,
    kidneyHealth:100,
    liverHealth: 100,
    hydration:   100,
    immuneHealth:100
  };

  // Filter out low confidence findings from health score deductions
  const scoredFindings = allFindings.filter(f => f.confidence !== CONFIDENCE_LEVELS.LOW);

  for (const finding of scoredFindings) {
    if (finding.status === 'Normal' || finding.status === 'Unknown') continue;
    const deduction = SCORE_DEDUCTIONS[finding.status] || 0;
    const cat = finding.category;
    if (cat && categories[cat] !== undefined) {
      categories[cat] = Math.max(0, categories[cat] - deduction);
    }
  }

  const measured = Object.entries(categories)
    .filter(([k]) => !['hydration', 'immuneHealth'].includes(k))
    .map(([, v]) => v);
  const overall = measured.length > 0 ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : 100;

  let overallLabel = 'Excellent';
  if (overall < 40) overallLabel = 'High Priority';
  else if (overall < 60) overallLabel = 'Needs Attention';
  else if (overall < 80) overallLabel = 'Moderate';
  else if (overall < 100) overallLabel = 'Good';

  return { categories, overall, overallLabel };
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API & EXTRACTION UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Extracts patient details from raw text.
 */
function parsePatientInfo(text) {
  try {
    let name = null;
    const nameRegexes = [
      /(?:patient(?:\s*name)?|name\s*of\s*patient|patient's\s*name)\s*[:\-]\s*([A-Za-z.\s]+)/i,
      /(?:^|\n)\s*name\s*[:\-]\s*([A-Za-z.\s]+)/i,
      /\bpt(?:\.|\s+name)?\s*[:\-]\s*([A-Za-z.\s]+)/i
    ];
    for (const regex of nameRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (candidate && !/^(age|gender|sex|date|id|ref|mrn|report|dob|uhid|dr)\b/i.test(candidate)) {
          const cleaned = candidate.split(/\n/)[0].trim().replace(/\s{2,}/g, ' ');
          if (cleaned.length > 2 && cleaned.length < 50) {
            name = cleaned.split(/\s+(?:age|sex|gender|date|ref|dob|id|mrn|uhid)/i)[0].trim();
            break;
          }
        }
      }
    }

    let age = null;
    const ageRegexes = [
      /(?:age|patient\s*age)\s*[:\-]?\s*(\d{1,3})\s*(?:yrs|years|y|yr)?\b/i,
      /\b(\d{1,3})\s*(?:years|yrs)\s*(?:old)?\b/i,
      /(?:age\s*\/\s*sex|sex\s*\/\s*age)\s*[:\-]?\s*(\d{1,3})/i
    ];
    for (const regex of ageRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val > 0 && val < 125) {
          age = val.toString();
          break;
        }
      }
    }

    let gender = null;
    const genderRegexes = [
      /(?:gender|sex)\s*[:\-]?\s*(male|female|m|f|other)\b/i,
      /(?:age\s*\/\s*sex|sex\s*\/\s*age)\s*[:\-]?\s*(?:\d{1,3}\s*[\/\-]\s*)?(male|female|m|f)\b/i,
      /\b(male|female)\b/i
    ];
    for (const regex of genderRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        let val = match[1].trim().toLowerCase();
        if (val === 'm') val = 'male';
        if (val === 'f') val = 'female';
        gender = val.charAt(0).toUpperCase() + val.slice(1);
        break;
      }
    }

    let patientId = null;
    const pidRegexes = [
      /(?:patient\s*id|pid|uhid|mrn|reg(?:\.|\s*no)?|ipd\s*no|opd\s*no|barcode\s*no|sample\s*id)\s*[:\-#]?\s*([A-Za-z0-9\-_/]+)/i,
      /\bid\s*[:\-#]\s*([A-Za-z0-9\-_/]+)/i
    ];
    for (const regex of pidRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val.length >= 2 && val.length <= 30 && !/^(date|male|female|age|name)$/i.test(val)) {
          patientId = val;
          break;
        }
      }
    }

    let dob = null;
    const dobRegexes = [
      /(?:date\s*of\s*birth|dob|birth\s*date)\s*[:\-]?\s*([0-9a-zA-Z\s,/-]+)/i
    ];
    for (const regex of dobRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const candidate = match[1].split(/\n/)[0].trim();
        const dateMatch = candidate.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/);
        if (dateMatch) {
          dob = dateMatch[0];
          break;
        }
      }
    }

    let reportDate = null;
    const dateRegexes = [
      /(?:report\s*date|date\s*of\s*report|collected\s*on|collection\s*date|sample\s*date|registration\s*date|date)\s*[:\-]?\s*([0-9a-zA-Z\s,/-]+)/i
    ];
    for (const regex of dateRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const candidate = match[1].split(/\n/)[0].trim();
        const dateMatch = candidate.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/);
        if (dateMatch) {
          reportDate = dateMatch[0];
          break;
        }
      }
    }
    if (!reportDate) {
      const fallbackDateMatch = text.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/) || text.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/);
      if (fallbackDateMatch) {
        reportDate = fallbackDateMatch[0];
      }
    }

    return {
      name: name || "Not detected",
      age: age || "Not detected",
      gender: gender || "Not detected",
      patientId: patientId || "Not detected",
      dob: dob || "Not detected",
      reportDate: reportDate || "Not detected"
    };
  } catch (err) {
    console.error('medicalAnalysisService: parsePatientInfo error:', err.message);
    return {
      name: "Not detected",
      age: "Not detected",
      gender: "Not detected",
      patientId: "Not detected",
      dob: "Not detected",
      reportDate: "Not detected"
    };
  }
}

/**
 * Extracts medical summary information (diagnosis, symptoms, allergies, etc.)
 */
function parseMedicalInfo(text) {
  try {
    let diagnosis = null;
    const diagRegexes = [
      /(?:diagnosis|clinical\s*diagnosis|provisional\s*diagnosis|final\s*diagnosis|impression|conclusion)\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const regex of diagRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 2 && val.length < 150) {
          diagnosis = val;
          break;
        }
      }
    }

    let symptoms = null;
    const sympRegexes = [
      /(?:symptoms?|chief\s*complaints?|presenting\s*complaints?|complaints?)\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const regex of sympRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 2 && val.length < 150) {
          symptoms = val;
          break;
        }
      }
    }

    let conditions = null;
    const condRegexes = [
      /(?:medical\s*conditions?|known\s*conditions?|past\s*medical\s*history|clinical\s*history)\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const regex of condRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 2 && val.length < 150) {
          conditions = val;
          break;
        }
      }
    }

    let allergies = null;
    const allRegexes = [
      /(?:allergies|known\s*allergies|drug\s*allerg(?:y|ies)|food\s*allerg(?:y|ies))\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const regex of allRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 1 && val.length < 150) {
          allergies = val;
          break;
        }
      }
    }

    let medications = null;
    const medRegexes = [
      /(?:medications?|current\s*medications?|prescriptions?|rx)\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const regex of medRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 2 && val.length < 150) {
          medications = val;
          break;
        }
      }
    }

    let doctorName = null;
    const docRegexes = [
      /(?:consulting\s*doctor|referred\s*by|physician|doctor|consultant|dr\.?)\s*[:\-]\s*([A-Za-z.\s]+)/i
    ];
    for (const regex of docRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].split(/\n/)[0].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 2 && val.length < 60 && !/^(hospital|clinic|lab|report|page|date)$/i.test(val)) {
          doctorName = val;
          break;
        }
      }
    }

    let hospitalName = null;
    const hospRegexes = [
      /(?:hospital|clinic|laboratory|diagnostic\s*center|lab\s*name)\s*[:\-]\s*([^\n\r]+)/i,
      /(?:^|\n)\s*([A-Z0-9\s&.,'-]+(?:hospital|clinic|diagnostics?|laborator(?:y|ies)|healthcare|pathology|medical\s*center))/i
    ];
    for (const regex of hospRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/\s{2,}/g, ' ');
        if (val.length > 3 && val.length < 80) {
          hospitalName = val;
          break;
        }
      }
    }

    return {
      diagnosis: diagnosis || "Not detected",
      symptoms: symptoms || "Not detected",
      conditions: conditions || "Not detected",
      allergies: allergies || "Not detected",
      medications: medications || "Not detected",
      doctorName: doctorName || "Not detected",
      hospitalName: hospitalName || "Not detected"
    };
  } catch (err) {
    console.error('medicalAnalysisService: parseMedicalInfo error:', err.message);
    return {
      diagnosis: "Not detected",
      symptoms: "Not detected",
      conditions: "Not detected",
      allergies: "Not detected",
      medications: "Not detected",
      doctorName: "Not detected",
      hospitalName: "Not detected"
    };
  }
}

/**
 * Parses raw text lines to reconstruct the table of test results.
 */
function parseTableLines(text) {
  try {
    const lines = text.split('\n');
    const extractedRows = [];
    const unitPattern = /\b(?:mg\/dL|g\/dL|%|uIU\/mL|µIU\/mL|mIU\/L|U\/L|pg\/mL|ng\/mL|ng\/dL|mcg\/dL|mmol\/L|µg\/dL|fl|pg|g\/L|mill\/cmm|thou\/cmm)\b/i;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (/^(patient|name|age|gender|sex|date|mrn|physician|doctor|hospital|lab|laboratory|page|report|specimen|test\s+name|result|unit|reference)/i.test(line)) {
        continue;
      }

      const refRangeRegex = /(?:[<>=]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?)/i;
      const refMatch = line.match(refRangeRegex);

      if (refMatch) {
        const referenceRange = refMatch[0].trim();
        const refIdx = refMatch.index;
        const beforeRef = line.substring(0, refIdx).trim();

        const valueRegex = /\b(\d+(?:\.\d+)?)\b(?!.*\b\d+(?:\.\d+)?\b)/;
        const valMatch = beforeRef.match(valueRegex);

        if (valMatch) {
          const value = valMatch[1];
          const valIdx = valMatch.index;
          const testName = beforeRef.substring(0, valIdx).trim().replace(/[:\-\s]+$/, '').trim();

          let unit = beforeRef.substring(valIdx + valMatch[0].length).trim();
          if (!unit) {
            const afterRef = line.substring(refIdx + referenceRange.length).trim();
            const unitMatch = afterRef.match(unitPattern);
            if (unitMatch) unit = unitMatch[0];
          } else {
            const unitMatch = unit.match(unitPattern);
            if (unitMatch) unit = unitMatch[0];
          }

          const afterRefText = line.substring(refIdx + referenceRange.length).trim();
          let status = "Not detected";
          const statusMatch = afterRefText.match(/\b(high|low|normal|abnormal|critical|h|l)\b/i);
          if (statusMatch) {
            const s = statusMatch[1].toLowerCase();
            if (s === 'h' || s === 'high') status = 'High';
            else if (s === 'l' || s === 'low') status = 'Low';
            else if (s === 'critical') status = 'Critical';
            else if (s === 'abnormal') status = 'Abnormal';
            else if (s === 'normal') status = 'Normal';
          }

          let cleanedName = testName.replace(/^\d+[\.\s]*/, '').trim();
          if (cleanedName.length > 1 && !/^[.\-–:_ ]+$/.test(cleanedName)) {
            extractedRows.push({
              test: cleanedName,
              name: cleanedName,
              result: value || "Not detected",
              value: value || "Not detected",
              unit: unit || "Not detected",
              referenceRange: referenceRange || "Not detected",
              status: status
            });
            continue;
          }
        }
      }

      // Fallback: value and unit match
      const unitMatch = line.match(unitPattern);
      if (unitMatch) {
        const unit = unitMatch[0];
        const unitIdx = line.indexOf(unit);
        const beforeUnit = line.substring(0, unitIdx).trim();
        const valMatch = beforeUnit.match(/\b(\d+(?:\.\d+)?)\b(?!.*\b\d+(?:\.\d+)?\b)/);
        
        if (valMatch) {
          const value = valMatch[1];
          const valIdx = valMatch.index;
          const testName = beforeUnit.substring(0, valIdx).trim().replace(/[:\-\s]+$/, '').trim();
          let cleanedName = testName.replace(/^\d+[\.\s]*/, '').trim();
          
          const afterUnit = line.substring(unitIdx + unit.length).trim();
          const refMatchAfter = afterUnit.match(refRangeRegex);
          const referenceRange = refMatchAfter ? refMatchAfter[0] : "Not detected";
          
          let status = "Not detected";
          const statusMatch = afterUnit.match(/\b(high|low|normal|abnormal|critical|h|l)\b/i);
          if (statusMatch) {
            const s = statusMatch[1].toLowerCase();
            if (s === 'h' || s === 'high') status = 'High';
            else if (s === 'l' || s === 'low') status = 'Low';
            else if (s === 'critical') status = 'Critical';
            else if (s === 'abnormal') status = 'Abnormal';
            else if (s === 'normal') status = 'Normal';
          }
          
          if (cleanedName.length > 1 && !/^[.\-–:_ ]+$/.test(cleanedName)) {
            extractedRows.push({
              test: cleanedName,
              name: cleanedName,
              result: value || "Not detected",
              value: value || "Not detected",
              unit: unit || "Not detected",
              referenceRange: referenceRange,
              status: status
            });
          }
        }
      }
    }

    return extractedRows;
  } catch (err) {
    console.error('medicalAnalysisService: parseTableLines error:', err.message);
    return [];
  }
}

/**
 * Builds unified test results combining verified findings and table-parsed rows.
 */
function buildUnifiedTestResults(allFindings, tableRows) {
  const map = new Map();

  // First, add all findings detected by verified clinical regex patterns
  for (const f of allFindings) {
    const key = (f.biomarker || f.key || '').toLowerCase();
    if (!key) continue;
    map.set(key, {
      test: f.biomarker,
      name: f.biomarker,
      result: f.value !== undefined ? String(f.value) : 'Not detected',
      value: f.value !== undefined ? String(f.value) : 'Not detected',
      unit: f.unit || 'Not detected',
      referenceRange: f.referenceRange || 'Not detected',
      status: f.status || 'Normal'
    });
  }

  // Next, augment with any additional table rows from the report that weren't caught by predefined biomarkers
  for (const row of tableRows) {
    const key = (row.name || row.test || '').toLowerCase();
    if (!key || map.has(key)) continue;

    // Avoid generic table headers
    if (/^(test|result|unit|reference|parameter|investigation)$/i.test(key)) continue;

    map.set(key, {
      test: row.name || row.test,
      name: row.name || row.test,
      result: row.value || row.result || 'Not detected',
      value: row.value || row.result || 'Not detected',
      unit: row.unit || 'Not detected',
      referenceRange: row.referenceRange || 'Not detected',
      status: row.status || 'Not detected'
    });
  }

  return Array.from(map.values());
}

/**
 * Full analysis pipeline given extracted text from document processor.
 *
 * @param {string} text Raw text
 * @param {string} [notes] Optional user notes
 * @param {Object} [options] Analysis options
 */
function analyzeReport(text, notes = '', options = {}) {
  const combinedText = `${text} ${notes}`.trim();
  const patientInfo = parsePatientInfo(combinedText);
  const medicalInfo = parseMedicalInfo(combinedText);
  const extractedTable = parseTableLines(text);

  const safeDefault = {
    biomarkers: {},
    findings: [],
    unverifiedFindings: [],
    wellnessConcerns: [],
    healthScores: { categories: {}, overall: 100, overallLabel: 'Good' },
    foodProfile: { foodsToLimit: [], foodsToPrefer: [], recommendedNutrients: [], unverifiedFoodRestrictions: [] },
    summary: 'Report processed. Review the extracted test values and patient information below.',
    analysisConfidence: 0,
    analysisFailed: false,
    patientInfo,
    medicalInfo,
    testResults: extractedTable,
    extractedTable,
    rawOcrText: text
  };

  try {
    const extractedData = extractBiomarkers(combinedText, options);
    const allFindings = generateFindings(extractedData);
    const testResults = buildUnifiedTestResults(allFindings, extractedTable);

    const verifiedFindings = allFindings.filter(f => f.confidence !== CONFIDENCE_LEVELS.LOW);
    const unverifiedFindings = allFindings.filter(f => f.confidence === CONFIDENCE_LEVELS.LOW);

    const wellnessConcerns = inferWellnessConcerns(verifiedFindings);
    const healthScores = calculateHealthScores(allFindings);
    const foodProfile = buildFoodProfile(allFindings);

    const analysisConfidence = Math.min(100, Math.max(30, 40 + testResults.length * 10));

    let summary;
    if (testResults.length === 0) {
      summary = 'Document text processed. No standard numerical lab test values could be parsed.';
    } else {
      const abnormalCount = testResults.filter(t => t.status === 'High' || t.status === 'Low' || t.status === 'Critical').length;
      if (abnormalCount === 0) {
        summary = `Extracted ${testResults.length} test parameter${testResults.length > 1 ? 's' : ''}. All identified values appear within standard reference ranges.`;
      } else {
        summary = `Extracted ${testResults.length} test parameter${testResults.length > 1 ? 's' : ''}, with ${abnormalCount} flagged for review. Please consult a qualified physician for clinical assessment.`;
      }
    }

    const biomarkerSummaryMap = {};
    for (const [k, v] of Object.entries(extractedData)) {
      biomarkerSummaryMap[k] = v.value;
    }

    return {
      biomarkers: biomarkerSummaryMap,
      findings: verifiedFindings,
      unverifiedFindings,
      wellnessConcerns,
      healthScores,
      foodProfile,
      summary,
      analysisConfidence,
      analysisFailed: false,
      patientInfo,
      medicalInfo,
      testResults,
      extractedTable: testResults,
      rawOcrText: text
    };
  } catch (err) {
    console.error('medicalAnalysisService: analysis error (safe catch):', err.message);
    return { ...safeDefault, analysisFailed: true };
  }
}

/**
 * Legacy compatibility shim.
 */
function extractBiomarkersAndRecommendations(notes = '', filename = '', options = {}) {
  const result = analyzeReport('', notes, options);
  return {
    summary:          result.summary,
    findings:         result.findings,
    unverifiedFindings: result.unverifiedFindings,
    risks:            result.wellnessConcerns.map(c => c.tag),
    recommendedFoods: result.foodProfile.foodsToPrefer,
    avoidFoods:       result.foodProfile.foodsToLimit,
    analysisFailed:   result.analysisFailed
  };
}

module.exports = {
  analyzeReport,
  extractBiomarkersAndRecommendations,
  REFERENCE_RANGES,
  FOOD_RULES
};
