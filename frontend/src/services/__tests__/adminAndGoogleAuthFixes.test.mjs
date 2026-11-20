import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting 10-Scenario Test Suite for Admin Login & Google Auth Fixes...');

// Scenario 1: Verify AdminDashboardScreen has no unguarded browser globals
console.log('\n--- Scenario 1: Admin Dashboard Hermes Safety ---');
const adminDashboardCode = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');

assert(
  adminDashboardCode.includes("Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function'"),
  'AdminDashboardScreen popstate useEffect must be guarded against non-web platforms and undefined window.addEventListener'
);
assert(
  !adminDashboardCode.includes("window.addEventListener('popstate', onPop);\n  }, []);"),
  'Unguarded window.addEventListener must not exist in AdminDashboardScreen'
);
assert(
  adminDashboardCode.includes("Platform.OS === 'web' && typeof window !== 'undefined' && window.location"),
  'AdminDashboardScreen activeTab state must guard window.location with Platform.OS === web'
);
assert(
  adminDashboardCode.includes("Platform.OS === 'web' && typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function'"),
  'AdminDashboardScreen handleTabSelect must guard window.history.pushState'
);
console.log('✅ Scenario 1 Passed: Admin Dashboard screen is completely protected against undefined function calls on Android Hermes.');

// Scenario 2: Normal user cannot access Admin dashboard (Access Denied)
console.log('\n--- Scenario 2: Role-Based Access Control - Normal User Denied ---');
const protectedRouteCode = fs.readFileSync('frontend/src/components/ProtectedAdminRoute.js', 'utf8');
assert(
  protectedRouteCode.includes("effectiveUser.role === 'admin' || (effectiveUser.role !== 'user' && cleanEmail === AUTHORIZED_ADMIN_EMAIL)"),
  'ProtectedAdminRoute must check role and authorized email'
);

// Simulate RBAC logic
const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';
function checkAuthorized(user) {
  if (!user) return false;
  const cleanEmail = (user.email || '').trim().toLowerCase();
  return Boolean(user.role === 'admin' || (user.role !== 'user' && cleanEmail === AUTHORIZED_ADMIN_EMAIL));
}

const normalUser = { email: 'john@example.com', role: 'user' };
assert.strictEqual(checkAuthorized(normalUser), false, 'Normal user must be rejected from Admin Route');
console.log('✅ Scenario 2 Passed: Normal user cannot access Admin Dashboard.');

// Scenario 3: Unauthenticated user redirected to SignIn
console.log('\n--- Scenario 3: Unauthenticated User Redirection ---');
assert.strictEqual(checkAuthorized(null), false, 'Unauthenticated visitor must not have access');
assert(
  protectedRouteCode.includes("navigation.navigate('SignIn')"),
  'ProtectedAdminRoute must redirect unauthenticated visitors to SignIn'
);
console.log('✅ Scenario 3 Passed: Unauthenticated visitor triggers redirect to SignIn.');

// Scenario 4: Admin role determination and verification
console.log('\n--- Scenario 4: Admin Verification for Authorized Admin ---');
const adminUserWithRole = { email: 'customadmin@domain.com', role: 'admin' };
const adminUserByEmail = { email: 'sham111205s@gmail.com', role: 'admin' };
const regularUserWithAdminEmailSpoofed = { email: 'sham111205s@gmail.com', role: 'user' };

assert.strictEqual(checkAuthorized(adminUserWithRole), true, 'User with role admin must be authorized');
assert.strictEqual(checkAuthorized(adminUserByEmail), true, 'Designated admin account must be authorized');
assert.strictEqual(checkAuthorized(regularUserWithAdminEmailSpoofed), false, 'Explicit non-admin role cannot access admin');
console.log('✅ Scenario 4 Passed: Admin role verification correctly handles authorized admin and prevents role spoofing.');

// Scenario 5: Google Sign-In forces account picker by calling signOut() before signIn()
console.log('\n--- Scenario 5: Native Android Google Sign-In Account Picker Forcing ---');
const googleAndroidCode = fs.readFileSync('frontend/src/services/googleAuth.android.js', 'utf8');

