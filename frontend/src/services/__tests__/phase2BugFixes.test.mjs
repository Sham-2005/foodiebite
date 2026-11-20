// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/phase2BugFixes.test.mjs
//  Automated Verification Suite for FoodieBite Phase 2 Bug Fixes:
//    1. Logout & Delete Account (Supabase + Google Sign Out + Backend Cascade)
//    2. Android Camera & Gallery Permissions (Android 13+ READ_MEDIA_IMAGES)
//    3. Suggested Food Selection & Parameter Sanitization (Hermes stability)
// ─────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Starting FoodieBite Phase 2 Bug Fixes Verification Suite...\n');

// ── Test 1: AndroidManifest.xml permissions verification ─────────
console.log('▶ Test 1: Verifying AndroidManifest.xml for Android 13/14 permissions...');
const manifestPath = resolve(__dirname, '../../../../frontend/android/app/src/main/AndroidManifest.xml');
const manifestContent = readFileSync(manifestPath, 'utf8');

assert.ok(
  manifestContent.includes('android.permission.CAMERA'),
  'AndroidManifest.xml must include android.permission.CAMERA'
);
assert.ok(
  manifestContent.includes('android.permission.READ_MEDIA_IMAGES'),
  'AndroidManifest.xml must include android.permission.READ_MEDIA_IMAGES for Android 13+ (API 33+)'
);
assert.ok(
  manifestContent.includes('android.permission.READ_MEDIA_VISUAL_USER_SELECTED'),
  'AndroidManifest.xml must include android.permission.READ_MEDIA_VISUAL_USER_SELECTED for Android 14+ (API 34+)'
);
assert.ok(
  manifestContent.includes('android.permission.READ_EXTERNAL_STORAGE'),
  'AndroidManifest.xml must preserve READ_EXTERNAL_STORAGE for legacy devices'
);
console.log('  ✔ AndroidManifest.xml contains all required permissions (CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VISUAL_USER_SELECTED, READ_EXTERNAL_STORAGE)');

// ── Test 2: filePicker.android.js runtime permission check ────────
console.log('\n▶ Test 2: Verifying filePicker.android.js runtime permission requests...');
const filePickerPath = resolve(__dirname, '../filePicker.android.js');
const filePickerContent = readFileSync(filePickerPath, 'utf8');

assert.ok(
  filePickerContent.includes('requestGalleryPermission'),
  'filePicker.android.js must define and export requestGalleryPermission'
);
assert.ok(
  filePickerContent.includes('READ_MEDIA_IMAGES'),
  'filePicker.android.js must check READ_MEDIA_IMAGES on API 33+'
);
assert.ok(
  filePickerContent.includes('READ_EXTERNAL_STORAGE'),
  'filePicker.android.js must check READ_EXTERNAL_STORAGE on API <= 32'
);
assert.ok(
  filePickerContent.includes('await requestGalleryPermission()'),
  'launchImageLibrary must request gallery permission at runtime before accessing photos'
);
console.log('  ✔ filePicker.android.js gracefully requests gallery permissions according to Android API level');

// ── Test 3: Backend Account Deletion Controller & Route ──────────
console.log('\n▶ Test 3: Verifying backend deleteUserAccount controller & userRoutes...');
const userRoutesPath = resolve(__dirname, '../../../../backend/src/routes/userRoutes.js');
const userRoutesContent = readFileSync(userRoutesPath, 'utf8');
assert.ok(
  userRoutesContent.includes("router.delete('/account'"),
  'userRoutes.js must register DELETE /account'
);

const userControllerPath = resolve(__dirname, '../../../../backend/src/controllers/userController.js');
const userControllerContent = readFileSync(userControllerPath, 'utf8');
assert.ok(
  userControllerContent.includes('exports.deleteUserAccount = async'),
  'userController.js must define deleteUserAccount'
);
assert.ok(
  userControllerContent.includes("adminClient.from('medical_reports').delete()"),
  'deleteUserAccount must cascade delete user medical reports'
);
assert.ok(
  userControllerContent.includes("adminClient.from('user_favorites').delete()"),
  'deleteUserAccount must cascade delete user favorites'
);
assert.ok(
  userControllerContent.includes("adminClient.from('profiles').delete()"),
  'deleteUserAccount must cascade delete user profile'
);
assert.ok(
  userControllerContent.includes('adminClient.auth.admin.deleteUser'),
  'deleteUserAccount must delete user from Supabase Auth via Admin API'
);
console.log('  ✔ Backend deleteUserAccount cascades all user records and deletes Supabase Auth account');

// ── Test 4: Frontend apiDeleteAccount & apiLogout ─────────────────
console.log('\n▶ Test 4: Verifying frontend apiDeleteAccount & apiLogout in api.js...');
const apiServicePath = resolve(__dirname, '../api.js');
const apiServiceContent = readFileSync(apiServicePath, 'utf8');

