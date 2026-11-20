// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/p1SupabaseBackendIntegration.test.js
//  FoodieBite Phase P1 — Core Backend Supabase Integration Verification
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../backend/.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();

const assert = require('assert');
const jwt = require('jsonwebtoken');
const supabaseConfig = require('../../config/supabase');
const { getSupabaseClient, getUserSupabaseClient, getSupabaseAdmin, isSupabaseConfigured } = supabaseConfig;
const userController = require('../../controllers/userController');
const coachController = require('../../controllers/coachController');
const medicalController = require('../../controllers/medicalController');

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

function createMockResponse() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    }
  };
}

async function runAllP1IntegrationTests() {
  console.log('\n======================================================');
  console.log('--- PHASE P1 — CORE BACKEND SUPABASE INTEGRATION TESTS ---');
  console.log('======================================================\n');

  const testUserId = '00000000-0000-4000-8000-000000000001';
  const testUserEmail = 'p1_test_user@foodiebite.test';
  const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';

  const userToken = jwt.sign(
    {
      sub: testUserId,
      id: testUserId,
      email: testUserEmail,
      role: 'user',
      aud: 'authenticated',
      iss: 'https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ── TEST GROUP 1: Supabase Client Configuration ───────────
  console.log('\n[GROUP 1: Supabase Backend Client Configuration]');

  await runTest('Supabase configuration flags and env variables exist', async () => {
    assert.strictEqual(typeof process.env.SUPABASE_URL, 'string', 'SUPABASE_URL must be defined');
    assert.ok(process.env.SUPABASE_URL.startsWith('https://'), 'SUPABASE_URL must be an HTTPS URL');
    assert.strictEqual(typeof process.env.SUPABASE_ANON_KEY, 'string', 'SUPABASE_ANON_KEY must be defined');
    assert.strictEqual(isSupabaseConfigured, true, 'isSupabaseConfigured must be true');
  });

  await runTest('Centralized and User-Scoped Supabase Clients initialize correctly', async () => {
    const defaultClient = getSupabaseClient();
    assert.ok(defaultClient, 'Default Supabase client must be initialized');
    assert.strictEqual(typeof defaultClient.from, 'function', 'client.from must be a function');

    const scopedClient = getUserSupabaseClient(userToken);
    assert.ok(scopedClient, 'User scoped client must be initialized');
    assert.strictEqual(typeof scopedClient.from, 'function', 'scopedClient.from must be a function');
  });

  // ── TEST GROUP 2: User Profile & Security ──────────────────
  console.log('\n[GROUP 2: User Profile & Privilege Protection]');

  const originalGetUserSupabaseClient = supabaseConfig.getUserSupabaseClient;

  // In-memory test store simulating Supabase PostgreSQL tables
  const mockDb = {
    profiles: new Map(),
    user_favorites: [],
    user_search_history: []
  };

  mockDb.profiles.set(testUserId, {
    id: testUserId,
    email: testUserEmail,
    name: 'Initial Gourmet',
    role: 'user',
    diet_type: 'Vegetarian',
    dietType: 'Vegetarian',
    account_status: 'active',
    disabled: false,
    preferences: {
      dietType: 'Vegetarian',
      spiceLevel: 'Medium',
      cuisines: ['indian'],
      allergies: []
    }
  });

  function createMockSupabaseClient(tables, realClient) {
    return {
      storage: realClient.storage,
      from(table) {
        if (!tables[table]) {
          return realClient.from(table);
        }
        let op = 'select';
        let filters = [];
        let insertData = null;
        let updateData = null;
        let isSingle = false;

        const chain = {
          select(fields) {
            return chain;
          },
          insert(data) {
            op = 'insert';
            insertData = data;
            return chain;
          },
          upsert(data, opts) {
            op = 'upsert';
            insertData = data;
            return chain;
          },
          update(data) {
            op = 'update';
            updateData = data;
            return chain;
          },
          delete() {
            op = 'delete';
            return chain;
          },
          eq(col, val) {
            filters.push({ col, val: String(val) });
            return chain;
          },
          order() {
            return chain;
          },
          limit() {
            return chain;
          },
          maybeSingle() {
            isSingle = true;
            return chain;
          },
          single() {
            isSingle = true;
            return chain;
          },
          async then(resolve, reject) {
            try {
              if (table === 'profiles') {
                const idFilter = filters.find(f => f.col === 'id');
                const targetId = idFilter ? idFilter.val : testUserId;
                if (op === 'select') {
                  const p = tables.profiles.get(targetId);
                  return resolve({ data: p ? { ...p } : null, error: null });
                }
                if (op === 'update') {
                  const existing = tables.profiles.get(targetId) || {};
                  const updated = { ...existing, ...updateData };
                  tables.profiles.set(targetId, updated);
                  return resolve({ data: updated, error: null });
                }
                if (op === 'upsert' || op === 'insert') {
                  tables.profiles.set(insertData.id, insertData);
                  return resolve({ data: insertData, error: null });
                }
                if (op === 'delete') {
                  tables.profiles.delete(targetId);
                  return resolve({ data: null, error: null });
                }
              }

              if (table === 'user_favorites') {
                if (op === 'select') {
                  const uFilter = filters.find(f => f.col === 'user_id');
                  const list = tables.user_favorites.filter(f => !uFilter || String(f.user_id) === uFilter.val);
                  return resolve({ data: [...list], error: null });
                }
                if (op === 'upsert') {
                  const idx = tables.user_favorites.findIndex(f => String(f.user_id) === String(insertData.user_id) && String(f.food_id) === String(insertData.food_id));
                  const item = { id: 'fav_' + Date.now(), ...insertData };
                  if (idx >= 0) {
                    tables.user_favorites[idx] = item;
                  } else {
                    tables.user_favorites.push(item);
                  }
                  return resolve({ data: item, error: null });
                }
                if (op === 'delete') {
                  tables.user_favorites = tables.user_favorites.filter(f => {
                    return !filters.every(flt => String(f[flt.col]) === flt.val);
                  });
                  return resolve({ data: null, error: null });
                }
              }

              if (table === 'user_search_history') {
                if (op === 'insert') {
                  const item = { id: 'search_' + Date.now(), ...insertData };
                  tables.user_search_history.push(item);
                  return resolve({ data: item, error: null });
                }
                if (op === 'select') {
                  const uFilter = filters.find(f => f.col === 'user_id');
                  const list = tables.user_search_history.filter(s => !uFilter || String(s.user_id) === uFilter.val);
                  return resolve({ data: [...list], error: null });
                }
                if (op === 'delete') {
                  const uFilter = filters.find(f => f.col === 'user_id');
                  tables.user_search_history = tables.user_search_history.filter(s => uFilter && String(s.user_id) !== uFilter.val);
                  return resolve({ data: null, error: null });
                }
              }

              return resolve({ data: null, error: null });
            } catch (err) {
              reject(err);
            }
          }
        };
        return chain;
      }
    };
  }

  supabaseConfig.getUserSupabaseClient = (token) => {
    return createMockSupabaseClient(mockDb, getSupabaseClient());
  };

  await runTest('Profile Retrieval: GET /api/user/profile handles user session', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail, role: 'user' },
      token: userToken
    };
    const res = createMockResponse();

    await userController.getProfile(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
    assert.ok(res.jsonData.success, 'Profile response success must be true');
  });

  await runTest('Profile Update: Whitelisted fields update successfully', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail, role: 'user' },
      token: userToken,
      body: {
        name: 'Test Gourmet',
        age: 28,
        gender: 'female',
        dietType: 'Vegan'
      }
    };
    const res = createMockResponse();

    await userController.updateProfile(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.profile.name, 'Test Gourmet');
    assert.strictEqual(res.jsonData.profile.diet_type, 'Vegan');
  });

  await runTest('Security Enforcement: Non-admin privilege escalation is rejected', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail, role: 'user' },
      token: userToken,
      body: {
        name: 'Attempted Exploiter',
        role: 'admin',
        disabled: true,
        account_status: 'disabled'
      }
    };
    const res = createMockResponse();

    await userController.updateProfile(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.profile.role, 'user', 'Role must remain user');
    assert.strictEqual(res.jsonData.profile.disabled, false, 'Disabled must remain false');
    assert.strictEqual(res.jsonData.profile.account_status, 'active', 'Account status must remain active');
  });

  // ── TEST GROUP 3: Dietary Preferences ─────────────────────
  console.log('\n[GROUP 3: Dietary Preferences Integration]');

  await runTest('Preferences: Update and Retrieve dietary preferences JSONB', async () => {
    const updateReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: {
        dietType: 'Keto',
        spiceLevel: 'High',
        allergies: ['peanuts', 'shellfish'],
        cuisines: ['mexican', 'italian']
      }
    };
    const updateRes = createMockResponse();

    await userController.updatePreferences(updateReq, updateRes, (err) => { throw err; });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.jsonData.preferences.dietType, 'Keto');
    assert.deepStrictEqual(updateRes.jsonData.preferences.allergies, ['peanuts', 'shellfish']);

    const getReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const getRes = createMockResponse();

    await userController.getPreferences(getReq, getRes, (err) => { throw err; });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.jsonData.preferences.dietType, 'Keto');
  });

  // ── TEST GROUP 4: User Favorites & Duplicate Prevention ───
  console.log('\n[GROUP 4: User Favorites (public.user_favorites)]');

  const sampleFood = {
    foodId: 'food-test-avocado-salad-101',
    foodName: 'Keto Avocado Crunch Salad',
    cuisine: 'mexican',
    category: 'salad',
    calories: 320,
    protein: 8
  };

  await runTest('Favorites: Add food to user_favorites', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: sampleFood
    };
    const res = createMockResponse();

    await userController.addFavoriteFood(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.foodId, sampleFood.foodId);
  });

  await runTest('Favorites: Duplicate insertion is idempotent (onConflict: user_id, food_id)', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: sampleFood
    };
    const res = createMockResponse();

    await userController.addFavoriteFood(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);

    const getReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const getRes = createMockResponse();
    await userController.getFavorites(getReq, getRes, (err) => { throw err; });
    assert.strictEqual(getRes.statusCode, 200);
    const matches = getRes.jsonData.favoriteFoods.filter(f => (f.foodId || f.id) === sampleFood.foodId);
    assert.strictEqual(matches.length, 1, 'Duplicate favorites must not exist for the same food');
  });

  await runTest('Favorites: Remove food from user_favorites', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      params: { foodId: sampleFood.foodId }
    };
    const res = createMockResponse();

    await userController.removeFavoriteFood(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
  });

  // ── TEST GROUP 5: Search History ──────────────────────────
  console.log('\n[GROUP 5: User Search History (public.user_search_history)]');

  await runTest('Search History: Record query and retrieve search history', async () => {
    const addReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: {
        query: 'organic green tea',
        filters: { diet: 'Vegan', maxCalories: 50 },
        resultCount: 14
      }
    };
    const addRes = createMockResponse();

    await userController.addSearchHistory(addReq, addRes, (err) => { throw err; });
    assert.strictEqual(addRes.statusCode, 201);
    assert.strictEqual(addRes.jsonData.success, true);

    const getReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const getRes = createMockResponse();
    await userController.getSearchHistory(getReq, getRes, (err) => { throw err; });
    assert.strictEqual(getRes.statusCode, 200);
    assert.ok(getRes.jsonData.history.length >= 1, 'At least 1 search record must exist');
  });

  await runTest('Search History: Clear search history deletes records', async () => {
    const clearReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const clearRes = createMockResponse();

    await userController.clearSearchHistory(clearReq, clearRes, (err) => { throw err; });
    assert.strictEqual(clearRes.statusCode, 200);
    assert.strictEqual(clearRes.jsonData.success, true);

    const getReq = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const getRes = createMockResponse();
    await userController.getSearchHistory(getReq, getRes, (err) => { throw err; });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.jsonData.history.length, 0, 'Search history must be cleared');
  });

  // ── TEST GROUP 6: AI Coach Integration ────────────────────
  console.log('\n[GROUP 6: AI Coach (coach_threads & coach_messages)]');

  await runTest('AI Coach: Chat message creates thread, replies, and persists message', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: {
        threadId: 'default',
        message: 'What is a healthy high protein breakfast for vegetarians?'
      }
    };
    const res = createMockResponse();

    await coachController.handleChatMessage(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(typeof res.jsonData.reply === 'string' && res.jsonData.reply.length > 0, 'AI Coach must return reply');
    assert.ok(res.jsonData.threadId, 'AI Coach must return resolved threadId');
    assert.ok(res.jsonData.sessionId, 'AI Coach must return sessionId');
  });

  // ── TEST GROUP 7: Medical Reports & Health Profiles ───────
  console.log('\n[GROUP 7: Medical Reports & Health Profiles (medical_reports & health_profiles)]');

  await runTest('Health Profile: GET /api/medical/health-profile returns structured health profile', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const res = createMockResponse();

    await medicalController.getHealthProfile(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.healthProfile, 'Health profile object must be returned');
    assert.ok(typeof res.jsonData.healthProfile.overallScore === 'number', 'overallScore must be a number');
  });

  await runTest('Manual Biomarkers: POST /api/medical/manual-values updates health profile', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken,
      body: {
        values: {
          fastingGlucose: '110',
          totalCholesterol: '210',
          vitaminD: '22'
        },
        notes: 'Routine health checkup'
      }
    };
    const res = createMockResponse();

    await medicalController.saveManualValues(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(res.jsonData.analysis, 'Analysis must be returned');
    assert.ok(res.jsonData.analysis.healthScores, 'Health scores must be computed');
  });

  await runTest('Medical Reports: GET /api/medical/reports returns user-scoped reports list', async () => {
    const req = {
      user: { id: testUserId, email: testUserEmail },
      token: userToken
    };
    const res = createMockResponse();

    await medicalController.getMedicalReports(req, res, (err) => { throw err; });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.ok(Array.isArray(res.jsonData.reports), 'reports must be an array');
  });

  // Restore original client function
  supabaseConfig.getUserSupabaseClient = originalGetUserSupabaseClient;

  // ── SUMMARY REPORT ────────────────────────────────────────
  console.log('\n======================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllP1IntegrationTests().catch(err => {
    console.error('Test suite failed unexpectedly:', err);
    process.exit(1);
  });
}

module.exports = { runAllP1IntegrationTests };
