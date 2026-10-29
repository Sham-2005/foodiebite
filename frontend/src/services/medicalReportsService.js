// ─────────────────────────────────────────────────────────────
//  frontend/src/services/medicalReportsService.js
//  FoodieBite Medical Report Cloud & Storage Integration Service
//  Architecture:
//    - Cloudinary / Cloud Storage: permanent CDN hosting for PDFs
//    - Persistent Backend Database: durable JSON storage across restarts
//    - Cloud Firestore: real-time synchronization across devices
//    - Local Storage: instant offline client rehydration
// ─────────────────────────────────────────────────────────────

import {
  auth,
  db,
  storage,
  isFirebaseConfigured,
  collection,
  doc,
  query,
  where,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from './firebase';

import {
  apiUploadMedicalReport,
  apiDeleteMedicalReport,
  apiGetMedicalReports,
  getLocalActiveUser
} from './api';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validate that the selected file is a valid PDF within size limits.
 */
export function validateMedicalPdf(file) {
  if (!file) {
    return { valid: false, error: 'Please select a file to upload.' };
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name?.toLowerCase().endsWith('.pdf') ||
    file.fileName?.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    return {
      valid: false,
      error: 'Invalid file type. Only PDF documents are supported for medical reports.'
    };
  }

  const fileSize = file.size || file.fileSize || 0;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds the 20 MB limit. Please upload a smaller PDF.'
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
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalReport(userId, report) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getStorageKey(userId);
    const existing = getLocalReports(userId);
    const rId = report.id || report._id;
    const filtered = existing.filter(r => (r.id || r._id) !== rId);
    filtered.unshift(report);
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 50)));
  } catch (_) {}
}

export function removeLocalReport(userId, reportId) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getStorageKey(userId);
    const existing = getLocalReports(userId);
    const filtered = existing.filter(r => (r.id || r._id) !== reportId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (_) {}
}

/**
 * Helper to normalize Firestore or API report document format.
 */
