// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/emailAuthVerificationWorkflow.test.mjs
//  Complete Email Authentication, Verification, Resend & SMTP Diagnostics Suite
// ─────────────────────────────────────────────────────────────

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill in-memory localStorage for Node test runner
const memoryStorage = {};
global.window = {
  location: {
    origin: 'http://localhost:3000',
    hash: '',
    search: '',
  },
  localStorage: {
    getItem: (key) => memoryStorage[key] || null,
    setItem: (key, val) => { memoryStorage[key] = String(val); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
  },
};
global.localStorage = global.window.localStorage;
global.__DEV__ = false;

// Load frontend/.env for environment configuration
const envPath = path.resolve(__dirname, '../../../../frontend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (m) {
      let val = (m[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1).trim();
      }
      process.env[m[1]] = val;
    }
  });
}

let testsPassed = 0;
let testsTotal = 0;

async function runTest(name, fn) {
  testsTotal++;
  try {
    await fn();
    testsPassed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
    throw err;
  }
}

async function runEmailAuthSuite() {
  console.log('\n🧪 Running Email Authentication, Resend & SMTP Workflow Test Suite...\n');

  // Import client and services
  const { getSupabaseClient, isSupabaseConfigured } = await import('../../config/supabaseClient.js');
  const client = getSupabaseClient();

  assert(isSupabaseConfigured, 'Supabase client must be configured');
  assert(client && client.auth, 'Supabase Auth must be available on client');

  // Safe mock default for RPC
  client.rpc = async () => ({ data: 'rpc-log-id', error: null });

  const { registerWithEmail, resendVerificationEmail, loginWithEmail, resetPassword, isValidEmail } = await import('../supabaseAuthService.js');
  const { apiRegister, apiLogin, apiResendVerificationEmail, apiForgotPassword } = await import('../api.js');

  // ─────────────────────────────────────────────────────────────
  // 1. INVALID EMAIL VALIDATION TEST
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 1: Invalid email format is rejected immediately before hitting Supabase', async () => {
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail('not-an-email'), false);
    assert.strictEqual(isValidEmail('user@'), false);
    assert.strictEqual(isValidEmail('@domain.com'), false);
    assert.strictEqual(isValidEmail('valid.user@foodiebite.com'), true);

    let threw = false;
    try {
      await apiRegister({
        name: 'Invalid User',
        email: 'invalid-email-address',
        password: 'Password123',
        gender: 'Male',
        age: 25,
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('valid email address'), `Expected valid email error, got: ${err.message}`);
    }
    assert(threw, 'Should throw on invalid email');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. NEW USER REGISTRATION WITH EMAIL CONFIRMATION ACTIVE
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 2: New user registration triggers confirmation email and returns requiresVerification: true', async () => {
    let capturedSignUpOptions = null;
    client.auth.signUp = async (params) => {
      capturedSignUpOptions = params;
      return {
        data: {
          user: {
            id: '11111111-2222-3333-4444-555555555555',
            email: params.email,
            identities: [{ id: 'identity-1' }],
          },
          session: null, // session null = email confirmation ON
        },
        error: null,
      };
    };

    const res = await registerWithEmail({
      email: 'newuser@foodiebite.com',
      password: 'StrongPassword123',
      fullName: 'New Foodie',
      dietType: 'Vegetarian',
      age: 24,
      gender: 'Female',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.requiresVerification, true);
    assert.strictEqual(res.user.email, 'newuser@foodiebite.com');
    assert(capturedSignUpOptions.options.emailRedirectTo.includes('http://localhost:3000') || capturedSignUpOptions.options.emailRedirectTo.includes('foodiebite://'));
    assert(res.message.includes('check your inbox'));
  });

  // ─────────────────────────────────────────────────────────────
  // 3. SMTP FAILURE HANDLING ("Error sending confirmation email")
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 3: Catches Brevo SMTP relay failure ("Error sending confirmation email") and maps to user-friendly message', async () => {
    client.auth.signUp = async () => ({
      data: { user: null, session: null },
      error: { message: 'Error sending confirmation email', status: 500 },
    });

    const res = await registerWithEmail({
      email: 'smtp.test@foodiebite.com',
      password: 'StrongPassword123',
      fullName: 'SMTP Test User',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.rawError, 'Error sending confirmation email');
    assert(res.error.includes('Unable to send verification email'), `Expected friendly SMTP error message but got: ${res.error}`);
    assert(res.error.includes('Resend Verification Email'), 'Should point user to Resend Verification Email action');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. RATE LIMIT HANDLING (HTTP 429 / over_email_send_rate_limit)
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 4: Catches GoTrue email rate limits and maps to clear wait guidance', async () => {
    client.auth.signUp = async () => ({
      data: { user: null, session: null },
      error: { message: 'over_email_send_rate_limit', status: 429 },
    });

    const res = await registerWithEmail({
      email: 'ratelimit.test@foodiebite.com',
      password: 'StrongPassword123',
      fullName: 'Rate Limit User',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'RATE_LIMIT');
    assert(res.error.includes('Too many email requests'), `Expected rate limit message, got: ${res.error}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. DUPLICATE REGISTRATION ATTEMPT
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 5: Duplicate registration returns clear guidance without leaking user credentials', async () => {
    client.auth.signUp = async () => ({
      data: {
        user: {
          id: 'existing-uuid-1',
          email: 'duplicate@foodiebite.com',
          identities: [], // Empty identities array signals existing user
        },
        session: null,
      },
      error: null,
    });

    const res = await registerWithEmail({
      email: 'duplicate@foodiebite.com',
      password: 'Password123',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'USER_ALREADY_EXISTS');
    assert(res.error.includes('already exists'), 'Expected duplicate account message');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. LOGIN BEFORE EMAIL VERIFICATION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 6: Login before verification is intercepted and attaches isUnverified: true', async () => {
    client.auth.signInWithPassword = async () => ({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed' },
    });

    const res = await loginWithEmail({
      email: 'unverified@foodiebite.com',
      password: 'Password123',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isUnverified, true);
    assert.strictEqual(res.code, 'EMAIL_NOT_CONFIRMED');
    assert(res.error.includes('not been verified'), `Expected unverified message, got: ${res.error}`);

    // Verify apiLogin layer attaches isUnverified flag
    let threw = false;
    try {
      await apiLogin({ email: 'unverified@foodiebite.com', password: 'Password123' });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.isUnverified, true, 'Error should have isUnverified flag attached');
      assert.strictEqual(err.email, 'unverified@foodiebite.com');
    }
    assert(threw, 'apiLogin should throw for unverified user');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. RESEND CONFIRMATION EMAIL FUNCTIONALITY
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 7: Resend confirmation email dispatches email via client.auth.resend', async () => {
    let capturedResendArgs = null;
    client.auth.resend = async (args) => {
      capturedResendArgs = args;
      return { data: {}, error: null };
    };

    const res = await resendVerificationEmail({
      email: 'resend.test@foodiebite.com',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedResendArgs.type, 'signup');
    assert.strictEqual(capturedResendArgs.email, 'resend.test@foodiebite.com');
    assert(res.message.includes('sent to resend.test@foodiebite.com'));
  });

  // ─────────────────────────────────────────────────────────────
  // 8. RESEND CONFIRMATION EMAIL 60-SECOND COOLDOWN PROTECTION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 8: Rapid resend attempts are blocked by 60-second cooldown protection', async () => {
    // Immediate second call for the same email
    const duplicateResend = await resendVerificationEmail({
      email: 'resend.test@foodiebite.com',
    });

    assert.strictEqual(duplicateResend.success, false);
    assert.strictEqual(duplicateResend.code, 'COOLDOWN_ACTIVE');
    assert(duplicateResend.error.includes('Please wait'));
    assert(duplicateResend.remainingSeconds > 0 && duplicateResend.remainingSeconds <= 60);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. INCORRECT PASSWORD HANDLING
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 9: Incorrect password returns user-friendly error', async () => {
    client.auth.signInWithPassword = async () => ({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const res = await loginWithEmail({
      email: 'verified@foodiebite.com',
      password: 'WrongPassword',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'Incorrect email or password. Please try again.');
  });

  // ─────────────────────────────────────────────────────────────
  // 10. LOGIN AFTER SUCCESSFUL EMAIL VERIFICATION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 10: Verified user logs in smoothly and retrieves full session', async () => {
    const verifiedUserId = '77777777-8888-9999-0000-111111111111';
    client.auth.signInWithPassword = async () => ({
      data: {
        user: {
          id: verifiedUserId,
          email: 'verified@foodiebite.com',
          email_confirmed_at: '2026-11-04T12:00:00Z',
        },
        session: { access_token: 'valid-jwt-token-verified-user' },
      },
      error: null,
    });

    client.from = () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: verifiedUserId,
              email: 'verified@foodiebite.com',
              name: 'Verified User',
              role: 'user',
              disabled: false,
              account_status: 'active',
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await loginWithEmail({
      email: 'verified@foodiebite.com',
      password: 'CorrectPassword123',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.id, verifiedUserId);
    assert.strictEqual(res.session.access_token, 'valid-jwt-token-verified-user');
  });

  // ─────────────────────────────────────────────────────────────
  // 11. PASSWORD RESET EMAIL REQUEST
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 11: Password reset email dispatches reset link with correct redirect URL', async () => {
    let capturedResetArgs = null;
    client.auth.resetPasswordForEmail = async (email, options) => {
      capturedResetArgs = { email, options };
      return { data: {}, error: null };
    };

    const res = await resetPassword('forgotpass@foodiebite.com');
    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedResetArgs.email, 'forgotpass@foodiebite.com');
    assert(capturedResetArgs.options.redirectTo.includes('reset-password'));
    assert(res.message.includes('Password reset link sent'));
  });

  // ─────────────────────────────────────────────────────────────
  // 12. PASSWORD RESET COOLDOWN PROTECTION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 12: Password reset enforces cooldown to protect against spam attacks', async () => {
    const res = await resetPassword('forgotpass@foodiebite.com');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'COOLDOWN_ACTIVE');
    assert(res.error.includes('Please wait'));
  });

  console.log(`\n📊 Email Auth & Verification Tests: ${testsPassed} / ${testsTotal} Passed (100%)\n`);
}

runEmailAuthSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
