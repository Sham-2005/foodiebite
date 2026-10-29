// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/adminSecurityAndManagement.test.js
//  FoodieBite Admin Security, Account Management & Notification Tests
// ─────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();
const assert = require('assert');
const jwt = require('jsonwebtoken');
const userStore = require('../userStore');
const adminController = require('../../controllers/adminController');
const { protect, requireAdmin, verifyAdmin } = require('../../middleware/authMiddleware');

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
  console.log('--- Admin Security, Authorization & Management Tests ---');
  console.log('======================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';
  const AUTHORIZED_ADMIN = 'sham111205s@gmail.com';

  // Helper to create test token
  const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  // ── GROUP 1: Sole Authorized Administrator Enforcement ─────
  console.log('[1. SOLE AUTHORIZED ADMINISTRATOR ENFORCEMENT]');

  await runTest('Only sham111205s@gmail.com receives admin role in userStore', () => {
    const adminUser = userStore.upsertUser({
      uid: 'admin_test_1',
      email: 'sham111205s@gmail.com',
      name: 'Authorized Admin'
    });
    assert.strictEqual(adminUser.role, 'admin');

    const normalUser = userStore.upsertUser({
      uid: 'normal_test_1',
      email: 'regular_user@example.com',
      name: 'Regular User'
    });
    assert.strictEqual(normalUser.role, 'user');

    // Case insensitivity & trimming check
    const caseAdmin = userStore.upsertUser({
      uid: 'admin_test_case',
      email: '  SHAM111205S@GMAIL.COM  ',
      name: 'Case Admin'
    });
    assert.strictEqual(caseAdmin.role, 'admin');

    // Legacy admin accounts must not receive admin role
    const legacyAdmin = userStore.upsertUser({
      uid: 'legacy_admin_1',
      email: 'admin@foodiebite.com',
      name: 'Legacy Admin'
    });
    assert.strictEqual(legacyAdmin.role, 'user', 'Legacy admin@foodiebite.com must be demoted to user');
  });

  // ── GROUP 2: Middleware Route Protection ───────────────────
  console.log('\n[2. ROUTE & MIDDLEWARE AUTHORIZATION]');

  await runTest('protect rejects unauthenticated requests with HTTP 401', async () => {
    const req = { headers: {} };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (code) => { statusSent = code; return res; },
      json: (data) => { jsonSent = data; }
    };
    await protect(req, res, () => {
      assert.fail('Should not call next() when unauthenticated');
    });
    assert.strictEqual(statusSent, 401);
    assert.strictEqual(jsonSent.success, false);
  });

  await runTest('requireAdmin rejects normal authenticated user with HTTP 403', async () => {
    const normalToken = makeToken({ uid: 'usr_normal', email: 'regular@example.com', role: 'user' });
    const req = { headers: { authorization: `Bearer ${normalToken}` } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (code) => { statusSent = code; return res; },
      json: (data) => { jsonSent = data; }
    };
    await protect(req, res, () => {
      requireAdmin(req, res, () => {
        assert.fail('Should not call next() for normal user');
      });
    });
    assert.strictEqual(statusSent, 403);
    assert.strictEqual(jsonSent.success, false);
  });

  await runTest('Grants access through protect and requireAdmin for sham111205s@gmail.com', async () => {
    const adminToken = makeToken({ uid: 'DIzyGlgaTgTW6MP1MVMVmEuIug93', email: 'sham111205s@gmail.com' });
    const req = { headers: { authorization: `Bearer ${adminToken}` } };
    let nextCalled = false;
    const res = {
      status: () => res,
      json: () => {}
    };
    await protect(req, res, () => {
      requireAdmin(req, res, () => {
        nextCalled = true;
      });
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.email, AUTHORIZED_ADMIN);
    assert.strictEqual(req.user.role, 'admin');
  });

  // ── GROUP 3: Disable Account Functionality ─────────────────
  console.log('\n[3. ACCOUNT DISABLING & ACCESS BLOCKING]');

  await runTest('Admin can disable user and update database status', async () => {
    userStore.updateUser('user_to_disable_99', { disabled: false, accountStatus: 'active' });
    const targetUser = userStore.upsertUser({
      uid: 'user_to_disable_99',
      email: 'disable_test@example.com',
      name: 'To Disable',
      disabled: false,
      accountStatus: 'active'
    });
    assert.strictEqual(targetUser.disabled, false);

    const req = {
      user: { email: AUTHORIZED_ADMIN, role: 'admin' },
      params: { id: 'user_to_disable_99' },
      body: { disabled: true }
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };
    const next = (err) => { if (err) throw err; };

    await adminController.disableUser(req, res, next);
    assert.strictEqual(statusSent, 200);
    assert.strictEqual(jsonSent.success, true);
    assert.strictEqual(jsonSent.disabled, true);

    const updated = userStore.getUserById('user_to_disable_99');
    assert.strictEqual(updated.disabled, true);
  });

  await runTest('Disabled user is blocked by protect middleware with HTTP 403', async () => {
    const disabledToken = makeToken({ uid: 'user_to_disable_99', email: 'disable_test@example.com' });
    const req = { headers: { authorization: `Bearer ${disabledToken}` } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };
    await protect(req, res, () => {
      assert.fail('Should not allow disabled user through protect');
    });
    assert.strictEqual(statusSent, 403);
    assert.strictEqual(jsonSent.success, false);
    assert.strictEqual(jsonSent.message.includes('disabled'), true);
  });

  await runTest('Authorized admin cannot disable their own account', async () => {
    const req = {
      user: { email: AUTHORIZED_ADMIN, role: 'admin' },
      params: { id: 'DIzyGlgaTgTW6MP1MVMVmEuIug93' },
      body: { disabled: true }
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };
    const next = (err) => { if (err) throw err; };

    await adminController.disableUser(req, res, next);
    assert.strictEqual(statusSent, 400);
    assert.strictEqual(jsonSent.success, false);
    assert.strictEqual(jsonSent.message.toLowerCase().includes('cannot disable'), true);
  });

  // ── GROUP 4: Permanent Deletion Functionality ──────────────
  console.log('\n[4. PERMANENT ACCOUNT DELETION]');

  await runTest('Authorized admin can permanently delete a user account', async () => {
    userStore.upsertUser({
      uid: 'user_to_delete_77',
      email: 'delete_test@example.com',
      name: 'To Delete'
    });
    assert.notStrictEqual(userStore.getUserById('user_to_delete_77'), null);

    const req = {
      user: { email: AUTHORIZED_ADMIN, role: 'admin' },
      params: { id: 'user_to_delete_77' }
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };
    const next = (err) => { if (err) throw err; };

    await adminController.deleteUser(req, res, next);
    assert.strictEqual(statusSent, 200);
    assert.strictEqual(jsonSent.success, true);
    assert.strictEqual(jsonSent.permanent, true);

    const deleted = userStore.getUserById('user_to_delete_77');
    assert.strictEqual(deleted, null, 'User must be permanently removed from store');
  });

  await runTest('Authorized admin cannot delete their own account', async () => {
    const req = {
      user: { email: AUTHORIZED_ADMIN, role: 'admin' },
      params: { id: 'DIzyGlgaTgTW6MP1MVMVmEuIug93' }
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };
    const next = (err) => { if (err) throw err; };

    await adminController.deleteUser(req, res, next);
    assert.strictEqual(statusSent, 400);
    assert.strictEqual(jsonSent.success, false);
    assert.strictEqual(jsonSent.message.toLowerCase().includes('cannot delete'), true);
  });

  // ── GROUP 5: Notification Settings & Scheduling ───────────
  console.log('\n[5. NOTIFICATION SETTINGS & EMAIL PERSISTENCE]');

  await runTest('Retrieves persistent notification settings', async () => {
    const req = { user: { email: AUTHORIZED_ADMIN, role: 'admin' } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };

    await adminController.getNotificationSettings(req, res);
    assert.strictEqual(statusSent, 200);
    assert.strictEqual(jsonSent.success, true);
    assert.strictEqual(typeof jsonSent.settings.welcomeEmailEnabled, 'boolean');
    assert.strictEqual(typeof jsonSent.settings.dailyRecommendationsEnabled, 'boolean');
  });

  await runTest('Updates and persists notification preferences', async () => {
    const newSettings = {
      welcomeEmailEnabled: true,
      dailyRecommendationsEnabled: true,
      dailyRecommendationSchedule: '0 8 * * *',
      marketingEmailsEnabled: false,
      securityAlertsEnabled: true,
      adminFeedbackAlertsEnabled: true
    };
    const req = {
      user: { email: AUTHORIZED_ADMIN, role: 'admin' },
      body: newSettings
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status: (c) => { statusSent = c; return res; },
      json: (d) => { jsonSent = d; }
    };

    await adminController.updateNotificationSettings(req, res);
    assert.strictEqual(statusSent, 200);
    assert.strictEqual(jsonSent.success, true);
    assert.strictEqual(jsonSent.settings.dailyRecommendationSchedule, '0 8 * * *');
  });

  // ── SUMMARY ────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  if (passedTests === totalTests) {
    console.log('All Admin Security & Management Tests PASSED flawlessly!');
  } else {
    console.error(`Failed ${totalTests - passedTests} tests.`);
    process.exit(1);
  }
  console.log('======================================================\n');
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
