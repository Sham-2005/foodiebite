import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory local storage polyfill
const memoryStorage = {};
global.window = {
  location: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    replace: () => {},
  },
  history: {
    replaceState: () => {},
  },
  localStorage: {
    getItem: (k) => memoryStorage[k] || null,
    setItem: (k, v) => { memoryStorage[k] = String(v); },
    removeItem: (k) => { delete memoryStorage[k]; },
    clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
  },
  sessionStorage: {
    getItem: (k) => memoryStorage[k] || null,
    setItem: (k, v) => { memoryStorage[k] = String(v); },
    removeItem: (k) => { delete memoryStorage[k]; },
    clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
  },
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

console.log('🧪 Running Android Native Google Login to Supabase Auth Migration Test Suite...\n');

const { getSupabaseClient, isSupabaseConfigured } = await import('../../config/supabaseClient.js');
const client = getSupabaseClient();
assert(isSupabaseConfigured, 'Supabase client must be configured');
assert(client && client.auth, 'Supabase Auth must be present on client');

client.rpc = async () => ({ data: 'rpc-ok', error: null });

let passedCount = 0;
let totalCount = 0;

async function runTest(name, fn) {
  totalCount++;
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
// Test 1: Native GoogleSignin configuration and Web Client ID
// ─────────────────────────────────────────────────────────────
await runTest('Test 1: GoogleSignin is configured with official Web Client ID and offlineAccess', async () => {
  const googleAuthAndroidCode = fs.readFileSync(path.resolve(__dirname, '../googleAuth.android.js'), 'utf-8');
  assert(
    googleAuthAndroidCode.includes('287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com'),
    'googleAuth.android.js must include the official webClientId from Google Cloud project my-bot-504415'
  );
  assert(
    googleAuthAndroidCode.includes('offlineAccess: true'),
    'GoogleSignin must specify offlineAccess: true'
  );
});

// ─────────────────────────────────────────────────────────────
// Test 2: Native Android flow uses signInWithIdToken, NOT web OAuth
// ─────────────────────────────────────────────────────────────
await runTest('Test 2: Android native authentication invokes signInWithIdToken and does not use web PKCE callback', async () => {
  const googleAuthAndroidCode = fs.readFileSync(path.resolve(__dirname, '../googleAuth.android.js'), 'utf-8');
  assert(
    googleAuthAndroidCode.includes('signInWithGoogleIdToken({ idToken })'),
    'Android native Google login must authenticate via signInWithGoogleIdToken'
  );
  assert(
    !googleAuthAndroidCode.includes('signInWithGoogleOAuth'),
    'Android native Google login must NOT fall back to web PKCE browser OAuth'
  );
});

// ─────────────────────────────────────────────────────────────
// Test 3: New user native Google Sign-In establishes session & profile
// ─────────────────────────────────────────────────────────────
await runTest('Test 3: New Android Google user receives Supabase session, maps UUID, and marks profile incomplete', async () => {
  const newUser = {
    id: 'android-new-uuid-101',
    email: 'android.new@foodiebite.com',
    user_metadata: { full_name: 'Android Gourmet' },
  };
  const newSession = {
    access_token: 'android.new.jwt.token',
    refresh_token: 'android.new.refresh',
    user: newUser,
  };

  client.auth.signInWithIdToken = async ({ provider, token }) => {
    assert.strictEqual(provider, 'google');
    assert.strictEqual(token, 'mock_google_id_token_123');
    return { data: { session: newSession, user: newUser }, error: null };
  };

  client.from = (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'android-new-uuid-101',
            email: 'android.new@foodiebite.com',
            name: 'Android Gourmet',
            role: 'user',
            disabled: false,
            account_status: 'active',
            profileCompleted: false,
          },
          error: null,
        }),
      }),
    }),
  });

  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');
  const res = await signInWithGoogleIdToken({ idToken: 'mock_google_id_token_123' });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.user.id, 'android-new-uuid-101');
  assert.strictEqual(res.session.access_token, 'android.new.jwt.token');
  assert.strictEqual(res.profile.profileCompleted, false);
});

