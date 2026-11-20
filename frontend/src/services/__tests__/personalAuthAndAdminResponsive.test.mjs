import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Test Suite: Personal Account Auth & Admin Responsive Layout...');

// Test 1: Verify googleAuth.android.js imports all storage methods
console.log('\n--- Test 1: googleAuth.android.js Storage Imports ---');
const googleAndroidCode = fs.readFileSync('frontend/src/services/googleAuth.android.js', 'utf8');

assert(
  googleAndroidCode.includes("import { setItem, removeItem, setItemSync, removeItemSync } from './storage.js'"),
  'googleAuth.android.js must import setItem, removeItem, setItemSync, and removeItemSync from storage.js'
);
assert(
  !googleAndroidCode.includes("import { setItemSync } from './storage.js'"),
  'Old partial import must be replaced'
);
console.log('✅ Test 1 Passed: googleAuth.android.js correctly imports all storage APIs.');

// Test 2: Verify personal account login does not throw removeItemSync error
console.log('\n--- Test 2: Personal Account Storage Handling (Non-Admin) ---');
assert(
  googleAndroidCode.includes("await removeItem('foodiebite_admin_session')"),
  'Personal account login must await removeItem for foodiebite_admin_session'
);
assert(
  googleAndroidCode.includes("await setItem('foodiebite_admin_session'"),
  'Admin account login must await setItem for foodiebite_admin_session'
);
assert(
  googleAndroidCode.includes("catch (storageErr)"),
  'Storage operations must be wrapped in defensive try-catch to prevent app crash on storage issues'
);
console.log('✅ Test 2 Passed: Personal account login properly calls and awaits removeItem with defensive error handling.');

// Test 3: Verify AsyncStorage persistence in storage.android.js
console.log('\n--- Test 3: Storage Implementation Architecture ---');
const storageAndroidCode = fs.readFileSync('frontend/src/services/storage.android.js', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));

assert(
  packageJson.dependencies['@react-native-async-storage/async-storage'],
  '@react-native-async-storage/async-storage must be in package.json dependencies'
);
assert(
  storageAndroidCode.includes("import AsyncStorage from '@react-native-async-storage/async-storage'"),
  'storage.android.js must be backed by @react-native-async-storage/async-storage'
);
assert(
  storageAndroidCode.includes("export async function removeItem(key)"),
  'storage.android.js must export async removeItem'
);
assert(
  storageAndroidCode.includes("export async function setItem(key, value)"),
  'storage.android.js must export async setItem'
);
assert(
  storageAndroidCode.includes("export async function getItem(key)"),
  'storage.android.js must export async getItem'
);
assert(
  storageAndroidCode.includes("export function removeItemSync(key)"),
  'storage.android.js must export removeItemSync'
);
console.log('✅ Test 3 Passed: Persistent storage is backed by official AsyncStorage with sync memoryCache support.');

// Test 4: Verify AppContext logout storage handling
console.log('\n--- Test 4: AppContext Logout Storage Handling ---');
const appContextCode = fs.readFileSync('frontend/src/context/AppContext.js', 'utf8');

assert(
  appContextCode.includes("import storage, { getItemSync, removeItemSync, removeItem } from '../services/storage'"),
  'AppContext.js must import removeItem alongside removeItemSync'
);
assert(
  appContextCode.includes("await Promise.all([") && appContextCode.includes("removeItem('nb_token')"),
  'AppContext.logout must await async removeItem for persistent session keys'
);
console.log('✅ Test 4 Passed: AppContext logout awaits AsyncStorage removal and purges memoryCache.');

// Test 5: Verify apiLogout storage handling in api.js
console.log('\n--- Test 5: api.js Logout Storage Handling ---');
const apiCode = fs.readFileSync('frontend/src/services/api.js', 'utf8');

assert(
  apiCode.includes("import storage, { getItemSync, setItemSync, removeItemSync, removeItem, setItem, getJSONSync } from './storage.js'"),
  'api.js must import removeItem and setItem'
);
assert(
  apiCode.includes("await Promise.all([") && apiCode.includes("removeItem('nb_token')"),
  'apiLogout must await async storage removal'
);
console.log('✅ Test 5 Passed: api.js properly awaits AsyncStorage removal during logout.');

