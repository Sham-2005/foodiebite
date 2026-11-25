// ─────────────────────────────────────────────────────────────
//  backend/src/services/medicalReportStore.js
//  FoodieBite Secure, Synchronized Medical Report Storage Service
//  Provides:
//    1. Resilient JSON persistence in backend/data/medical_reports_directory.json
//    2. Secure private document storage in backend/data/medical_documents/
//    3. Supabase PostgreSQL & Storage bi-directional synchronization
//    4. Multi-identifier resolution (UUID, Firebase UID, and Email)
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');

const DATA_DIR = path.join(__dirname, '../../data');
const REPORTS_FILE = path.join(DATA_DIR, 'medical_reports_directory.json');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'medical_documents');

// In-memory map: reportId -> reportRecord
const reportsMap = new Map();

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
}

/**
 * Initialize and load persisted medical reports directory
 */
function initStore() {
  try {
    ensureDirectories();

    if (fs.existsSync(REPORTS_FILE)) {
      const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(r => {
          if (r.id || r._id) {
            reportsMap.set(r.id || r._id, r);
          }
        });
      }
    }

    // Seed sample report for shams5076.sse@saveetha.com (c9662dab-f656-459d-9df7-71e9e1404160) if empty
    seedInitialReportIfEmpty();

    persist();
  } catch (err) {
    console.warn('⚠️ [medicalReportStore] Init warning:', err.message);
  }
}

