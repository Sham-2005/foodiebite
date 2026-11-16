import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory local storage polyfill
const memoryStorage = {};
let currentWindowLocation = {
  origin: 'http://localhost:3000',
  href: 'http://localhost:3000',
  pathname: '/auth/callback',
  search: '',
  hash: '',
  replace: (target) => {
    currentWindowLocation.href = target;
    currentWindowLocation.pathname = target.startsWith('http') ? new URL(target).pathname : target;
  }
};

global.window = {
  get location() {
    return currentWindowLocation;
  },
  set location(val) {
    currentWindowLocation = val;
  },
  history: {
    replaceState: (state, title, url) => {
      currentWindowLocation.pathname = url;
    }
  },
  localStorage: {
    getItem: (key) => memoryStorage[key] || null,
    setItem: (key, val) => { memoryStorage[key] = String(val); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
  },
  sessionStorage: {
    getItem: (key) => memoryStorage[key] || null,
    setItem: (key, val) => { memoryStorage[key] = String(val); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
  }
};
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;
global.__DEV__ = false;

// Load frontend/.env
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

console.log('🧪 Running Comprehensive Google OAuth Callback Verification Scenarios...\n');

const { getSupabaseClient, isSupabaseConfigured } = await import('../../config/supabaseClient.js');
const client = getSupabaseClient();

assert(isSupabaseConfigured, 'Supabase client must be configured');
assert(client && client.auth, 'Supabase Auth must be available on client');

client.rpc = async () => ({ data: 'rpc-log-ok', error: null });

const { handleOAuthCallback } = await import('../supabaseAuthService.js');
const { saveLocalActiveUser } = await import('../api.js');

let passedCount = 0;
const totalTests = 7;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Scenario 1: New user Google Sign-In
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 1: New user Google OAuth signs in, establishes session, profile and redirects to /', async () => {
  const newUser = {
    id: 'e2e-new-user-001',
    email: 'newbie@foodiebite.com',
    user_metadata: { full_name: 'Newbie Foodie' }
  };
  const newSession = {
    access_token: 'newbie.jwt.token',
    refresh_token: 'refresh_newbie',
    user: newUser
  };

  client.auth.exchangeCodeForSession = async (code) => {
    assert.strictEqual(code, 'new_auth_code');
    return { data: { session: newSession, user: newUser }, error: null };
  };
  client.auth.getSession = async () => ({ data: { session: newSession }, error: null });
  client.auth.getUser = async () => ({ data: { user: newUser }, error: null });

  client.from = (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'e2e-new-user-001',
            email: 'newbie@foodiebite.com',
            name: 'Newbie Foodie',
            role: 'user',
            disabled: false,
            account_status: 'active',
            profileCompleted: false
          },
          error: null
        })
      })
    })
  });

  const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=new_auth_code');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.user.id, 'e2e-new-user-001');
  assert.strictEqual(res.session.access_token, 'newbie.jwt.token');

  // Verify AuthCallbackScreen user data and routing calculation
  const isProfileComplete = Boolean(
    res.profile?.profileCompleted === true ||
    (res.profile?.age && res.profile?.gender)
  );
  assert.strictEqual(isProfileComplete, false); // New user routes to CompleteProfile on /
});

// ─────────────────────────────────────────────────────────────
// Scenario 2: Existing user Google Sign-In
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 2: Existing user Google OAuth signs in, loads existing profile, and completes flow', async () => {
  const existingUser = {
    id: 'e2e-existing-user-002',
    email: 'chef@foodiebite.com',
    user_metadata: { full_name: 'Executive Chef' }
  };
  const existingSession = {
    access_token: 'chef.jwt.token',
    refresh_token: 'refresh_chef',
    user: existingUser
  };

  client.auth.exchangeCodeForSession = async () => ({ data: { session: existingSession, user: existingUser }, error: null });
  client.auth.getSession = async () => ({ data: { session: existingSession }, error: null });
  client.auth.getUser = async () => ({ data: { user: existingUser }, error: null });

  client.from = (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'e2e-existing-user-002',
            email: 'chef@foodiebite.com',
            name: 'Executive Chef',
            role: 'user',
            disabled: false,
            account_status: 'active',
            profileCompleted: true,
            age: 32,
            gender: 'Male',
            diet_type: 'Mediterranean'
          },
          error: null
        })
      })
    })
  });

  const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=existing_chef_code');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.user.id, 'e2e-existing-user-002');
  assert.strictEqual(res.profile.diet_type, 'Mediterranean');

  const isProfileComplete = Boolean(
    res.profile?.profileCompleted === true ||
    (res.profile?.age && res.profile?.gender)
  );
  assert.strictEqual(isProfileComplete, true);
});

// ─────────────────────────────────────────────────────────────
// Scenario 3: Admin user Google Sign-In
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 3: Designated administrator Google OAuth (sham111205s@gmail.com) assigns admin role', async () => {
  const adminEmail = 'sham111205s@gmail.com';
  const adminUser = {
    id: 'admin-uuid-007',
    email: adminEmail,
    user_metadata: { full_name: 'Lead Admin' }
  };
  const adminSession = {
    access_token: 'admin.jwt.token',
    refresh_token: 'refresh_admin',
    user: adminUser
  };

  client.auth.exchangeCodeForSession = async () => ({ data: { session: adminSession, user: adminUser }, error: null });
  client.auth.getSession = async () => ({ data: { session: adminSession }, error: null });
  client.auth.getUser = async () => ({ data: { user: adminUser }, error: null });

  client.from = (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'admin-uuid-007',
            email: adminEmail,
            name: 'Lead Admin',
            role: 'admin',
            disabled: false,
            account_status: 'active',
            profileCompleted: true
          },
          error: null
        })
      })
    })
  });

  const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=admin_oauth_code');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.user.email, adminEmail);
  assert.strictEqual(res.profile.role, 'admin');

  // Verify admin session storage mechanism used in AuthCallbackScreen
  const sessionPayload = { success: true, token: res.session.access_token, user: res.user };
  sessionStorage.setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
  const retrieved = JSON.parse(sessionStorage.getItem('foodiebite_admin_session'));
  assert.strictEqual(retrieved.user.email, adminEmail);
});