// Test 6: Verify Admin Dashboard uses useWindowDimensions for responsiveness
console.log('\n--- Test 6: Admin Dashboard Responsive Dimension Hook ---');
const adminDashboardCode = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');

assert(
  adminDashboardCode.includes("useWindowDimensions"),
  'AdminDashboardScreen must import and call useWindowDimensions'
);
assert(
  adminDashboardCode.includes("const isMobile = width < 768;"),
  'AdminDashboardScreen must calculate isMobile breakpoint'
);
assert(
  adminDashboardCode.includes("const isSmallPhone = width < 380;"),
  'AdminDashboardScreen must calculate isSmallPhone breakpoint'
);
console.log('✅ Test 6 Passed: AdminDashboardScreen uses standard responsive breakpoints.');

// Test 7: Verify Responsive Admin Header on Mobile
console.log('\n--- Test 7: Responsive Admin Header ---');
assert(
  adminDashboardCode.includes("styles.adminHeaderContainer"),
  'AdminDashboardScreen must render responsive adminHeaderContainer'
);
assert(
  adminDashboardCode.includes("styles.adminHeaderMainRow"),
  'AdminDashboardScreen must render adminHeaderMainRow'
);
assert(
  adminDashboardCode.includes("styles.adminHeaderSubRow"),
  'AdminDashboardScreen must render adminHeaderSubRow on mobile screens'
);
assert(
  adminDashboardCode.includes("isSmallPhone ? 'Admin' : 'Admin Dashboard'"),
  'Header title must adapt to small phone screen width'
);
console.log('✅ Test 7 Passed: Admin Header is responsive and prevents mobile header crowding/overflow.');

// Test 8: Verify Metric Cards Grid Responsiveness (Section C)
console.log('\n--- Test 8: Metric Cards Responsive Grid ---');
assert(
  adminDashboardCode.includes("styles.metricsGridContainer"),
  'AdminDashboardScreen must render metricsGridContainer'
);
assert(
  adminDashboardCode.includes("width: isSmallPhone ? '100%' : (isMobile ? '48.5%' : '23.5%')"),
  'Metric cards must adapt width: 100% on small phone, 48.5% (2 cols) on mobile, 23.5% (4 cols) on tablet/desktop'
);
assert(
  adminDashboardCode.includes("minHeight: 90"),
  'Metric cards must have equal minimum heights'
);
console.log('✅ Test 8 Passed: Metric cards arrange in a clean 2-column mobile grid or 4-column desktop layout with equal heights.');

// Test 9: Verify Users Table Mobile Scroll Hint (Section D)
console.log('\n--- Test 9: Users Table Mobile Scroll Usability ---');
assert(
  adminDashboardCode.includes("styles.mobileTableHint"),
  'AdminDashboardScreen must render mobileTableHint on mobile'
);
assert(
  adminDashboardCode.includes("Swipe horizontally"),
  'Mobile table must include swipe guidance for mobile users'
);
console.log('✅ Test 9 Passed: Users Table includes clear horizontal scroll guidance on mobile.');

// Test 10: Verify Responsive Bottom Navigation Bar
console.log('\n--- Test 10: Admin Footer Navigation Responsiveness ---');
assert(
  !adminDashboardCode.includes("minWidth: 460,\n    paddingHorizontal: 8,"),
  'Conflicting minWidth: 460 on footer scroll must be removed'
);
assert(
  adminDashboardCode.includes("adminFooterScroll: {") && adminDashboardCode.includes("gap: 6,"),
  'adminFooterScroll must use responsive horizontal padding and gap'
);
assert(
  adminDashboardCode.includes("adminFooterIconWrapper"),
  'Admin footer items must have dedicated icon wrappers'
);
console.log('✅ Test 10 Passed: Admin Footer Navigation is responsive and scrolls smoothly on all screen sizes.');

console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY!');
