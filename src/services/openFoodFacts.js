// ─────────────────────────────────────────────────────────────
//  services/openFoodFacts.js
//  All Open Food Facts API calls + filter + rank logic
// ─────────────────────────────────────────────────────────────

const BASE = 'https://world.openfoodfacts.org';

// ── Category search terms mapped to diet/lifestyle ──────────
const DIET_SEARCH_TERMS = {
  Vegetarian:        ['vegetable salad', 'paneer', 'lentil soup', 'tofu', 'chickpea', 'quinoa', 'yogurt'],
  Vegan:             ['vegan salad', 'tofu', 'chickpea', 'lentil', 'quinoa', 'almond milk', 'soy'],
  Eggetarian:        ['egg salad', 'omelette', 'egg protein', 'egg bowl', 'scrambled egg'],
  'Non-Vegetarian':  ['chicken salad', 'grilled chicken', 'tuna', 'salmon', 'turkey', 'lean beef'],
  'Non Vegetarian':  ['chicken salad', 'grilled chicken', 'tuna', 'salmon', 'turkey', 'lean beef'],
  Keto:              ['keto', 'avocado', 'almond', 'low carb', 'cheese', 'bacon'],
  'Diabetic Friendly': ['low sugar', 'oat bran', 'whole grain', 'diabetic', 'low glycemic'],
};

const GOAL_TERMS = {
  weight_loss:    ['low calorie', 'light salad', 'diet food', 'low fat'],
  muscle_gain:    ['high protein', 'whey protein', 'chicken breast', 'protein shake'],
  healthy_eating: ['whole grain', 'superfood', 'organic salad', 'natural'],
  others:         ['balanced meal', 'mixed salad', 'healthy snack'],
};

const SEASON_TERMS = {
  summer:  ['coconut water', 'fruit salad', 'yogurt', 'cucumber salad', 'watermelon'],
  monsoon: ['soup', 'lentil soup', 'hot tea', 'oats', 'stew'],
  winter:  ['oats', 'soup', 'porridge', 'whole grain', 'beans'],
  mild:    ['balanced meal', 'mixed salad', 'healthy snack'],
};

