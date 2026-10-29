// ─────────────────────────────────────────────────────────────
//  services/openFoodFacts.js
//  All Open Food Facts API calls + filter + rank logic
// ─────────────────────────────────────────────────────────────

import { FOOD_ITEMS } from '../data/mockData';
import { FALLBACK_FOODS } from '../data/fallbackFoods';
import { resolveFoodImage, resolveFoodGrade } from './foodHelpers';
import { normalizeFoodName, normalizeFoodItem, normalizeFoodList, deduplicateFoods } from './foodNameNormalizer';

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

// ── Hand-crafted Premium Local Food Catalog (dynamically synchronized) ─────────────────
const mappedFoodItems = FOOD_ITEMS.map(item => {
  let grade = item.grade || 'c';
  if (item.calories < 150) grade = 'a';
  else if (item.calories < 250) grade = 'b';
  else if (item.calories < 350) grade = 'c';
  else if (item.calories < 450) grade = 'd';
  else grade = 'e';

  const labels = [
    ...(item.tags || []).map(t => t.toLowerCase()),
    item.cuisine ? item.cuisine.toLowerCase() : '',
    item.category ? item.category.toLowerCase() : '',
  ].filter(Boolean);

  if (labels.some(l => l.includes('vegan'))) {
    labels.push('vegan', 'vegetarian', 'en:vegan', 'en:vegetarian');
  } else if (labels.some(l => l.includes('vegetarian') || l.includes('veg'))) {
    labels.push('vegetarian', 'en:vegetarian');
  }

  const allergens = [];
  const ingredientsStr = (item.ingredients || []).join(' ').toLowerCase();
  if (ingredientsStr.includes('milk') || ingredientsStr.includes('paneer') || ingredientsStr.includes('butter') || ingredientsStr.includes('cream') || ingredientsStr.includes('cheese')) {
    allergens.push('milk');
  }
  if (ingredientsStr.includes('wheat') || ingredientsStr.includes('flour') || ingredientsStr.includes('gluten') || ingredientsStr.includes('bread') || ingredientsStr.includes('naan') || ingredientsStr.includes('puri') || ingredientsStr.includes('bhature')) {
    allergens.push('gluten');
  }
  if (ingredientsStr.includes('peanut')) {
    allergens.push('peanuts');
  }
  if (ingredientsStr.includes('egg')) {
    allergens.push('egg');
  }
  if (ingredientsStr.includes('fish')) {
    allergens.push('fish');
  }
  if (ingredientsStr.includes('prawn') || ingredientsStr.includes('shrimp') || ingredientsStr.includes('crab') || ingredientsStr.includes('lobster')) {
    allergens.push('crustaceans');
  }

  const cleanName = normalizeFoodName(item.name);

  return {
    id: item.id,
    name: cleanName,
    displayName: cleanName,
    originalName: item.name,
    image: item.image,
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbs: item.carbs || 0,
    fat: item.fat || 0,
    fiber: item.fiber || Math.round((item.protein * 0.2) * 10) / 10 || 1.0,
    sugar: item.sugar || Math.round((item.carbs * 0.1) * 10) / 10 || 2.0,
    sodium: item.sodium || 250,
    grade: grade,
    labels: Array.from(new Set(labels)),
    allergens: Array.from(new Set(allergens)),
    categories: [item.category || 'Healthy', 'Healthy'],
    quantity: '200g',
    source: 'local'
  };
});

const mappedFallback = FALLBACK_FOODS.map(item => {
  const labels = [
    ...(item.dietTags || []).map(t => t.toLowerCase()),
    ...(item.categories || []).map(c => c.toLowerCase()),
  ];
  if (labels.some(l => l.includes('vegan'))) {
    labels.push('vegan', 'vegetarian', 'en:vegan', 'en:vegetarian');
  } else if (labels.some(l => l.includes('vegetarian') || l.includes('veg'))) {
    labels.push('vegetarian', 'en:vegetarian');
  }

  const cleanName = normalizeFoodName(item.name);

  return {
    id: item.id,
    name: cleanName,
    displayName: cleanName,
    originalName: item.originalName || item.name,
    image: item.image || resolveFoodImage(item),
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbs: item.carbs || 0,
    fat: item.fat || 0,
    fiber: item.fiber || 1.0,
    sugar: item.sugar || 2.0,
    sodium: item.sodium || 200,
    grade: (item.grade || item.healthGrade || 'b').toLowerCase(),
    labels: Array.from(new Set(labels)),
    allergens: Array.from(new Set(item.allergens || [])),
    categories: Array.isArray(item.categories) ? item.categories : [item.category || 'Healthy'],
    quantity: item.quantity || '200g',
    source: 'local'
  };
});

