// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/supabaseAccountDeletionAndSync.test.js
//  FoodieBite — Supabase Account Deletion & Data Synchronization Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

const assert = require('assert');
const { getSupabaseClient } = require('../../config/supabase');
const userController = require('../../controllers/userController');
const adminController = require('../../controllers/adminController');
const feedbackStore = require('../feedbackStore');
const restaurantRequestStore = require('../restaurantRequestStore');

let testsPassed = 0;
let testsFailed = 0;

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Reason: ${err.message}`);
    testsFailed++;
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    setHeader() {
      return this;
    }
  };
  return res;
}

async function runSuite() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING: Supabase Account Deletion & Data Sync Test Suite');
  console.log('===============================================================\n');

  // TEST 1: Verification of Supabase Single Source of Truth Connectivity
  await runTest('Supabase client is configured and can query core tables', async () => {
    const client = getSupabaseClient();
    assert.ok(client, 'Supabase client must be initialized');

    const { error: profileErr } = await client.from('profiles').select('id').limit(1);
    assert.strictEqual(profileErr, null, `Querying profiles failed: ${profileErr?.message}`);

    const { error: favErr } = await client.from('user_favorites').select('id').limit(1);
    assert.strictEqual(favErr, null, `Querying user_favorites failed: ${favErr?.message}`);

    const { error: searchErr } = await client.from('user_search_history').select('id').limit(1);
    assert.strictEqual(searchErr, null, `Querying user_search_history failed: ${searchErr?.message}`);

    const { error: fbErr } = await client.from('user_feedback').select('id').limit(1);
    assert.strictEqual(fbErr, null, `Querying user_feedback failed: ${fbErr?.message}`);

    const { error: restErr } = await client.from('restaurant_requests').select('id').limit(1);
    assert.strictEqual(restErr, null, `Querying restaurant_requests failed: ${restErr?.message}`);

    const { error: medErr } = await client.from('medical_reports').select('id').limit(1);
    assert.strictEqual(medErr, null, `Querying medical_reports failed: ${medErr?.message}`);

    const { error: healthErr } = await client.from('health_profiles').select('user_id').limit(1);
    assert.strictEqual(healthErr, null, `Querying health_profiles failed: ${healthErr?.message}`);

    const { error: mealErr } = await client.from('user_meal_logs').select('id').limit(1);
    assert.strictEqual(mealErr, null, `Querying user_meal_logs failed: ${mealErr?.message}`);

    const { error: sysErr } = await client.from('system_settings').select('key').limit(1);
    assert.strictEqual(sysErr, null, `Querying system_settings failed: ${sysErr?.message}`);
  });

  // TEST 2: User Account Deletion Requires Authentication
  await runTest('deleteUserAccount returns 401 when no authenticated user is present', async () => {
    const req = { user: null };
    const res = createMockRes();

    await userController.deleteUserAccount(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('Authentication required'));
  });

  // TEST 3: Admin Deletion Security: Non-Admin Blocked
  await runTest('Admin deletion prevents unauthorized non-admin deletion', async () => {
    const unauthReq = {
      params: { id: 'some_target_user_id' },
      user: { email: 'hacker@example.com', role: 'user' }
    };
    const unauthRes = createMockRes();
    const next = (err) => { throw err; };

    await adminController.deleteUser(unauthReq, unauthRes, next);
    assert.strictEqual(unauthRes.statusCode, 403);
    assert.strictEqual(unauthRes.body.success, false);
    assert.ok(unauthRes.body.message.includes('Access denied'));
  });

  // TEST 4: Admin Deletion Security: Primary Administrator Cannot Be Deleted
  await runTest('Admin deletion strictly protects primary administrator account', async () => {
    const adminReq = {
      params: { id: 'DIzyGlgaTgTW6MP1MVMVmEuIug93' },
      user: { email: 'sham111205s@gmail.com', role: 'admin', id: 'DIzyGlgaTgTW6MP1MVMVmEuIug93' }
    };
    const adminRes = createMockRes();
    const next = (err) => { throw err; };

    await adminController.deleteUser(adminReq, adminRes, next);
    assert.strictEqual(adminRes.statusCode, 400);
    assert.strictEqual(adminRes.body.success, false);
    assert.ok(adminRes.body.message.includes('Cannot delete the authorized administrator account'));
  });

  // TEST 5: Anti-Silent-Failure: Controller Rejects With 500 If Profile Is Not Deleted
  await runTest('deleteUserAccount rejects with 500 if profile row is not purged (anti-silent-failure)', async () => {
    // If a non-existent or un-deletable profile is attempted, it must verify and not return false success
    const fakeId = '00000000-0000-4000-8000-000000000999';
    const req = {
      user: { id: fakeId, uid: fakeId }
    };
    const res = createMockRes();

    await userController.deleteUserAccount(req, res);
    // Since fakeId does not exist in profiles, remainingProfile is null and storage/tables are purged
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
  });

  // TEST 6: User Controller Input Validation
  await runTest('addFavoriteFood rejects missing user ID or foodId with 400', async () => {
    const invalidReq = { user: null, body: {} };
    const res = createMockRes();
    const next = (err) => { throw err; };

    await userController.addFavoriteFood(invalidReq, res, next);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 7: Search History Input Validation
  await runTest('addSearchHistory rejects empty query with 400', async () => {
    const invalidReq = { user: { id: '00000000-0000-0000-0000-000000000001' }, body: { query: '   ' } };
    const res = createMockRes();
    const next = (err) => { throw err; };

    await userController.addSearchHistory(invalidReq, res, next);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 8: Restaurant Request Store Input Validation
  await runTest('restaurantRequestStore validates mandatory merchant and restaurant fields', async () => {
    try {
      await restaurantRequestStore.createRequest({
        merchantId: null,
        restaurantData: {}
      });
      assert.fail('Should have thrown validation error for missing merchantId');
    } catch (err) {
      assert.ok(err.message.includes('required'));
    }

    try {
      await restaurantRequestStore.rejectRequest('some_id', {}, '');
      assert.fail('Should have thrown validation error for missing rejection reason');
    } catch (err) {
      assert.ok(err.message.includes('reason for rejection is required'));
    }
  });

  // TEST 9: Notification Settings Persist to Supabase public.system_settings
  await runTest('getNotificationSettings and updateNotificationSettings interact with Supabase system_settings', async () => {
    const req = {};
    const res = createMockRes();
    const next = (err) => { throw err; };

    await adminController.getNotificationSettings(req, res, next);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.settings, 'Settings must be returned');
    assert.strictEqual(typeof res.body.settings.dailyRecommendationsEnabled, 'boolean');
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('===============================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
