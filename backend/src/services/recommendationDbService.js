// ─────────────────────────────────────────────────────────────
//  src/services/recommendationDbService.js
//  Firestore Query Service for the foodiebiteRecommendations Collection
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

// ── Lazy Firestore getter — never crashes on module load ──────
function getDb() {
  try {
    return admin.firestore();
  } catch (err) {
    console.warn('⚠️ recommendationDbService: Firestore unavailable:', err.message);
    return null;
  }
}


// ── Emergency hardcoded fallback foods (never empty) ─────────
const EMERGENCY_FOODS = [
  {
    id: 'ef-001',
    name: 'Oats',
    image: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=500&auto=format&fit=crop&q=80',
    calories: 389,
    protein: 17,
    carbs: 66,
    fat: 7,
    fiber: 11,
    sugar: 1,
    sodium: 10,
    healthScore: 95,
    grade: 'a',
    healthGrade: 'A',
    category: 'Breakfast',
    dietTags: ['vegetarian', 'vegan', 'high-protein', 'high-fiber', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-002',
    name: 'Banana',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&auto=format&fit=crop&q=80',
    calories: 89,
    protein: 1,
    carbs: 23,
    fat: 0,
    fiber: 3,
    sugar: 12,
    sodium: 1,
    healthScore: 88,
    grade: 'b',
    healthGrade: 'B',
    category: 'Fruits',
    dietTags: ['vegetarian', 'vegan', 'fruit', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-003',
    name: 'Boiled Egg',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&auto=format&fit=crop&q=80',
    calories: 155,
    protein: 13,
    carbs: 1,
    fat: 11,
    fiber: 0,
    sugar: 1,
    sodium: 124,
    healthScore: 90,
    grade: 'a',
    healthGrade: 'A',
    category: 'Protein',
    dietTags: ['eggetarian', 'high-protein', 'low-carb', 'healthy'],
    allergens: ['egg']
  },
  {
    id: 'ef-004',
    name: 'Greek Yogurt',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80',
    calories: 100,
    protein: 17,
    carbs: 6,
    fat: 1,
    fiber: 0,
    sugar: 4,
    sodium: 50,
    healthScore: 92,
    grade: 'a',
    healthGrade: 'A',
    category: 'Dairy',
    dietTags: ['vegetarian', 'eggetarian', 'high-protein', 'low-carb', 'healthy'],
    allergens: ['milk']
  },
  {
    id: 'ef-005',
    name: 'Mixed Nuts',
    image: 'https://images.unsplash.com/photo-1536591375315-1b83886532ce?w=500&auto=format&fit=crop&q=80',
    calories: 607,
    protein: 21,
    carbs: 21,
    fat: 54,
    fiber: 7,
    sugar: 4,
    sodium: 15,
    healthScore: 85,
    grade: 'b',
    healthGrade: 'B',
    category: 'Snacks',
    dietTags: ['vegetarian', 'vegan', 'high-protein', 'healthy-fats', 'healthy'],
    allergens: ['tree nuts']
  },
  {
    id: 'ef-006',
    name: 'Chicken Breast',
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&auto=format&fit=crop&q=80',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 4,
    fiber: 0,
    sugar: 0,
    sodium: 74,
    healthScore: 95,
    grade: 'a',
    healthGrade: 'A',
    category: 'Protein',
    dietTags: ['non-vegetarian', 'high-protein', 'low-carb', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-007',
    name: 'Brown Rice',
    image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
    calories: 216,
    protein: 5,
    carbs: 45,
    fat: 2,
    fiber: 4,
    sugar: 1,
    sodium: 10,
    healthScore: 82,
    grade: 'b',
    healthGrade: 'B',
    category: 'Grains',
    dietTags: ['vegetarian', 'vegan', 'grains', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-008',
    name: 'Lentil Soup',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80',
    calories: 230,
    protein: 18,
    carbs: 40,
    fat: 1,
    fiber: 16,
    sugar: 3,
    sodium: 380,
    healthScore: 93,
    grade: 'a',
    healthGrade: 'A',
    category: 'Soup',
    dietTags: ['vegetarian', 'vegan', 'high-protein', 'high-fiber', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-009',
    name: 'Spinach Salad',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
    calories: 65,
    protein: 5,
    carbs: 7,
    fat: 1,
    fiber: 4,
    sugar: 2,
    sodium: 90,
    healthScore: 96,
    grade: 'a',
    healthGrade: 'A',
    category: 'Salads',
    dietTags: ['vegetarian', 'vegan', 'low-carb', 'high-fiber', 'healthy'],
    allergens: []
  },
  {
    id: 'ef-010',
    name: 'Apple',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80',
    calories: 95,
    protein: 0,
    carbs: 25,
    fat: 0,
    fiber: 4,
    sugar: 19,
    sodium: 2,
    healthScore: 89,
    grade: 'a',
    healthGrade: 'A',
    category: 'Fruits',
    dietTags: ['vegetarian', 'vegan', 'fruit', 'healthy'],
    allergens: []
  },
];

/**
 * Query recommendations from the foodiebiteRecommendations collection.
 * Fallback order: Firestore → EMERGENCY_FOODS (hardcoded).
 * Never returns an empty array.
 */
async function queryRecommendationsFromDb(dietType, healthGoals = [], mood = null, weather = null) {
  // ── Tier 1: Firestore ─────────────────────────────────────
  const db = getDb();
  if (db) {
    try {
      const recsRef = db.collection('foodiebiteRecommendations');
      let queryRef = recsRef;

      if (dietType) {
        queryRef = queryRef.where('dietTags', 'array-contains', dietType);
      }

      const snap = await queryRef.get();
      let matchedFoods = [];

      snap.forEach(doc => {
        const data = doc.data();
        const foods = data.foods || [];
        let weight = 1;

        if (healthGoals.length > 0 && data.goalTags) {
          if (healthGoals.some(g => data.goalTags.includes(g))) weight += 2;
        }
        if (mood && data.moodTags && data.moodTags.includes(mood))                         weight += 2;
        if (weather && weather.season && data.weatherTags && data.weatherTags.includes(weather.season)) weight += 1;

        foods.forEach(f => matchedFoods.push({ ...f, matchWeight: weight }));
      });

      if (matchedFoods.length > 0) {
        // Deduplicate by ID
        const seen = new Set();
        const unique = [];
        matchedFoods.forEach(item => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
          } else {
            const ex = unique.find(f => f.id === item.id);
            if (ex && item.matchWeight > ex.matchWeight) ex.matchWeight = item.matchWeight;
          }
        });
        return unique.sort((a, b) => b.matchWeight - a.matchWeight);
      }

      console.warn('⚠️ recommendationDbService: No Firestore results — using emergency fallback');
    } catch (err) {
      console.warn('⚠️ recommendationDbService: Firestore query failed (safe):', err.message);
    }
  } else {
    console.warn('⚠️ recommendationDbService: Firestore unavailable — using emergency fallback');
  }

  // ── Tier 2: Comprehensive Verified Fallback Catalog (180+ validated foods) ──
  try {
    const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');
    const { normalizeFoodList } = require('./foodNameNormalizer');
    const combined = [...FALLBACK_FOODS, ...EMERGENCY_FOODS];
    return normalizeFoodList(combined).map(f => ({ ...f, matchWeight: 1, source: f.source || 'fallback' }));
  } catch (fallbackErr) {
    console.warn('⚠️ recommendationDbService: Error loading FALLBACK_FOODS, using emergency fallback:', fallbackErr.message);
    return EMERGENCY_FOODS.map(f => ({ ...f, matchWeight: 1, source: 'emergency_fallback' }));
  }
}

module.exports = {
  queryRecommendationsFromDb
};