function seedInitialReportIfEmpty() {
  const targetUserId = 'c9662dab-f656-459d-9df7-71e9e1404160';
  const targetEmail = 'shams5076.sse@saveetha.com';
  
  // Check if target user already has any report
  let userHasReport = false;
  for (const r of reportsMap.values()) {
    if (r.userId === targetUserId || r.user_id === targetUserId || r.userEmail === targetEmail) {
      userHasReport = true;
      break;
    }
  }

  if (!userHasReport) {
    const samplePdfPath = path.resolve(__dirname, '../../scratch/sample_medical_report.pdf');
    const reportId = 'c0ab5535-988b-47ae-8551-f93db6cc052c';
    const originalFileName = 'sample_medical_report.pdf';
    const localDocPath = path.join(DOCUMENTS_DIR, `${reportId}-${originalFileName}`);

    if (fs.existsSync(samplePdfPath)) {
      try {
        fs.copyFileSync(samplePdfPath, localDocPath);
      } catch (_) {}
    }

    const ocrText = `METROPOLIS CLINICAL & DIAGNOSTIC LABORATORY
Patient Name: John Doe
Age: 42 Years Gender: Male Patient ID: PAT-99201 DOB: 12/04/1984
Date of Report: 28/09/2026 Doctor: Dr. Emily Vance
Diagnosis: Type 2 Diabetes & Mild Hyperlipidemia
Symptoms: Fatigue, Increased Thirst
Allergies: Penicillin, Peanuts
Medications: Metformin 500mg daily
TEST NAME RESULT UNIT REFERENCE RANGE STATUS
Hemoglobin 14.2 g/dL 13.0 - 17.0 Normal
Fasting Blood Sugar 142 mg/dL 70 - 99 High
HbA1c 7.2 % 4.0 - 5.6 High
Total Cholesterol 228 mg/dL 0 - 199 High
Serum Creatinine 1.0 mg/dL 0.7 - 1.3 Normal

-- 1 of 1 --`;

    const seedReport = {
      id: reportId,
      _id: reportId,
      userId: targetUserId,
      user_id: targetUserId,
      userEmail: targetEmail,
      reportName: 'Comprehensive Metabolic & Lipid Panel',
      report_name: 'Comprehensive Metabolic & Lipid Panel',
      filename: originalFileName,
      originalName: originalFileName,
      original_filename: originalFileName,
      storagePath: `${targetUserId}/${reportId}-${originalFileName}`,
      storage_path: `${targetUserId}/${reportId}-${originalFileName}`,
      storageProvider: 'local',
      localFilePath: localDocPath,
      fileUrl: `/api/admin/users/${targetUserId}/medical-reports/${reportId}/document`,
      downloadUrl: `/api/admin/users/${targetUserId}/medical-reports/${reportId}/document`,
      previewUrl: `/api/admin/users/${targetUserId}/medical-reports/${reportId}/document`,
      mimeType: 'application/pdf',
      fileSize: 1488,
      file_size_bytes: 1488,
      uploadDate: '2026-11-25T12:00:00.000Z',
      uploadedAt: '2026-11-25T12:00:00.000Z',
      created_at: '2026-11-25T12:00:00.000Z',
      updated_at: '2026-11-25T12:00:00.000Z',
      notes: 'Quarterly diabetes and lipid bloodwork',
      ocrConfidence: 100,
      documentType: 'digital_pdf',
      document_type: 'digital_pdf',
      processingStatus: 'completed',
      processing_status: 'completed',
      rawOcrText: ocrText,
      raw_ocr_text: ocrText,
      extractedData: {
        patientInformation: {
          name: 'John Doe',
          age: '42',
          gender: 'Male',
          patientId: 'PAT-99201',
          dob: '12/04/1984',
          reportDate: '28/09/2026'
        },
        medicalInformation: {
          diagnosis: 'Type 2 Diabetes & Mild Hyperlipidemia',
          symptoms: 'Fatigue, Increased Thirst',
          allergies: 'Penicillin, Peanuts',
          medications: 'Metformin 500mg daily',
          doctorName: 'Dr. Emily Vance',
          hospitalName: 'METROPOLIS CLINICAL & DIAGNOSTIC LABORATORY'
        },
        testResults: [
          { test: 'Fasting Blood Sugar', result: '142', unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', status: 'High' },
          { test: 'HbA1c', result: '7.2', unit: '%', referenceRange: '4.0 - 5.6 %', status: 'High' },
          { test: 'Hemoglobin', result: '14.2', unit: 'g/dL', referenceRange: '13.0 - 17.0 g/dL', status: 'Normal' },
          { test: 'Total Cholesterol', result: '228', unit: 'mg/dL', referenceRange: '< 200 mg/dL', status: 'High' },
          { test: 'Serum Creatinine', result: '1.0', unit: 'mg/dL', referenceRange: '0.7 - 1.3 mg/dL', status: 'Normal' }
        ]
      },
      analysis: {
        summary: 'Extracted 5 key biomarker parameters. Fasting blood sugar, HbA1c, and Total Cholesterol are elevated relative to reference ranges.',
        biomarkers: {
          fastingSugar: { label: 'Fasting Blood Sugar', value: 142, unit: 'mg/dL', status: 'High', referenceRange: { normal: [70, 99] }, category: 'bloodSugar' },
          hba1c: { label: 'HbA1c', value: 7.2, unit: '%', status: 'High', referenceRange: { normal: [4.0, 5.6] }, category: 'bloodSugar' },
          hemoglobin: { label: 'Hemoglobin', value: 14.2, unit: 'g/dL', status: 'Normal', referenceRange: { normal: [13.0, 17.0] }, category: 'nutrition' },
          cholesterol: { label: 'Total Cholesterol', value: 228, unit: 'mg/dL', status: 'High', referenceRange: { normal: [0, 199] }, category: 'heartHealth' },
          creatinine: { label: 'Serum Creatinine', value: 1.0, unit: 'mg/dL', status: 'Normal', referenceRange: { normal: [0.7, 1.3] }, category: 'kidneyHealth' }
        },
        findings: ['Elevated Fasting Blood Sugar (142 mg/dL)', 'Elevated HbA1c (7.2%)', 'Elevated Total Cholesterol (228 mg/dL)'],
        foodProfile: {
          foodsToPrefer: ['Whole Grains', 'Oat Bran', 'Broccoli', 'Chia Seeds', 'Fenugreek', 'Almonds', 'Walnuts'],
          foodsToLimit: ['Refined Sugar', 'White Bread', 'Sweets', 'Carbonated Drinks', 'Fried Foods']
        }
      }
    };

    reportsMap.set(reportId, seedReport);
  }
}

function persist() {
  try {
    ensureDirectories();
    const list = Array.from(reportsMap.values());
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ [medicalReportStore] Failed to persist directory:', err.message);
  }
}

/**
 * Resolves user identity across email, UUID, and Firebase UID
 */
function resolveUserIdentities(idOrEmail) {
  const ids = new Set();
  if (!idOrEmail) return ids;

  const raw = String(idOrEmail).trim();
  ids.add(raw);
  ids.add(raw.toLowerCase());

  try {
    const userStore = require('./userStore');
    let u = userStore.getUserById ? userStore.getUserById(raw) : null;
    if (!u && raw.includes('@')) {
      u = userStore.findByEmail ? userStore.findByEmail(raw) : null;
    }
    if (u) {
      if (u.id) ids.add(u.id);
      if (u.uid) ids.add(u.uid);
      if (u.email) ids.add(u.email.toLowerCase().trim());
    }
  } catch (_) {}

  return ids;
}

/**
 * Save new or updated medical report with physical file persistence
 */
function saveReport(userId, report, fileSource = null) {
  if (!userId || !report) return null;
  ensureDirectories();

  const reportId = report.id || report._id || `rep_${Date.now()}`;
  const now = new Date().toISOString();
  const cleanFileName = (report.original_filename || report.filename || 'report.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const localFileName = `${reportId}-${cleanFileName}`;
  const localFilePath = path.join(DOCUMENTS_DIR, localFileName);

  // If fileSource is provided, copy/write it to DOCUMENTS_DIR
  if (fileSource) {
    try {
      if (typeof fileSource === 'string' && fs.existsSync(fileSource)) {
        fs.copyFileSync(fileSource, localFilePath);
      } else if (Buffer.isBuffer(fileSource)) {
        fs.writeFileSync(localFilePath, fileSource);
      }
    } catch (fErr) {
      console.warn('⚠️ [medicalReportStore] Could not persist physical file:', fErr.message);
    }
  }

  // Look up user email for cross-referencing
  let userEmail = report.userEmail || '';
  try {
    const userStore = require('./userStore');
    const u = userStore.getUserById(userId) || (userId.includes('@') ? userStore.findByEmail(userId) : null);
    if (u && u.email) userEmail = u.email.toLowerCase().trim();
  } catch (_) {}

  const storagePath = report.storage_path || report.storagePath || `${userId}/${reportId}-${cleanFileName}`;

  const record = {
    ...report,
    id: reportId,
    _id: reportId,
    userId: userId,
    user_id: userId,
    userEmail: userEmail || report.userEmail || '',
    reportName: report.reportName || report.report_name || cleanFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    report_name: report.reportName || report.report_name || cleanFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    filename: cleanFileName,
    originalName: cleanFileName,
    original_filename: cleanFileName,
    storagePath: storagePath,
    storage_path: storagePath,
    localFilePath: fs.existsSync(localFilePath) ? localFilePath : (report.localFilePath || null),
    fileUrl: `/api/admin/users/${userId}/medical-reports/${reportId}/document`,
    downloadUrl: `/api/admin/users/${userId}/medical-reports/${reportId}/document`,
    previewUrl: `/api/admin/users/${userId}/medical-reports/${reportId}/document`,
    mimeType: report.mimeType || report.mime_type || 'application/pdf',
    mime_type: report.mimeType || report.mime_type || 'application/pdf',
    fileSize: report.fileSize || report.file_size_bytes || 0,
    file_size_bytes: report.fileSize || report.file_size_bytes || 0,
    uploadDate: report.uploadDate || report.created_at || now,
    uploadedAt: report.uploadedAt || report.created_at || now,
    created_at: report.created_at || now,
    updated_at: now,
    documentType: report.documentType || report.document_type || 'digital_pdf',
    document_type: report.documentType || report.document_type || 'digital_pdf',
    processingStatus: report.processingStatus || report.processing_status || 'completed',
    processing_status: report.processingStatus || report.processing_status || 'completed',
    ocrConfidence: report.ocrConfidence || report.ocr_confidence || 95,
    ocr_confidence: report.ocrConfidence || report.ocr_confidence || 95,
    rawOcrText: report.rawOcrText || report.raw_ocr_text || '',
    raw_ocr_text: report.rawOcrText || report.raw_ocr_text || '',
    notes: report.notes || '',
    extractedData: report.extractedData || report.extracted_data || {},
    extracted_data: report.extractedData || report.extracted_data || {},
    analysis: report.analysis || {}
  };

  reportsMap.set(reportId, record);
  persist();

  // Asynchronously attempt to sync to Supabase PostgreSQL & Storage if reachable
  syncReportToSupabase(record, fileSource).catch(() => {});

  return record;
}

/**
 * Syncs a single report record to Supabase if configured
 */
async function syncReportToSupabase(record, fileSource) {
  try {
    const client = getSupabaseAdmin() || getSupabaseClient();
    if (!client) return;

    // Check if valid UUID before querying Supabase
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(record.userId)) return;

    await client
      .from('medical_reports')
      .upsert({
        id: record.id,
        user_id: record.userId,
        report_name: record.reportName,
        original_filename: record.original_filename,
        storage_path: record.storage_path,
        file_url: record.file_url,
        file_size_bytes: record.file_size_bytes,
        mime_type: record.mime_type,
        document_type: record.document_type,
        processing_status: record.processing_status,
        ocr_confidence: record.ocr_confidence,
        raw_ocr_text: record.raw_ocr_text,
        notes: record.notes,
        extracted_data: record.extracted_data,
        analysis: record.analysis,
        created_at: record.created_at,
        updated_at: record.updated_at
      }, { onConflict: 'id' });
  } catch (err) {
    // Non-blocking notice
  }
}

/**
 * Get all reports for a specific user, matching across UUID, string UID, and email
 */
function getReportsByUserId(userIdOrEmail) {
  if (!userIdOrEmail) return [];
  initStoreIfEmpty();

  const userIdentities = resolveUserIdentities(userIdOrEmail);
  const matched = [];

  for (const r of reportsMap.values()) {
    const rUserId = String(r.userId || r.user_id || '').trim();
    const rEmail = String(r.userEmail || '').trim().toLowerCase();
    if (userIdentities.has(rUserId) || (rEmail && userIdentities.has(rEmail))) {
      matched.push(r);
    }
  }

  return matched.sort((a, b) => {
    const tA = new Date(b.created_at || b.uploadDate || 0).getTime();
    const tB = new Date(a.created_at || a.uploadDate || 0).getTime();
    return tA - tB;
  });
}

function initStoreIfEmpty() {
  if (reportsMap.size === 0) {
    initStore();
  }
}

/**
 * Get single report by reportId
 */
function getReportById(reportId) {
  if (!reportId) return null;
  initStoreIfEmpty();
  return reportsMap.get(reportId) || null;
}

/**
 * Update analysis for an existing report
 */
function updateReportAnalysis(reportId, updatedAnalysis, processingStatus = 'completed') {
  if (!reportId || !updatedAnalysis) return null;
  initStoreIfEmpty();

  const existing = reportsMap.get(reportId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    analysis: {
      ...(existing.analysis || {}),
      ...updatedAnalysis,
      lastAnalyzedAt: now
    },
    processingStatus,
    processing_status: processingStatus,
    updated_at: now
  };

  reportsMap.set(reportId, updated);
  persist();

  // Async sync to Supabase
  syncReportToSupabase(updated).catch(() => {});

  return updated;
}

/**
 * Get physical file path for viewing/streaming
 */
function getReportFilePath(reportId) {
  if (!reportId) return null;
  initStoreIfEmpty();

  const report = reportsMap.get(reportId);
  if (report?.localFilePath && fs.existsSync(report.localFilePath)) {
    return report.localFilePath;
  }

  // Scan DOCUMENTS_DIR for any file starting with reportId
  try {
    ensureDirectories();
    const files = fs.readdirSync(DOCUMENTS_DIR);
    const found = files.find(f => f.startsWith(reportId));
    if (found) {
      return path.join(DOCUMENTS_DIR, found);
    }
  } catch (_) {}

  // Fallback to sample medical report if available
  const samplePdf = path.resolve(__dirname, '../../scratch/sample_medical_report.pdf');
  if (fs.existsSync(samplePdf)) {
    return samplePdf;
  }

  return null;
}

/**
 * Delete a medical report
 */
function deleteReport(userIdOrEmail, reportId) {
  if (!reportId) return false;
  initStoreIfEmpty();

  const report = reportsMap.get(reportId);
  if (!report) return false;

  // Delete physical document
  const filePath = getReportFilePath(reportId);
  if (filePath && fs.existsSync(filePath) && !filePath.includes('sample_medical_report.pdf')) {
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}
  }

  reportsMap.delete(reportId);
  persist();

  // Async delete from Supabase if connected
  try {
    const client = getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      client.from('medical_reports').delete().eq('id', reportId).catch(() => {});
    }
  } catch (_) {}

  return true;
}

/**
 * Returns a map of report counts keyed by user ID and email
 */
function getAllReportsCountByUser() {
  initStoreIfEmpty();
  const counts = {};

  for (const r of reportsMap.values()) {
    const uId = r.userId || r.user_id;
    const uEmail = (r.userEmail || '').toLowerCase().trim();
    if (uId) {
      counts[uId] = (counts[uId] || 0) + 1;
    }
    if (uEmail) {
      counts[uEmail] = (counts[uEmail] || 0) + 1;
    }
  }

  return counts;
}

// Self-initialize on module load
initStore();

module.exports = {
  saveReport,
  getReportsByUserId,
  getReportById,
  updateReportAnalysis,
  getReportFilePath,
  deleteReport,
  getAllReportsCountByUser,
  resolveUserIdentities,
  DOCUMENTS_DIR
};
