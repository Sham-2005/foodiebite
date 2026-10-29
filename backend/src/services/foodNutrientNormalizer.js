/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/foodNutrientNormalizer.js
 *  FoodieBite — OpenFoodFacts Medical Nutrient Normalizer (Phase 3)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Normalizes raw food products (e.g., from OpenFoodFacts or external APIs)
 *  into the canonical FoodieBite nutrient profile and medical dietary tags.
 *
 *  CRITICAL SAFETY RULES:
 *  1. Non-destructive: Does NOT mutate the input object.
 *  2. Safe Null Handling: Missing data is strictly `null` (Unknown), NEVER assumed to be 0.
 *  3. No False Tags: Tags (e.g. low-sodium) are generated ONLY when sufficient
 *     verified nutrient data is present. Missing sodium NEVER gets "low-sodium".
 *  4. No Invented Labs: Glycemic index is left as `null` if not explicitly present.
 *  5. Configurable Thresholds: Standard clinical & nutritional reference limits.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { normalizeFoodName } = require('./foodNameNormalizer');

/**
 * Standard Nutritional Reference Thresholds (per 100g of food).
 * Based on international guidelines (WHO / UK FSA / FDA food labelling standards).
 * Kept configurable and documented.
 */
const NUTRIENT_THRESHOLDS = Object.freeze({
  sodium: {
    // Low: <= 120mg / 100g (0.12g sodium)
    lowMax: 120,
    // High: > 600mg / 100g (0.6g sodium / 1.5g salt)
    highMin: 600
  },
  saturatedFat: {
    // Low: <= 1.5g / 100g
    lowMax: 1.5,
    // High: > 5.0g / 100g
    highMin: 5.0
  },
  sugar: {
    // Low: <= 5.0g / 100g
    lowMax: 5.0,
    // High: > 15.0g / 100g
    highMin: 15.0
  },
  fiber: {
    // Low: < 1.5g / 100g
    lowMax: 1.5,
    // High: >= 6.0g / 100g (or high-fiber claim threshold)
    highMin: 6.0
  },
  protein: {
    // Low: < 3.0g / 100g
    lowMax: 3.0,
    // High: >= 10.0g / 100g
    highMin: 10.0
  }
});

/**
 * Safely parses a raw nutrient value into a number or null.
 * Strictly preserves 0 as a valid measurement and distinguishes it from null (missing).
 *
 * @param {*} val - Raw value from product nutriments
 * @returns {number|null} Parsed numeric value or null if absent/invalid
 */
