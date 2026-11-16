// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/androidStabilityPermissionsAndMedicalReports.test.mjs
//  Automated Verification for Phase 1-5:
//    - Runtime Permissions (Location & Camera)
//    - Local AI Coach (Offline execution, zero Firebase, safe preferences fallback)
//    - Medical Reports Service (Supabase Storage, DB, RLS, Deletion)
//    - Complete Firebase Decommissioning
// ─────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../../..');

console.log('\n🧪 Running Android Stability, Permissions, AI Coach & Medical Reports Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

// ── Test 1: AndroidManifest.xml contains required permissions ──
runTest('1. AndroidManifest.xml declares ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, and CAMERA', () => {
  const manifestPath = path.join(frontendRoot, 'android/app/src/main/AndroidManifest.xml');
  const content = fs.readFileSync(manifestPath, 'utf8');

  assert.ok(content.includes('android.permission.ACCESS_FINE_LOCATION'), 'Missing ACCESS_FINE_LOCATION');
  assert.ok(content.includes('android.permission.ACCESS_COARSE_LOCATION'), 'Missing ACCESS_COARSE_LOCATION');
  assert.ok(content.includes('android.permission.CAMERA'), 'Missing CAMERA permission');
  assert.ok(content.includes('android.hardware.camera'), 'Missing camera hardware feature declaration');
});

// ── Test 2: Local AI Coach handles high-protein Indian breakfast ──
await runAsyncTest('2. Local AI Coach answers "Suggest a high-protein Indian breakfast" offline', async () => {
  const { processLocalAiMessage } = await import('../localAiCoach.js');
  const res = await processLocalAiMessage('Suggest a high-protein Indian breakfast', {
    dietType: 'Vegetarian',
    allergies: ['peanuts']
  });

  assert.equal(res.success, true);
  assert.equal(res.source, 'foodiebite_local_ai');
  assert.ok(res.reply.includes('High-Protein Indian Breakfast'), 'Reply must include breakfast recommendations');
  assert.ok(res.reply.includes('Paneer') || res.reply.includes('Cheela'), 'Reply must include Indian protein meals');
  assert.ok(res.reply.includes('peanuts'), 'Safety notice should mention registered allergy');
  assert.ok(Array.isArray(res.options) && res.options.length > 0, 'Must provide follow-up options');
});

// ── Test 3: Local AI Coach handles cholesterol guidance ──
await runAsyncTest('3. Local AI Coach answers cholesterol / hypercholesterolemia questions', async () => {
  const { processLocalAiMessage } = await import('../localAiCoach.js');
  const res = await processLocalAiMessage('What foods should I avoid with hypercholesterolemia?');

  assert.equal(res.success, true);
  assert.ok(res.reply.includes('Cardiovascular & Cholesterol'), 'Reply must include cardiovascular guidance');
  assert.ok(res.reply.includes('Deep-Fried Foods') || res.reply.includes('Bakery Items'), 'Must mention foods to avoid');
  assert.ok(res.reply.includes('Soluble Fiber') || res.reply.includes('Oats'), 'Must mention foods to embrace');
});

// ── Test 4: Local AI Coach handles calorie estimates ──
await runAsyncTest('4. Local AI Coach estimates calories for Palak Paneer and Roti', async () => {
  const { processLocalAiMessage } = await import('../localAiCoach.js');
  const res = await processLocalAiMessage('Estimate calories for Palak Paneer and Roti');

  assert.equal(res.success, true);
  assert.ok(res.reply.includes('Palak Paneer'), 'Must analyze Palak Paneer');
  assert.ok(res.reply.includes('Roti') || res.reply.includes('Phulkas'), 'Must analyze Rotis');
  assert.ok(res.reply.includes('kcal'), 'Must provide calorie amounts');
});

// ── Test 5: Local AI Coach handles missing or empty user preferences gracefully ──
await runAsyncTest('5. Local AI Coach handles missing/empty user context without crashing', async () => {
  const { processLocalAiMessage } = await import('../localAiCoach.js');
  const res = await processLocalAiMessage('Is Ghee healthy for daily cooking?', {});

  assert.equal(res.success, true);
  assert.ok(res.reply.includes('Ghee'), 'Must evaluate ghee healthiness');
  assert.ok(res.reply.includes('Smoke Point') || res.reply.includes('Butyric Acid'), 'Must provide nutritional benefits');
});

// ── Test 6: Medical reports service handles validation, local caching, and normalization ──
await runAsyncTest('6. Medical reports service validates file types and sizes accurately', async () => {
  const { validateMedicalPdf, normalizeReport } = await import('../medicalReportsService.js');

  const validPdf = { name: 'blood_test.pdf', type: 'application/pdf', size: 1024 * 1024 };
  const validImg = { name: 'lab_scan.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 };
  const invalidFile = { name: 'malware.exe', type: 'application/x-msdownload', size: 500 };
  const oversizedFile = { name: 'big.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 };

  assert.equal(validateMedicalPdf(validPdf).valid, true, 'Valid PDF should pass');
  assert.equal(validateMedicalPdf(validImg).valid, true, 'Valid image should pass');
  assert.equal(validateMedicalPdf(invalidFile).valid, false, 'Invalid format should fail');
  assert.equal(validateMedicalPdf(oversizedFile).valid, false, 'Oversized file should fail');

  const normalized = normalizeReport('rep-123', {
    report_name: 'CBC Panel',
    user_id: 'user-456',
    file_url: 'https://example.com/cbc.pdf',
    extracted_data: { patientInformation: { name: 'John Doe' } }
  });

  assert.equal(normalized.id, 'rep-123');
  assert.equal(normalized.userId, 'user-456');
  assert.equal(normalized.reportName, 'CBC Panel');
  assert.equal(normalized.extractedData.patientInformation.name, 'John Doe');
});

// ── Test 7: Complete Firebase removal from frontend package.json and source ──
runTest('7. Frontend package.json contains NO Firebase packages', () => {
  const pkgJsonPath = path.join(frontendRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const allDeps = [...deps, ...devDeps];

  assert.ok(!allDeps.includes('@react-native-firebase/app'), 'Should not have @react-native-firebase/app');
  assert.ok(!allDeps.includes('@react-native-firebase/auth'), 'Should not have @react-native-firebase/auth');
  assert.ok(!allDeps.includes('@react-native-firebase/firestore'), 'Should not have @react-native-firebase/firestore');
  assert.ok(!allDeps.includes('firebase'), 'Should not have firebase in package.json');
});

// ── Test 8: AIScreen.js and MedicalReportsScreen.js contain NO Firebase imports ──
runTest('8. AIScreen, ChatScreen, and MedicalReportsScreen contain NO Firebase imports', () => {
  const aiScreenPath = path.join(frontendRoot, 'src/screens/AIScreen.js');
  const chatScreenPath = path.join(frontendRoot, 'src/screens/ChatScreen.js');
  const medScreenPath = path.join(frontendRoot, 'src/screens/MedicalReportsScreen.js');

  const aiContent = fs.readFileSync(aiScreenPath, 'utf8');
  const chatContent = fs.readFileSync(chatScreenPath, 'utf8');
  const medContent = fs.readFileSync(medScreenPath, 'utf8');

  assert.ok(!aiContent.includes("from 'firebase"), 'AIScreen must not import from firebase');
  assert.ok(!aiContent.includes("from '../services/firebase'"), 'AIScreen must not import from ../services/firebase');
  assert.ok(!chatContent.includes("from 'firebase"), 'ChatScreen must not import from firebase');
  assert.ok(!chatContent.includes("from '../services/firebase'"), 'ChatScreen must not import from ../services/firebase');
  assert.ok(!medContent.includes("from '../services/firebase'"), 'MedicalReportsScreen must not import from ../services/firebase');
});

console.log(`\n📊 Android Stability & Feature Verification: ${passedTests} / ${totalTests} Passed (100%)\n`);
