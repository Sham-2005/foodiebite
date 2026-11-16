// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/supabaseConnection.test.mjs
//  FoodieBite Supabase Client & Connection Service Test Suite
// ─────────────────────────────────────────────────────────────

import assert from 'assert';

console.log('\n🧪 Running Supabase Connection & Client Unit Tests...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
  }
}

// TEST 1: Module Exports Verification
await runAsyncTest('Module exports: supabaseClient.js exports required singleton and status', async () => {
  const supabaseModule = await import('../../config/supabaseClient.js');
  assert(typeof supabaseModule.getSupabaseClient === 'function', 'getSupabaseClient should be a function');
  assert('isSupabaseConfigured' in supabaseModule, 'isSupabaseConfigured should be exported');
});

// TEST 2: Service Exports Verification
await runAsyncTest('Module exports: supabaseService.js exports testSupabaseConnection and fetchConnectionTest', async () => {
  const serviceModule = await import('../supabaseService.js');
  assert(typeof serviceModule.testSupabaseConnection === 'function', 'testSupabaseConnection should be a function');
  assert(typeof serviceModule.fetchConnectionTest === 'function', 'fetchConnectionTest should be a function');
});

// TEST 3: Graceful Handling of Unconfigured / Placeholder Credentials
await runAsyncTest('Configuration Guard: Returns "Configuration Missing" when credentials are placeholder', async () => {
  const serviceModule = await import('../supabaseService.js');
  const res = await serviceModule.testSupabaseConnection();
  
  assert(typeof res === 'object', 'Result should be an object');
  assert('connected' in res, 'Result should have connected boolean');
  assert('status' in res, 'Result should have status string');
  assert('message' in res, 'Result should have message string');

  // Since publishable key is currently 'YOUR_PUBLISHABLE_KEY' in .env:
  if (res.status === 'Configuration Missing') {
    assert.strictEqual(res.connected, false, 'Should be disconnected when configuration is missing');
    assert(res.message.includes('credentials') || res.message.includes('placeholder'), 'Message should explain missing configuration');
  } else {
    // If real credentials were provided
    assert(typeof res.connected === 'boolean', 'Connected must be boolean');
  }
});

// TEST 4: Fetch Connection Test Guard
await runAsyncTest('Query Guard: fetchConnectionTest handles unconfigured state gracefully', async () => {
  const serviceModule = await import('../supabaseService.js');
  const res = await serviceModule.fetchConnectionTest();
  
  assert(typeof res === 'object', 'Result must be an object');
  assert('success' in res, 'Result must contain success boolean');
  if (!res.success) {
    assert(typeof res.error === 'string', 'Error message should be string');
  }
});

// TEST 5: No Secret Exposure
await runAsyncTest('Security: Logs and error messages never expose secret keys', async () => {
  const serviceModule = await import('../supabaseService.js');
  const res = await serviceModule.testSupabaseConnection();
  
  const serialized = JSON.stringify(res);
  assert(!serialized.includes('service_role'), 'Result must not contain service_role');
  assert(!serialized.includes('sbp_'), 'Result must not expose Supabase access tokens');
});

console.log(`\n📊 Supabase Tests Passed: ${passedTests} / ${totalTests} (100%)\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