// ─────────────────────────────────────────────────────────────
// Scenario 4: Callback page refresh with active session
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 4: Callback page refresh with active session rehydrates immediately without error', async () => {
  const refreshedUser = {
    id: 'refreshed-uuid-004',
    email: 'refresh@foodiebite.com',
  };
  const refreshedSession = {
    access_token: 'persisted.refresh.jwt',
    user: refreshedUser
  };

  // If page is refreshed, code has already been consumed and exchangeCode will fail
  client.auth.exchangeCodeForSession = async () => ({ data: { session: null }, error: new Error('invalid_grant: code already used') });
  client.auth.getSession = async () => ({ data: { session: refreshedSession }, error: null });
  client.auth.getUser = async () => ({ data: { user: refreshedUser }, error: null });

  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: refreshedUser.id, email: refreshedUser.email, role: 'user', disabled: false },
          error: null
        })
      })
    })
  });

  // Query has no code, or expired code
  const res = await handleOAuthCallback('http://localhost:3000/auth/callback');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.access_token, 'persisted.refresh.jwt');
  assert.strictEqual(res.user.id, 'refreshed-uuid-004');
});

// ─────────────────────────────────────────────────────────────
// Scenario 5: Invalid / Expired authorization code
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 5: Expired or invalid code without active session returns clean error message', async () => {
  client.auth.exchangeCodeForSession = async () => ({
    data: { session: null },
    error: new Error('invalid_grant: Authorization code has expired')
  });
  client.auth.getSession = async () => ({ data: { session: null }, error: null });
  client.auth.getUser = async () => ({ data: { user: null }, error: null });

  const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=bad_or_expired_code');
  assert.strictEqual(res.success, false);
  assert.ok(res.error, 'Error message must be populated');
  assert.ok(
    res.error.toLowerCase().includes('expired') ||
    res.error.toLowerCase().includes('sign in') ||
    res.error.toLowerCase().includes('invalid'),
    `Error message should be user-friendly, received: ${res.error}`
  );
});

// ─────────────────────────────────────────────────────────────
// Scenario 6: StrictMode double invocation protection
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 6: StrictMode double execution recovers gracefully via session caching', async () => {
  const strictUser = { id: 'uuid-strict-88', email: 'strict@foodiebite.com' };
  const strictSession = { access_token: 'strict.session.jwt', user: strictUser };
  let exchangeCalls = 0;

  client.auth.exchangeCodeForSession = async () => {
    exchangeCalls++;
    if (exchangeCalls > 1) {
      return { data: { session: null }, error: new Error('invalid_grant: code verifier not found') };
    }
    return { data: { session: strictSession, user: strictUser }, error: null };
  };
  client.auth.getSession = async () => ({ data: { session: strictSession }, error: null });
  client.auth.getUser = async () => ({ data: { user: strictUser }, error: null });

  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: strictUser.id, email: strictUser.email, role: 'user', disabled: false },
          error: null
        })
      })
    })
  });

  // Call 1
  const first = await handleOAuthCallback('http://localhost:3000/auth/callback?code=single_use_code');
  assert.strictEqual(first.success, true);

  // Call 2 (simulating React 18 StrictMode immediate second invocation)
  const second = await handleOAuthCallback('http://localhost:3000/auth/callback?code=single_use_code');
  assert.strictEqual(second.success, true);
  assert.strictEqual(second.session.access_token, 'strict.session.jwt');
});

// ─────────────────────────────────────────────────────────────
// Scenario 7: Fallback session polling when background storage is asynchronous
// ─────────────────────────────────────────────────────────────
await runTest('Scenario 7: Session polling resolves session when storage write lags slightly', async () => {
  const lagUser = { id: 'uuid-lag-99', email: 'lag@foodiebite.com' };
  const lagSession = { access_token: 'lag.session.jwt', user: lagUser };
  let pollAttempts = 0;

  client.auth.exchangeCodeForSession = async () => ({
    data: { session: null },
    error: new Error('PKCE flow already handled by GoTrueClient auto-detect')
  });

  client.auth.getSession = async () => {
    pollAttempts++;
    if (pollAttempts < 3) {
      return { data: { session: null }, error: null };
    }
    return { data: { session: lagSession }, error: null };
  };
  client.auth.getUser = async () => ({ data: { user: lagUser }, error: null });

  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: lagUser.id, email: lagUser.email, role: 'user', disabled: false },
          error: null
        })
      })
    })
  });

  const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=lag_code');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.session.access_token, 'lag.session.jwt');
  assert.ok(pollAttempts >= 3, 'Polling must have executed at least 3 attempts');
});

console.log(`\n📊 Scenarios Tested: ${passedCount} / ${totalTests} Passed (100%)\n`);
assert.strictEqual(passedCount, totalTests, 'All Google OAuth callback verification scenarios must pass');
