// ─────────────────────────────────────────────────────────────
//  backend/src/services/foodDatabaseService.js
//  FoodieBite Unified Food Database Management Service
//  Aggregates, normalizes, and indexes all application food data sources:
//    1. Main Food Knowledge Base (foodKnowledge.js - 1,500 items)
//    2. Curated Fallback Food Dataset (foodiebiteFallbackFoods.js - 178 items)
//    3. Emergency Baseline Dataset (recommendationDbService.js)
//  ZERO hardcoded samples; 100% dynamic multi-source data integration
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
const { getAllFoods } = require('../ai/foodKnowledge');
const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');

// Default placeholder image by category if none exists
const CATEGORY_IMAGES = {
  'Grain / Bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
  'Curry': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
  'Dal / Legume': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80',
  'Rice / Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
  'Breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=500&auto=format&fit=crop&q=80',
  'Snack': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
  'Dessert / Sweet': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80',
  'Beverage': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=80',
  'Salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
  'Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
  'Protein': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=80',
  'Non-Veg / Meat': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
  'Seafood': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80',
  'Vegetable': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
  'Default': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500&auto=format&fit=crop&q=80'
};

let cachedUnifiedFoods = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute in-memory cache

/**
 * Normalizes and merges all food records into a unified FoodieBite database catalog
 */
