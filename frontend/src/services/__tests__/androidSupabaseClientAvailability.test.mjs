// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/androidSupabaseClientAvailability.test.mjs
//  FoodieBite Android Supabase Client Availability & Polyfill Test Suite
// ─────────────────────────────────────────────────────────────

import assert from 'assert';

console.log('\n🧪 Running Android Supabase Client Availability & Polyfill Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
  }
}

// TEST 1: URL Polyfill & ensureUrlSupport
await runTest('1. ensureUrlSupport activates WHATWG-compliant URL on React Native', async () => {
  const { ensureUrlSupport } = await import('../../config/supabaseClient.js');
  assert.strictEqual(typeof ensureUrlSupport, 'function', 'ensureUrlSupport should be exported');
  
  ensureUrlSupport();
  assert(typeof URL !== 'undefined', 'global.URL must be defined');
  const u = new URL('https://wzhxalmixfeqszgwqeqr.supabase.co/auth/v1');
  assert.strictEqual(u.protocol, 'https:', 'URL must implement .protocol');
  assert.strictEqual(u.hostname, 'wzhxalmixfeqszgwqeqr.supabase.co', 'URL must implement .hostname');
});

// TEST 2: getSupabaseClient Singleton
await runTest('2. getSupabaseClient returns initialized singleton instance', async () => {
  const { getSupabaseClient, isSupabaseConfigured } = await import('../../config/supabaseClient.js');
  assert(isSupabaseConfigured, 'Supabase must be configured with canonical credentials');
  const client = getSupabaseClient();
  assert(client !== null && client !== undefined, 'getSupabaseClient() must not return null');
  assert(typeof client.auth === 'object', 'client.auth must be present');
  assert(typeof client.auth.signInWithIdToken === 'function', 'client.auth.signInWithIdToken must be a function');
  assert(typeof client.from === 'function', 'client.from must be a function');
});

// TEST 3: Direct `supabase` Proxy Export
await runTest('3. Direct `supabase` export delegates to initialized client', async () => {
  const { supabase } = await import('../../config/supabaseClient.js');
  assert(supabase !== null && supabase !== undefined, 'supabase export must be defined');
  assert(typeof supabase.auth === 'object', 'supabase.auth must be accessible via Proxy');
  assert(typeof supabase.auth.getSession === 'function', 'supabase.auth.getSession must be a function');
});

// TEST 4: getSupabaseInitError reports null on healthy init
await runTest('4. getSupabaseInitError reports null when client is healthy', async () => {
  const { getSupabaseInitError } = await import('../../config/supabaseClient.js');
  const err = getSupabaseInitError();
  assert.strictEqual(err, null, 'Initialization error should be null when initialized successfully');
});

// TEST 5: signInWithGoogleIdToken uses initialized client and requires token
await runTest('5. signInWithGoogleIdToken rejects missing token without returning client unavailable', async () => {
  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');
  const res = await signInWithGoogleIdToken({});
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.code, 'MISSING_ID_TOKEN');
  assert.notStrictEqual(res.code, 'CLIENT_UNAVAILABLE', 'Client must be available, error should be missing token');
});

// TEST 6: Real Supabase endpoint connectivity
await runTest('6. Supabase health endpoint reachable via testSupabaseConnection', async () => {
  const { testSupabaseConnection } = await import('../supabaseService.js');
  const res = await testSupabaseConnection();
  assert.strictEqual(res.connected, true, 'Must connect to live Supabase Auth service');
  assert.strictEqual(res.status, 'Connected');
  assert(res.latencyMs > 0, 'Latency must be reported');
});

// TEST 7: googleAuth.android imports and pre-validates Supabase client
await runTest('7. googleAuth.android exports loginWithGoogle and configureGoogleSignIn', async () => {
  const googleAuthAndroid = await import('../googleAuth.android.js');
  assert.strictEqual(typeof googleAuthAndroid.loginWithGoogle, 'function');
  assert.strictEqual(typeof googleAuthAndroid.configureGoogleSignIn, 'function');
  assert.strictEqual(typeof googleAuthAndroid.signOutFromGoogle, 'function');
});

console.log(`\n📊 Android Supabase Client Availability Tests Passed: ${passedTests} / ${totalTests} (100%)\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