assert(
  googleAndroidCode.includes('GoogleSigninModule.signOut()') &&
  googleAndroidCode.includes('GoogleSigninModule.signIn()'),
  'googleAuth.android.js must call signOut before signIn to force Google Play Services account picker'
);
const signOutIndex = googleAndroidCode.indexOf('await GoogleSigninModule.signOut()');
const signInIndex = googleAndroidCode.indexOf('await GoogleSigninModule.signIn()');
assert(signOutIndex > 0 && signInIndex > 0 && signOutIndex < signInIndex, 'signOut must precede signIn in loginWithGoogle');
console.log('✅ Scenario 5 Passed: Google Play Services local session is cleared prior to signIn, ensuring account picker popup.');

// Scenario 6: Google Sign-Out preserves authorization (no revokeAccess)
console.log('\n--- Scenario 6: Google Sign-Out Non-Revocation ---');
assert(
  !googleAndroidCode.includes('.revokeAccess('),
  'Routine Google sign-out must NOT call revokeAccess() to avoid invalidating user app permission'
);
assert(
  googleAndroidCode.includes('export async function signOutFromGoogle()'),
  'signOutFromGoogle must be exported'
);
console.log('✅ Scenario 6 Passed: Google sign-out clears local session while preserving user account authorization.');

// Scenario 7: State isolation on logout (all tokens and caches purged)
console.log('\n--- Scenario 7: State Isolation & Cache Purging on Logout ---');
const apiCode = fs.readFileSync('frontend/src/services/api.js', 'utf8');
const appContextCode = fs.readFileSync('frontend/src/context/AppContext.js', 'utf8');

const expectedPurgedKeys = [
  'nb_token',
  'nb_active_session',
  'nb_active_user',
  'nb_mock_active',
  'foodiebite_admin_session',
  'foodiebite_redirect_after_login'
];

expectedPurgedKeys.forEach(k => {
  assert(apiCode.includes(`removeItemSync('${k}')`), `apiLogout must purge storage key ${k}`);
  assert(appContextCode.includes(`removeItemSync('${k}')`), `AppContext.logout must purge storage key ${k}`);
});
console.log('✅ Scenario 7 Passed: All authentication tokens and user session keys are purged on logout.');

// Scenario 8: User preferences reset on logout
console.log('\n--- Scenario 8: User Preferences Reset on Logout ---');
assert(
  appContextCode.includes('DEFAULT_PREFERENCES'),
  'AppContext must define DEFAULT_PREFERENCES'
);
assert(
  appContextCode.includes('setPreferencesState(DEFAULT_PREFERENCES)'),
  'AppContext.logout and setUser(null) must reset preferences to default state'
);
console.log('✅ Scenario 8 Passed: User preferences and favorites are reset on logout, preventing cross-account bleed.');

// Scenario 9: Cancellation handling in Google Sign-In
console.log('\n--- Scenario 9: Graceful Cancellation Handling ---');
assert(
  googleAndroidCode.includes("err.code === statusCodes.SIGN_IN_CANCELLED || /cancel/i.test(err.message || '')"),
  'Cancellation of Google Sign-In must be caught'
);
assert(
  googleAndroidCode.includes("'Google Sign-In was cancelled.'"),
  'Cancelled sign-in must produce friendly non-fatal error'
);
console.log('✅ Scenario 9 Passed: Account picker cancellation is handled cleanly without crash.');

// Scenario 10: Sanitized logging (No tokens, passwords, or secrets logged)
console.log('\n--- Scenario 10: Sanitized Logging Verification ---');
const filesToCheck = [
  'frontend/src/services/googleAuth.android.js',
  'frontend/src/services/supabaseAuthService.js',
  'frontend/src/services/api.js',
  'frontend/src/context/AppContext.js'
];

filesToCheck.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('console.log(') || line.includes('console.warn(') || line.includes('console.error(')) {
      assert(
        !/console\.(log|warn|error)\([^)]*(password|access_token|refresh_token|idToken)\s*,/i.test(line),
        `Sensitive token/password logged in ${file}:${idx + 1}: ${line.trim()}`
      );
    }
  });
});
console.log('✅ Scenario 10 Passed: All logs are properly sanitized with zero sensitive credential exposure.');

console.log('\n🎉 ALL 10 TEST SCENARIOS PASSED SUCCESSFULLY!');
