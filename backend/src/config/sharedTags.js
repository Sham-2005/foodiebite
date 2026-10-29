/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/config/sharedTags.js
 *  FoodieBite — Shared Controlled Vocabulary (Phase 0 Foundation)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Single source of truth for condition, diet, and allergen vocabulary
 *  used by BOTH the medical rules engine and the food data model.
 *
 *  IMPORTANT:
 *  No other file in the application should define or hardcode condition,
 *  diet, or allergen tag strings independently. Any tag used across the
 *  system must be registered in this controlled vocabulary.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Flat list of all medical / wellness condition tags.
 * Derived from biomarkers extracted in medicalAnalysisService.js.
 */
const CONDITION_TAGS = Object.freeze([
  'diabetic',
  'prediabetic',
  'hypoglycemia',
  'high-cholesterol',
  'high-ldl',
  'low-hdl',
  'high-triglycerides',
  'low-sodium-required',
  'kidney-disease',
  'gout-risk',
  'hypothyroid',
  'hyperthyroid',
  'anemia',
  'iron-deficiency',
  'vitamin-d-deficient',
  'vitamin-b12-deficient',
  'liver-concern',
  'fatty-liver',
  'overweight',
  'obesity-risk',
  'underweight',
  'hypertension',
  'cardiovascular-risk',
  'dehydration-concern'
]);

/**
 * Flat list of all dietary classification and food property tags.
 */
const DIET_TAGS = Object.freeze([
  'vegetarian',
  'vegan',
  'eggetarian',
  'non-vegetarian',
  'gluten-free',
  'keto',
  'dairy-free',
  'low-carb',
  'high-protein',
  'low-protein',
  'high-fiber',
  'low-fiber',
  'low-fat',
  'refined-sugar',
  'high-sugar',
  'low-sugar',
  'high-glycemic',
  'lower-glycemic',
  'low-gi',
  'high-saturated-fat',
  'low-saturated-fat',
  'trans-fat',
  'tea-coffee-with-meals',
  'iron-rich',
  'vitamin-c-rich',
  'vitamin-d-rich',
  'vitamin-b12-rich',
  'high-sodium',
  'low-sodium',
  'antioxidant-rich',
  'omega-3-rich',
  'high-purine',
  'low-purine'
]);

/**
 * Flat list of all allergen classification tags.
 */
const ALLERGEN_TAGS = Object.freeze([
  'nuts',
  'peanuts',
  'tree-nuts',
  'soy',
  'sesame',
  'mustard',
  'dairy',
  'milk',
  'eggs',
  'fish',
  'shellfish',
  'crustaceans',
  'gluten',
  'wheat'
]);

// Enum-like mapping objects for programmatic access
const CONDITION_TAG_ENUM = Object.freeze(
  CONDITION_TAGS.reduce((acc, tag) => {
    const key = tag.toUpperCase().replace(/-/g, '_');
    acc[key] = tag;
    return acc;
  }, {})
);

const DIET_TAG_ENUM = Object.freeze(
  DIET_TAGS.reduce((acc, tag) => {
    const key = tag.toUpperCase().replace(/-/g, '_');
    acc[key] = tag;
    return acc;
  }, {})
);

const ALLERGEN_TAG_ENUM = Object.freeze(
  ALLERGEN_TAGS.reduce((acc, tag) => {
    const key = tag.toUpperCase().replace(/-/g, '_');
    acc[key] = tag;
    return acc;
  }, {})
);

// Lookup sets for high-performance validation
const CONDITION_TAG_SET = new Set(CONDITION_TAGS);
const DIET_TAG_SET = new Set(DIET_TAGS);
const ALLERGEN_TAG_SET = new Set(ALLERGEN_TAGS);
const ALL_TAGS_SET = new Set([...CONDITION_TAGS, ...DIET_TAGS, ...ALLERGEN_TAGS]);

/**
 * Validates a condition tag against the controlled vocabulary.
 * Throws a descriptive error if the tag is invalid.
 *
 * @param {string} tag - Condition tag string to validate
 * @returns {boolean} True if valid
 */