export const LOCAL_PRODUCTS = deduplicateFoods([...mappedFoodItems, ...mappedFallback]);

// ── Fetch products from Backend Proxy (Offline resilient) ───────────────────────
export async function searchFoods(term, pageSize = 20, countryCode = 'in') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('SearchFoods offline: serving from LOCAL_PRODUCTS');
    const matched = LOCAL_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(term.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(term.toLowerCase()))
    );
    return matched.length > 0 ? matched : LOCAL_PRODUCTS.slice(0, 5);
  }

  try {
    const token = localStorage.getItem('nb_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`http://localhost:5000/api/foods/search?q=${encodeURIComponent(term)}&pageSize=${pageSize}`, {
      headers
    });
    const data = await res.json();
    return data.foods || [];
  } catch (err) {
    console.error('OFF search proxy failure, returning fallback:', err);
    const matched = LOCAL_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(term.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(term.toLowerCase()))
    );
    return matched.length > 0 ? matched : LOCAL_PRODUCTS.slice(0, 5);
  }
}

// ── Fetch single product by barcode (Offline resilient) ─────────────────────────
export async function getProductById(barcode) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('GetProductById offline: serving from LOCAL_PRODUCTS');
    const matched = LOCAL_PRODUCTS.find(p => p.id === barcode);
    return matched || LOCAL_PRODUCTS[0];
  }

  try {
    const token = localStorage.getItem('nb_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`http://localhost:5000/api/foods/${barcode}`, {
      headers
    });
    const data = await res.json();
    return data.food || null;
  } catch (err) {
    console.error('OFF barcode proxy failure, returning fallback:', err);
    const matched = LOCAL_PRODUCTS.find(p => p.id === barcode);
    return matched || LOCAL_PRODUCTS[0];
  }
}