export function normalizeReport(id, data = {}) {
  const patientInfo = data.extractedData?.patientInformation || data.analysis?.patientInfo || {};
  const medicalInfo = data.extractedData?.medicalInformation || data.analysis?.medicalInfo || {};
  const testResults = data.extractedData?.testResults || data.analysis?.testResults || data.analysis?.extractedTable || [];
  const rawOcrText = data.rawOcrText || data.analysis?.rawOcrText || '';

  // Determine uploaded date string
  let uploadedDate = data.uploadedAtIso || data.uploadDate || data.uploadedAt;
  if (data.uploadedAt?.toDate && typeof data.uploadedAt.toDate === 'function') {
    uploadedDate = data.uploadedAt.toDate().toISOString();
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

  const finalUrl = resolveUrl(data.fileUrl || data.downloadUrl || data.previewUrl || '');

  return {
    id: id || data.id || data._id,
    _id: id || data.id || data._id,
    userId: data.userId || '',
    fileName: data.fileName || data.filename || data.originalName || 'Medical_Report.pdf',
    reportName: data.reportName || data.fileName || data.filename || 'Medical Report',
    storagePath: data.storagePath || '',
    storageProvider: data.storageProvider || (finalUrl.includes('cloudinary') ? 'cloudinary' : 'local'),
    cloudinaryPublicId: data.cloudinaryPublicId || null,
    fileUrl: finalUrl,
    downloadUrl: finalUrl,
    previewUrl: finalUrl,
    reportDate: data.reportDate || patientInfo.reportDate || 'Not detected',
    uploadedAt: uploadedDate,
    uploadedAtIso: uploadedDate,
    processingStatus: data.processingStatus || (data.analysis?.analysisFailed ? 'ocr_failed' : 'completed'),
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
 * Upload original PDF to Cloud Storage (Cloudinary + backend persistent database + Firestore),
 * execute OCR extraction, and save across all persistence tiers.
 */
export async function uploadAndPersistMedicalReport(file, notes = '', onProgress = () => {}) {
  // 1. Validation
  const validation = validateMedicalPdf(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Identify Authenticated User
  const fbUser = auth ? auth.currentUser : null;
  const localUser = getLocalActiveUser();
  const userId = fbUser?.uid || localUser?.uid || localUser?.id || 'guest_user';

  // Normalize file object to ensure raw File/Blob is ready
  let rawFile = file;
  if (file && !(file instanceof Blob) && !(file instanceof File)) {
    if (file.file && (file.file instanceof Blob || file.file instanceof File)) {
      rawFile = file.file;
    } else if (file.uri) {
      try {
        const fetched = await fetch(file.uri);
        const blob = await fetched.blob();
        rawFile = new File([blob], file.name || file.fileName || 'medical_report.pdf', {
          type: file.type || 'application/pdf'
        });
      } catch (_) {
        rawFile = file;
      }
    }
  }

  // 3. OCR, Cloud Storage (Cloudinary) & Backend DB Persistence
  onProgress('Scanning report with OCR & uploading to Cloud Storage...');
  let apiResponse = null;

  try {
    const apiCall = apiUploadMedicalReport(rawFile, notes, file.name || 'Medical Report');
    apiResponse = await promiseWithTimeout(apiCall, 25000, null);
    if (!apiResponse) {
      throw new Error('Upload and extraction timed out. Please try again.');
    }
  } catch (apiErr) {
    console.warn('API upload error:', apiErr.message);
    throw apiErr;
  }

  const backendReport = apiResponse.report || {};
  const reportId = backendReport.id || backendReport._id || `report_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Normalize structured data
  const patientInfo = backendReport.analysis?.patientInfo || {};
  const medicalInfo = backendReport.analysis?.medicalInfo || {};
  const testResults = backendReport.analysis?.testResults || backendReport.analysis?.extractedTable || [];
  const rawOcrText  = backendReport.rawOcrText || backendReport.analysis?.rawOcrText || '';

  const reportDoc = {
    id: reportId,
    _id: reportId,
    userId: userId,
    fileName: file.name || 'medical_report.pdf',
    reportName: file.name ? file.name.replace(/\.pdf$/i, '') : 'Medical Report',
    storagePath: backendReport.storagePath || `medical-reports/${userId}/${reportId}.pdf`,
    storageProvider: backendReport.storageProvider || 'cloudinary',
    fileUrl: backendReport.fileUrl || backendReport.downloadUrl,
    downloadUrl: backendReport.downloadUrl || backendReport.fileUrl,
    previewUrl: backendReport.previewUrl || backendReport.fileUrl,
    cloudinaryPublicId: backendReport.cloudinaryPublicId || null,
    reportDate: patientInfo.reportDate && patientInfo.reportDate !== 'Not detected'
      ? patientInfo.reportDate
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    uploadedAt: backendReport.uploadedAt || nowIso,
    uploadedAtIso: nowIso,
    processingStatus: backendReport.processingStatus || 'completed',
    extractedData: {
      patientInformation: patientInfo,
      medicalInformation: medicalInfo,
      testResults: Array.isArray(testResults) ? testResults : []
    },
    rawOcrText: rawOcrText,
    analysis: backendReport.analysis || {}
  };

  const normalized = normalizeReport(reportId, reportDoc);

  // 4. Client-side LocalStorage Persistence
  saveLocalReport(userId, normalized);

  // 5. Cloud Firestore Synchronization (if client is authenticated with Firebase)
  if (isFirebaseConfigured && db && fbUser) {
    onProgress('Syncing with Cloud Firestore...');
    try {
      await promiseWithTimeout(
        setDoc(doc(db, 'medicalReports', reportId), {
          ...reportDoc,
          uploadedAt: serverTimestamp ? serverTimestamp() : nowIso
        }),
        2000,
        null
      );
    } catch (dbErr) {
      console.warn('Firestore optional sync notice:', dbErr.message);
    }
  }

  onProgress('Report saved successfully to Cloud Storage.');
  return normalized;
}

/**
 * Subscribe to medical reports:
 * Combines LocalStorage (instant), Backend Persistent DB (Cloudinary), and Cloud Firestore.
 */
export function subscribeToUserMedicalReports(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  let active = true;

  // 1. Immediately emit from local storage for 0ms UI render
  const localCached = getLocalReports(userId);
  if (localCached.length > 0) {
    onUpdate(localCached.map(r => normalizeReport(r.id || r._id, r)));
  }

  const mergeAndEmit = (newReports) => {
    if (!active) return;
    const current = getLocalReports(userId);
    const map = new Map();

    // Add existing
    current.forEach(r => map.set(r.id || r._id, r));
    // Merge new
    newReports.forEach(r => {
      const norm = normalizeReport(r.id || r._id, r);
      map.set(norm.id || norm._id, norm);
      saveLocalReport(userId, norm);
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    onUpdate(combined);
  };

  // 2. Fetch from Backend Persistent DB (contains Cloudinary links + OCR data)
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

  // 3. Real-time Cloud Firestore synchronization (if active)
  let unsubscribeFirestore = null;
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'medicalReports'),
        where('userId', '==', userId)
      );

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (!active) return;
          if (!snapshot.empty) {
            const fsReports = [];
            snapshot.forEach((docSnap) => {
              fsReports.push(normalizeReport(docSnap.id, docSnap.data()));
            });
            mergeAndEmit(fsReports);
          }
        },
        (err) => {
          console.warn('Firestore real-time sync notice:', err.message);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription notice:', e.message);
    }
  }

  return () => {
    active = false;
    if (typeof unsubscribeFirestore === 'function') {
      unsubscribeFirestore();
    }
  };
}

/**
 * Delete a medical report from all storage and database tiers.
 */
export async function deleteCloudMedicalReport(reportId, storagePath, userId) {
  if (!reportId) return;

  // 1. Delete from LocalStorage
  removeLocalReport(userId, reportId);

  // 2. Delete from Backend (purges Cloudinary CDN, persistent disk DB, and local file)
  try {
    await apiDeleteMedicalReport(reportId);
  } catch (apiErr) {
    console.warn('Backend delete report notice:', apiErr.message);
  }

  // 3. Delete from Cloud Firestore
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'medicalReports', reportId));
    } catch (_) {}
  }

  // 4. Delete from Firebase Storage
  if (isFirebaseConfigured && storage && storagePath) {
    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch (_) {}
  }
}
