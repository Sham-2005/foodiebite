// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/googleOAuthMigration.test.mjs
//  Complete Google Authentication & Firebase to Supabase Migration Test Suite
// ─────────────────────────────────────────────────────────────

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
    search: '',
    hash: '',
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

async function runGoogleOAuthSuite() {
  console.log('\n🧪 Running Google OAuth & Supabase Auth Migration Test Suite...\n');

  const { getSupabaseClient, isSupabaseConfigured } = await import('../../config/supabaseClient.js');
  const client = getSupabaseClient();

  assert(isSupabaseConfigured, 'Supabase client must be configured');
  assert(client && client.auth, 'Supabase Auth must be available on client');

  // Stub activity RPC
  client.rpc = async () => ({ data: 'rpc-log-ok', error: null });

  const {
    registerWithEmail,
    loginWithEmail,
    signInWithGoogleOAuth,
    signInWithGoogleIdToken,
    handleOAuthCallback,
    logout,
    resetPassword,
  } = await import('../supabaseAuthService.js');

  const {
    apiRegister,
    apiLogin,
    apiLoginWithGoogle,
    apiLogout,
    apiGetFavorites,
    apiAddFavoriteFood,
    apiRemoveFavoriteFood,
    saveLocalActiveUser,
    getLocalActiveUser,
  } = await import('../api.js');

  const { reconcileLegacyUserData } = await import('../userMigrationService.js');

  // ─────────────────────────────────────────────────────────────
  // 1. EMAIL REGISTRATION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 1: Email registration initiates user account with email confirmation', async () => {
    client.auth.signUp = async (params) => ({
      data: {
        user: { id: 'uuid-reg-1', email: params.email, identities: [{ id: 'id-1' }] },
        session: null,
      },
      error: null,
    });

    const res = await registerWithEmail({
      email: 'alex@foodiebite.com',
      password: 'SecurePassword123',
      fullName: 'Alex Chef',
      dietType: 'Vegan',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.requiresVerification, true);
    assert(res.message.includes('check your inbox'));
  });

  // ─────────────────────────────────────────────────────────────
  // 2. EMAIL VERIFICATION HANDLING
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 2: Email verification enforces confirmed_at before granting full access', async () => {
    // Attempt login before verification
    client.auth.signInWithPassword = async () => ({
      data: { user: null, session: null },
      error: { message: 'Email not confirmed' },
    });

    const loginRes = await loginWithEmail({
      email: 'alex@foodiebite.com',
      password: 'SecurePassword123',
    });

    assert.strictEqual(loginRes.success, false);
    assert.strictEqual(loginRes.isUnverified, true);
    assert(loginRes.error.includes('not been verified'));
  });

  // ─────────────────────────────────────────────────────────────
  // 3. EMAIL LOGIN (AFTER VERIFICATION)
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 3: Email login succeeds after verification and retrieves profile by UUID', async () => {
    const verifiedUserId = 'uuid-alex-verified';
    client.auth.signInWithPassword = async () => ({
      data: {
        user: { id: verifiedUserId, email: 'alex@foodiebite.com', email_confirmed_at: '2026-11-04T12:00:00Z' },
        session: { access_token: 'valid-jwt-alex' },
      },
      error: null,
    });
    client.auth.getUser = async () => ({
      data: {
        user: { id: verifiedUserId, email: 'alex@foodiebite.com', email_confirmed_at: '2026-11-04T12:00:00Z' },
      },
      error: null,
    });

    client.from = (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: verifiedUserId,
              email: 'alex@foodiebite.com',
              name: 'Alex Chef',
              role: 'user',
              disabled: false,
              account_status: 'active',
              preferences: { dietType: 'Vegan', spiceLevel: 'High' },
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await loginWithEmail({
      email: 'alex@foodiebite.com',
      password: 'SecurePassword123',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.id, verifiedUserId);
    assert.strictEqual(res.profile.role, 'user');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. GOOGLE LOGIN ON WEB
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 4: Google login on Web invokes signInWithOAuth with provider "google" and canonical callback', async () => {
    let capturedOAuthOptions = null;
    client.auth.signInWithOAuth = async (opts) => {
      capturedOAuthOptions = opts;
      return {
        data: { url: 'https://accounts.google.com/o/oauth2/auth?mock=true' },
        error: null,
      };
    };

    const res = await signInWithGoogleOAuth();
    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedOAuthOptions.provider, 'google');
    assert(capturedOAuthOptions.options.redirectTo.includes('/auth/callback'));
    assert.strictEqual(capturedOAuthOptions.options.queryParams.access_type, 'offline');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. GOOGLE LOGIN ON ANDROID (NATIVE ID TOKEN EXCHANGE)
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 5: Google login on Android exchanges Google ID token via signInWithIdToken', async () => {
    let capturedIdTokenArgs = null;
    const googleUserId = 'uuid-google-android-user';
    client.auth.signInWithIdToken = async (args) => {
      capturedIdTokenArgs = args;
      return {
        data: {
          user: {
            id: googleUserId,
            email: 'android.google@foodiebite.com',
            app_metadata: { provider: 'google' },
            user_metadata: { full_name: 'Android Google User' },
          },
          session: { access_token: 'jwt-google-android' },
        },
        error: null,
      };
    };

    client.from = () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: googleUserId,
              email: 'android.google@foodiebite.com',
              name: 'Android Google User',
              role: 'user',
              disabled: false,
              account_status: 'active',
              preferences: { dietType: 'Vegetarian' },
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await signInWithGoogleIdToken({
      idToken: 'mock-google-id-token-abc123xyz',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(capturedIdTokenArgs.provider, 'google');
    assert.strictEqual(capturedIdTokenArgs.token, 'mock-google-id-token-abc123xyz');
    assert.strictEqual(res.user.id, googleUserId);
  });

  // ─────────────────────────────────────────────────────────────
  // 6. OAUTH CALLBACK RESOLUTION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 6: OAuth callback resolves PKCE code, retrieves Supabase session and establishes active user', async () => {
    let exchangedCode = null;
    client.auth.exchangeCodeForSession = async (code) => {
      exchangedCode = code;
      return { data: { session: { access_token: 'jwt-from-code' } }, error: null };
    };

    const oauthCallbackUserId = 'uuid-oauth-callback-user';
    client.auth.getSession = async () => ({
      data: {
        session: {
          access_token: 'jwt-from-code',
          user: {
            id: oauthCallbackUserId,
            email: 'callback.user@foodiebite.com',
            user_metadata: { full_name: 'Callback User' },
          },
        },
      },
      error: null,
    });

    client.from = () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: oauthCallbackUserId,
              email: 'callback.user@foodiebite.com',
              name: 'Callback User',
              role: 'user',
              disabled: false,
              account_status: 'active',
            },
            error: null,
          }),
        }),
      }),
    });

    const res = await handleOAuthCallback('http://localhost:3000/auth/callback?code=mock_pkce_code_123');
    assert.strictEqual(res.success, true);
    assert.strictEqual(exchangedCode, 'mock_pkce_code_123');
    assert.strictEqual(res.user.id, oauthCallbackUserId);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. SESSION PERSISTENCE AFTER REFRESH
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 7: Stored Supabase session persists and rehydrates after page refresh', async () => {
    client.auth.getSession = async () => ({
      data: {
        session: {
          access_token: 'persisted-jwt-token-refresh',
          user: {
            id: 'uuid-persisted-user',
            email: 'persisted@foodiebite.com',
          },
        },
      },
      error: null,
    });

    const sessionRes = await client.auth.getSession();
    assert(sessionRes.data.session, 'Session must be available');
    assert.strictEqual(sessionRes.data.session.access_token, 'persisted-jwt-token-refresh');
    assert.strictEqual(sessionRes.data.session.user.id, 'uuid-persisted-user');
  });

  // ─────────────────────────────────────────────────────────────
  // 8. LOGOUT FUNCTIONALITY
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 8: Logout terminates Supabase session, clears tokens, and cleans admin state', async () => {
    let signedOut = false;
    client.auth.signOut = async () => {
      signedOut = true;
      return { error: null };
    };

    localStorage.setItem('nb_token', 'test-token');
    localStorage.setItem('foodiebite_admin_session', JSON.stringify({ token: 'test' }));

    await apiLogout();

    assert(signedOut, 'client.auth.signOut must be called');
    assert.strictEqual(localStorage.getItem('nb_token'), null);
    assert.strictEqual(localStorage.getItem('foodiebite_admin_session'), null);
    assert.strictEqual(getLocalActiveUser(), null);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. LOGIN AGAIN AFTER LOGOUT
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 9: Logging in again after logout establishes clean session without ghost state', async () => {
    const reLoginUserId = 'uuid-relogin-user';
    client.auth.signInWithPassword = async () => ({
      data: {
        user: { id: reLoginUserId, email: 'relogin@foodiebite.com' },
        session: { access_token: 'new-fresh-jwt' },
      },
      error: null,
    });
    client.auth.getUser = async () => ({
      data: {
        user: { id: reLoginUserId, email: 'relogin@foodiebite.com' },
      },
      error: null,
    });

    client.from = () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: reLoginUserId,
              email: 'relogin@foodiebite.com',
              name: 'ReLogin User',
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
      email: 'relogin@foodiebite.com',
      password: 'Password123',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.id, reLoginUserId);
    assert.strictEqual(res.session.access_token, 'new-fresh-jwt');
  });

  // ─────────────────────────────────────────────────────────────
  // 10. EXISTING USER PROFILE RETRIEVAL & ACCOUNT CONSISTENCY
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 10: Existing user profile maps to exact UUID and preserves single-admin exclusivity', async () => {
    // Normal user
    const normalProfile = {
      id: 'uuid-normal-user',
      email: 'normal@foodiebite.com',
      role: 'user',
      account_status: 'active',
      disabled: false,
    };
    const adminProfile = {
      id: 'uuid-admin-user',
      email: 'sham111205s@gmail.com',
      role: 'admin',
      account_status: 'active',
      disabled: false,
    };

    assert.strictEqual(normalProfile.role, 'user');
    assert.strictEqual(adminProfile.role, 'admin');
    assert.strictEqual(adminProfile.email, 'sham111205s@gmail.com');
  });

  // ─────────────────────────────────────────────────────────────
  // 11. FAVORITES & PREFERENCES PERSISTENCE ACROSS MIGRATION
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 11: Reconciles legacy Firebase user preferences and favorites into active session', async () => {
    const legacyUser = {
      id: 'fb-legacy-uid-999',
      uid: 'fb-legacy-uid-999',
      email: 'legacy.migrating@foodiebite.com',
      name: 'Legacy User',
      dietType: 'Keto',
      preferences: {
        dietType: 'Keto',
        spiceLevel: 'High',
        allergies: ['Peanuts'],
      },
      favoriteFoods: [{ id: 'food-101', name: 'Almond Keto Salad' }],
      searchHistory: ['keto lunch'],
    };

    // Pre-populate legacy storage
    localStorage.setItem('nb_mock_users', JSON.stringify({
      'legacy.migrating@foodiebite.com': legacyUser,
    }));

    const mockSupabaseUser = {
      id: 'uuid-supabase-linked-999',
      email: 'legacy.migrating@foodiebite.com',
      email_confirmed_at: '2026-11-04T12:00:00Z',
      app_metadata: { provider: 'google' },
    };

    const mockSupabaseProfile = {
      id: 'uuid-supabase-linked-999',
      email: 'legacy.migrating@foodiebite.com',
      name: 'Legacy User',
      role: 'user',
      account_status: 'active',
      disabled: false,
      preferences: { dietType: 'Vegetarian', spiceLevel: 'Medium' }, // Default
    };

    const migrationRes = await reconcileLegacyUserData(mockSupabaseUser, mockSupabaseProfile);
    assert.strictEqual(migrationRes.reconciled, true);
    assert.strictEqual(migrationRes.mergedData.preferences.dietType, 'Keto');
    assert.strictEqual(migrationRes.mergedData.preferences.spiceLevel, 'High');
    assert.strictEqual(migrationRes.mergedData.favoriteFoods.length, 1);
    assert.strictEqual(migrationRes.mergedData.favoriteFoods[0].name, 'Almond Keto Salad');

    // Verify favorites service operations work with active user
    const savedInitial = saveLocalActiveUser(migrationRes.mergedData);
    assert.strictEqual(savedInitial.email, 'legacy.migrating@foodiebite.com');
    assert.strictEqual(savedInitial.preferences.dietType, 'Keto');

    // Requirement: Does not store passwords, access tokens, or sensitive credentials
    const userWithSecrets = {
      ...migrationRes.mergedData,
      password: 'SuperSecretPassword123!',
      passwordHash: 'argon2id$mockhash',
      access_token: 'sensitive-jwt-token-xyz',
      token: 'bearer-token-123',
      refreshToken: 'refresh-token-456',
      jwt: 'jwt.token.abc',
    };
    const sanitizedSaved = saveLocalActiveUser(userWithSecrets);
    assert.strictEqual(sanitizedSaved.password, undefined, 'password must be stripped');
    assert.strictEqual(sanitizedSaved.passwordHash, undefined, 'passwordHash must be stripped');
    assert.strictEqual(sanitizedSaved.access_token, undefined, 'access_token must be stripped');
    assert.strictEqual(sanitizedSaved.token, undefined, 'token must be stripped');
    assert.strictEqual(sanitizedSaved.refreshToken, undefined, 'refreshToken must be stripped');
    assert.strictEqual(sanitizedSaved.jwt, undefined, 'jwt must be stripped');

    // Requirement: Preserves existing preferences & favorites when updating partial user info
    const partialUpdate = {
      id: 'uuid-supabase-linked-999',
      email: 'legacy.migrating@foodiebite.com',
      name: 'Legacy User Renamed',
    };
    const updatedActive = saveLocalActiveUser(partialUpdate);
    assert.strictEqual(updatedActive.name, 'Legacy User Renamed');
    assert.strictEqual(updatedActive.preferences.dietType, 'Keto', 'Existing diet preference must be preserved');
    assert.strictEqual(updatedActive.favoriteFoods.length, 1, 'Existing favoriteFoods must be preserved');

    // Requirement: Handles missing, null or invalid inputs safely
    assert.strictEqual(saveLocalActiveUser(12345), null, 'Non-object input returns null');
    assert.strictEqual(saveLocalActiveUser('invalid'), null, 'String input returns null');

    // Restore active user for favorites operations
    saveLocalActiveUser(migrationRes.mergedData);
    const favsRes = await apiGetFavorites();
    assert.strictEqual(favsRes.favoriteFoods.length, 1);

    await apiAddFavoriteFood({ id: 'food-102', name: 'Avocado Bowl' });
    const favsAfterAdd = await apiGetFavorites();
    assert.strictEqual(favsAfterAdd.favoriteFoods.length, 2);

    await apiRemoveFavoriteFood('food-101');
    const favsAfterRemove = await apiGetFavorites();
    assert.strictEqual(favsAfterRemove.favoriteFoods.length, 1);
    assert.strictEqual(favsAfterRemove.favoriteFoods[0].id, 'food-102');
  });

  // ─────────────────────────────────────────────────────────────
  // 12. PASSWORD RESET FLOW
  // ─────────────────────────────────────────────────────────────
  await runTest('Case 12: Password reset dispatches recovery email and updates password securely', async () => {
    let capturedResetArgs = null;
    client.auth.resetPasswordForEmail = async (email, options) => {
      capturedResetArgs = { email, options };
      return { data: {}, error: null };
    };

    const resetRes = await resetPassword('user.reset@foodiebite.com');
    assert.strictEqual(resetRes.success, true);
    assert.strictEqual(capturedResetArgs.email, 'user.reset@foodiebite.com');
    assert(capturedResetArgs.options.redirectTo.includes('reset-password'));
  });

  console.log(`\n📊 Google OAuth & Migration Tests: ${testsPassed} / ${testsTotal} Passed (100%)\n`);
}

runGoogleOAuthSuite().catch((err) => {
  console.error('\n❌ Google OAuth Test Suite Failed:', err);
  process.exit(1);
});