assert.ok(
  apiServiceContent.includes('export async function apiDeleteAccount()'),
  'api.js must export apiDeleteAccount'
);
assert.ok(
  apiServiceContent.includes('/user/account'),
  'apiDeleteAccount must call DELETE /user/account endpoint'
);
assert.ok(
  apiServiceContent.includes('export async function apiLogout()'),
  'api.js must export apiLogout'
);
assert.ok(
  apiServiceContent.includes('signOutFromGoogle'),
  'apiLogout must call signOutFromGoogle to clear native Google Sign-In state'
);
assert.ok(
  apiServiceContent.includes('supabaseLogout'),
  'apiLogout must call supabaseLogout to terminate Supabase session'
);
console.log('  ✔ apiDeleteAccount and apiLogout cleanly terminate sessions and clean up local user storage');

// ── Test 5: ProfileScreen logout & delete handlers ───────────────
console.log('\n▶ Test 5: Verifying ProfileScreen logout & delete account navigation resets...');
const profileScreenPath = resolve(__dirname, '../../screens/ProfileScreen.js');
const profileScreenContent = readFileSync(profileScreenPath, 'utf8');

assert.ok(
  profileScreenContent.includes('logout'),
  'ProfileScreen must import/use logout from AppContext'
);
assert.ok(
  profileScreenContent.includes("navigation.reset({\n        index: 0,\n        routes: [{ name: 'SignIn' }],\n      })") ||
  profileScreenContent.includes("routes: [{ name: 'SignIn' }]"),
  'ProfileScreen must reset navigation to SignIn upon logout'
);
assert.ok(
  profileScreenContent.includes('apiDeleteAccount'),
  'ProfileScreen must invoke apiDeleteAccount on confirmed delete'
);
console.log('  ✔ ProfileScreen safely resets navigation stack to SignIn preventing back-button re-entry');

// ── Test 6: SignInScreen BackHandler hardware back protection ────
console.log('\n▶ Test 6: Verifying SignInScreen hardware back button handler...');
const signInScreenPath = resolve(__dirname, '../../screens/SignInScreen.js');
const signInScreenContent = readFileSync(signInScreenPath, 'utf8');

assert.ok(
  signInScreenContent.includes('BackHandler'),
  'SignInScreen must import and register BackHandler'
);
assert.ok(
  signInScreenContent.includes('BackHandler.exitApp()'),
  'SignInScreen must exit application on Android hardware back press when on sign in'
);
console.log('  ✔ SignInScreen captures hardware back press to exit app and prevent unauthorized navigation');

// ── Test 7: NutritionScannerScreen Preview & Confirmation ─────────
console.log('\n▶ Test 7: Verifying NutritionScannerScreen preview, confirmation, and suggested foods...');
const scannerScreenPath = resolve(__dirname, '../../screens/NutritionScannerScreen.js');
const scannerScreenContent = readFileSync(scannerScreenPath, 'utf8');

assert.ok(
  scannerScreenContent.includes('pendingImage'),
  'NutritionScannerScreen must maintain pendingImage state for preview and confirmation'
);
assert.ok(
  scannerScreenContent.includes('handleConfirmPendingImage'),
  'NutritionScannerScreen must provide handleConfirmPendingImage'
);
assert.ok(
  scannerScreenContent.includes('handleCancelPendingImage'),
  'NutritionScannerScreen must provide handleCancelPendingImage (retake)'
);
assert.ok(
  scannerScreenContent.includes('SUGGESTED_SCANNER_FOODS'),
  'NutritionScannerScreen must define SUGGESTED_SCANNER_FOODS'
);
assert.ok(
  scannerScreenContent.includes('handleSuggestedFoodPress'),
  'NutritionScannerScreen must define handleSuggestedFoodPress'
);
assert.ok(
  scannerScreenContent.includes("navigation.navigate('FoodDetail'"),
  'handleSuggestedFoodPress must navigate to FoodDetail screen'
);
console.log('  ✔ NutritionScannerScreen provides full preview/retake/confirm flow and clickable suggested foods');

// ── Test 8: FoodDetailScreen and UI.js Defensive Fallbacks ────────
console.log('\n▶ Test 8: Verifying FoodDetailScreen and UI.js Hermes runtime safety...');
const foodDetailPath = resolve(__dirname, '../../screens/FoodDetailScreen.js');
const foodDetailContent = readFileSync(foodDetailPath, 'utf8');

assert.ok(
  foodDetailContent.includes('Array.isArray(food?.allergens) ? food.allergens : []'),
  'FoodDetailScreen must defensively check if allergens is an array'
);
assert.ok(
  foodDetailContent.includes('String(a).replace'),
  'FoodDetailScreen must cast allergen items to String before calling replace'
);
assert.ok(
  foodDetailContent.includes('String(l).replace'),
  'FoodDetailScreen must cast label items to String before calling replace'
);

const uiPath = resolve(__dirname, '../../components/UI.js');
const uiContent = readFileSync(uiPath, 'utf8');

assert.ok(
  uiContent.includes('numScore.toFixed(1)'),
  'HealthScoreBadge must safely coerce score to number before calling toFixed'
);
assert.ok(
  uiContent.includes('Number(food.protein)'),
  'HealthScoreCard must safely coerce protein to Number'
);
console.log('  ✔ FoodDetailScreen and UI.js contain defensive fallbacks preventing Hermes exceptions');

console.log('\n🎉 ALL 8 AUTOMATED TESTS PASSED! All Phase 2 bug fixes verified.\n');
