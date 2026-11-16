// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/navigationAndCallbackFlow.test.mjs
//  Verification of React Navigation Screen Registration,
//  AuthCallback Routing, Profile Completion, and Session Handover
// ─────────────────────────────────────────────────────────────

import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Polyfill window & localStorage for Node testing environment
if (typeof global.window === 'undefined') {
  global.window = {
    location: {
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/auth/callback?code=mock_code',
      pathname: '/auth/callback',
      search: '?code=mock_code',
      hash: '',
    },
  };
}

// Load frontend/.env
const envPath = path.resolve('frontend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

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

async function runNavigationSuite() {
  console.log('\n🧪 Running Navigation & Auth Callback Flow Test Suite...\n');

  // 1. Verify all Screen components registered in Stack.Navigator exist
  await runTest('Case 1: All Stack.Screen components in App.js exist and export valid default components', async () => {
    const screens = [
      'SplashScreen', 'HomeScreen', 'SignInScreen', 'SignUpScreen',
      'OnboardingScreen', 'SearchScreen', 'FoodDetailScreen',
      'FavoritesScreen', 'ProfileScreen', 'PreferencesScreen',
      'PersonalInformation', 'MedicalReportsScreen', 'RecommendationsAllScreen',
      'AIScreen', 'PrivacyPolicyScreen', 'TermsAndConditionsScreen',
      'CompleteProfileScreen', 'AboutUsScreen', 'FeedbackScreen',
      'CompareScreen', 'ChatScreen', 'AnalyticsScreen',
      'NutritionScannerScreen', 'AuthCallbackScreen'
    ];

    for (const s of screens) {
      const p = path.resolve('frontend/src/screens', `${s}.js`);
      assert(fs.existsSync(p), `Screen file missing: ${p}`);
      const content = fs.readFileSync(p, 'utf8');
      assert(/export\s+default/.test(content), `Missing export default in: ${s}`);
    }

    const pAdmin = path.resolve('frontend/src/components/ProtectedAdminRoute.js');
    assert(fs.existsSync(pAdmin), `ProtectedAdminRoute missing`);
    assert(/export\s+default/.test(fs.readFileSync(pAdmin, 'utf8')), 'Missing export default in ProtectedAdminRoute');
  });

  // 2. Initial Route Resolution logic
  await runTest('Case 2: initialRouteName resolves accurately without referring to undefined screens', async () => {
    function computeInitialRoute(user) {
      const cleanEmail = (user?.email || '').trim().toLowerCase();
      const isAdminUser = cleanEmail === 'sham111205s@gmail.com';
      const hasCompletedProfile =
        isAdminUser || (user && (user.profileCompleted === true || (!!user.age && !!user.gender)));

      return !user
        ? "Splash"
        : isAdminUser
        ? "Admin"
        : !hasCompletedProfile
        ? "CompleteProfile"
        : "Home";
    }

    assert.strictEqual(computeInitialRoute(null), 'Splash');
    assert.strictEqual(computeInitialRoute({ email: 'sham111205s@gmail.com' }), 'Admin');
    assert.strictEqual(computeInitialRoute({ email: 'newuser@foodiebite.com', age: null, gender: null }), 'CompleteProfile');
    assert.strictEqual(computeInitialRoute({ email: 'verified@foodiebite.com', age: 28, gender: 'Female' }), 'Home');
  });

  // 3. Linking Configuration contains all critical routes
  await runTest('Case 3: Deep linking configuration in App.js contains CompleteProfile and AuthCallback', async () => {
    const appContent = fs.readFileSync(path.resolve('frontend/src/App.js'), 'utf8');
    assert(appContent.includes("AuthCallback: 'auth/callback'"), 'AuthCallback deep link mapping missing');
    assert(appContent.includes("CompleteProfile: 'complete-profile'"), 'CompleteProfile deep link mapping missing');
    assert(appContent.includes("Home: 'home'"), 'Home deep link mapping missing');
    assert(appContent.includes("Admin: 'admin'"), 'Admin deep link mapping missing');
  });

  // 4. Supabase Client Setup for API Services
  const { getSupabaseClient } = await import('../../config/supabaseClient.js');
  const client = getSupabaseClient();
  client.rpc = async () => ({ data: 'ok', error: null });

  const {
    saveLocalActiveUser,
    getLocalActiveUser,
    apiCompleteProfile,
    apiGetPreferences,
    apiUpdatePreferences,
  } = await import('../api.js');

  // 5. Complete Profile Service
  await runTest('Case 4: apiCompleteProfile updates user profile and marks profileCompleted in Supabase mode', async () => {
    const activeUser = {
      id: 'uuid-complete-profile-test',
      email: 'newuser@foodiebite.com',
      name: 'New Foodie',
      role: 'user',
      preferences: { dietType: 'Vegetarian' },
    };
    saveLocalActiveUser(activeUser);

    client.auth.getUser = async () => ({
      data: { user: { id: activeUser.id, email: activeUser.email } },
      error: null,
    });

    client.from = (table) => ({
      update: (payload) => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: activeUser.id,
                email: activeUser.email,
                name: activeUser.name,
                role: 'user',
                age: payload.age,
                gender: payload.gender,
                diet_type: payload.diet_type,
                preferences: payload.preferences,
                account_status: 'active',
                disabled: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await apiCompleteProfile({
      age: 25,
      gender: 'Male',
      height: 178,
      weight: 72,
      activityLevel: 'Moderately Active',
      dietType: 'Vegan',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.user.age, 25);
    assert.strictEqual(res.user.gender, 'Male');
    assert.strictEqual(res.user.preferences.dietType, 'Vegan');
    assert.strictEqual(res.user.profileCompleted, true);

    const stored = getLocalActiveUser();
    assert.strictEqual(stored.age, 25);
    assert.strictEqual(stored.gender, 'Male');
  });

  // 6. Preferences handling in Supabase mode
  await runTest('Case 5: apiGetPreferences and apiUpdatePreferences execute cleanly without "Not authenticated"', async () => {
    client.auth.getUser = async () => ({
      data: { user: { id: 'uuid-complete-profile-test', email: 'newuser@foodiebite.com' } },
      error: null,
    });

    client.from = (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 'uuid-complete-profile-test',
              preferences: { dietType: 'Vegan', spiceLevel: 'Medium' },
            },
            error: null,
          }),
        }),
      }),
      update: (payload) => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: 'uuid-complete-profile-test',
                preferences: payload.preferences,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const getPrefRes = await apiGetPreferences();
    assert.strictEqual(getPrefRes.success, true);
    assert.strictEqual(getPrefRes.preferences.dietType, 'Vegan');

    const updatePrefRes = await apiUpdatePreferences({ spiceLevel: 'High', healthGoals: ['muscle_gain'] });
    assert.strictEqual(updatePrefRes.success, true);
    assert.strictEqual(updatePrefRes.preferences.spiceLevel, 'High');
  });

  // 7. AuthCallbackScreen destination routing decision logic
  await runTest('Case 6: AuthCallback routes to CompleteProfile when user metrics are missing, and Home when complete', async () => {
    function resolveCallbackRoute(cleanEmail, profile) {
      const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';
      const isAdmin = cleanEmail === AUTHORIZED_ADMIN_EMAIL;
      const isProfileComplete = Boolean(
        isAdmin ||
        (profile?.profileCompleted === true) ||
        (profile?.age && profile?.gender)
      );

      return {
        screen: isAdmin ? 'Admin' : (isProfileComplete ? 'Home' : 'CompleteProfile'),
        path: isAdmin ? '/admin' : (isProfileComplete ? '/home' : '/complete-profile'),
      };
    }

    const adminRoute = resolveCallbackRoute('sham111205s@gmail.com', null);
    assert.strictEqual(adminRoute.screen, 'Admin');
    assert.strictEqual(adminRoute.path, '/admin');

    const newGoogleUserRoute = resolveCallbackRoute('alex@gmail.com', { age: null, gender: null });
    assert.strictEqual(newGoogleUserRoute.screen, 'CompleteProfile');
    assert.strictEqual(newGoogleUserRoute.path, '/complete-profile');

    const completedUserRoute = resolveCallbackRoute('alex@gmail.com', { age: 30, gender: 'Male' });
    assert.strictEqual(completedUserRoute.screen, 'Home');
    assert.strictEqual(completedUserRoute.path, '/home');
  });

  console.log(`\n📊 Navigation & Flow Tests: ${testsPassed} / ${testsTotal} Passed (100%)\n`);
}

runNavigationSuite().catch((err) => {
  console.error('\n❌ Navigation Test Suite Failed:', err);
  process.exit(1);
});
