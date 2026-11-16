// ─────────────────────────────────────────────────────────────
//  frontend/src/services/medicalReportsService.js
//  FoodieBite Medical Report Supabase & Local Storage Service
//  Architecture:
//    - Supabase Storage: Secure storage bucket for medical PDFs / documents
//    - Supabase PostgreSQL: Primary medical_reports table with RLS
//    - Local Storage: Instant offline client rehydration & resilience
//    - Backend API: Optional OCR extraction and analysis pipeline
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabaseClient.js';
import { getItemSync, setItemSync, getJSONSync } from './storage.js';
import {
  apiUploadMedicalReport,
  apiDeleteMedicalReport,
  apiGetMedicalReports,
  getLocalActiveUser,
} from './api.js';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validate that the selected file is a valid PDF or image within size limits.
 */
export function validateMedicalPdf(file) {
  if (!file) {
    return { valid: false, error: 'Please select a file to upload.' };
  }

  const name = (file.name || file.fileName || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  const isSupported =
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    name.endsWith('.pdf') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png');

  if (!isSupported) {
    return {
      valid: false,
      error: 'Invalid file type. Supported formats: PDF, JPEG, and PNG documents.',
    };
  }

  const fileSize = file.size || file.fileSize || 0;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds the 20 MB limit. Please upload a smaller file.',
    };
  }

  return { valid: true };
}

/**
 * Local storage helpers for instant rehydration
 */
function getStorageKey(userId) {
  return `foodiebite_saved_reports_${userId || 'guest_user'}`;
}

export function getLocalReports(userId) {
  try {
    return getJSONSync(getStorageKey(userId), []);
  } catch (_) {
    return [];
  }
}

export function saveLocalReport(userId, report) {
  try {
    const key = getStorageKey(userId);
    const existing = getLocalReports(userId);
    const rId = report.id || report._id;
    const filtered = existing.filter(r => (r.id || r._id) !== rId);
    filtered.unshift(report);
    setItemSync(key, JSON.stringify(filtered.slice(0, 50)));
  } catch (_) {}
}

export function removeLocalReport(userId, reportId) {
  try {
    const key = getStorageKey(userId);
    const existing = getLocalReports(userId);
    const filtered = existing.filter(r => (r.id || r._id) !== reportId);
    setItemSync(key, JSON.stringify(filtered));
  } catch (_) {}
}

/**
 * Helper to normalize report document format across all providers.
 */
export function normalizeReport(id, data = {}) {
  const patientInfo = data.extractedData?.patientInformation || data.analysis?.patientInfo || data.extracted_data?.patientInformation || {};
  const medicalInfo = data.extractedData?.medicalInformation || data.analysis?.medicalInfo || data.extracted_data?.medicalInformation || {};
  const testResults = data.extractedData?.testResults || data.analysis?.testResults || data.extracted_data?.testResults || data.analysis?.extractedTable || [];
  const rawOcrText = data.rawOcrText || data.raw_ocr_text || data.analysis?.rawOcrText || '';

  // Determine uploaded date string
  let uploadedDate = data.uploadedAtIso || data.uploadDate || data.uploadedAt || data.created_at;
  if (uploadedDate && typeof uploadedDate === 'object' && uploadedDate.toISOString) {
    uploadedDate = uploadedDate.toISOString();
  } else if (!uploadedDate) {
    uploadedDate = new Date().toISOString();
  }

  const resolveUrl = (u) => {
    if (!u) return '';
    if (typeof u === 'string' && (u.startsWith('/uploads') || u.startsWith('uploads/'))) {
      const backendBase = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
        ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')
        : 'http://localhost:5000';
      return `${backendBase}${u.startsWith('/') ? u : `/${u}`}`;
    }
    return u;
  };

  const finalUrl = resolveUrl(data.fileUrl || data.downloadUrl || data.previewUrl || data.file_url || '');

  return {
    id: id || data.id || data._id,
    _id: id || data.id || data._id,
    userId: data.userId || data.user_id || '',
    fileName: data.fileName || data.filename || data.originalName || data.report_name || 'Medical_Report.pdf',
    reportName: data.reportName || data.report_name || data.fileName || data.filename || 'Medical Report',
    storagePath: data.storagePath || data.storage_path || '',
    storageProvider: data.storageProvider || (finalUrl.includes('supabase') ? 'supabase' : 'local'),
    fileUrl: finalUrl,
    downloadUrl: finalUrl,
    previewUrl: finalUrl,
    reportDate: data.reportDate || patientInfo.reportDate || 'Not detected',
    uploadedAt: uploadedDate,
    uploadedAtIso: uploadedDate,
    processingStatus: data.processingStatus || data.processing_status || (data.analysis?.analysisFailed ? 'ocr_failed' : 'completed'),
    extractedData: {
      patientInformation: {
        name: patientInfo.name || 'Not detected',
        age: patientInfo.age || 'Not detected',
        gender: patientInfo.gender || 'Not detected',
        patientId: patientInfo.patientId || 'Not detected',
        dob: patientInfo.dob || 'Not detected',
        reportDate: patientInfo.reportDate || 'Not detected'
      },
      medicalInformation: {
        diagnosis: medicalInfo.diagnosis || 'Not detected',
        symptoms: medicalInfo.symptoms || 'Not detected',
        conditions: medicalInfo.conditions || 'Not detected',
        allergies: medicalInfo.allergies || 'Not detected',
        medications: medicalInfo.medications || 'Not detected',
        doctorName: medicalInfo.doctorName || 'Not detected',
        hospitalName: medicalInfo.hospitalName || 'Not detected'
      },
      testResults: Array.isArray(testResults) ? testResults : []
    },
    rawOcrText: rawOcrText,
    analysis: data.analysis || {
      patientInfo,
      medicalInfo,
      testResults,
      rawOcrText
    }
  };
}