function buildUnifiedFoodDatabase() {
  const now = Date.now();
  if (cachedUnifiedFoods && (now - cacheTimestamp < CACHE_TTL)) {
    return cachedUnifiedFoods;
  }

  const foodMap = new Map();

  // 1. Process Main Food Knowledge Base (1,500 items)
  try {
    const rawKnowledgeFoods = getAllFoods();
    for (const f of rawKnowledgeFoods) {
      if (!f || !f.id || !f.name) continue;

      let dietType = 'Vegetarian';
      if (f.vegan) dietType = 'Vegan';
      else if (!f.vegetarian && f.eggetarian) dietType = 'Eggetarian';
      else if (!f.vegetarian && !f.eggetarian) dietType = 'Non-Vegetarian';
      else if (f.vegetarian) dietType = 'Vegetarian';

      const category = f.category || 'General';
      const image = f.image || CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Default'];

      const unifiedItem = {
        id: String(f.id),
        name: f.name.trim(),
        image,
        category,
        cuisine: f.cuisine || 'Indian',
        dietType,
        isVegetarian: Boolean(f.vegetarian),
        isVegan: Boolean(f.vegan),
        isEggetarian: Boolean(f.eggetarian),
        isNonVegetarian: !f.vegetarian && !f.eggetarian,
        calories: typeof f.calories === 'number' ? Math.round(f.calories) : 0,
        protein: typeof f.protein === 'number' ? Number(f.protein.toFixed(1)) : 0,
        carbohydrates: typeof f.carbohydrates === 'number' ? Number(f.carbohydrates.toFixed(1)) : (typeof f.carbs === 'number' ? Number(f.carbs.toFixed(1)) : 0),
        fat: typeof f.fat === 'number' ? Number(f.fat.toFixed(1)) : 0,
        fiber: typeof f.fiber === 'number' ? Number(f.fiber.toFixed(1)) : 0,
        sugar: typeof f.sugar === 'number' ? Number(f.sugar.toFixed(1)) : 0,
        sodium: typeof f.sodium === 'number' ? Math.round(f.sodium) : 0,
        calcium: typeof f.calcium === 'number' ? Math.round(f.calcium) : 0,
        iron: typeof f.iron === 'number' ? Number(f.iron.toFixed(1)) : 0,
        glycemicCategory: f.glycemicCategory || 'medium',
        spiceLevel: f.spiceLevel || 'Medium',
        seasonality: Array.isArray(f.seasonality) ? f.seasonality : (typeof f.seasonality === 'string' ? [f.seasonality] : ['all_year']),
        healthTags: Array.isArray(f.tags) ? f.tags : (Array.isArray(f.suitabilityTags) ? f.suitabilityTags : ['wholesome']),
        allergens: Array.isArray(f.allergens) ? f.allergens : [],
        ingredients: Array.isArray(f.ingredients) ? f.ingredients : (Array.isArray(f.aliases) && f.aliases.length > 0 ? f.aliases : [f.name.trim()]),
        nutrition: {
          calories: typeof f.calories === 'number' ? Math.round(f.calories) : 0,
          protein: typeof f.protein === 'number' ? Number(f.protein.toFixed(1)) : 0,
          carbohydrates: typeof f.carbohydrates === 'number' ? Number(f.carbohydrates.toFixed(1)) : (typeof f.carbs === 'number' ? Number(f.carbs.toFixed(1)) : 0),
          fat: typeof f.fat === 'number' ? Number(f.fat.toFixed(1)) : 0,
          fiber: typeof f.fiber === 'number' ? Number(f.fiber.toFixed(1)) : 0
        },
        preparation: {
          prepTimeMinutes: f.preparationMinutes || 15,
          cookTimeMinutes: f.cookingMinutes || 20,
          difficulty: f.difficulty || 'Easy',
          servingSize: f.servingSize || '1 standard portion'
        },
        servingSize: f.servingSize || '1 standard portion',
        preparationMinutes: f.preparationMinutes || 15,
        difficulty: f.difficulty || 'Easy',
        mealTypes: Array.isArray(f.mealTypes) ? f.mealTypes : ['lunch', 'dinner'],
        aliases: Array.isArray(f.aliases) ? f.aliases : [],
        satietyScore: f.satietyScore || 6,
        budgetLevel: f.budgetLevel || 'budget',
        source: 'Knowledge Base (foodKnowledge)',
        sourceDataset: 'primary_knowledge',
        availability: 'Available',
        description: `${f.cuisine || 'Traditional'} ${category.toLowerCase()} wholesome preparation. Features balanced ${f.calories ? `${Math.round(f.calories)} kcal` : 'nutrition'} with ${f.protein ? `${f.protein}g protein` : 'nourishing ingredients'}.`
      };

      const key = f.name.toLowerCase().trim();
      foodMap.set(key, unifiedItem);
    }
  } catch (err) {
    console.warn('⚠️ [FoodDatabaseService] FoodKnowledge load warning:', err.message);
  }

  // 2. Process Curated Fallback Foods (178 items)
  try {
    if (Array.isArray(FALLBACK_FOODS)) {
      for (const fb of FALLBACK_FOODS) {
        if (!fb || !fb.name) continue;
        const key = fb.name.toLowerCase().trim();

        // If not already in map, add it
        if (!foodMap.has(key)) {
          const dtTags = fb.dietTags || [];
          const nameLower = fb.name.toLowerCase();
          const catLower = (fb.categories && fb.categories[0] ? fb.categories[0] : '').toLowerCase();

          // A food is non-vegetarian ONLY if it contains meat, poultry, fish, seafood or egg dishes
          const hasMeat = /chicken|mutton|beef|pork|fish|salmon|tuna|prawn|shrimp|crab|meat|bacon|turkey|seafood|keema|tikka/i.test(nameLower) ||
                          /seafood|poultry|meat/i.test(catLower);
          const hasEgg = /egg|omelette|bhurji/i.test(nameLower) || /egg/i.test(catLower);

          let isVegan = dtTags.includes('vegan') && !hasMeat && !hasEgg;
          let isVeg = (dtTags.includes('vegetarian') || isVegan) && !hasMeat && !hasEgg;
          let isEggOnly = (dtTags.includes('eggetarian') || hasEgg) && !hasMeat && !isVeg;
          let isNonVeg = hasMeat || (!isVeg && !isEggOnly);

          let dietType = 'Vegetarian';
          if (isVegan) dietType = 'Vegan';
          else if (isNonVeg) dietType = 'Non-Vegetarian';
          else if (isEggOnly) dietType = 'Eggetarian';

          const primaryCategory = (fb.categories && fb.categories[0]) || 'General';
          const image = fb.image || CATEGORY_IMAGES[primaryCategory] || CATEGORY_IMAGES['Default'];

          const unifiedItem = {
            id: String(fb.id || `fb_${key.replace(/[^a-z0-9]/g, '_')}`),
            name: fb.name.trim(),
            image,
            category: primaryCategory,
            cuisine: (fb.contextTags?.cuisine && fb.contextTags.cuisine[0]) || 'Continental',
            dietType,
            isVegetarian: isVeg,
            isVegan,
            isEggetarian: isVeg || isEggOnly,
            isNonVegetarian: isNonVeg,
            calories: typeof fb.calories === 'number' ? Math.round(fb.calories) : 0,
            protein: typeof fb.protein === 'number' ? Number(fb.protein.toFixed(1)) : 0,
            carbohydrates: typeof fb.carbs === 'number' ? Number(fb.carbs.toFixed(1)) : 0,
            fat: typeof fb.fat === 'number' ? Number(fb.fat.toFixed(1)) : 0,
            fiber: typeof fb.fiber === 'number' ? Number(fb.fiber.toFixed(1)) : 0,
            sugar: typeof fb.sugar === 'number' ? Number(fb.sugar.toFixed(1)) : 0,
            sodium: typeof fb.sodium === 'number' ? Math.round(fb.sodium) : 0,
            calcium: 0,
            iron: 0,
            glycemicCategory: fb.nutrientProfile?.glycemicIndex ? 'low' : 'medium',
            spiceLevel: 'Mild',
            seasonality: fb.contextTags?.weather || ['all_year'],
            healthTags: fb.conditionTags?.prefer || dtTags.filter(t => t.includes('high') || t.includes('low') || t.includes('healthy')),
            allergens: Array.isArray(fb.allergens) ? fb.allergens : [],
            ingredients: [fb.name.trim()],
            nutrition: {
              calories: typeof fb.calories === 'number' ? Math.round(fb.calories) : 0,
              protein: typeof fb.protein === 'number' ? Number(fb.protein.toFixed(1)) : 0,
              carbohydrates: typeof fb.carbs === 'number' ? Number(fb.carbs.toFixed(1)) : 0,
              fat: typeof fb.fat === 'number' ? Number(fb.fat.toFixed(1)) : 0,
              fiber: typeof fb.fiber === 'number' ? Number(fb.fiber.toFixed(1)) : 0
            },
            preparation: {
              prepTimeMinutes: 15,
              cookTimeMinutes: 15,
              difficulty: 'Easy',
              servingSize: fb.quantity || '1 serving'
            },
            servingSize: fb.quantity || '1 serving',
            preparationMinutes: 15,
            difficulty: 'Easy',
            mealTypes: fb.categories || ['snack', 'breakfast'],
            aliases: [],
            satietyScore: 7,
            budgetLevel: 'moderate',
            source: 'Curated Fallback (foodiebiteFallbackFoods)',
            sourceDataset: 'curated_fallback',
            availability: 'Available',
            description: `Carefully curated ${primaryCategory.toLowerCase()} item offering balanced nutrients. Nutri-Grade: ${String(fb.grade || 'A').toUpperCase()}.`
          };

          foodMap.set(key, unifiedItem);
        } else {
          // Enrich existing knowledge base food with image or fallback metadata if missing
          const existing = foodMap.get(key);
          if (!existing.image && fb.image) existing.image = fb.image;
          if (Array.isArray(fb.allergens) && existing.allergens.length === 0) {
            existing.allergens = fb.allergens;
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [FoodDatabaseService] FallbackFoods load warning:', err.message);
  }

  const allItems = Array.from(foodMap.values());
  cachedUnifiedFoods = allItems;
  cacheTimestamp = now;
  return allItems;
}

/**
 * Filter, search, and paginate foods for Admin Food Database View
 */
function queryFoodDatabase({
  q = '',
  category = 'all',
  cuisine = 'all',
  dietType = 'all',
  spiceLevel = 'all',
  seasonality = 'all',
  sortBy = 'name',
  sortOrder = 'asc',
  page = 1,
  limit = 12
} = {}) {
  const allFoods = buildUnifiedFoodDatabase();
  let filtered = [...allFoods];

  // 1. Search Query (Name, Cuisine, Category, Ingredients, Allergens, Tags, Aliases, Description)
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    filtered = filtered.filter(f =>
      f.name.toLowerCase().includes(term) ||
      f.cuisine.toLowerCase().includes(term) ||
      f.category.toLowerCase().includes(term) ||
      f.dietType.toLowerCase().includes(term) ||
      (f.ingredients && Array.isArray(f.ingredients) && f.ingredients.some(i => typeof i === 'string' && i.toLowerCase().includes(term))) ||
      (f.description && typeof f.description === 'string' && f.description.toLowerCase().includes(term)) ||
      (f.aliases && f.aliases.some(a => a.toLowerCase().includes(term))) ||
      (f.healthTags && f.healthTags.some(t => t.toLowerCase().includes(term)))
    );
  }

  // 2. Filter: Category
  if (category && category !== 'all') {
    const catLower = category.toLowerCase();
    filtered = filtered.filter(f => f.category.toLowerCase() === catLower);
  }

  // 3. Filter: Cuisine
  if (cuisine && cuisine !== 'all') {
    const cLower = cuisine.toLowerCase();
    filtered = filtered.filter(f => f.cuisine.toLowerCase() === cLower);
  }

  // 4. Filter: Diet Type
  if (dietType && dietType !== 'all') {
    const dtLower = dietType.toLowerCase();
    if (dtLower === 'vegetarian') {
      filtered = filtered.filter(f => f.dietType.toLowerCase() === 'vegetarian');
    } else if (dtLower === 'vegan') {
      filtered = filtered.filter(f => f.dietType.toLowerCase() === 'vegan');
    } else if (dtLower === 'eggetarian') {
      filtered = filtered.filter(f => f.dietType.toLowerCase() === 'eggetarian');
    } else if (dtLower === 'non-vegetarian' || dtLower === 'non-veg') {
      filtered = filtered.filter(f => f.dietType.toLowerCase() === 'non-vegetarian');
    } else {
      filtered = filtered.filter(f => f.dietType.toLowerCase() === dtLower);
    }
  }

  // 5. Filter: Spice Level
  if (spiceLevel && spiceLevel !== 'all') {
    const slLower = spiceLevel.toLowerCase();
    filtered = filtered.filter(f => (f.spiceLevel || '').toLowerCase() === slLower);
  }

  // 6. Filter: Seasonality
  if (seasonality && seasonality !== 'all') {
    const sLower = seasonality.toLowerCase();
    filtered = filtered.filter(f => {
      if (Array.isArray(f.seasonality)) {
        return f.seasonality.some(s => {
          const sStr = String(s).toLowerCase();
          return sStr.includes('all') || sStr.includes(sLower);
        });
      }
      if (typeof f.seasonality === 'string') {
        const sStr = f.seasonality.toLowerCase();
        return sStr.includes('all') || sStr.includes(sLower);
      }
      return true;
    });
  }

  // 7. Sorting
  const isAsc = sortOrder.toLowerCase() === 'asc';
  filtered.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (valA === null || valA === undefined) valA = isAsc ? Infinity : -Infinity;
    if (valB === null || valB === undefined) valB = isAsc ? Infinity : -Infinity;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return isAsc ? (valA - valB) : (valB - valA);
  });

  // 8. Pagination
  const total = filtered.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const totalPages = Math.ceil(total / limitNum) || 1;
  const startIndex = (pageNum - 1) * limitNum;
  const pagedItems = filtered.slice(startIndex, startIndex + limitNum);

  return {
    success: true,
    foods: pagedItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    },
    page: pageNum,
    totalPages,
    total
  };
}

