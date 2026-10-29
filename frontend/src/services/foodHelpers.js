// ─────────────────────────────────────────────────────────────
//  src/services/foodHelpers.js
//  Centralized Image Resolution, Nutri-Score Derivation,
//  and Food Categorization/Filtering Rules
// ─────────────────────────────────────────────────────────────

// Curated verified Unsplash food photo catalog for consistent, fast rendering
const CURATED_FOOD_IMAGES = {
  // Specific food keywords (lower-cased)
  'oat': 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
  'oats': 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
  'oatmeal': 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
  'banana': 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
  'egg': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
  'boiled egg': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
  'omelette': 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=500&auto=format&fit=crop&q=80',
  'yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  'greek yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  'nut': 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  'nuts': 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  'mixed nuts': 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  'chicken': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  'chicken breast': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  'rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  'brown rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
  'lentil': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'lentils': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'lentil soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'spinach': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  'spinach salad': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'apple': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80',
  'quinoa': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'avocado': 'https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=500&auto=format&fit=crop&q=80',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=500&auto=format&fit=crop&q=80',
  'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=500&auto=format&fit=crop&q=80',
  'paneer': 'https://images.unsplash.com/photo-1567184109411-4779f047c197?w=500&auto=format&fit=crop&q=80',
  'tofu': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
  'chickpea': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80',
  'chana': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80',
  'sprouts': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&auto=format&fit=crop&q=80',
  'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  'salmon': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  'dosa': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
  'idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
  'upma': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=500&auto=format&fit=crop&q=80',
  'poha': 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=500&auto=format&fit=crop&q=80',
  'tea': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=80',
  'chai': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=80',
  'lassi': 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80',
  'bread': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=80',
};

// Curated Category fallback images
const CATEGORY_FALLBACK_IMAGES = {
  breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop&q=80',
  fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&auto=format&fit=crop&q=80',
  fruit: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=500&auto=format&fit=crop&q=80',
  dairy: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
  snacks: 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  snack: 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
  protein: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  grains: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  grain: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
  soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  salads: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  healthy: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
};

// In-memory cache for resolved image URLs
const imageResolutionCache = new Map();

/**
 * Resolves a reliable image URL for a food item across all data schemas.
 *
 * Supports:
 * - food.image, food.imageUrl, food.image_url, food.thumbnail, food.images[0]
 * - Cloudinary public IDs (formatted using REACT_APP_CLOUDINARY_CLOUD_NAME)
 * - Relative upload paths (/uploads/...)
 * - Curated fallback by food name keywords and categories
 *
 * @param {Object} food - Food object
 * @returns {string} - Clean, loadable image URL
 */
