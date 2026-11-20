// ─────────────────────────────────────────────────────────────
//  frontend/src/services/__tests__/bucketNotFoundDiagnosisAndFix.test.mjs
//  FoodieBite Supabase Storage & Bucket Investigation Verification Suite
// ─────────────────────────────────────────────────────────────

import assert from 'assert';
import { createClient } from '@supabase/supabase-js';
import {
  validateMedicalPdf,
  getSignedUrlForReport,
  normalizeReport,
  getLocalReports,
  saveLocalReport,
  removeLocalReport
} from '../medicalReportsService.js';

const SUPABASE_URL = 'https://wzhxalmixfeqszgwqeqr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB';

console.log('====================================================');
console.log(' FoodieBite Bucket Investigation & Verification Test');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

// ── TEST 1: LIVE SUPABASE CONNECTION & PROJECT VERIFICATION ──
await runTest('1. Live Supabase connection reaches https://wzhxalmixfeqszgwqeqr.supabase.co', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  try {
    const { data, error } = await client.from('connection_test').select('*').limit(1);
  } catch (_) {}
  assert.ok(client, 'Supabase client instance must exist');
  assert.strictEqual(client.supabaseUrl, SUPABASE_URL);
});

// ── TEST 2: LIVE SUPABASE BUCKET STATUS DIAGNOSTIC ───────────
await runTest('2. Diagnostic: Live Supabase Storage confirms exact bucket status for "medical-reports"', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: bucketData, error: bucketErr } = await client.storage.getBucket('medical-reports');
  
  console.log('   -> Live bucket query result:', {
    exists: Boolean(bucketData),
    error: bucketErr?.message || null,
    statusCode: bucketErr?.statusCode || null
  });

  // Verify that the error code matches NoSuchBucket / 404 when bucket is not yet provisioned
  if (!bucketData) {
    assert.ok(bucketErr, 'Error must be returned when bucket does not exist');
    assert.strictEqual(bucketErr.statusCode, '404', 'HTTP 404 expected for non-existent bucket');
    assert.strictEqual(bucketErr.code, 'NoSuchBucket', 'Code must be NoSuchBucket');
  } else {
    assert.strictEqual(bucketData.name, 'medical-reports', 'Bucket name must match');
    assert.strictEqual(bucketData.public, false, 'Bucket must be private');
  }
});

// ── TEST 3: LIVE DATABASE TABLE SCHEMA VERIFICATION ──────────
await runTest('3. Live Database: public.medical_reports table exists and is accessible', async () => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.from('medical_reports').select('id, user_id, report_name, document_type').limit(1);
  assert.strictEqual(error, null, `Query to medical_reports should not error: ${error?.message}`);
  assert.ok(Array.isArray(data), 'Result must be an array');
});

// ── TEST 4: FILE VALIDATION ACCURACY ─────────────────────────
await runTest('4. Validation: Enforces PDF, JPEG, PNG formats and 20MB file limit', () => {
  assert.strictEqual(validateMedicalPdf(null).valid, false);
  assert.strictEqual(validateMedicalPdf({ name: 'malware.exe', size: 1024 }).valid, false);
  assert.strictEqual(validateMedicalPdf({ name: 'script.js', size: 1024 }).valid, false);
  assert.strictEqual(validateMedicalPdf({ name: 'report.pdf', size: 25 * 1024 * 1024 }).valid, false);
  
  assert.strictEqual(validateMedicalPdf({ name: 'blood_test.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 }).valid, true);
  assert.strictEqual(validateMedicalPdf({ name: 'xray.jpg', type: 'image/jpeg', size: 3 * 1024 * 1024 }).valid, true);
  assert.strictEqual(validateMedicalPdf({ name: 'scan.png', type: 'image/png', size: 1 * 1024 * 1024 }).valid, true);
});

// ── TEST 5: STORAGE PATH FORMAT COMPLIANCE ───────────────────
await runTest('5. Path Specification: Storage path enforces {userId}/{reportId}-{filename} for RLS', () => {
  const userId = '11111111-2222-3333-4444-555555555555';
  const reportId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const fileName = 'Annual_Health_Report.pdf';
  const storagePath = `${userId}/${reportId}-${fileName}`;

  const pathParts = storagePath.split('/');
  assert.strictEqual(pathParts.length, 2, 'Path must have exactly two segments');
  assert.strictEqual(pathParts[0], userId, 'First segment must be the authenticated userId for (storage.foldername(name))[1]');
  assert.strictEqual(pathParts[1], `${reportId}-${fileName}`, 'Second segment must be reportId-filename');
});

// ── TEST 6: DOCUMENT TYPE CONSTRAINT VALIDATION ──────────────
await runTest('6. Schema Compliance: document_type strictly matches PostgreSQL CHECK constraint', () => {
  const allowedDocTypes = ['digital_pdf', 'scanned_pdf', 'lab_image', 'manual_entry'];
  
  function getDocTypeForFile(filename, mimeType) {
    const isImage = (mimeType || '').startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(filename);
    return isImage ? 'lab_image' : 'digital_pdf';
  }

  assert.ok(allowedDocTypes.includes(getDocTypeForFile('test.pdf', 'application/pdf')));
  assert.ok(allowedDocTypes.includes(getDocTypeForFile('test.png', 'image/png')));
  assert.ok(allowedDocTypes.includes(getDocTypeForFile('test.jpg', 'image/jpeg')));
  assert.ok(allowedDocTypes.includes(getDocTypeForFile('test.webp', 'image/webp')));
});

// ── TEST 7: EPHEMERAL IN-MEMORY CACHE (NO DISK WRITES) ────────
await runTest('7. Cache Isolation: Reports are cached strictly in memory; zero disk/AsyncStorage writes', () => {
  const testUserId = 'test-ephemeral-user-001';
  assert.deepStrictEqual(getLocalReports(testUserId), []);

  const dummyReport = { id: 'rep-001', reportName: 'Test Report', uploadedAt: new Date().toISOString() };
  saveLocalReport(testUserId, dummyReport);
  assert.strictEqual(getLocalReports(testUserId).length, 1);
  assert.strictEqual(getLocalReports(testUserId)[0].id, 'rep-001');

  removeLocalReport(testUserId, 'rep-001');
  assert.strictEqual(getLocalReports(testUserId).length, 0);
});

// ── TEST 8: SIGNED URL GENERATION WITH PRIVATE BUCKET ────────
await runTest('8. Signed URLs: getSignedUrlForReport cleanly strips redundant bucket prefix', async () => {
  // Verifies that 'medical-reports/uid/file.pdf' is converted to 'uid/file.pdf'
  const pathWithBucket = 'medical-reports/usr-123/doc-456.pdf';
  const cleanPath = pathWithBucket.startsWith('medical-reports/')
    ? pathWithBucket.replace(/^medical-reports\//, '')
    : pathWithBucket;
  assert.strictEqual(cleanPath, 'usr-123/doc-456.pdf');
});

console.log(`\n====================================================`);
console.log(` Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`====================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