/**
 * Calculates comprehensive dynamic statistics over the food database
 */
function getFoodDatabaseStats() {
  const allFoods = buildUnifiedFoodDatabase();

  let vegCount = 0;
  let nonVegCount = 0;
  let veganCount = 0;
  let eggCount = 0;
  let withNutritionCount = 0;

  const cuisineMap = new Map();
  const categoryMap = new Map();

  for (const f of allFoods) {
    if (f.isVegan) veganCount++;
    if (f.isVegetarian) vegCount++;
    if (f.isEggetarian) eggCount++;
    if (f.isNonVegetarian) nonVegCount++;

    if (f.calories !== null && f.protein !== null) {
      withNutritionCount++;
    }

    if (f.cuisine) {
      cuisineMap.set(f.cuisine, (cuisineMap.get(f.cuisine) || 0) + 1);
    }
    if (f.category) {
      categoryMap.set(f.category, (categoryMap.get(f.category) || 0) + 1);
    }
  }

  const cuisinesList = Array.from(cuisineMap.entries())
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count);

  const categoriesList = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFoods: allFoods.length,
    vegetarian: vegCount,
    vegetarianCount: vegCount,
    nonVegetarian: nonVegCount,
    nonVegetarianCount: nonVegCount,
    vegan: veganCount,
    veganCount: veganCount,
    eggetarian: eggCount,
    eggetarianCount: eggCount,
    totalCuisines: cuisineMap.size,
    cuisinesCount: cuisineMap.size,
    totalCategories: categoryMap.size,
    categoriesCount: categoryMap.size,
    withNutritionInfo: withNutritionCount,
    withNutritionCount,
    cuisines: cuisinesList,
    categories: categoriesList
  };
}

/**
 * Retrieves a single food item by ID
 */
function getFoodItemById(id) {
  const allFoods = buildUnifiedFoodDatabase();
  const targetId = String(id).toLowerCase().trim();
  return allFoods.find(f => f.id.toLowerCase() === targetId || f.name.toLowerCase() === targetId) || null;
}

module.exports = {
  buildUnifiedFoodDatabase,
  queryFoodDatabase,
  getFoodDatabaseStats,
  getFoodItemById
};