// ── Normalise raw OFF product → our app shape ───────────────
export function normaliseProduct(raw) {
  if (!raw) return null;
  
  // If already normalised (from backend or local products), ensure image & grade are populated
  if (raw.source === 'openfoodfacts' || raw.source === 'fallback' || raw.source === 'cache' || raw.source === 'local' || raw.source === 'emergency_fallback') {
    if (!raw.image) {
      raw.image = resolveFoodImage(raw);
    }
    if (!raw.grade || raw.grade === 'unknown') {
      raw.grade = resolveFoodGrade(raw).toLowerCase();
    }
    return raw;
  }

  if (!raw.product_name) return null;

  const n = raw.nutriments || {};
  let calories = Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0);
  const protein = Math.round((n.proteins_100g    || 0) * 10) / 10;
  const carbs = Math.round((n.carbohydrates_100g || 0) * 10) / 10;
  const fat = Math.round((n.fat_100g          || 0) * 10) / 10;

  // Estimate calories if they are missing but macros are present (Atwater general factors)
  if (calories === 0 && (protein > 0 || carbs > 0 || fat > 0)) {
    calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
  }

  const rawImg = raw.image || raw.imageUrl || raw.image_url || raw.image_front_url || null;
  const resolvedImg = resolveFoodImage({ ...raw, name: raw.product_name, image: rawImg });
  const resolvedGrade = resolveFoodGrade(raw.nutrition_grades || raw.grade || { calories, protein, sugar, sodium }).toLowerCase();

  return {
    id:          raw.id || raw._id || String(Math.random()),
    name:        raw.product_name,
    image:       resolvedImg,
    calories:    calories,
    protein:     protein,
    carbs:       carbs,
    fat:         fat,
    fiber:       Math.round((n.fiber_100g        || 0) * 10) / 10,
    sugar:       Math.round((n.sugars_100g       || 0) * 10) / 10,
    sodium:      Math.round((n.sodium_100g       || 0) * 1000) / 10,  // mg
    grade:       resolvedGrade,
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
      const pAllergens = Array.isArray(p.allergens) ? p.allergens : [];
      const hasAllergen = allergies.some(a =>
        pAllergens.some(pa => String(pa).toLowerCase().includes(String(a).toLowerCase()))
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

// ── Main entry: fetch recommendations ──────────────────────
export async function getRecommendations(preferences, count = 20) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('GetRecommendations offline: serving from LOCAL_PRODUCTS');
    const filtered = filterProducts(LOCAL_PRODUCTS, preferences);
    return filtered.slice(0, count);
  }

  try {
    const token = localStorage.getItem('nb_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const queryParams = new URLSearchParams({ count: String(count) });
    if (preferences?.dietType) queryParams.append('dietType', preferences.dietType);
    if (preferences?.allergies && preferences.allergies.length > 0) {
      queryParams.append('allergies', Array.isArray(preferences.allergies) ? preferences.allergies.join(',') : String(preferences.allergies));
    }
    if (preferences?.cuisines && preferences.cuisines.length > 0) {
      queryParams.append('cuisines', Array.isArray(preferences.cuisines) ? preferences.cuisines.join(',') : String(preferences.cuisines));
    }
    if (preferences?.healthGoals && preferences.healthGoals.length > 0) {
      queryParams.append('healthGoals', Array.isArray(preferences.healthGoals) ? preferences.healthGoals.join(',') : String(preferences.healthGoals));
    }
    if (preferences?.weather) queryParams.append('weather', typeof preferences.weather === 'object' ? (preferences.weather.description || '') : String(preferences.weather));
    if (preferences?.mood) queryParams.append('mood', String(preferences.mood));

    const res = await fetch(`http://localhost:5000/api/foods/recommendations?${queryParams.toString()}`, {
      headers
    });
    const data = await res.json();
    return data.foods || [];
  } catch (err) {
    console.error('OFF recommendations proxy failure, returning fallback:', err);
    const filtered = filterProducts(LOCAL_PRODUCTS, preferences);
    return filtered.slice(0, count);
  }
}

// ── Search by query string (for Search screen) ──────────────
export async function searchByQuery(query, preferences, count = 20) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('SearchByQuery offline: serving from LOCAL_PRODUCTS');
    const matchedLocal = LOCAL_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(query.toLowerCase()))
    );
    const filtered = filterProducts(matchedLocal, preferences);
    return filtered.slice(0, count);
  }

  try {
    const token = localStorage.getItem('nb_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const queryParams = new URLSearchParams({ q: query, count: String(count) });
    if (preferences?.dietType) queryParams.append('dietType', preferences.dietType);
    if (preferences?.allergies && preferences.allergies.length > 0) {
      queryParams.append('allergies', Array.isArray(preferences.allergies) ? preferences.allergies.join(',') : String(preferences.allergies));
    }
    if (preferences?.cuisines && preferences.cuisines.length > 0) {
      queryParams.append('cuisines', Array.isArray(preferences.cuisines) ? preferences.cuisines.join(',') : String(preferences.cuisines));
    }
    if (preferences?.healthGoals && preferences.healthGoals.length > 0) {
      queryParams.append('healthGoals', Array.isArray(preferences.healthGoals) ? preferences.healthGoals.join(',') : String(preferences.healthGoals));
    }

    const res = await fetch(`http://localhost:5000/api/foods/search?${queryParams.toString()}`, {
      headers
    });
    const data = await res.json();
    return data.foods || [];
  } catch (err) {
    console.error('Search by query failed, returning fallback:', err);
    const matchedLocal = LOCAL_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(query.toLowerCase()))
    );
    const filtered = filterProducts(matchedLocal, preferences);
    return filtered.slice(0, count);
  }
}

// ── Nutrition grade colour helper ───────────────────────────
export function gradeColor(grade) {
  const map = { a: '#1e8a3e', b: '#85bb2f', c: '#f5a623', d: '#e07b39', e: '#cc1f1f' };
  return map[grade?.toLowerCase()] || '#555';
}

export function gradeLabel(grade) {
  return grade ? grade.toUpperCase() : '?';
}