function parseNutrientValue(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(num) || !isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Extracts and normalizes raw OpenFoodFacts nutrients into a standard nutrition record.
 * Missing fields remain null, NEVER coerced to 0.
 *
 * @param {Object} rawNutriments - `raw.nutriments` object from OpenFoodFacts
 * @returns {Object} Structured nutrition object
 */
function normalizeNutrients(rawNutriments = {}) {
  const n = rawNutriments || {};

  const calories = parseNutrientValue(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n.calories);
  const protein = parseNutrientValue(n['proteins_100g'] ?? n.proteins ?? n.protein);
  const carbs = parseNutrientValue(n['carbohydrates_100g'] ?? n.carbohydrates ?? n.carbs);
  const fat = parseNutrientValue(n['fat_100g'] ?? n.fat);
  const saturatedFat = parseNutrientValue(n['saturated-fat_100g'] ?? n['saturated-fat'] ?? n.saturatedFat);
  const fiber = parseNutrientValue(n['fiber_100g'] ?? n.fiber);
  const sugar = parseNutrientValue(n['sugars_100g'] ?? n.sugars ?? n.sugar);

  // Sodium handling:
  // OpenFoodFacts typically reports `sodium_100g` in GRAMS.
  // We normalize sodium to MILLIGRAMS (mg).
  // If sodium is missing but salt is present: salt (g) * 400 ≈ sodium (mg).
  let sodium = null;
  const rawSodium = n['sodium_100g'] ?? n.sodium;
  const rawSalt = n['salt_100g'] ?? n.salt;

  if (rawSodium !== undefined && rawSodium !== null && rawSodium !== '') {
    const parsedSodium = parseNutrientValue(rawSodium);
    if (parsedSodium !== null) {
      // If the value is tiny (< 10), it's almost certainly in grams (OFF standard)
      // If it's already large (>= 10), check if it's already in mg
      sodium = parsedSodium <= 10 ? Math.round(parsedSodium * 1000) : Math.round(parsedSodium);
    }
  } else if (rawSalt !== undefined && rawSalt !== null && rawSalt !== '') {
    const parsedSalt = parseNutrientValue(rawSalt);
    if (parsedSalt !== null) {
      // 1g salt ≈ 400mg sodium
      sodium = Math.round(parsedSalt * 400);
    }
  }

  const salt = parseNutrientValue(rawSalt) ?? (sodium !== null ? Math.round((sodium / 400) * 10) / 10 : null);

  return {
    calories,
    protein,
    carbs,
    fiber,
    fat,
    saturatedFat,
    sugar,
    sodium,
    salt
  };
}

/**
 * Builds the categorical FoodieBite nutrientProfile ('high' | 'medium' | 'low' | null).
 * Missing nutrients yield null (unknown).
 *
 * @param {Object} nutrition - Normalized nutrition object
 * @returns {Object} Categorical nutrient profile
 */
function buildNutrientProfile(nutrition) {
  if (!nutrition) {
    return {
      glycemicIndex: null,
      fiber: null,
      protein: null,
      sodium: null,
      saturatedFat: null,
      sugar: null
    };
  }

  // Fiber
  let fiber = null;
  if (nutrition.fiber !== null) {
    if (nutrition.fiber >= NUTRIENT_THRESHOLDS.fiber.highMin) fiber = 'high';
    else if (nutrition.fiber <= NUTRIENT_THRESHOLDS.fiber.lowMax) fiber = 'low';
    else fiber = 'medium';
  }

  // Protein
  let protein = null;
  if (nutrition.protein !== null) {
    if (nutrition.protein >= NUTRIENT_THRESHOLDS.protein.highMin) protein = 'high';
    else if (nutrition.protein <= NUTRIENT_THRESHOLDS.protein.lowMax) protein = 'low';
    else protein = 'medium';
  }

  // Sodium
  let sodium = null;
  if (nutrition.sodium !== null) {
    if (nutrition.sodium > NUTRIENT_THRESHOLDS.sodium.highMin) sodium = 'high';
    else if (nutrition.sodium <= NUTRIENT_THRESHOLDS.sodium.lowMax) sodium = 'low';
    else sodium = 'medium';
  }

  // Saturated Fat
  let saturatedFat = null;
  if (nutrition.saturatedFat !== null) {
    if (nutrition.saturatedFat > NUTRIENT_THRESHOLDS.saturatedFat.highMin) saturatedFat = 'high';
    else if (nutrition.saturatedFat <= NUTRIENT_THRESHOLDS.saturatedFat.lowMax) saturatedFat = 'low';
    else saturatedFat = 'medium';
  }

  // Sugar
  let sugar = null;
  if (nutrition.sugar !== null) {
    if (nutrition.sugar > NUTRIENT_THRESHOLDS.sugar.highMin) sugar = 'high';
    else if (nutrition.sugar <= NUTRIENT_THRESHOLDS.sugar.lowMax) sugar = 'low';
    else sugar = 'medium';
  }

  return {
    glycemicIndex: null, // Never invent GI without laboratory metadata
    fiber,
    protein,
    sodium,
    saturatedFat,
    sugar
  };
}

/**
 * Derives conditionTags ({ prefer: string[], avoid: string[] }) and dietTags.
 * Generates tags ONLY when sufficient nutrient data exists.
 *
 * @param {Object} nutrientProfile - Categorical nutrient profile
 * @param {Object} nutrition - Numeric nutrition object
 * @returns {{ prefer: string[], avoid: string[], dietTags: string[] }}
 */
function deriveConditionAndDietTags(nutrientProfile, nutrition) {
  const prefer = new Set();
  const avoid = new Set();
  const dietTags = new Set();

  if (!nutrientProfile || !nutrition) {
    return { prefer: [], avoid: [], dietTags: [] };
  }

  // ── Sodium ───────────────────────────────────────────────────
  if (nutrientProfile.sodium === 'low') {
    prefer.add('low-sodium');
    dietTags.add('low-sodium');
  } else if (nutrientProfile.sodium === 'high') {
    avoid.add('high-sodium');
    dietTags.add('high-sodium');
  }

  // ── Fiber ────────────────────────────────────────────────────
  if (nutrientProfile.fiber === 'high') {
    prefer.add('high-fiber');
    dietTags.add('high-fiber');
  } else if (nutrientProfile.fiber === 'low') {
    dietTags.add('low-fiber');
  }

  // ── Saturated Fat ─────────────────────────────────────────────
  if (nutrientProfile.saturatedFat === 'low') {
    prefer.add('low-saturated-fat');
    dietTags.add('low-saturated-fat');
  } else if (nutrientProfile.saturatedFat === 'high') {
    avoid.add('high-saturated-fat');
    dietTags.add('high-saturated-fat');
  }

  // Total Fat
  if (nutrition.fat !== null) {
    if (nutrition.fat <= 3.0) {
      dietTags.add('low-fat');
    }
  }

  // ── Sugar & Glycemic Indicators ──────────────────────────────
  if (nutrientProfile.sugar === 'low') {
    prefer.add('low-sugar');
    dietTags.add('low-sugar');
    // If sugar is low AND fiber is high (or medium), favorable glycemic profile
    if (nutrientProfile.fiber === 'high' || nutrientProfile.fiber === 'medium') {
      prefer.add('low-gi');
      prefer.add('lower-glycemic');
      dietTags.add('low-gi');
      dietTags.add('lower-glycemic');
    }
  } else if (nutrientProfile.sugar === 'high') {
    avoid.add('refined-sugar');
    avoid.add('high-sugar');
    avoid.add('high-glycemic');
    dietTags.add('refined-sugar');
    dietTags.add('high-sugar');
    dietTags.add('high-glycemic');
  }

  // ── Protein ──────────────────────────────────────────────────
  if (nutrientProfile.protein === 'high') {
    prefer.add('high-protein');
    dietTags.add('high-protein');
  } else if (nutrientProfile.protein === 'low') {
    dietTags.add('low-protein');
  }

  return {
    prefer: [...prefer],
    avoid: [...avoid],
    dietTags: [...dietTags]
  };
}

/**
 * Safely derives context metadata from raw OpenFoodFacts categories and metadata.
 * Strictly adheres to rule: never fabricate weather, seasonal, or fasting suitability
 * when source data lacks evidence (leaves as empty array / null / unknown).
 *
 * @param {Object} raw - Raw product record
 * @returns {Object} Contextual tags
 */
function deriveContextTags(raw = {}) {
  const categories = Array.isArray(raw.categories_tags)
    ? raw.categories_tags.map(c => String(c).toLowerCase())
    : (typeof raw.categories === 'string' ? raw.categories.toLowerCase().split(',').map(s => s.trim()) : []);

  const mealTypes = new Set();
  for (const cat of categories) {
    if (cat.includes('breakfast') || cat.includes('cereal') || cat.includes('pancake') || cat.includes('waffle')) {
      mealTypes.add('breakfast');
    }
    if (cat.includes('snack') || cat.includes('biscuit') || cat.includes('cookie') || cat.includes('bar') || cat.includes('cracker') || cat.includes('chip')) {
      mealTypes.add('morning_snack');
      mealTypes.add('evening_snack');
    }
    if (cat.includes('meal') || cat.includes('dish') || cat.includes('entree') || cat.includes('soup') || cat.includes('salad') || cat.includes('curry')) {
      mealTypes.add('lunch');
      mealTypes.add('dinner');
    }
  }

  const cuisines = new Set();
  const origins = Array.isArray(raw.origins_tags) ? raw.origins_tags : [];
  const countries = Array.isArray(raw.countries_tags) ? raw.countries_tags : [];
  for (const item of [...origins, ...countries]) {
    const s = String(item).toLowerCase();
    if (s.includes('india')) cuisines.add('indian');
    if (s.includes('ital')) cuisines.add('italian');
    if (s.includes('mexic')) cuisines.add('mexican');
    if (s.includes('china') || s.includes('chine')) cuisines.add('chinese');
    if (s.includes('japan')) cuisines.add('japanese');
    if (s.includes('thai')) cuisines.add('thai');
  }

  return {
    mealTypes: [...mealTypes],
    weatherTags: [], // Kept empty — never fabricate weather suitability
    seasonalTags: [], // Kept empty — never fabricate seasonality
    fastingTags: [], // Kept empty — never fabricate fasting suitability
    cuisineTags: [...cuisines],
    spiceLevel: null,
    availability: 'unknown'
  };
}

/**
 * Normalizes an OpenFoodFacts product record into a complete FoodieBite food object.
 * Non-destructive: Does not alter `raw`.
 *
 * @param {Object} raw - Raw product record from OpenFoodFacts or API
 * @returns {Object|null} Normalized FoodieBite food item or null if invalid
 */
function normalizeOffProduct(raw) {
  if (!raw || (!raw.product_name && !raw.name)) return null;

  const nutrition = normalizeNutrients(raw.nutriments || raw.nutrition || {});
  const nutrientProfile = buildNutrientProfile(nutrition);
  const { prefer, avoid, dietTags } = deriveConditionAndDietTags(nutrientProfile, nutrition);
  const contextMeta = deriveContextTags(raw);

  // Preserve existing allergens & labels if present
  const allergens = Array.isArray(raw.allergens_tags)
    ? raw.allergens_tags.map(a => a.replace(/^[a-z]{2}:/, '').trim().toLowerCase())
    : (Array.isArray(raw.allergens) ? raw.allergens : []);

  const labels = Array.isArray(raw.labels_tags)
    ? raw.labels_tags.map(l => l.replace(/^[a-z]{2}:/, '').trim().toLowerCase())
    : (Array.isArray(raw.labels) ? raw.labels : []);

  // Merge derived diet tags with existing labels/dietTags
  const combinedDietTags = new Set([...dietTags, ...(raw.dietTags || [])]);

  const rawNameStr = raw.product_name || raw.name || 'Nutritious Meal';
  const cleanEnglishName = normalizeFoodName(rawNameStr);

  return {
    id: raw.id || raw._id || raw.code || String(Math.random()),
    name: cleanEnglishName,
    displayName: cleanEnglishName,
    originalName: rawNameStr,
    image: raw.image_url || raw.image || null,
    nutrition,
    nutrientProfile,
    conditionTags: {
      prefer,
      avoid
    },
    dietTags: [...combinedDietTags],
    allergens,
    labels,
    quantity: raw.quantity || '',
    grade: raw.nutrition_grades || raw.grade || 'unknown',
    source: raw.source || 'openfoodfacts',
    // Phase 4 Contextual metadata
    mealTypes: contextMeta.mealTypes,
    weatherTags: contextMeta.weatherTags,
    seasonalTags: contextMeta.seasonalTags,
    fastingTags: contextMeta.fastingTags,
    cuisineTags: contextMeta.cuisineTags,
    spiceLevel: contextMeta.spiceLevel,
    availability: contextMeta.availability,
    contextTags: {
      weather: [],
      mood: []
    },
    // Root level nutrition attributes for legacy backward compatibility
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    saturatedFat: nutrition.saturatedFat,
    fiber: nutrition.fiber,
    sugar: nutrition.sugar,
    sodium: nutrition.sodium
  };
}

module.exports = {
  NUTRIENT_THRESHOLDS,
  parseNutrientValue,
  normalizeNutrients,
  buildNutrientProfile,
  deriveConditionAndDietTags,
  deriveContextTags,
  normalizeOffProduct
};