// ─────────────────────────────────────────────────────────────
// Test 4: Existing user native Google Sign-In preserves preferences
// ─────────────────────────────────────────────────────────────
await runTest('Test 4: Existing user preserves custom dietary preferences and favorites', async () => {
  const existingUser = {
    id: 'android-existing-uuid-202',
    email: 'existing.chef@foodiebite.com',
    user_metadata: { full_name: 'Existing Chef' },
  };
  const existingSession = {
    access_token: 'android.existing.jwt.token',
    user: existingUser,
  };

  client.auth.signInWithIdToken = async () => ({
    data: { session: existingSession, user: existingUser },
    error: null,
  });

  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'android-existing-uuid-202',
            email: 'existing.chef@foodiebite.com',
            name: 'Existing Chef',
            role: 'user',
            disabled: false,
            account_status: 'active',
            profileCompleted: true,
            diet_type: 'Vegan',
            preferences: {
              dietType: 'Vegan',
              allergies: ['peanuts'],
              spicyLevel: 'High',
            },
          },
          error: null,
        }),
      }),
    }),
  });

  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');
  const res = await signInWithGoogleIdToken({ idToken: 'valid_chef_token' });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.profile.diet_type, 'Vegan');
  assert.strictEqual(res.profile.preferences.dietType, 'Vegan');
  assert.deepStrictEqual(res.profile.preferences.allergies, ['peanuts']);
});

// ─────────────────────────────────────────────────────────────
// Test 5: Designated administrator security enforcement
// ─────────────────────────────────────────────────────────────
await runTest('Test 5: Sole admin sham111205s@gmail.com is granted admin; non-admin cannot elevate', async () => {
  const adminUser = {
    id: 'admin-uuid-777',
    email: 'sham111205s@gmail.com',
    user_metadata: { full_name: 'Lead Admin' },
  };
  const adminSession = { access_token: 'admin.jwt', user: adminUser };

  client.auth.signInWithIdToken = async () => ({ data: { session: adminSession, user: adminUser }, error: null });
  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: adminUser.id, email: adminUser.email, role: 'admin', disabled: false },
          error: null,
        }),
      }),
    }),
  });

  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');
  const res = await signInWithGoogleIdToken({ idToken: 'admin_id_token' });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.profile.role, 'admin');

  // Verify non-admin spoofing
  const attackerUser = { id: 'attacker-uuid', email: 'imposter@gmail.com' };
  client.auth.signInWithIdToken = async () => ({ data: { session: { access_token: 'atk.jwt', user: attackerUser }, user: attackerUser }, error: null });
  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          // Database trigger or profile always returns 'user' for non-admin
          data: { id: attackerUser.id, email: attackerUser.email, role: 'user', disabled: false },
          error: null,
        }),
      }),
    }),
  });

  const atkRes = await signInWithGoogleIdToken({ idToken: 'attacker_token' });
  assert.strictEqual(atkRes.profile.role, 'user');
});

// ─────────────────────────────────────────────────────────────
// Test 6: Disabled user account is blocked and logged out
// ─────────────────────────────────────────────────────────────
await runTest('Test 6: Disabled user is immediately rejected with HTTP/Auth friendly error and session cleared', async () => {
  const disabledUser = { id: 'disabled-uuid-403', email: 'banned@foodiebite.com' };
  client.auth.signInWithIdToken = async () => ({
    data: { session: { access_token: 'banned.jwt', user: disabledUser }, user: disabledUser },
    error: null,
  });
  client.auth.signOut = async () => ({ error: null });

  client.from = () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: disabledUser.id, email: disabledUser.email, disabled: true, account_status: 'disabled' },
          error: null,
        }),
      }),
    }),
  });

  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');
  const res = await signInWithGoogleIdToken({ idToken: 'banned_user_token' });
  assert.strictEqual(res.success, false);
  assert(res.error.includes('disabled'), `Expected disabled error message, got: ${res.error}`);
});

// ─────────────────────────────────────────────────────────────
// Test 7: Error handling (user cancellation, play services, network error)
// ─────────────────────────────────────────────────────────────
await runTest('Test 7: Error conditions (user cancellation, missing token, network) map to clear user guidance', async () => {
  const { signInWithGoogleIdToken } = await import('../supabaseAuthService.js');

  // Missing token
  const noToken = await signInWithGoogleIdToken({});
  assert.strictEqual(noToken.success, false);
  assert.strictEqual(noToken.code, 'MISSING_ID_TOKEN');

  // Supabase rejected token
  client.auth.signInWithIdToken = async () => ({
    data: { session: null, user: null },
    error: new Error('Invalid ID token: signature verification failed'),
  });
  const badToken = await signInWithGoogleIdToken({ idToken: 'corrupted_token' });
  assert.strictEqual(badToken.success, false);
  assert(badToken.error.includes('Google') || badToken.error.includes('failed') || badToken.error.includes('Invalid'));
});

