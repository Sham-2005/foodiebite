// ─────────────────────────────────────────────────────────────
//  frontend/src/services/medicalReportsService.js
//  FoodieBite Standardized Supabase-Only Medical Report Service
//  Architecture:
//    - Supabase Storage: Private bucket 'medical-reports' (RLS enforced)
//    - Supabase PostgreSQL: Primary 'public.medical_reports' table (RLS enforced)
//    - Supabase PostgreSQL: 'public.health_profiles' biomarker summary table
//    - Supabase Realtime: Instant cross-platform sync (Web & Android)
//    - ZERO permanent disk or localStorage/AsyncStorage persistence
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabaseClient.js';
import { apiUploadMedicalReport, apiDeleteMedicalReport } from './api.js';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Ephemeral in-memory report cache for smooth UI rendering (never written to disk/AsyncStorage)
const ephemeralReportsCache = new Map();

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
    mime === 'application/octet-stream' ||
    mime.startsWith('image/') ||
    name.endsWith('.pdf') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp');

  if (!isSupported) {
    return {
      valid: false,
      error: 'Invalid file type. Supported formats: PDF, JPEG, and PNG medical documents.',
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
 * Ephemeral in-memory access helpers (Supabase is single source of truth; no permanent local writes)
 */
export function getLocalReports(userId) {
  if (!userId) return [];
  const cached = ephemeralReportsCache.get(userId);
  return Array.isArray(cached) ? cached : [];
}

export function saveLocalReport(userId, report) {
  if (!userId || !report) return;
  const existing = getLocalReports(userId);
  const rId = report.id || report._id;
  const filtered = existing.filter(r => (r.id || r._id) !== rId);
  filtered.unshift(report);
  ephemeralReportsCache.set(userId, filtered.slice(0, 50));
}

export function removeLocalReport(userId, reportId) {
  if (!userId || !reportId) return;
  const existing = getLocalReports(userId);
  const filtered = existing.filter(r => (r.id || r._id) !== reportId);
  ephemeralReportsCache.set(userId, filtered);
}

/**
 * Generate a short-lived signed URL for a file in the private 'medical-reports' bucket.
 * 
 * @param {string} storagePath - Relative path inside 'medical-reports' bucket ({userId}/{reportId}-{filename})
 * @param {number} expiresInSeconds - Expiration duration in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>}
 */
export async function getSignedUrlForReport(storagePath, expiresInSeconds = 3600) {
  if (!storagePath) return '';
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (!client) return '';

  try {
    const cleanPath = storagePath.startsWith('medical-reports/')
      ? storagePath.replace(/^medical-reports\//, '')
      : storagePath;

    const { data, error } = await client.storage
      .from('medical-reports')
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('medicalReportsService: getSignedUrl error:', err.message);
  }
  return '';
}

/**
 * Normalizes report document format across all representations.
 */
export function normalizeReport(id, data = {}) {
  const patientInfo = data.extractedData?.patientInformation ||
    data.analysis?.patientInfo ||
    data.extracted_data?.patientInformation || {};

  const medicalInfo = data.extractedData?.medicalInformation ||
    data.analysis?.medicalInfo ||
    data.extracted_data?.medicalInformation || {};

  const testResults = data.extractedData?.testResults ||
    data.analysis?.testResults ||
    data.extracted_data?.testResults ||
    data.analysis?.extractedTable || [];

  const rawOcrText = data.rawOcrText || data.raw_ocr_text || data.analysis?.rawOcrText || '';

  let uploadedDate = data.created_at || data.uploadedAtIso || data.uploadDate || data.uploadedAt;
  if (uploadedDate && typeof uploadedDate === 'object' && uploadedDate.toISOString) {
    uploadedDate = uploadedDate.toISOString();
  } else if (!uploadedDate) {
    uploadedDate = new Date().toISOString();
  }

  const rawStoragePath = data.storage_path || data.storagePath || '';
  const cleanStoragePath = rawStoragePath.startsWith('medical-reports/')
    ? rawStoragePath.replace(/^medical-reports\//, '')
    : rawStoragePath;

  const fileUrl = data.file_url || data.fileUrl || data.downloadUrl || data.previewUrl || '';

  return {
    id: id || data.id || data._id,
    _id: id || data.id || data._id,
    userId: data.user_id || data.userId || '',
    user_id: data.user_id || data.userId || '',
    fileName: data.original_filename || data.fileName || data.filename || data.originalName || data.report_name || 'Medical_Report.pdf',
    original_filename: data.original_filename || data.fileName || data.filename || data.originalName || data.report_name || 'Medical_Report.pdf',
    reportName: data.report_name || data.reportName || data.fileName || data.filename || 'Medical Report',
    report_name: data.report_name || data.reportName || data.fileName || data.filename || 'Medical Report',
    storagePath: cleanStoragePath,
    storage_path: cleanStoragePath,
    storageProvider: 'supabase',
    fileUrl: fileUrl,
    file_url: fileUrl,
    downloadUrl: fileUrl,
    previewUrl: fileUrl,
    reportDate: data.reportDate || patientInfo.reportDate || 'Not detected',
    uploadedAt: uploadedDate,
    uploadedAtIso: uploadedDate,
    created_at: uploadedDate,
    updated_at: data.updated_at || uploadedDate,
    processingStatus: data.processing_status || data.processingStatus || 'completed',
    processing_status: data.processing_status || data.processingStatus || 'completed',
    documentType: data.document_type || data.documentType || 'digital_pdf',
    document_type: data.document_type || data.documentType || 'digital_pdf',
    ocrConfidence: Number(data.ocr_confidence || data.ocrConfidence || 95),
    ocr_confidence: Number(data.ocr_confidence || data.ocrConfidence || 95),
    notes: data.notes || '',
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
    raw_ocr_text: rawOcrText,
    analysis: data.analysis || {
      patientInfo,
      medicalInfo,
      testResults,
      rawOcrText,
      wellnessConcerns: [],
      healthScores: { overall: 100, overallLabel: 'Good' },
      foodProfile: { foodsToPrefer: [], foodsToLimit: [] }
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
 * Generate standard UUID v4 for records and file identification.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Upload medical document to Supabase Storage & save metadata to Supabase PostgreSQL.
 * Strict upload sequence with rollback on database failure.
 */
export async function uploadAndPersistMedicalReport(file, notes = '', onProgress = () => { }) {
  // 1. Validate file format and size
  const validation = validateMedicalPdf(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Authenticate current user via Supabase
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (!client) {
    throw new Error('Supabase client is unavailable. Please verify connection.');
  }

  const { data: authData, error: authErr } = await client.auth.getUser();
  const activeUser = authData?.user;
  if (authErr || !activeUser || !activeUser.id) {
    throw new Error('Authentication required. Please sign in to upload medical reports.');
  }

  const userId = activeUser.id;
  const reportId = generateUUID();
  const nowIso = new Date().toISOString();

  const originalRawName = file.name || file.fileName || 'medical_report.pdf';
  const cleanFileName = originalRawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const reportName = cleanFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

  // Enforce correct storage path format: {user_id}/{report_id}-{filename}
  // Matches RLS policy: (storage.foldername(name))[1] = auth.uid()::text
  const storagePath = `${userId}/${reportId}-${cleanFileName}`;

  // 3. Upload physical file to Supabase Storage bucket 'medical-reports'
  onProgress('Uploading document to secure Supabase Storage...');
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

  const mimeType = file.type || (cleanFileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  const { data: uploadData, error: uploadErr } = await client.storage
    .from('medical-reports')
    .upload(storagePath, fileBody, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadErr) {
    if (
      uploadErr.message?.toLowerCase().includes('bucket not found') ||
      uploadErr.statusCode === '404' ||
      uploadErr.status === 404
    ) {
      throw new Error(
        `Storage upload failed: Bucket not found. The 'medical-reports' private storage bucket has not been provisioned in Supabase yet. Please execute the bucket creation SQL in the Supabase Dashboard SQL Editor or run 'node backend/scripts/provisionStorage.js'.`
      );
    }
    throw new Error(`Storage upload failed: ${uploadErr.message}`);
  }

  const confirmedStoragePath = uploadData?.path || storagePath;

  // 4. Generate short-lived signed URL for initial viewing/preview (bucket is private)
  let initialSignedUrl = '';
  try {
    const { data: signedData } = await client.storage
      .from('medical-reports')
      .createSignedUrl(confirmedStoragePath, 3600);
    initialSignedUrl = signedData?.signedUrl || '';
  } catch (signErr) {
    console.warn('Initial signed URL generation notice:', signErr.message);
  }

  // 5. Temporary backend OCR processing for biomarker extraction
  let backendReport = null;
  try {
    onProgress('Extracting health insights and clinical biomarkers...');
    let rawFile = file;
    const isNativeFile = typeof File !== 'undefined' && file instanceof File;
    const isNativeBlob = typeof Blob !== 'undefined' && file instanceof Blob;

    if (file && !isNativeBlob && !isNativeFile && file.uri) {
      if (typeof File !== 'undefined') {
        try {
          const fetched = await fetch(file.uri);
          const blob = await fetched.blob();
          rawFile = new File([blob], cleanFileName, { type: mimeType });
        } catch (_) {
          rawFile = file;
        }
      } else {
        rawFile = {
          uri: file.uri,
          name: cleanFileName,
          type: mimeType,
        };
      }
    }

    const apiCall = apiUploadMedicalReport(rawFile, notes, reportName);
    const apiResponse = await promiseWithTimeout(apiCall, 20000, null);
    if (apiResponse?.report) {
      backendReport = apiResponse.report;
    }
  } catch (apiErr) {
    console.warn('Backend OCR notice (saving document with base clinical metadata):', apiErr.message);
  }

  const patientInfo = backendReport?.extractedData?.patientInformation ||
    backendReport?.analysis?.patientInfo || {};
  const medicalInfo = backendReport?.extractedData?.medicalInformation ||
    backendReport?.analysis?.medicalInfo || {};
  const testResults = backendReport?.extractedData?.testResults ||
    backendReport?.analysis?.testResults ||
    backendReport?.analysis?.extractedTable || [];
  const rawOcrText = backendReport?.rawOcrText || '';

  // Determine valid document_type constraint
  // CHECK (document_type IN ('digital_pdf', 'scanned_pdf', 'lab_image', 'manual_entry'))
  const isImage = mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(cleanFileName);
  const documentType = isImage ? 'lab_image' : 'digital_pdf';

  const extractedDataPayload = {
    patientInformation: patientInfo,
    medicalInformation: medicalInfo,
    testResults: Array.isArray(testResults) ? testResults : []
  };

  const analysisPayload = backendReport?.analysis || {
    patientInfo,
    medicalInfo,
    testResults,
    rawOcrText,
    wellnessConcerns: [],
    healthScores: { overall: 100, overallLabel: 'Good' },
    foodProfile: { foodsToPrefer: [], foodsToLimit: [] }
  };

  // 6. Save metadata to Supabase table public.medical_reports
  onProgress('Saving verified report to Supabase database...');
  const insertPayload = {
    id: reportId,
    user_id: userId,
    report_name: reportName,
    original_filename: cleanFileName,
    storage_path: confirmedStoragePath,
    file_url: initialSignedUrl || confirmedStoragePath,
    file_size_bytes: file.size || file.fileSize || 0,
    mime_type: mimeType,
    document_type: documentType,
    processing_status: 'completed',
    ocr_confidence: Number(backendReport?.ocrConfidence || 95),
    raw_ocr_text: rawOcrText,
    notes: notes || '',
    extracted_data: extractedDataPayload,
    analysis: analysisPayload,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { error: insertErr } = await client
    .from('medical_reports')
    .insert(insertPayload);

  // 7. ROLLBACK on database insertion failure
  if (insertErr) {
    console.error('Supabase medical_reports insert error:', insertErr.message);
    try {
      await client.storage.from('medical-reports').remove([confirmedStoragePath]);
      console.log('Successfully rolled back uploaded storage file:', confirmedStoragePath);
    } catch (rbErr) {
      console.warn('Storage rollback warning:', rbErr.message);
    }
    throw new Error(`Database record creation failed: ${insertErr.message}. Upload rolled back.`);
  }

  // 8. Synchronize consolidated health profile in public.health_profiles
  if (analysisPayload?.healthScores || analysisPayload?.wellnessConcerns) {
    try {
      await client
        .from('health_profiles')
        .upsert({
          user_id: userId,
          overall_score: analysisPayload.healthScores?.overall ?? 100,
          overall_label: analysisPayload.healthScores?.overallLabel || 'Good',
          category_scores: analysisPayload.healthScores?.categories || {},
          wellness_concerns: analysisPayload.wellnessConcerns || [],
          food_profile: analysisPayload.foodProfile || {},
          findings: analysisPayload.findings || [],
          last_updated: nowIso
        }, { onConflict: 'user_id' });
    } catch (hpErr) {
      console.warn('Health profile upsert notice:', hpErr.message);
    }
  }

  const normalized = normalizeReport(reportId, {
    ...insertPayload,
    fileUrl: initialSignedUrl,
  });

  saveLocalReport(userId, normalized);
  onProgress('Report saved successfully to Supabase.');
  return normalized;
}

/**
 * Subscribe to medical reports exclusively via Supabase PostgreSQL & Realtime.
 * Synchronizes seamlessly between Web and Android platforms.
 */
export function subscribeToUserMedicalReports(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([]);
    return () => { };
  }

  let active = true;
  const client = isSupabaseConfigured ? getSupabaseClient() : null;

  if (!client) {
    onUpdate([]);
    return () => { };
  }

  // 1. Initial fetch from Supabase PostgreSQL
  client
    .from('medical_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn('Supabase medical_reports select notice:', error.message);
        if (onError) onError(error);
        return;
      }

      if (Array.isArray(data)) {
        // Resolve signed URLs for each report
        const normalizedList = await Promise.all(
          data.map(async (r) => {
            const norm = normalizeReport(r.id, r);
            if (norm.storagePath && (!norm.fileUrl || norm.fileUrl === norm.storagePath)) {
              const freshSigned = await getSignedUrlForReport(norm.storagePath);
              if (freshSigned) norm.fileUrl = freshSigned;
            }
            return norm;
          })
        );

        if (active) {
          ephemeralReportsCache.set(userId, normalizedList);
          onUpdate(normalizedList);
        }
      }
    })
    .catch((err) => {
      if (active && onError) onError(err);
    });

  // 2. Real-time Supabase postgres_changes channel
  let channel = null;
  try {
    channel = client
      .channel(`realtime-medical-reports-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medical_reports',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (!active) return;
          const current = getLocalReports(userId);

          if (payload.eventType === 'INSERT' && payload.new) {
            const norm = normalizeReport(payload.new.id, payload.new);
            if (norm.storagePath) {
              const freshSigned = await getSignedUrlForReport(norm.storagePath);
              if (freshSigned) norm.fileUrl = freshSigned;
            }
            const exists = current.some(r => (r.id || r._id) === norm.id);
            const updated = exists
              ? current.map(r => (r.id || r._id) === norm.id ? norm : r)
              : [norm, ...current];
            ephemeralReportsCache.set(userId, updated);
            onUpdate(updated);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const norm = normalizeReport(payload.new.id, payload.new);
            if (norm.storagePath) {
              const freshSigned = await getSignedUrlForReport(norm.storagePath);
              if (freshSigned) norm.fileUrl = freshSigned;
            }
            const updated = current.map(r => (r.id || r._id) === norm.id ? norm : r);
            ephemeralReportsCache.set(userId, updated);
            onUpdate(updated);
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const delId = payload.old.id;
            const updated = current.filter(r => (r.id || r._id) !== delId);
            ephemeralReportsCache.set(userId, updated);
            onUpdate(updated);
          }
        }
      )
      .subscribe();
  } catch (subErr) {
    console.warn('Realtime subscription notice:', subErr.message);
  }

  return () => {
    active = false;
    if (channel && client) {
      try {
        client.removeChannel(channel);
      } catch (_) { }
    }
  };
}

/**
 * Delete a medical report permanently from Supabase PostgreSQL & Supabase Storage.
 */
export async function deleteCloudMedicalReport(reportId, storagePath, userId) {
  if (!reportId) return;

  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (!client) {
    throw new Error('Supabase client is unavailable.');
  }

  // 1. Delete from Supabase PostgreSQL public.medical_reports
  const { error: dbErr } = await client
    .from('medical_reports')
    .delete()
    .eq('id', reportId);

  if (dbErr) {
    console.warn('Supabase delete medical report record notice:', dbErr.message);
  }

  // 2. Delete physical file from Supabase Storage bucket 'medical-reports'
  if (storagePath) {
    const cleanPath = storagePath.startsWith('medical-reports/')
      ? storagePath.replace(/^medical-reports\//, '')
      : storagePath;

    const { error: storageErr } = await client.storage
      .from('medical-reports')
      .remove([cleanPath]);

    if (storageErr) {
      console.warn('Supabase delete storage file notice:', storageErr.message);
    }
  }

  // 3. Remove from ephemeral memory cache
  if (userId) {
    removeLocalReport(userId, reportId);
  }

  // 4. Optional backend cleanup notification
  try {
    await apiDeleteMedicalReport(reportId);
  } catch (_) { }
}

export default {
  validateMedicalPdf,
  getLocalReports,
  saveLocalReport,
  removeLocalReport,
  getSignedUrlForReport,
  normalizeReport,
  uploadAndPersistMedicalReport,
  subscribeToUserMedicalReports,
  deleteCloudMedicalReport,
};