function validateConditionTag(tag) {
  if (!CONDITION_TAG_SET.has(tag)) {
    throw new Error(
      `[SharedTags Error] Invalid condition tag: "${tag}". Must be one of: ${CONDITION_TAGS.join(', ')}`
    );
  }
  return true;
}

/**
 * Validates a diet tag against the controlled vocabulary.
 * Throws a descriptive error if the tag is invalid.
 *
 * @param {string} tag - Diet tag string to validate
 * @returns {boolean} True if valid
 */
function validateDietTag(tag) {
  if (!DIET_TAG_SET.has(tag)) {
    throw new Error(
      `[SharedTags Error] Invalid diet tag: "${tag}". Must be one of: ${DIET_TAGS.join(', ')}`
    );
  }
  return true;
}

/**
 * Validates an allergen tag against the controlled vocabulary.
 * Throws a descriptive error if the tag is invalid.
 *
 * @param {string} tag - Allergen tag string to validate
 * @returns {boolean} True if valid
 */
function validateAllergenTag(tag) {
  if (!ALLERGEN_TAG_SET.has(tag)) {
    throw new Error(
      `[SharedTags Error] Invalid allergen tag: "${tag}". Must be one of: ${ALLERGEN_TAGS.join(', ')}`
    );
  }
  return true;
}

/**
 * Validates a tag or list of tags against the shared controlled vocabulary.
 * Throws an Error if any tag is not present in the allowed registry.
 *
 * @param {string|string[]} tags - Single tag string or array of tag strings to validate
 * @param {('condition'|'diet'|'allergen')} [category] - Optional tag category constraint
 * @returns {boolean} True if valid
 */
function validateTag(tags, category = null) {
  const tagList = Array.isArray(tags) ? tags : [tags];

  for (const tag of tagList) {
    if (typeof tag !== 'string' || !tag.trim()) {
      throw new Error(`[SharedTags Error] Tag must be a non-empty string. Received: ${typeof tag}`);
    }
    const cleanTag = tag.trim().toLowerCase();

    if (category === 'condition') {
      validateConditionTag(cleanTag);
    } else if (category === 'diet') {
      validateDietTag(cleanTag);
    } else if (category === 'allergen') {
      validateAllergenTag(cleanTag);
    } else {
      if (!ALL_TAGS_SET.has(cleanTag)) {
        throw new Error(
          `[SharedTags Error] Invalid tag: "${cleanTag}". Tag is not registered in sharedTags controlled vocabulary.`
        );
      }
    }
  }

  return true;
}

/**
 * Non-throwing boolean check for condition tags.
 */
function isValidConditionTag(tag) {
  return CONDITION_TAG_SET.has(typeof tag === 'string' ? tag.trim().toLowerCase() : '');
}

/**
 * Non-throwing boolean check for diet tags.
 */
function isValidDietTag(tag) {
  return DIET_TAG_SET.has(typeof tag === 'string' ? tag.trim().toLowerCase() : '');
}

/**
 * Non-throwing boolean check for allergen tags.
 */
function isValidAllergenTag(tag) {
  return ALLERGEN_TAG_SET.has(typeof tag === 'string' ? tag.trim().toLowerCase() : '');
}

/**
 * Non-throwing boolean check for any tag in shared vocabulary.
 */
function isValidTag(tag) {
  return ALL_TAGS_SET.has(typeof tag === 'string' ? tag.trim().toLowerCase() : '');
}

module.exports = {
  CONDITION_TAGS,
  DIET_TAGS,
  ALLERGEN_TAGS,
  CONDITION_TAG_ENUM,
  DIET_TAG_ENUM,
  ALLERGEN_TAG_ENUM,
  validateTag,
  validateConditionTag,
  validateDietTag,
  validateAllergenTag,
  isValidTag,
  isValidConditionTag,
  isValidDietTag,
  isValidAllergenTag
};