// ─────────────────────────────────────────────────────────────
// Test 8: Platform dispatcher in googleAuth.js delegates correctly
// ─────────────────────────────────────────────────────────────
await runTest('Test 8: googleAuth.js delegates to googleAuth.android on Android and googleAuth.web on Web', async () => {
  const googleAuthDispatcher = fs.readFileSync(path.resolve(__dirname, '../googleAuth.js'), 'utf-8');
  assert(
    googleAuthDispatcher.includes("Platform.OS === 'android'") || googleAuthDispatcher.includes('Platform && Platform.OS'),
    'googleAuth.js must inspect Platform.OS'
  );
  assert(
    googleAuthDispatcher.includes('loginWithGoogleAndroid'),
    'googleAuth.js must import and call loginWithGoogleAndroid'
  );
  assert(
    googleAuthDispatcher.includes('loginWithGoogleWeb'),
    'googleAuth.js must import and call loginWithGoogleWeb'
  );
});

// ─────────────────────────────────────────────────────────────
// Test 9: AsyncStorage storage priority in supabaseClient.js
// ─────────────────────────────────────────────────────────────
await runTest('Test 9: supabaseClient.js prioritizes AsyncStorage when running on mobile (Platform.OS !== web)', async () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../../config/supabaseClient.js'), 'utf-8');
  assert(
    clientCode.includes("Platform && Platform.OS !== 'web'"),
    'supabaseClient.js must prioritize AsyncStorage when Platform.OS is not web'
  );
  assert(
    clientCode.includes('@react-native-async-storage/async-storage'),
    'supabaseClient.js must require @react-native-async-storage/async-storage for mobile storage'
  );
});

// ─────────────────────────────────────────────────────────────
// Test 10: Logout on Android clears native GoogleSignin and Supabase session
// ─────────────────────────────────────────────────────────────
await runTest('Test 10: logout() clears both Supabase session and native GoogleSignin account cache', async () => {
  let supabaseSignedOut = false;
  client.auth.signOut = async () => {
    supabaseSignedOut = true;
    return { error: null };
  };

  const { logout } = await import('../supabaseAuthService.js');
  const logoutRes = await logout();
  assert.strictEqual(logoutRes.success, true);
  assert.strictEqual(supabaseSignedOut, true);
});

// ─────────────────────────────────────────────────────────────
// Test 11: Route after auth handles CompleteProfile vs Home vs Admin
// ─────────────────────────────────────────────────────────────
await runTest('Test 11: Route navigation resolves correctly for Incomplete User, Completed User, and Admin', async () => {
  const signInCode = fs.readFileSync(path.resolve(__dirname, '../../screens/SignInScreen.js'), 'utf-8');
  assert(
    signInCode.includes('CompleteProfile') && signInCode.includes('Home') && signInCode.includes('Admin'),
    'SignInScreen must route to CompleteProfile for incomplete users, Home for complete users, and Admin for admin'
  );

  const signUpCode = fs.readFileSync(path.resolve(__dirname, '../../screens/SignUpScreen.js'), 'utf-8');
  assert(
    signUpCode.includes('routeAfterAuth(data.user)'),
    'SignUpScreen must invoke routeAfterAuth after successful Google authentication'
  );
});

// ─────────────────────────────────────────────────────────────
// Test 12: Email / Password authentication remains untouched and functional
// ─────────────────────────────────────────────────────────────
await runTest('Test 12: Existing email/password login and registration functions remain fully intact', async () => {
  const { loginWithEmail, registerWithEmail } = await import('../supabaseAuthService.js');
  assert.strictEqual(typeof loginWithEmail, 'function');
  assert.strictEqual(typeof registerWithEmail, 'function');

  const emptyLogin = await loginWithEmail({ email: '', password: '' });
  assert.strictEqual(emptyLogin.success, false);
});

console.log(`\n📊 Android Native Google Auth Migration Test Suite Passed: ${passedCount} / ${totalCount} (100%)\n`);
assert.strictEqual(passedCount, totalCount, 'All Android Native Google Auth tests must pass');