export function resolveFoodImage(food) {
  if (!food) return CATEGORY_FALLBACK_IMAGES.default;

  const cacheKey = food.id || food.foodId || food.name;
  if (cacheKey && imageResolutionCache.has(cacheKey)) {
    return imageResolutionCache.get(cacheKey);
  }

  // 1. Check all supported property names
  let rawUrl = 
    food.image ||
    food.imageUrl ||
    food.image_url ||
    food.thumbnail ||
    (Array.isArray(food.images) && food.images.length > 0 ? food.images[0] : null) ||
    food.photo ||
    food.picture ||
    food.image_front_url ||
    food.image_front_small_url ||
    food.image_small_url;

  let resolved = null;

  if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      resolved = trimmed;
    } else if (trimmed.startsWith('/uploads')) {
      // Relative API upload path
      const apiOrigin = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      resolved = `${apiOrigin}${trimmed}`;
    } else if (!trimmed.includes('/') && trimmed.length > 4) {
      // Cloudinary public ID
      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dvuv4dphe';
      resolved = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${trimmed}`;
    }
  }

  // 2. If no valid URL, find curated matching image by name
  if (!resolved) {
    resolved = getCuratedFallbackImage(food);
  }

  if (cacheKey) {
    imageResolutionCache.set(cacheKey, resolved);
  }

  return resolved;
}

/**
 * Returns a curated verified fallback image based on food name or category.
 *
 * @param {Object} food - Food object
 * @returns {string} - Verified image URL
 */
export function getCuratedFallbackImage(food) {
  if (!food) return CATEGORY_FALLBACK_IMAGES.default;

  const nameLower = String(food.name || '').toLowerCase().trim();

  // Keyword match in food name
  for (const [key, url] of Object.entries(CURATED_FOOD_IMAGES)) {
    if (nameLower.includes(key)) {
      return url;
    }
  }

  // Category fallback
  const cat = String(food.category || (Array.isArray(food.categories) ? food.categories[0] : '') || '').toLowerCase().trim();
  if (cat && CATEGORY_FALLBACK_IMAGES[cat]) {
    return CATEGORY_FALLBACK_IMAGES[cat];
  }

  // Tags fallback
  const tags = [
    ...(Array.isArray(food.tags) ? food.tags : []),
    ...(Array.isArray(food.dietTags) ? food.dietTags : []),
    ...(Array.isArray(food.labels) ? food.labels : []),
  ].map(t => String(t).toLowerCase());

  for (const t of tags) {
    if (CATEGORY_FALLBACK_IMAGES[t]) {
      return CATEGORY_FALLBACK_IMAGES[t];
    }
  }

  return CATEGORY_FALLBACK_IMAGES.default;
}

/**
 * Resolves nutritional grade ('A', 'B', 'C', 'D', 'E') for any food.
 * Guarantees a valid grade is returned instead of '?' when nutritional data exists.
 *
 * @param {Object|string} foodOrGrade - Food object or raw grade string
 * @returns {string} - 'A', 'B', 'C', 'D', or 'E'
 */
export function resolveFoodGrade(foodOrGrade) {
  if (!foodOrGrade) return 'B';

  if (typeof foodOrGrade === 'string') {
    const clean = foodOrGrade.trim().toLowerCase();
    if (['a+', 'a'].includes(clean)) return 'A';
    if (clean === 'b') return 'B';
    if (clean === 'c') return 'C';
    if (clean === 'd') return 'D';
    if (clean === 'e') return 'E';
    return clean ? clean.toUpperCase() : 'B';
  }

  const food = foodOrGrade;

  // 1. Check explicit grade fields
  const explicit = food.grade || food.healthGrade || food.nutrition_grades;
  if (typeof explicit === 'string' && explicit !== 'unknown') {
    const clean = explicit.trim().toLowerCase();
    if (['a+', 'a'].includes(clean)) return 'A';
    if (clean === 'b') return 'B';
    if (clean === 'c') return 'C';
    if (clean === 'd') return 'D';
    if (clean === 'e') return 'E';
  }

  // 2. Check healthScore
  if (typeof food.healthScore === 'number') {
    const score = food.healthScore > 10 ? food.healthScore / 10 : food.healthScore;
    if (score >= 8.5) return 'A';
    if (score >= 7.0) return 'B';
    if (score >= 5.5) return 'C';
    if (score >= 4.0) return 'D';
    return 'E';
  }

  // 3. Approximate from calories
  const cal = Number(food.calories);
  if (!isNaN(cal) && cal > 0) {
    if (cal < 150) return 'A';
    if (cal < 250) return 'B';
    if (cal < 350) return 'C';
    if (cal < 450) return 'D';
    return 'E';
  }

  return 'B';
}

/**
 * Multi-signal classification for 'Healthy' food filter.
 *
 * Criteria:
 * 1. Grade A / B / A+ (Nutri-Score)
 * 2. Health score >= 70% (>= 7.0 out of 10 or >= 70 out of 100)
 * 3. Health-positive category or tags ('Healthy', 'Salads', 'Fruits', 'Superfood')
 * 4. Wholesome nutrient profile (low sugar, low sodium, good protein or fiber)
 *
 * Does NOT classify high-sugar or ultra-processed foods as healthy.
 *
 * @param {Object} food - Food item
 * @returns {boolean} - true if healthy
 */
export function isFoodHealthy(food) {
  if (!food) return false;

  // 1. Explicit grade
  const grade = resolveFoodGrade(food);
  if (['A', 'B'].includes(grade)) {
    // Sanity check: Ensure not an outlier ultra-high sugar item
    if (Number(food.sugar) > 30) return false;
    return true;
  }

  // 2. Health score
  if (typeof food.healthScore === 'number') {
    const s = food.healthScore > 10 ? food.healthScore : food.healthScore * 10;
    if (s >= 70) return true;
    if (s < 50) return false;
  }

  // 3. Category & Tags
  const categoryStr = Array.isArray(food.categories)
    ? food.categories.join(' ')
    : (typeof food.category === 'string' ? food.category : '');
  const tagsList = [
    ...(Array.isArray(food.tags) ? food.tags : []),
    ...(Array.isArray(food.dietTags) ? food.dietTags : []),
    ...(Array.isArray(food.labels) ? food.labels : []),
  ];
  const combined = `${categoryStr} ${tagsList.join(' ')}`.toLowerCase();
  if (combined.includes('healthy') || combined.includes('superfood') || combined.includes('salad') || combined.includes('fruit')) {
    return true;
  }

  // 4. Nutrient density computation
  const calories = Number(food.calories) || 0;
  const protein = Number(food.protein) || 0;
  const fiber = Number(food.fiber) || 0;
  const sugar = Number(food.sugar) || 0;
  const sodium = Number(food.sodium) || 0;

  let score = 5.0;
  score += Math.min(2.0, protein * 0.2);
  score += Math.min(2.0, fiber * 0.4);
  score -= Math.min(2.5, sugar * 0.15);
  score -= Math.min(1.5, sodium * 0.002);
  if (calories > 450 && fiber < 2 && protein < 5) score -= 1.5;

  return score >= 6.0;
}

/**
 * Checks if food qualifies for 'Protein' category (protein >= 8g or protein tag).
 */
export function isFoodProtein(food) {
  if (!food) return false;
  if ((Number(food.protein) || 0) >= 8) return true;

  const tags = [
    ...(Array.isArray(food.tags) ? food.tags : []),
    ...(Array.isArray(food.dietTags) ? food.dietTags : []),
    ...(Array.isArray(food.labels) ? food.labels : []),
  ].map(t => String(t).toLowerCase());

  return tags.some(t => t.includes('protein'));
}

/**
 * Checks if food qualifies for 'Low Carb' category (carbs <= 20g or low-carb/keto tag).
 */
export function isFoodLowCarb(food) {
  if (!food) return false;
  if (food.carbs !== undefined && food.carbs !== null && !isNaN(Number(food.carbs))) {
    if (Number(food.carbs) <= 20) return true;
  }

  const tags = [
    ...(Array.isArray(food.tags) ? food.tags : []),
    ...(Array.isArray(food.dietTags) ? food.dietTags : []),
    ...(Array.isArray(food.labels) ? food.labels : []),
  ].map(t => String(t).toLowerCase());

  return tags.some(t => t.includes('low-carb') || t.includes('low carb') || t.includes('keto'));
}

/**
 * Checks if food qualifies for 'Vegan' category.
 */
export function isFoodVegan(food) {
  if (!food) return false;

  const allergens = (Array.isArray(food.allergens) ? food.allergens : []).map(a => String(a).toLowerCase());
  if (allergens.some(a => ['milk', 'dairy', 'egg', 'eggs', 'fish', 'meat', 'crustaceans'].some(x => a.includes(x)))) {
    return false;
  }

  const labels = Array.isArray(food.labels) ? food.labels : [];
  const tags = Array.isArray(food.tags) ? food.tags : [];
  const dietTags = Array.isArray(food.dietTags) ? food.dietTags : [];
  const dietType = Array.isArray(food.dietType)
    ? food.dietType
    : (typeof food.dietType === 'string' ? [food.dietType] : []);
  const category = typeof food.category === 'string' ? [food.category] : [];

  const combined = [...labels, ...tags, ...dietTags, ...dietType, ...category]
    .map(t => String(t || '').toLowerCase());

  if (combined.some(t => t.includes('vegan'))) {
    return true;
  }

  const nameLower = String(food.name || '').toLowerCase();
  if (nameLower.includes('vegan')) return true;

  // Pure plant fruits, salads, grains with no non-vegan ingredients
  const cat = String(food.category || '').toLowerCase();
  if (['fruits', 'grains', 'salads'].includes(cat) && !allergens.includes('milk') && !allergens.includes('egg')) {
    return true;
  }

  return false;
}

/**
 * Filter foods array by category ID.
 * Returns a new array without mutating original foods.
 *
 * @param {Array<Object>} foods - List of food items
 * @param {string} categoryId - 'all' | 'healthy' | 'protein' | 'lowcarb' | 'vegan'
 * @returns {Array<Object>} - Filtered list
 */
export function filterByCategory(foods, categoryId) {
  if (!Array.isArray(foods)) return [];
  const cat = String(categoryId || 'all').toLowerCase().trim();

  if (cat === 'all') return [...foods];
  if (cat === 'healthy') return foods.filter(isFoodHealthy);
  if (cat === 'protein') return foods.filter(isFoodProtein);
  if (cat === 'lowcarb') return foods.filter(isFoodLowCarb);
  if (cat === 'vegan') return foods.filter(isFoodVegan);

  return [...foods];
}
