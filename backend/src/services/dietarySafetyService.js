/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/dietarySafetyService.js
 *  Centralized, cross-engine dietary safety & compatibility evaluator.
 *  Enforces strict dietary exclusions across both catalog & AI recommendation engines.
 * ─────────────────────────────────────────────────────────────
 */

const MEAT_FISH_KEYWORDS = [
  'chicken', 'mutton', 'beef', 'pork', 'lamb', 'goat', 'turkey', 'veal', 'duck',
  'bacon', 'ham', 'sausage', 'pepperoni', 'salami', 'meat', 'poultry',
  'fish', 'seafood', 'salmon', 'tuna', 'sardine', 'sardines', 'cod', 'prawn', 'prawns',
  'shrimp', 'crab', 'lobster', 'oyster', 'anchovy', 'anchovies', 'clam', 'squid',
  'mackerel', 'tilapia', 'surmai', 'rohu', 'katla', 'pomfret', 'hilsa'
];

const EGG_KEYWORDS = ['egg', 'eggs', 'anda', 'omelette', 'omelet', 'bhurji', 'mayonnaise'];

const DAIRY_AND_ANIMAL_KEYWORDS = [
  'milk', 'dairy', 'cheese', 'butter', 'ghee', 'paneer', 'yogurt', 'curd',
  'dahi', 'cream', 'whey', 'casein', 'honey', 'gelatin'
];

/**
 * Checks if a food item is compatible with the given user diet type.
 * Evaluates dataset dietTags, boolean flags (vegan, vegetarian, eggetarian),
 * labels, allergens, and keyword tokens.
 *
 * @param {Object} food - The candidate food object
 * @param {string} userDietType - User's diet preference (e.g. 'Vegan', 'Vegetarian', 'Eggetarian', 'Non-Vegetarian')
 * @returns {boolean} True if safe and compatible; false if it must be strictly excluded.
 */
function isDietCompatible(food, userDietType) {
  if (!food || typeof food !== 'object') return false;
  if (!userDietType) return true;

  const rawDiet = String(userDietType).toLowerCase().trim().replace(/[\s_-]+/g, '');

  // Non-vegetarian has no dietary restrictions
  if (rawDiet === 'nonvegetarian' || rawDiet === 'nonveg') {
    return true;
  }

  const nameLower = (food.name || '').toLowerCase();
  const allergensLower = (food.allergens || []).map(a => String(a).toLowerCase());
  const labelsLower = (food.labels || food.labels_tags || []).map(l => String(l).toLowerCase());
  const dietTags = (food.dietTags || []).map(t => String(t).toLowerCase());

  // Check meat / fish keyword using word boundary
  const hasMeatFishKeyword = MEAT_FISH_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(nameLower);
  });

  const hasMeatFishAllergen = allergensLower.some(a => 
    a.includes('fish') || a.includes('crustacean') || a.includes('mollusc') || a.includes('meat')
  );

  const hasNonVegLabel = labelsLower.some(l => 
    l.includes('non-vegetarian') || l.includes('en:non-vegetarian') || l.includes('meat') || l.includes('fish')
  );

  // ── 1. VEGAN ───────────────────────────────────────────────
  if (rawDiet === 'vegan') {
    if (food.vegan === false) return false;
    if (food.vegetarian === false) return false;

    // Check dataset dietTags (FALLBACK_FOODS)
    if (dietTags.length > 0 && !dietTags.includes('vegan')) {
      return false;
    }

    // Must not contain meat or fish
    if (hasMeatFishKeyword || hasMeatFishAllergen || hasNonVegLabel) return false;

    // Must not contain eggs
    if (allergensLower.some(a => a.includes('egg'))) return false;
    if (EGG_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower))) return false;

    // Must not contain dairy or animal-derived products
    if (allergensLower.some(a => a.includes('milk') || a.includes('dairy'))) return false;
    if (DAIRY_AND_ANIMAL_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nameLower))) return false;
    if (labelsLower.some(l => l.includes('milk') || l.includes('cheese') || l.includes('butter') || l.includes('egg') || l.includes('dairy'))) return false;

    return true;
  }

  // ── 2. VEGETARIAN ──────────────────────────────────────────
  if (rawDiet === 'vegetarian' || rawDiet === 'veg') {
    if (food.vegetarian === false) return false;

    // Check dataset dietTags
    if (dietTags.length > 0 && !dietTags.includes('vegetarian')) {
      return false;
    }

    // Must not contain meat or fish
    if (hasMeatFishKeyword || hasMeatFishAllergen || hasNonVegLabel) return false;

    // In FoodieBite schema, egg-only dishes are eggetarian, not vegetarian
    if (food.eggetarian && !food.vegetarian) return false;
    if (allergensLower.some(a => a.includes('egg')) && !dietTags.includes('vegetarian')) return false;

    return true;
  }

  // ── 3. EGGETARIAN ──────────────────────────────────────────
  if (rawDiet === 'eggetarian') {
    if (food.vegetarian === false && food.eggetarian === false) return false;

    // Check dataset dietTags
    if (dietTags.length > 0 && !dietTags.includes('eggetarian') && !dietTags.includes('vegetarian')) {
      return false;
    }

    // Must not contain meat or fish (eggs are allowed)
    if (hasMeatFishKeyword || hasMeatFishAllergen || hasNonVegLabel) return false;

    return true;
  }

  return true;
}

module.exports = {
  isDietCompatible,
  MEAT_FISH_KEYWORDS,
  EGG_KEYWORDS,
  DAIRY_AND_ANIMAL_KEYWORDS
};
