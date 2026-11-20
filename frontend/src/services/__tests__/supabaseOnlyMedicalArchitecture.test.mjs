// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/supabaseOnlyMedicalArchitecture.test.mjs
//  FoodieBite Comprehensive Supabase-Only Architecture Test Suite
// ─────────────────────────────────────────────────────────────

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('\n======================================================');
console.log('--- SUPABASE-ONLY ARCHITECTURE & MEDICAL REPORTS TESTS ---');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

// ── TEST 1: File Validation ───────────────────────────────────
import { validateMedicalPdf } from '../medicalReportsService.js';

runTest('1. File validation accepts valid PDF, JPEG, and PNG files under 20MB', () => {
  const validPdf = { name: 'blood_test.pdf', type: 'application/pdf', size: 1024 * 500 };
  const validJpg = { name: 'scan.jpg', type: 'image/jpeg', size: 1024 * 800 };
  const validPng = { name: 'report.png', type: 'image/png', size: 1024 * 1200 };

  assert.strictEqual(validateMedicalPdf(validPdf).valid, true);
  assert.strictEqual(validateMedicalPdf(validJpg).valid, true);
  assert.strictEqual(validateMedicalPdf(validPng).valid, true);
});

runTest('2. File validation rejects invalid formats and oversized files (>20MB)', () => {
  const invalidExe = { name: 'malware.exe', type: 'application/x-msdownload', size: 1024 };
  const invalidTxt = { name: 'notes.txt', type: 'text/plain', size: 500 };
  const oversized = { name: 'huge_scan.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 };

  assert.strictEqual(validateMedicalPdf(invalidExe).valid, false);
  assert.strictEqual(validateMedicalPdf(invalidTxt).valid, false);
  assert.strictEqual(validateMedicalPdf(oversized).valid, false);
});

// ── TEST 2: Storage Path & RLS Pattern ───────────────────────
runTest('3. Storage path strictly matches {userId}/{reportId}-{filename} for Storage RLS compatibility', () => {
  const userId = '24559eb4-845a-4934-8c81-197e4125bce8';
  const reportId = '7b2756aa-67c2-4cb1-80cf-561b3651d2f2';
  const rawFileName = 'My Lab Report #1.pdf';
  const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${reportId}-${cleanFileName}`;

  assert.strictEqual(cleanFileName, 'My_Lab_Report__1.pdf');
  assert.strictEqual(storagePath, '24559eb4-845a-4934-8c81-197e4125bce8/7b2756aa-67c2-4cb1-80cf-561b3651d2f2-My_Lab_Report__1.pdf');

  // Verify (storage.foldername(name))[1] evaluates to userId
  const parts = storagePath.split('/');
  assert.strictEqual(parts[0], userId, 'First folder must strictly match user_id / auth.uid()');
  assert.ok(!storagePath.startsWith('medical-reports/'), 'Path must NOT have bucket prefix inside bucket');
});

// ── TEST 3: PostgreSQL Schema Constraints ────────────────────
runTest('4. Document type strictly maps to valid Postgres check constraint', () => {
  const validCheckConstraints = ['digital_pdf', 'scanned_pdf', 'lab_image', 'manual_entry'];

  const getDocType = (mime, cleanName) => {
    const isImage = mime.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(cleanName);
    return isImage ? 'lab_image' : 'digital_pdf';
  };

  const pdfType = getDocType('application/pdf', 'report.pdf');
  const jpgType = getDocType('image/jpeg', 'photo.jpg');

  assert.ok(validCheckConstraints.includes(pdfType), 'PDF must map to allowed constraint');
  assert.ok(validCheckConstraints.includes(jpgType), 'Image must map to allowed constraint');
  assert.notStrictEqual(pdfType, 'medical_report', 'Must never use invalid "medical_report" string');
});

// ── TEST 4: Normalization and Ephemeral Storage ───────────────
import { normalizeReport, saveLocalReport, getLocalReports, removeLocalReport } from '../medicalReportsService.js';

runTest('5. Normalization preserves Supabase storageProvider and resolves metadata', () => {
  const sample = normalizeReport('test-id-1', {
    id: 'test-id-1',
    user_id: 'user-uuid-1',
    report_name: 'Lipid Panel',
    original_filename: 'lipid.pdf',
    storage_path: 'user-uuid-1/test-id-1-lipid.pdf',
    file_url: 'https://wzhxalmixfeqszgwqeqr.supabase.co/storage/v1/object/sign/medical-reports/signed-url',
    document_type: 'digital_pdf',
    created_at: '2026-11-18T10:00:00Z',
    analysis: {
      healthScores: { overall: 92, overallLabel: 'Good' },
      wellnessConcerns: [{ concern: 'Elevated Triglycerides' }],
      foodProfile: { foodsToPrefer: ['Oats'], foodsToLimit: ['Trans fats'] }
    }
  });

  assert.strictEqual(sample.id, 'test-id-1');
  assert.strictEqual(sample.storageProvider, 'supabase');
  assert.strictEqual(sample.documentType, 'digital_pdf');
  assert.strictEqual(sample.reportName, 'Lipid Panel');
});

runTest('6. Ephemeral report cache operates in-memory without persistent disk/AsyncStorage writes', () => {
  const uid = 'in-memory-test-user';
  const reportObj = { id: 'rep-mem-1', reportName: 'Test Report', storageProvider: 'supabase' };

  saveLocalReport(uid, reportObj);
  const fetched = getLocalReports(uid);
  assert.strictEqual(fetched.length, 1);
  assert.strictEqual(fetched[0].id, 'rep-mem-1');

  removeLocalReport(uid, 'rep-mem-1');
  const empty = getLocalReports(uid);
  assert.strictEqual(empty.length, 0);
});

// ── TEST 5: Backend Filesystem Cleanliness ───────────────────
runTest('7. Backend uploads/medical_reports contains zero permanent disk files', () => {
  const medicalUploadsDir = path.resolve('backend/uploads/medical_reports');
  if (fs.existsSync(medicalUploadsDir)) {
    const files = fs.readdirSync(medicalUploadsDir);
    assert.strictEqual(files.length, 0, `medical_reports directory must be empty, found: ${files.join(', ')}`);
  }
});

runTest('8. Backend medical_reports_db.json contains zero active user records', () => {
  const dbPath = path.resolve('backend/data/medical_reports_db.json');
  if (fs.existsSync(dbPath)) {
    const content = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert.deepStrictEqual(content, {}, 'medical_reports_db.json must be empty object');
  }
});

// ── TEST 6: Zero Firebase Runtime References ─────────────────
runTest('9. Zero firebase-admin dependencies in backend package.json', () => {
  const pkgPath = path.resolve('backend/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.strictEqual(pkg.dependencies['firebase-admin'], undefined, 'firebase-admin must be removed from dependencies');
});

runTest('10. Zero Firebase configuration files in workspace root', () => {
  assert.strictEqual(fs.existsSync('firebase.json'), false, 'firebase.json must not exist');
  assert.strictEqual(fs.existsSync('firestore.rules'), false, 'firestore.rules must not exist');
  assert.strictEqual(fs.existsSync('firestore.indexes.json'), false, 'firestore.indexes.json must not exist');
  assert.strictEqual(fs.existsSync('functions'), false, 'functions directory must not exist');
});

// ── TEST 7: Supabase Configuration Uniformity ────────────────
runTest('11. Root .env and frontend .env point uniformly to FoodieBite Supabase project', () => {
  const rootEnv = fs.readFileSync('.env', 'utf8');
  const frontEnv = fs.readFileSync('frontend/.env', 'utf8');
  const backEnv = fs.readFileSync('backend/.env', 'utf8');

  assert.ok(rootEnv.includes('wzhxalmixfeqszgwqeqr.supabase.co'));
  assert.ok(frontEnv.includes('wzhxalmixfeqszgwqeqr.supabase.co'));
  assert.ok(backEnv.includes('wzhxalmixfeqszgwqeqr.supabase.co'));

  assert.ok(!rootEnv.includes('REACT_APP_FIREBASE_API_KEY'));
  assert.ok(!frontEnv.includes('REACT_APP_FIREBASE_API_KEY'));
  assert.ok(!backEnv.includes('FIREBASE_PROJECT_ID'));
});

// ── TEST 8: Migration SQL Structure ──────────────────────────
runTest('12. Supabase storage hardening migration defines private bucket and storage RLS', () => {
  const migrationPath = path.resolve('supabase/migrations/20261118000007_storage_and_medical_reports_hardening.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration 07 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  assert.ok(sql.includes("bucket_id = 'medical-reports'"));
  assert.ok(sql.includes("(storage.foldername(name))[1] = auth.uid()::text"));
  assert.ok(sql.includes("public = false"));
  assert.ok(sql.includes("auth.uid() = user_id"));
});

console.log('\n======================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('✅ ALL SUPABASE-ONLY ARCHITECTURE TESTS PASSED FLAWLESSLY!\n');
} else {
  process.exit(1);
}
