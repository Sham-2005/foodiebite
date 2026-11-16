// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/jwtSecurityRemediation.test.js
//  FoodieBite P0 JWT Security Remediation Verification Suite
//  Tests cryptographic token verification and admin authorization:
//    1. Valid Supabase user JWT
//    2. Valid administrator JWT
//    3. Forged JWT containing admin email
//    4. JWT with modified payload
//    5. JWT with invalid signature
//    6. Expired JWT
//    7. Malformed JWT
//    8. Missing authorization header
//    9. Empty bearer token
//   10. User attempting admin endpoint
//   11. Unauthenticated request attempting admin endpoint
// ─────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();
const assert = require('assert');
const jwt = require('jsonwebtoken');
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

function createMockResponse() {
  return {
    statusCode: null,
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

async function runAllSecurityTests() {
  console.log('\n======================================================');
  console.log('--- P0 JWT AUTHENTICATION SECURITY REMEDIATION TESTS ---');
  console.log('======================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';
  const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test_supabase_jwt_secret_remediation_2026';
  process.env.SUPABASE_JWT_SECRET = SUPABASE_JWT_SECRET;

  const AUTHORIZED_ADMIN = 'sham111205s@gmail.com';
  const NORMAL_USER_EMAIL = 'john.doe@example.com';

  // ── TEST 1: Valid Supabase user JWT ─────────────────────────
  await runTest('1. Valid Supabase user JWT passes protect and assigns role "user"', async () => {
    const validSupabaseToken = jwt.sign(
      {
        sub: 'e7b0a82b-5867-4632-90ab-1234567890ab',
        email: NORMAL_USER_EMAIL,
        aud: 'authenticated',
        iss: 'https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1',
        user_metadata: { full_name: 'John Doe' }
      },
      SUPABASE_JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${validSupabaseToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Next() must be called for valid Supabase user');
    assert.strictEqual(res.statusCode, null, 'Status must not be set to error');
    assert.strictEqual(req.user.email, NORMAL_USER_EMAIL);
    assert.strictEqual(req.user.role, 'user');
    assert.strictEqual(req.user.provider, 'supabase');
  });

  // ── TEST 2: Valid administrator JWT ─────────────────────────
  await runTest('2. Valid administrator JWT passes protect and requireAdmin', async () => {
    const adminToken = jwt.sign(
      {
        uid: 'DIzyGlgaTgTW6MP1MVMVmEuIug93',
        email: AUTHORIZED_ADMIN,
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${adminToken}` } };
    const res = createMockResponse();
    let protectPassed = false;
    let adminPassed = false;

    await protect(req, res, () => {
      protectPassed = true;
      requireAdmin(req, res, () => {
        adminPassed = true;
      });
    });

    assert.strictEqual(protectPassed, true, 'Protect must pass for valid admin');
    assert.strictEqual(adminPassed, true, 'requireAdmin must pass for authorized admin');
    assert.strictEqual(req.user.email, AUTHORIZED_ADMIN);
    assert.strictEqual(req.user.role, 'admin');
  });

  // ── TEST 3: Forged JWT containing admin email ───────────────
  await runTest('3. Forged JWT containing admin email is strictly rejected with HTTP 401', async () => {
    // Attacker crafts a token with admin email but signs with a rogue key
    const forgedToken = jwt.sign(
      {
        sub: 'attacker_fake_id_666',
        email: AUTHORIZED_ADMIN,
        role: 'admin',
        aud: 'authenticated'
      },
      'attacker_unknown_private_secret_key',
      { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Forged JWT must NEVER call next()');
    assert.strictEqual(res.statusCode, 401, 'Forged token must return 401');
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(req.user, undefined, 'req.user must not be attached on forged token');
  });

  await runTest('3b. Live Supabase Auth API verification rejects forged token against remote server', async () => {
    // Temporarily unset SUPABASE_JWT_SECRET to force live HTTPS call to Supabase Auth API
    const savedSecret = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;

    const forgedToken = jwt.sign(
      {
        sub: 'attacker_fake_id_777',
        email: AUTHORIZED_ADMIN,
        role: 'admin',
        aud: 'authenticated',
        iss: 'https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1'
      },
      'fake_attacker_signature_key',
      { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    try {
      await protect(req, res, () => { nextCalled = true; });
    } finally {
      process.env.SUPABASE_JWT_SECRET = savedSecret;
    }

    assert.strictEqual(nextCalled, false, 'Forged JWT against live Supabase must never call next()');
    assert.strictEqual(res.statusCode, 401, 'Remote Supabase rejection must result in 401');
    assert.strictEqual(res.jsonData.success, false);
  });

  // ── TEST 4: JWT with modified payload ───────────────────────
  await runTest('4. JWT with modified payload is rejected with HTTP 401 due to signature mismatch', async () => {
    // Generate valid token for regular user
    const originalToken = jwt.sign(
      { uid: 'usr_orig_1', email: NORMAL_USER_EMAIL, role: 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Tamper with payload by changing email to admin email without re-signing with secret
    const parts = originalToken.split('.');
    const tamperedPayloadObj = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    tamperedPayloadObj.email = AUTHORIZED_ADMIN;
    tamperedPayloadObj.role = 'admin';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(tamperedPayloadObj)).toString('base64');
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const req = { headers: { authorization: `Bearer ${tamperedToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Tampered token must NEVER call next()');
    assert.strictEqual(res.statusCode, 401, 'Tampered token must return 401');
    assert.strictEqual(res.jsonData.success, false);
  });

  // ── TEST 5: JWT with invalid signature ──────────────────────
  await runTest('5. JWT with invalid / corrupted signature is rejected with HTTP 401', async () => {
    const validToken = jwt.sign(
      { uid: 'usr_1', email: NORMAL_USER_EMAIL },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const parts = validToken.split('.');
    const corruptedToken = `${parts[0]}.${parts[1]}.corrupted_signature_xyz123`;

    const req = { headers: { authorization: `Bearer ${corruptedToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
  });

  // ── TEST 6: Expired JWT ─────────────────────────────────────
  await runTest('6. Expired JWT is rejected with HTTP 401', async () => {
    const expiredToken = jwt.sign(
      { uid: 'usr_expired_1', email: NORMAL_USER_EMAIL },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
  });

  // ── TEST 7: Malformed JWT ───────────────────────────────────
  await runTest('7. Malformed JWT (invalid format / missing parts) is rejected with HTTP 401', async () => {
    const malformedTokens = [
      'not.a.valid.jwt.string',
      'justoneparttoken',
      'header.only',
      'header..signature',
      '..',
      'eyJhbGciOiJIUzI1NiJ9.invalidbase64!@#$.sig'
    ];

    for (const badToken of malformedTokens) {
      const req = { headers: { authorization: `Bearer ${badToken}` } };
      const res = createMockResponse();
      let nextCalled = false;

      await protect(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, `Bad token ${badToken} must not pass`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.success, false);
    }
  });

  // ── TEST 8: Missing authorization header ────────────────────
  await runTest('8. Missing authorization header is rejected with HTTP 401', async () => {
    const req = { headers: {} };
    const res = createMockResponse();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Not authorised. No token.');
  });

  // ── TEST 9: Empty bearer token ──────────────────────────────
  await runTest('9. Empty bearer token is rejected with HTTP 401', async () => {
    const emptyHeaders = [
      'Bearer',
      'Bearer ',
      'Bearer     ',
      'Bearer\t'
    ];

    for (const h of emptyHeaders) {
      const req = { headers: { authorization: h } };
      const res = createMockResponse();
      let nextCalled = false;

      await protect(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.jsonData.success, false);
    }
  });

  // ── TEST 10: User attempting admin endpoint ─────────────────
  await runTest('10. Authenticated non-admin user attempting admin endpoint is rejected with HTTP 403', async () => {
    const userToken = jwt.sign(
      {
        uid: 'usr_non_admin_999',
        email: 'regular_user@example.com',
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${userToken}` } };
    const res = createMockResponse();
    let protectPassed = false;
    let adminPassed = false;

    await protect(req, res, () => {
      protectPassed = true;
      requireAdmin(req, res, () => {
        adminPassed = true;
      });
    });

    assert.strictEqual(protectPassed, true, 'Legitimate user token must pass protect');
    assert.strictEqual(adminPassed, false, 'Non-admin user must NEVER pass requireAdmin');
    assert.strictEqual(res.statusCode, 403, 'Must return 403 Forbidden');
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.message, 'Access denied. Authorized administrator privileges required.');
  });

  // ── TEST 11: Unauthenticated request attempting admin endpoint
  await runTest('11. Unauthenticated request attempting admin endpoint is rejected with HTTP 401', async () => {
    const req = { headers: {} };
    const res = createMockResponse();
    let adminPassed = false;

    await protect(req, res, () => {
      requireAdmin(req, res, () => {
        adminPassed = true;
      });
    });

    assert.strictEqual(adminPassed, false, 'Unauthenticated request must never reach admin handler');
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonData.success, false);
  });

  console.log(`\n======================================================`);
  console.log(`Security Test Suite Results: ${passedTests} / ${totalTests} passed`);
  console.log(`======================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllSecurityTests().catch(err => {
  console.error('Fatal error in security test runner:', err);
  process.exit(1);
});