// ── Hand-crafted Premium Local Food Catalog ─────────────────
export const LOCAL_PRODUCTS = [
  {
    id: 'local_paneer_tikka',
    name: 'Paneer Tikka (Indian Cottage Cheese)',
    image: null,
    calories: 280,
    protein: 18,
    carbs: 6,
    fat: 20,
    fiber: 1.5,
    sugar: 2,
    sodium: 450,
    grade: 'b',
    labels: ['vegetarian', 'en:vegetarian', 'high-protein'],
    allergens: ['milk'],
    categories: ['Dairy', 'Indian Foods'],
    quantity: '200g',
    source: 'local'
  },
  {
    id: 'local_biryani',
    name: 'Vegetable Biryani',
    image: null,
    calories: 320,
    protein: 8,
    carbs: 52,
    fat: 9,
    fiber: 4,
    sugar: 3,
    sodium: 680,
    grade: 'c',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: [],
    categories: ['Rice Dishes', 'Indian Foods'],
    quantity: '350g',
    source: 'local'
  },
  {
    id: 'local_chicken_tikka',
    name: 'Chicken Tikka',
    image: null,
    calories: 220,
    protein: 26,
    carbs: 4,
    fat: 10,
    fiber: 1,
    sugar: 1,
    sodium: 580,
    grade: 'a',
    labels: ['non-vegetarian', 'high-protein'],
    allergens: [],
    categories: ['Poultry', 'Indian Foods'],
    quantity: '200g',
    source: 'local'
  },
  {
    id: 'local_dal_tadka',
    name: 'Dal Tadka (Lentil Curry)',
    image: null,
    calories: 180,
    protein: 9,
    carbs: 24,
    fat: 5,
    fiber: 6,
    sugar: 1,
    sodium: 380,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: [],
    categories: ['Legumes', 'Indian Foods'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_masala_dosa',
    name: 'Masala Dosa',
    image: null,
    calories: 250,
    protein: 5,
    carbs: 42,
    fat: 7,
    fiber: 2,
    sugar: 1,
    sodium: 480,
    grade: 'c',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: [],
    categories: ['Crepes', 'Indian Foods'],
    quantity: '150g',
    source: 'local'
  },
  {
    id: 'local_steamed_idli',
    name: 'Steamed Idli (3 Pieces)',
    image: null,
    calories: 160,
    protein: 4,
    carbs: 34,
    fat: 0.5,
    fiber: 2,
    sugar: 0.5,
    sodium: 290,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: [],
    categories: ['Breakfast', 'Indian Foods'],
    quantity: '120g',
    source: 'local'
  },
  {
    id: 'local_oats_porridge',
    name: 'Oats Porridge with Milk',
    image: null,
    calories: 210,
    protein: 7.5,
    carbs: 32,
    fat: 4.5,
    fiber: 4,
    sugar: 6,
    sodium: 120,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'healthy'],
    allergens: ['milk', 'gluten'],
    categories: ['Cereals', 'Breakfast'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_tofu_salad',
    name: 'Tofu Green Salad',
    image: null,
    calories: 140,
    protein: 10,
    carbs: 8,
    fat: 7,
    fiber: 3.5,
    sugar: 2,
    sodium: 250,
    grade: 'a',
    labels: ['vegan', 'vegetarian', 'en:vegetarian', 'en:vegan'],
    allergens: ['soy'],
    categories: ['Salads'],
    quantity: '200g',
    source: 'local'
  },
  {
    id: 'local_butter_chicken',
    name: 'Butter Chicken (Murgh Makhani)',
    image: null,
    calories: 380,
    protein: 28,
    carbs: 12,
    fat: 24,
    fiber: 1,
    sugar: 4,
    sodium: 620,
    grade: 'd',
    labels: ['non-vegetarian', 'high-protein'],
    allergens: ['milk', 'nuts'],
    categories: ['Poultry', 'Indian Foods', 'Curry'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_palak_paneer',
    name: 'Palak Paneer',
    image: null,
    calories: 220,
    protein: 10,
    carbs: 8,
    fat: 16,
    fiber: 3,
    sugar: 2,
    sodium: 410,
    grade: 'b',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['milk'],
    categories: ['Dairy', 'Indian Foods', 'Curry'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_chana_masala',
    name: 'Chana Masala (Chole Curry)',
    image: null,
    calories: 210,
    protein: 7,
    carbs: 32,
    fat: 6,
    fiber: 8,
    sugar: 2,
    sodium: 490,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: [],
    categories: ['Legumes', 'Indian Foods', 'Curry'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_samosa',
    name: 'Potato Samosa (2 Pieces)',
    image: null,
    calories: 310,
    protein: 4,
    carbs: 38,
    fat: 16,
    fiber: 3,
    sugar: 1,
    sodium: 350,
    grade: 'd',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: ['gluten'],
    categories: ['Snacks', 'Indian Foods'],
    quantity: '100g',
    source: 'local'
  },
  {
    id: 'local_gulab_jamun',
    name: 'Gulab Jamun (2 Pieces)',
    image: null,
    calories: 300,
    protein: 4,
    carbs: 52,
    fat: 9,
    fiber: 0.5,
    sugar: 44,
    sodium: 180,
    grade: 'e',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['milk', 'gluten'],
    categories: ['Desserts', 'Indian Foods'],
    quantity: '80g',
    source: 'local'
  },
  {
    id: 'local_aloo_paratha',
    name: 'Aloo Paratha (Stuffed Flatbread)',
    image: null,
    calories: 290,
    protein: 6,
    carbs: 48,
    fat: 8,
    fiber: 4,
    sugar: 1.5,
    sodium: 420,
    grade: 'c',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['gluten'],
    categories: ['Breads', 'Indian Foods'],
    quantity: '140g',
    source: 'local'
  },
  {
    id: 'local_tandoori_roti',
    name: 'Tandoori Roti (Whole Wheat)',
    image: null,
    calories: 110,
    protein: 3.5,
    carbs: 22,
    fat: 0.5,
    fiber: 3,
    sugar: 0.2,
    sodium: 190,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: ['gluten'],
    categories: ['Breads', 'Indian Foods'],
    quantity: '45g',
    source: 'local'
  },
  {
    id: 'local_rajma_chawal',
    name: 'Rajma Chawal (Kidney Beans & Rice)',
    image: null,
    calories: 340,
    protein: 11,
    carbs: 62,
    fat: 5,
    fiber: 7,
    sugar: 2,
    sodium: 540,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: [],
    categories: ['Rice Dishes', 'Indian Foods'],
    quantity: '400g',
    source: 'local'
  },
  {
    id: 'local_dhokla',
    name: 'Khaman Dhokla (Steamed Gram Flour Cake)',
    image: null,
    calories: 160,
    protein: 6,
    carbs: 28,
    fat: 3,
    fiber: 2,
    sugar: 6,
    sodium: 390,
    grade: 'b',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['mustard'],
    categories: ['Snacks', 'Indian Foods'],
    quantity: '100g',
    source: 'local'
  },
  {
    id: 'local_upma',
    name: 'Rava Upma (Semolina Savory Porridge)',
    image: null,
    calories: 210,
    protein: 5,
    carbs: 36,
    fat: 5,
    fiber: 3,
    sugar: 2,
    sodium: 430,
    grade: 'b',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['gluten', 'mustard'],
    categories: ['Breakfast', 'Indian Foods'],
    quantity: '150g',
    source: 'local'
  },
  {
    id: 'local_poha',
    name: 'Kanda Poha (Flattened Rice)',
    image: null,
    calories: 180,
    protein: 4,
    carbs: 32,
    fat: 4,
    fiber: 2.5,
    sugar: 3,
    sodium: 310,
    grade: 'b',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: ['peanuts', 'mustard'],
    categories: ['Breakfast', 'Indian Foods'],
    quantity: '120g',
    source: 'local'
  },
  {
    id: 'local_sambhar',
    name: 'Sambhar (Vegetable Lentil Stew)',
    image: null,
    calories: 120,
    protein: 4,
    carbs: 18,
    fat: 3,
    fiber: 5,
    sugar: 4,
    sodium: 460,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian', 'vegan'],
    allergens: ['mustard'],
    categories: ['Soups', 'Indian Foods'],
    quantity: '200g',
    source: 'local'
  },
  {
    id: 'local_fish_curry',
    name: 'Goan Fish Curry',
    image: null,
    calories: 260,
    protein: 22,
    carbs: 8,
    fat: 15,
    fiber: 2,
    sugar: 2,
    sodium: 590,
    grade: 'b',
    labels: ['non-vegetarian'],
    allergens: ['fish'],
    categories: ['Seafood', 'Indian Foods', 'Curry'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_mutton_rogan_josh',
    name: 'Mutton Rogan Josh',
    image: null,
    calories: 360,
    protein: 28,
    carbs: 10,
    fat: 24,
    fiber: 1.5,
    sugar: 2,
    sodium: 640,
    grade: 'd',
    labels: ['non-vegetarian', 'high-protein'],
    allergens: [],
    categories: ['Meat Dishes', 'Indian Foods', 'Curry'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_cucumber_raita',
    name: 'Cucumber Raita (Yogurt Dip)',
    image: null,
    calories: 60,
    protein: 3,
    carbs: 6,
    fat: 2.5,
    fiber: 0.5,
    sugar: 4,
    sodium: 180,
    grade: 'a',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['milk'],
    categories: ['Dairy', 'Indian Foods', 'Condiments'],
    quantity: '100g',
    source: 'local'
  },
  {
    id: 'local_mango_lassi',
    name: 'Mango Lassi (Yogurt Smoothie)',
    image: null,
    calories: 220,
    protein: 5,
    carbs: 38,
    fat: 4,
    fiber: 1,
    sugar: 32,
    sodium: 90,
    grade: 'c',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['milk'],
    categories: ['Beverages', 'Indian Foods'],
    quantity: '250ml',
    source: 'local'
  },
  {
    id: 'local_masala_chai',
    name: 'Masala Chai (Spiced Milk Tea)',
    image: null,
    calories: 90,
    protein: 2.5,
    carbs: 14,
    fat: 2.5,
    fiber: 0,
    sugar: 12,
    sodium: 40,
    grade: 'c',
    labels: ['vegetarian', 'en:vegetarian'],
    allergens: ['milk'],
    categories: ['Beverages', 'Indian Foods'],
    quantity: '150ml',
    source: 'local'
  },
  {
    id: 'local_chicken_noodle_soup',
    name: 'Hot Chicken Noodle Soup (Warming)',
    image: null,
    calories: 190,
    protein: 16,
    carbs: 18,
    fat: 4,
    fiber: 2,
    sugar: 1,
    sodium: 480,
    grade: 'a',
    labels: ['non-vegetarian', 'high-protein', 'warming', 'soup'],
    allergens: ['gluten'],
    categories: ['Poultry', 'Soups', 'Winter Specials'],
    quantity: '300g',
    source: 'local'
  },
  {
    id: 'local_mutton_stew',
    name: 'Hearty Mutton Stew (Warming)',
    image: null,
    calories: 310,
    protein: 24,
    carbs: 12,
    fat: 16,
    fiber: 3,
    sugar: 2,
    sodium: 520,
    grade: 'a',
    labels: ['non-vegetarian', 'high-protein', 'warming', 'stew'],
    allergens: [],
    categories: ['Meat Dishes', 'Stews', 'Winter Specials'],
    quantity: '350g',
    source: 'local'
  },
  {
    id: 'local_egg_curry',
    name: 'Spicy Egg Curry',
    image: null,
    calories: 240,
    protein: 14,
    carbs: 8,
    fat: 16,
    fiber: 2,
    sugar: 2,
    sodium: 490,
    grade: 'b',
    labels: ['eggetarian', 'non-vegetarian', 'high-protein', 'curry'],
    allergens: ['egg'],
    categories: ['Curry', 'Egg Dishes', 'Indian Foods'],
    quantity: '250g',
    source: 'local'
  },
  {
    id: 'local_tandoori_fish_tikka',
    name: 'Grilled Tandoori Fish Tikka',
    image: null,
    calories: 210,
    protein: 26,
    carbs: 3,
    fat: 8,
    fiber: 1,
    sugar: 0.5,
    sodium: 540,
    grade: 'a',
    labels: ['non-vegetarian', 'high-protein', 'healthy-fats'],
    allergens: ['fish'],
    categories: ['Seafood', 'Indian Foods', 'Winter Specials'],
    quantity: '200g',
    source: 'local'
  }
];

// ── Fetch products from Open Food Facts ─────────────────────
export async function searchFoods(term, pageSize = 20, countryCode = 'in') {
  const code = countryCode?.toLowerCase() || 'in';
  const base = code === 'world' ? 'https://world.openfoodfacts.org' : `https://${code}.openfoodfacts.org`;
  const url =
    `${base}/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(term)}` +
    `&search_simple=1&action=process&json=1` +
    `&page_size=${pageSize}` +
    `&fields=id,product_name,image_url,nutriments,labels_tags,` +
    `allergens_tags,nutrition_grades,categories_tags,quantity`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const products = data.products || [];

    // Fallback to world database if no products found in regional subdomain
    if (products.length === 0 && code !== 'world') {
      const fallbackUrl =
        `https://world.openfoodfacts.org/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(term)}` +
        `&search_simple=1&action=process&json=1` +
        `&page_size=${pageSize}` +
        `&fields=id,product_name,image_url,nutriments,labels_tags,` +
        `allergens_tags,nutrition_grades,categories_tags,quantity`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackData = await fallbackRes.json();
      return fallbackData.products || [];
    }

    return products;
  } catch (err) {
    console.error('OFF fetch error:', err);
    return [];
  }
}

// ── Fetch single product by barcode ─────────────────────────
export async function getProductById(barcode) {
  try {
    const res  = await fetch(`${BASE}/api/v0/product/${barcode}.json`);
    const data = await res.json();
    return data.product || null;
  } catch {
    return null;
  }
}

// ── Normalise raw OFF product → our app shape ───────────────
export function normaliseProduct(raw) {
  if (!raw || !raw.product_name) return null;

  const n = raw.nutriments || {};
  let calories = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0);
  const protein = Math.round((n.proteins_100g    || 0) * 10) / 10;
  const carbs = Math.round((n.carbohydrates_100g || 0) * 10) / 10;
  const fat = Math.round((n.fat_100g          || 0) * 10) / 10;

  // Estimate calories if they are missing but macros are present (Atwater general factors)
  if (calories === 0 && (protein > 0 || carbs > 0 || fat > 0)) {
    calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
  }

  return {
    id:          raw.id || raw._id || String(Math.random()),
    name:        raw.product_name,
    image:       raw.image_url || raw.image_front_url || null,
    calories:    calories,
    protein:     protein,
    carbs:       carbs,
    fat:         fat,
    fiber:       Math.round((n.fiber_100g        || 0) * 10) / 10,
    sugar:       Math.round((n.sugars_100g       || 0) * 10) / 10,
    sodium:      Math.round((n.sodium_100g       || 0) * 1000) / 10,  // mg
    grade:       raw.nutrition_grades || 'unknown',
    labels:      raw.labels_tags      || [],
    allergens:   raw.allergens_tags   || [],
    categories:  raw.categories_tags  || [],
    quantity:    raw.quantity         || '',
    source:      'openfoodfacts',
  };
}

// ── Filter products by user preferences ─────────────────────
export function filterProducts(products, preferences) {
  const { dietType, allergies = [], minProtein, maxCalories, minGrade, weather } = preferences;

  const GRADE_ORDER = { a: 4, b: 3, c: 2, d: 1, e: 0, unknown: -1 };
  const minGradeVal = GRADE_ORDER[minGrade?.toLowerCase()] ?? -1;

  return products.filter(p => {
    // Must have a name
    if (!p.name) return false;

    // Strict diet type filtering
    const labelsLower = (p.labels || []).map(l => l.toLowerCase());
    const nameLower = p.name.toLowerCase();

    if (dietType === 'Vegetarian') {
      // Discard if labeled non-vegetarian or has meat in title
      if (labelsLower.includes('non-vegetarian') || labelsLower.includes('en:non-vegetarian') ||
          nameLower.includes('chicken') || nameLower.includes('mutton') || 
          nameLower.includes('fish') || nameLower.includes('seafood') || nameLower.includes('beef')) {
        return false;
      }
    }

    if (dietType === 'Eggetarian') {
      // Discard if labeled non-vegetarian (but allow eggs!)
      if (labelsLower.includes('non-vegetarian') || labelsLower.includes('en:non-vegetarian') ||
          (nameLower.includes('chicken') && !nameLower.includes('egg')) || 
          nameLower.includes('mutton') || nameLower.includes('fish') || 
          nameLower.includes('seafood') || nameLower.includes('beef')) {
        if (!nameLower.includes('egg')) {
          return false;
        }
      }
    }

    if (dietType === 'Vegan') {
      // For local items, strictly require vegan label. For API, filter out obvious non-vegan items.
      if (p.source === 'local') {
        if (!labelsLower.includes('vegan')) return false;
      } else {
        if (labelsLower.includes('non-vegetarian') || labelsLower.includes('en:non-vegetarian') ||
            labelsLower.includes('milk') || labelsLower.includes('egg') || labelsLower.includes('cheese') ||
            nameLower.includes('chicken') || nameLower.includes('mutton') || nameLower.includes('fish') || 
            nameLower.includes('beef') || nameLower.includes('paneer') || nameLower.includes('ghee') || 
            nameLower.includes('yogurt') || nameLower.includes('egg') || nameLower.includes('butter')) {
          return false;
        }
      }
    }

    // Nutrition grade filter (do NOT discard if the grade is unknown)
    if (minGrade && p.grade && p.grade !== 'unknown' && GRADE_ORDER[p.grade?.toLowerCase()] < minGradeVal) return false;

    // Allergen exclusion
    if (allergies.length > 0) {
      const hasAllergen = allergies.some(a =>
        p.allergens.some(pa => pa.toLowerCase().includes(a.toLowerCase()))
      );
      if (hasAllergen) return false;
    }

    // Max calories
    if (maxCalories && p.calories > maxCalories) return false;

    // Min protein
    if (minProtein && p.protein < minProtein) return false;

    if (weather?.temperature >= 32 && p.calories > 450) return false;
    if (weather?.season === 'monsoon' && p.sodium > 900) return false;

    return true;
  });
}

// ── Rank products by nutrient score ─────────────────────────
export function rankProducts(products, healthGoals = []) {
  return [...products].sort((a, b) => score(b, healthGoals) - score(a, healthGoals));
}

function score(p, goals) {
  let s = 0;

  // Nutrition grade bonus
  const gradeBonus = { a: 40, b: 30, c: 15, d: 5, e: 0 };
  s += gradeBonus[p.grade?.toLowerCase()] || 0;

  // Goal-specific scoring
  if (goals.includes('muscle_gain')) {
    s += p.protein * 4;          // reward high protein heavily
    s -= p.fat    * 0.5;
  }
  if (goals.includes('weight_loss')) {
    s -= p.calories * 0.05;      // penalise calories
    s += p.fiber   * 3;          // reward fiber
    s -= p.sugar   * 2;
  }
  if (goals.includes('healthy_eating')) {
    s += p.fiber   * 2;
    s -= p.sugar   * 1.5;
    s -= p.sodium  * 0.01;
  }
  if (goals.includes('others')) {
    s += p.protein * 2;
    s += p.fiber;
  }

  // Generic quality signals
  s += p.protein * 2;
  s += p.fiber   * 1.5;
  s -= p.sugar   * 1;

  // Penalise missing image (less useful to user)
  if (!p.image) s -= 10;

  return s;
}

function scoreWeatherFit(product, weather) {
  if (!weather) return 0;

  const text = [
    product.name,
    ...(product.labels || []),
    ...(product.categories || []),
  ].join(' ').toLowerCase();

  let s = 0;
  if (weather.season === 'summer') {
    if (text.includes('water') || text.includes('fruit') || text.includes('salad') || text.includes('yogurt')) s += 24;
    if (product.calories <= 220) s += 12;
    if (product.sodium > 700) s -= 10;
  }
  if (weather.season === 'monsoon') {
    if (text.includes('soup') || text.includes('lentil') || text.includes('oat') || text.includes('tea')) s += 24;
    if (product.sugar > 18) s -= 8;
  }
  if (weather.season === 'winter') {
    if (text.includes('soup') || text.includes('oat') || text.includes('porridge') || text.includes('bean')) s += 22;
    if (product.protein >= 8) s += 8;
    if (text.includes('soup') || text.includes('stew') || text.includes('chicken') || text.includes('mutton') || text.includes('fish') || text.includes('egg')) {
      s += 15; // warming winter bonus
    }
  }
  if (weather.humidity >= 75 && product.sodium > 800) s -= 8;
  if (weather.rain > 0 && (text.includes('soup') || text.includes('hot'))) s += 10;
  return s;
}

export function rankProductsForWeather(products, healthGoals = [], weather) {
  return [...products].sort((a, b) => {
    const scoreA = score(a, healthGoals) + scoreWeatherFit(a, weather);
    const scoreB = score(b, healthGoals) + scoreWeatherFit(b, weather);
    return scoreB - scoreA;
  });
}

// ── Main entry: fetch + filter + rank for a user profile ────
export async function getRecommendations(preferences, count = 20) {
  const { dietType, healthGoals = [], weather, country = 'in' } = preferences;

  // Build search terms from diet + goals
  const dietTerms = DIET_SEARCH_TERMS[dietType] || DIET_SEARCH_TERMS['Vegetarian'];
  const goalTerms = healthGoals.flatMap(g => GOAL_TERMS[g] || []);
  let seasonTerms = SEASON_TERMS[weather?.season] || [];
  if (weather?.season === 'winter' && (dietType === 'Non-Vegetarian' || dietType === 'Non Vegetarian')) {
    seasonTerms = ['chicken soup', 'mutton stew', 'egg soup', 'hot chicken', ...seasonTerms];
  }
  const allTerms  = [...seasonTerms, ...dietTerms, ...goalTerms].slice(0, 8); // max 8 parallel calls

  // Fetch in parallel
  const rawArrays = await Promise.all(allTerms.map(t => searchFoods(t, 15, country)));
  const rawAll    = rawArrays.flat();

  // Deduplicate by id
  const seen = new Set();
  const unique = rawAll.filter(p => {
    const key = p.id || p._id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Normalise
  const normalised = unique.map(normaliseProduct).filter(Boolean);

  // Search hand-crafted local products matching any active query terms
  const localMatches = [];
  for (const term of allTerms) {
    const matches = LOCAL_PRODUCTS.filter(p => 
      (p.name.toLowerCase().includes(term.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(term.toLowerCase()))) &&
      !localMatches.some(lm => lm.id === p.id)
    );
    localMatches.push(...matches);
  }

  // Combine API and local matches
  const combined = [...localMatches, ...normalised];

  // Deduplicate combined list
  const finalSeen = new Set();
  const finalUnique = combined.filter(p => {
    if (finalSeen.has(p.id)) return false;
    finalSeen.add(p.id);
    return true;
  });

  const filtered   = filterProducts(finalUnique, preferences);
  const ranked     = rankProductsForWeather(filtered, healthGoals, weather);

  return ranked.slice(0, count);
}

// ── Search by query string (for Search screen) ──────────────
export async function searchByQuery(query, preferences, count = 20) {
  const country = preferences?.country || 'in';

  // Search local products
  const matchedLocal = LOCAL_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.categories.some(c => c.toLowerCase().includes(query.toLowerCase()))
  );

  const raw        = await searchFoods(query, 30, country);
  const normalised = raw.map(normaliseProduct).filter(Boolean);

  // Combine local and API
  const combined = [...matchedLocal, ...normalised];

  // Deduplicate combined list
  const finalSeen = new Set();
  const finalUnique = combined.filter(p => {
    if (finalSeen.has(p.id)) return false;
    finalSeen.add(p.id);
    return true;
  });

  const filtered   = filterProducts(finalUnique, preferences);
  const ranked     = rankProducts(filtered, preferences.healthGoals || []);
  return ranked.slice(0, count);
}

// ── Nutrition grade colour helper ───────────────────────────
export function gradeColor(grade) {
  const map = { a: '#1e8a3e', b: '#85bb2f', c: '#f5a623', d: '#e07b39', e: '#cc1f1f' };
  return map[grade?.toLowerCase()] || '#555';
}

export function gradeLabel(grade) {
  return grade ? grade.toUpperCase() : '?';
}
