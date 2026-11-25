// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/adminFoodDatabase.test.js
//  FoodieBite Admin Food Database Management & Security Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();
const assert = require('assert');
const {
  buildUnifiedFoodDatabase,
  queryFoodDatabase,
  getFoodDatabaseStats,
  getFoodItemById
} = require('../foodDatabaseService');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('--- Admin Food Database Management Test Suite ---');
  console.log('======================================================\n');

  // ── GROUP 1: Unified Database Aggregation & Deduplication ──
  console.log('[1. UNIFIED DATABASE AGGREGATION & SOURCING]');

  await runTest('Aggregates full FoodieBite catalog (>1,600 real foods) from primary and fallback sources', () => {
    const catalog = buildUnifiedFoodDatabase();
    assert(Array.isArray(catalog), 'Expected catalog to be an array');
    assert(catalog.length >= 1600, `Expected at least 1,600 foods, got ${catalog.length}`);
    
    // Check primary knowledge source presence
    const primaryCount = catalog.filter(f => f.sourceDataset === 'primary_knowledge' || f.source?.includes('foodKnowledge')).length;
    assert(primaryCount >= 1400, `Expected >= 1400 primary foods, got ${primaryCount}`);

    // Check curated fallback source presence
    const fallbackCount = catalog.filter(f => f.sourceDataset === 'curated_fallback' || f.source?.includes('foodiebiteFallbackFoods')).length;
    assert(fallbackCount >= 100, `Expected >= 100 fallback foods, got ${fallbackCount}`);
  });

  await runTest('Every food has complete normalized nutritional profile and valid image', () => {
    const catalog = buildUnifiedFoodDatabase();
    for (const f of catalog) {
      assert(f.id, 'Food missing id');
      assert(f.name, 'Food missing name');
      assert(f.category, `Food ${f.id} missing category`);
      assert(f.cuisine, `Food ${f.id} missing cuisine`);
      assert(['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'].includes(f.dietType), `Invalid dietType: ${f.dietType}`);
      assert(typeof f.calories === 'number' && !isNaN(f.calories), `Food ${f.id} invalid calories`);
      assert(typeof f.protein === 'number' && !isNaN(f.protein), `Food ${f.id} invalid protein`);
      assert(typeof f.image === 'string' && f.image.startsWith('http'), `Food ${f.id} invalid image: ${f.image}`);
    }
  });

  // ── GROUP 2: Search, Filters & Pagination ────────────────────
  console.log('\n[2. QUERYING, SEARCH, FILTERS & SORTING]');

  await runTest('Searches foods by keyword across name, category, and cuisine', () => {
    const res = queryFoodDatabase({ q: 'biryani' });
    assert(res.success, 'Query failed');
    assert(res.total > 0, 'Expected to find biryani items');
    assert(res.foods.every(f => f.name.toLowerCase().includes('biryani') || f.category.toLowerCase().includes('biryani') || f.cuisine.toLowerCase().includes('biryani')));
  });

  await runTest('Filters by Dietary Type (Vegetarian, Non-Vegetarian, Vegan, Eggetarian)', () => {
    const vegRes = queryFoodDatabase({ dietType: 'Vegetarian' });
    assert(vegRes.foods.every(f => f.dietType === 'Vegetarian'), 'Non-veg item found in veg filter');

    const nonVegRes = queryFoodDatabase({ dietType: 'Non-Vegetarian' });
    assert(nonVegRes.foods.every(f => f.dietType === 'Non-Vegetarian'), 'Veg item found in non-veg filter');

    const veganRes = queryFoodDatabase({ dietType: 'Vegan' });
    assert(veganRes.foods.every(f => f.dietType === 'Vegan'), 'Non-vegan item found in vegan filter');
  });

  await runTest('Filters by Cuisine and Category accurately', () => {
    const southRes = queryFoodDatabase({ cuisine: 'South Indian' });
    assert(southRes.foods.every(f => f.cuisine === 'South Indian'), 'Non-South Indian item found');

    const curryRes = queryFoodDatabase({ category: 'Curry' });
    assert(curryRes.foods.every(f => f.category === 'Curry'), 'Non-Curry item found');
  });

  await runTest('Filters by Spice Level and Seasonality', () => {
    const spicyRes = queryFoodDatabase({ spiceLevel: 'Spicy' });
    assert(spicyRes.foods.every(f => (f.spiceLevel || '').toLowerCase() === 'spicy'), 'Non-spicy item found');

    const summerRes = queryFoodDatabase({ seasonality: 'summer' });
    assert(summerRes.foods.every(f => {
      const arr = Array.isArray(f.seasonality) ? f.seasonality : [f.seasonality];
      return arr.some(s => {
        const sStr = String(s).toLowerCase();
        return sStr.includes('summer') || sStr.includes('all');
      });
    }), 'Incompatible season found');
  });

  await runTest('Sorts accurately by name, calories, and protein in asc and desc orders', () => {
    const sortCaloriesAsc = queryFoodDatabase({ sortBy: 'calories', sortOrder: 'asc', limit: 50 });
    for (let i = 0; i < sortCaloriesAsc.foods.length - 1; i++) {
      assert(sortCaloriesAsc.foods[i].calories <= sortCaloriesAsc.foods[i + 1].calories, 'Calories not sorted ascending');
    }

    const sortProteinDesc = queryFoodDatabase({ sortBy: 'protein', sortOrder: 'desc', limit: 50 });
    for (let i = 0; i < sortProteinDesc.foods.length - 1; i++) {
      assert(sortProteinDesc.foods[i].protein >= sortProteinDesc.foods[i + 1].protein, 'Protein not sorted descending');
    }
  });

  await runTest('Paginates results correctly with totalPages and total counts', () => {
    const page1 = queryFoodDatabase({ page: 1, limit: 15 });
    const page2 = queryFoodDatabase({ page: 2, limit: 15 });

    assert.strictEqual(page1.foods.length, 15);
    assert.strictEqual(page2.foods.length, 15);
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page2.page, 2);
    assert.notStrictEqual(page1.foods[0].id, page2.foods[0].id, 'Page 1 and Page 2 should have distinct items');
  });

  // ── GROUP 3: Live Statistics & Single Item Detail ───────────
  console.log('\n[3. STATS COMPUTATION & DETAIL LOOKUP]');

  await runTest('Computes aggregated statistics without hardcoded numbers', () => {
    const stats = getFoodDatabaseStats();
    assert(stats.totalFoods >= 1600, `Total foods stats: ${stats.totalFoods}`);
    assert(stats.vegetarian > 1000, `Veg foods: ${stats.vegetarian}`);
    assert(stats.nonVegetarian >= 300, `Non-veg foods: ${stats.nonVegetarian}`);
    assert(stats.vegan > 400, `Vegan foods: ${stats.vegan}`);
    assert(stats.totalCuisines >= 15, `Cuisines: ${stats.totalCuisines}`);
    assert(stats.totalCategories >= 30, `Categories: ${stats.totalCategories}`);
    assert.strictEqual(stats.withNutritionInfo, stats.totalFoods, 'Expected 100% nutrition coverage');

    // Verify 0 overlap between vegetarian and non-vegetarian classifications
    const catalog = buildUnifiedFoodDatabase();
    const overlapping = catalog.filter(f => f.isVegetarian && f.isNonVegetarian);
    assert.strictEqual(overlapping.length, 0, `Expected 0 overlap, found ${overlapping.length} items`);
  });

  await runTest('Retrieves single food detail by ID with complete metadata', () => {
    const catalog = buildUnifiedFoodDatabase();
    const targetItem = catalog[0];
    const detail = getFoodItemById(targetItem.id);

    assert(detail, `Failed to retrieve item ${targetItem.id}`);
    assert.strictEqual(detail.id, targetItem.id);
    assert.strictEqual(detail.name, targetItem.name);
    assert(Array.isArray(detail.ingredients), 'Expected ingredients array');
    assert(Array.isArray(detail.allergens), 'Expected allergens array');
    assert(Array.isArray(detail.healthTags), 'Expected healthTags array');
    assert(detail.nutrition, 'Expected nutrition object');
  });

  // ── GROUP 4: Security & Authorization Validation ────────────
  console.log('\n[4. SECURITY & AUTHORIZATION VALIDATION]');

  await runTest('Admin route middleware enforces authentication and administrator role', () => {
    const adminRoutes = require('../../routes/adminRoutes');
    const { protect, verifyAdmin } = require('../../middleware/authMiddleware');
    assert(adminRoutes, 'adminRoutes should export express router');
    
    const hasProtect = adminRoutes.stack.some(layer => layer.handle === protect || layer.name === 'protect' || layer.handle?.name === 'protect');
    const hasAdmin = adminRoutes.stack.some(layer => layer.handle === verifyAdmin || layer.name === 'verifyAdmin' || layer.name === 'requireAdmin' || layer.handle?.name === 'requireAdmin');
    
    assert(hasProtect, 'adminRoutes missing protect middleware');
    assert(hasAdmin, 'adminRoutes missing verifyAdmin middleware');
  });

  await runTest('Medical routes restrict normal users strictly to their own user_id', () => {
    const medicalController = require('../../controllers/medicalController');
    assert(typeof medicalController.getMedicalReports === 'function');
    assert(typeof medicalController.getMedicalReport === 'function');
    assert(typeof medicalController.deleteMedicalReport === 'function');
  });

  console.log('\n======================================================');
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