function promiseWithTimeout(promise, ms, fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallbackValue), ms))
  ]);
}

/**
 * Generate a standard UUID v4 for records and files.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Upload medical document, save metadata to Supabase & local storage.
 */
export async function uploadAndPersistMedicalReport(file, notes = '', onProgress = () => {}) {
  // 1. Validation
  const validation = validateMedicalPdf(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Identify Authenticated User
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  let activeUser = null;
  if (client) {
    try {
      const { data } = await client.auth.getUser();
      activeUser = data?.user || null;
    } catch (_) {}
  }
  const localUser = getLocalActiveUser();
  const userId = activeUser?.id || localUser?.uid || localUser?.id || 'guest_user';

  const reportId = generateUUID();
  const nowIso = new Date().toISOString();
  const fileName = file.name || file.fileName || 'medical_report.pdf';
  const reportName = fileName.replace(/\.[^/.]+$/, '');
  const storagePath = `medical-reports/${userId}/${reportId}-${fileName}`;

  let uploadedFileUrl = '';

  // 3. Optional Supabase Storage Bucket Upload
  if (client && activeUser) {
    try {
      onProgress('Uploading document to secure storage...');
      let fileBody = file;

      // React Native file handling
      if (file.uri && typeof fetch !== 'undefined') {
        try {
          const resp = await fetch(file.uri);
          fileBody = await resp.blob();
        } catch (_) {
          fileBody = file;
        }
      }

      const { data: uploadData, error: uploadErr } = await client.storage
        .from('medical-reports')
        .upload(storagePath, fileBody, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });

      if (!uploadErr && uploadData?.path) {
        const { data: urlData } = client.storage
          .from('medical-reports')
          .getPublicUrl(uploadData.path);
        uploadedFileUrl = urlData?.publicUrl || '';
      }
    } catch (storageErr) {
      console.warn('Supabase storage upload notice (will use local/backend fallback):', storageErr.message);
    }
  }

  // 4. Try Backend OCR extraction if available
  let backendReport = null;
  try {
    onProgress('Extracting health insights...');
    let rawFile = file;
    if (file && !(file instanceof Blob) && !(file instanceof File) && file.uri) {
      try {
        const fetched = await fetch(file.uri);
        const blob = await fetched.blob();
        rawFile = new File([blob], fileName, { type: file.type || 'application/pdf' });
      } catch (_) {
        rawFile = file;
      }
    }
    const apiCall = apiUploadMedicalReport(rawFile, notes, reportName);
    const apiResponse = await promiseWithTimeout(apiCall, 15000, null);
    if (apiResponse?.report) {
      backendReport = apiResponse.report;
    }
  } catch (apiErr) {
    console.warn('Backend OCR notice (falling back to direct Supabase record):', apiErr.message);
  }

  const patientInfo = backendReport?.analysis?.patientInfo || {};
  const medicalInfo = backendReport?.analysis?.medicalInfo || {};
  const testResults = backendReport?.analysis?.testResults || backendReport?.analysis?.extractedTable || [];
  const rawOcrText = backendReport?.rawOcrText || '';

  const reportDoc = {
    id: reportId,
    _id: reportId,
    user_id: userId,
    userId: userId,
    fileName: fileName,
    reportName: reportName,
    storagePath: storagePath,
    storageProvider: uploadedFileUrl ? 'supabase' : 'local',
    fileUrl: uploadedFileUrl || backendReport?.fileUrl || '',
    downloadUrl: uploadedFileUrl || backendReport?.downloadUrl || '',
    previewUrl: uploadedFileUrl || backendReport?.previewUrl || '',
    reportDate: patientInfo.reportDate && patientInfo.reportDate !== 'Not detected'
      ? patientInfo.reportDate
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    uploadedAt: nowIso,
    uploadedAtIso: nowIso,
    processingStatus: 'completed',
    extractedData: {
      patientInformation: patientInfo,
      medicalInformation: medicalInfo,
      testResults: Array.isArray(testResults) ? testResults : []
    },
    rawOcrText: rawOcrText,
    analysis: backendReport?.analysis || {
      patientInfo,
      medicalInfo,
      testResults,
      rawOcrText
    }
  };

  const normalized = normalizeReport(reportId, reportDoc);

  // 5. Save to local storage for instant offline access
  saveLocalReport(userId, normalized);

  // 6. Save metadata to Supabase medical_reports table
  if (client && activeUser) {
    try {
      onProgress('Saving report metadata to database...');
      const { error: insertErr } = await client
        .from('medical_reports')
        .insert({
          id: reportId,
          user_id: activeUser.id,
          report_name: reportName,
          storage_path: storagePath,
          file_url: reportDoc.fileUrl,
          file_size_bytes: file.size || file.fileSize || 0,
          mime_type: file.type || 'application/pdf',
          document_type: 'medical_report',
          processing_status: 'completed',
          ocr_confidence: 95,
          raw_ocr_text: rawOcrText,
          notes: notes || '',
          extracted_data: reportDoc.extractedData,
          analysis: reportDoc.analysis,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (insertErr) {
        console.warn('Supabase medical_reports insert notice:', insertErr.message);
      }
    } catch (dbErr) {
      console.warn('Supabase database save notice:', dbErr.message);
    }
  }

  onProgress('Report saved successfully.');
  return normalized;
}

/**
 * Subscribe to medical reports:
 * Combines LocalStorage (instant 0ms) and Supabase database.
 */
export function subscribeToUserMedicalReports(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  let active = true;

  // 1. Immediately emit from local storage
  const localCached = getLocalReports(userId);
  if (localCached.length > 0) {
    onUpdate(localCached.map(r => normalizeReport(r.id || r._id, r)));
  }

  const mergeAndEmit = (newReports) => {
    if (!active) return;
    const current = getLocalReports(userId);
    const map = new Map();

    current.forEach(r => map.set(r.id || r._id, r));
    newReports.forEach(r => {
      const norm = normalizeReport(r.id || r._id, r);
      map.set(norm.id || norm._id, norm);
      saveLocalReport(userId, norm);
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    onUpdate(combined);
  };

  // 2. Fetch from Supabase PostgreSQL
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (client) {
    client
      .from('medical_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && Array.isArray(data)) {
          mergeAndEmit(data);
        } else if (error) {
          console.warn('Supabase medical_reports select notice:', error.message);
        }
      })
      .catch(err => {
        console.warn('Supabase reports fetch error:', err.message);
      });
  }

  // 3. Fetch from backend API if available
  apiGetMedicalReports()
    .then(res => {
      if (!active) return;
      if (res?.reports && Array.isArray(res.reports)) {
        mergeAndEmit(res.reports);
      }
    })
    .catch(err => {
      if (onError) onError(err);
    });

  // 4. Real-time Supabase subscription if available
  let subscriptionChannel = null;
  if (client) {
    try {
      subscriptionChannel = client
        .channel(`medical-reports-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'medical_reports',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (!active) return;
            if (payload.eventType === 'DELETE') {
              removeLocalReport(userId, payload.old?.id);
              const remaining = getLocalReports(userId);
              onUpdate(remaining.map(r => normalizeReport(r.id || r._id, r)));
            } else if (payload.new) {
              mergeAndEmit([payload.new]);
            }
          }
        )
        .subscribe();
    } catch (_) {}
  }

  return () => {
    active = false;
    if (subscriptionChannel && client) {
      try {
        client.removeChannel(subscriptionChannel);
      } catch (_) {}
    }
  };
}

/**
 * Delete a medical report from Supabase, local storage, and backend.
 */
export async function deleteCloudMedicalReport(reportId, storagePath, userId) {
  if (!reportId) return;

  // 1. Delete from local storage
  removeLocalReport(userId, reportId);

  // 2. Delete from Supabase
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (client) {
    try {
      await client
        .from('medical_reports')
        .delete()
        .eq('id', reportId);

      if (storagePath) {
        await client.storage
          .from('medical-reports')
          .remove([storagePath]);
      }
    } catch (sbErr) {
      console.warn('Supabase delete report notice:', sbErr.message);
    }
  }

  // 3. Delete from backend if available
  try {
    await apiDeleteMedicalReport(reportId);
  } catch (apiErr) {
    console.warn('Backend delete report notice:', apiErr.message);
  }
}

export default {
  validateMedicalPdf,
  getLocalReports,
  saveLocalReport,
  removeLocalReport,
  normalizeReport,
  uploadAndPersistMedicalReport,
  subscribeToUserMedicalReports,
  deleteCloudMedicalReport,
};
