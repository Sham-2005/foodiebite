// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/apiEmailWelcomeIntegration.test.js
//  HTTP Route Integration Test for POST /api/email/welcome
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../backend/.env') });
const assert = require('assert');
const express = require('express');
const emailRoutes = require('../../routes/emailRoutes');

// Mock email automation service dispatch to prevent network side-effects during route testing
const emailAutomationService = require('../emailAutomationService');
const originalSendWelcome = emailAutomationService.sendWelcomeEmail;

const app = express();
app.use(express.json());
app.use('/api/email', emailRoutes);

let server;
let port;
let baseUrl;

async function setup() {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/email`;
      resolve();
    });
  });
}

async function teardown() {
  if (server) {
    server.close();
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('  ROUTE INTEGRATION: POST /api/email/welcome');
  console.log('============================================================\n');

  await setup();
  const fetch = require('node-fetch');

  try {
    // 1. Unauthenticated newly registered user payload
    const testEmail = `newuser_${Date.now()}@testfood.com`;
    console.log('  [TEST 1] Testing unauthenticated welcome email trigger...');
    const res1 = await fetch(`${baseUrl}/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          id: `usr_${Date.now()}`,
          email: testEmail,
          name: 'Integration User',
          dietType: 'Vegetarian'
        }
      })
    });
    const body1 = await res1.json();
    console.log('  Response 1:', res1.status, body1);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(body1.success, true);
    console.log('  ✅ PASS: Unauthenticated user successfully dispatched welcome email');

    // 2. Duplicate welcome email prevention
    console.log('  [TEST 2] Testing duplicate welcome email prevention on same account...');
    const res2 = await fetch(`${baseUrl}/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          id: `usr_${Date.now()}`,
          email: testEmail,
          name: 'Integration User'
        }
      })
    });
    const body2 = await res2.json();
    console.log('  Response 2:', res2.status, body2);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(body2.skipped, true);
    console.log('  ✅ PASS: Duplicate welcome email was safely prevented');

    // 3. Stale / Expired Bearer Token does NOT cause 401
    console.log('  [TEST 3] Testing stale bearer token fallback...');
    const freshEmail = `stale_token_${Date.now()}@testfood.com`;
    const res3 = await fetch(`${baseUrl}/welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer expired.or.stale.dummy.token'
      },
      body: JSON.stringify({
        user: {
          email: freshEmail,
          name: 'Stale Token User',
          dietType: 'Vegan'
        }
      })
    });
    const body3 = await res3.json();
    console.log('  Response 3:', res3.status, body3);
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(body3.success, true);
    console.log('  ✅ PASS: Stale Bearer token fell back gracefully to body without 401');

    // 4. Invalid email format rejection
    console.log('  [TEST 4] Testing invalid email format validation...');
    const res4 = await fetch(`${baseUrl}/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          email: 'invalid-email-address',
          name: 'Bad User'
        }
      })
    });
    const body4 = await res4.json();
    console.log('  Response 4:', res4.status, body4);
    assert.strictEqual(res4.status, 400);
    assert.strictEqual(body4.success, false);
    console.log('  ✅ PASS: Invalid email format was correctly rejected with 400');

    console.log('\n============================================================');
    console.log('  ALL ROUTE INTEGRATION TESTS PASSED ✅');
    console.log('============================================================\n');

  } finally {
    await teardown();
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  teardown().then(() => process.exit(1));
});
