// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/medicalController.js
//  Medical Report Intelligence — Unified Controller
//
//  Responsibilities:
//    POST /api/medical/upload       — Upload, OCR, Cloudinary Cloud Storage, Analyze, Persist
//    GET  /api/medical/reports      — List user's reports (from Persistent DB + Firestore)
//    GET  /api/medical/report/:id   — Get single report + analysis
//    DELETE /api/medical/report/:id — Delete report (Cloudinary, DB, Firestore)
//    GET  /api/medical/health-profile — Get structured health profile
//    POST /api/medical/manual-values — Save manual biomarker values
//    GET  /api/medical/history      — Analysis history
// ─────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const { processDocument }       = require('../services/documentProcessorService');
const { analyzeReport }         = require('../services/medicalAnalysisService');
const { getFirebaseAdmin, getFirestoreDb } = require('../config/firebase');
const { uploadReportFile, deleteReportFile } = require('../services/cloudStorageService');
const persistentReportDb        = require('../services/persistentReportDb');

function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms))
  ]);
}

// ── Firebase Admin & Storage helpers ─────────────────────────
function getAdmin() {
  return getFirebaseAdmin();
}

async function getFirestore() {
  return getFirestoreDb();
}

function getStorageBucket() {
  try {
    const admin = getFirebaseAdmin();
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'food-app-3d216.firebasestorage.app';
    if (!admin || !admin.apps || admin.apps.length === 0) return null;
    return admin.storage().bucket(storageBucket);
  } catch (err) {
    return null;
  }
}

async function getSignedDownloadUrl(storagePath) {
  if (!storagePath) return null;
  try {
    const bucket = getStorageBucket();
    if (!bucket) return null;
    const file = bucket.file(storagePath);
    const [exists] = await withTimeout(file.exists(), 1500);
    if (!exists) return null;
    const [url] = await withTimeout(file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    }), 1500);
    return url;
  } catch (err) {
    return null;
  }
}

// ── Gemini wellness explanation (optional, never required) ────
async function generateWellnessExplanation(wellnessConcerns, foodProfile) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY || GEMINI_KEY === 'AIzaSyFakeKeyFallback') return null;

  try {
    const prompt = `You are a registered dietitian writing a friendly wellness nutrition guide.
    
Based on the following wellness observations from a laboratory report, write a 2-3 sentence wellness-focused food guidance paragraph for the user. Do NOT mention any disease names or diagnoses. Focus only on food choices, nutrients, and healthy eating habits.

Wellness concerns: ${wellnessConcerns.map(c => c.concern).join(', ') || 'No specific concerns identified'}
Foods to prefer: ${foodProfile.foodsToPrefer.slice(0, 6).join(', ') || 'balanced diet'}
Foods to limit: ${foodProfile.foodsToLimit.slice(0, 4).join(', ') || 'none specified'}

Write the paragraph in second-person (you/your). Be encouraging and factual. Keep it under 80 words.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    let resp;
    try {
      const fetch = require('node-fetch');
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (e) {
    console.warn('medicalController: Gemini wellness explanation failed (non-fatal):', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  POST /api/medical/upload
// ═══════════════════════════════════════════════════════════════

exports.uploadMedicalReport = async (req, res, next) => {
  const uploadedTempPath = req.file?.path;

  try {
    // ── 1. File validation ────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const ALLOWED_MIMES = ['application/pdf', 'application/octet-stream'];
    const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    const mimeOk = ALLOWED_MIMES.includes(req.file.mimetype);
    const extOk  = fileExt === '.pdf';

    if (!mimeOk || !extOk) {
      if (fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF files are accepted for medical reports.'
      });
    }

    if (req.file.size > MAX_SIZE_BYTES) {
      if (fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum allowed size is 20 MB.'
      });
    }

    const { notes = '', reportName = '' } = req.body;
    const userId = req.user?.uid || req.user?.id || 'guest_user';
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // ── 2. OCR / text extraction ──────────────────────────────
    let extractionResult;
    try {
      extractionResult = await processDocument(uploadedTempPath, req.file.mimetype);
    } catch (ocrErr) {
      console.warn('medicalController: OCR process error (safe catch):', ocrErr.message);
      extractionResult = { success: false, text: '', rejectionReason: 'ocr_error', userMessage: 'Text extraction failed. Report will be saved without analysis.' };
    }

    // ── 3. Reject handwritten / low-quality / non-medical ─────
    if (!extractionResult.success && extractionResult.rejectionReason !== 'ocr_error') {
      if (fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(422).json({
        success: false,
        rejectionReason: extractionResult.rejectionReason,
        message: extractionResult.userMessage
      });
    }

    // ── 4. Run deterministic biomarker analysis ────────────────
    const combinedText = `${extractionResult.text || ''} ${notes}`;
    let analysis;
    try {
      analysis = analyzeReport(combinedText, notes, {
        documentType: extractionResult.documentType || 'digital_pdf',
        ocrConfidence: extractionResult.confidence || 100
      });
    } catch (analysisErr) {
      console.error('medicalController: analysis failed (safe catch):', analysisErr.message);
      analysis = {
        biomarkers: {}, findings: [], unverifiedFindings: [], wellnessConcerns: [],
        healthScores: { categories: {}, overall: 100, overallLabel: 'Good' },
        foodProfile: { foodsToLimit: [], foodsToPrefer: [], recommendedNutrients: [], unverifiedFoodRestrictions: [] },
        summary: 'Report saved. Analysis encountered an issue.',
        analysisConfidence: 0, analysisFailed: true
      };
    }

    // ── 5. Gemini wellness explanation (optional) ──────────────
    const wellnessText = await generateWellnessExplanation(
      analysis.wellnessConcerns,
      analysis.foodProfile
    );

    // ── 6. Upload original file to Cloudinary / Cloud Storage ──
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    let storageInfo = {
      provider: 'local',
      fileUrl: `${baseUrl}/uploads/medical_reports/${reportId}.pdf`,
      downloadUrl: `${baseUrl}/uploads/medical_reports/${reportId}.pdf`,
      storagePath: `medical-reports/${userId}/${reportId}.pdf`,
      publicId: null
    };

    try {
      const uploadRes = await uploadReportFile(
        uploadedTempPath,
        userId,
        reportId,
        req.file.originalname,
        baseUrl
      );
      if (uploadRes) {
        storageInfo = uploadRes;
      }
    } catch (sErr) {
      console.warn('medicalController: Cloud storage upload notice:', sErr.message);
    } finally {
      if (fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
    }

    // ── 7. Build complete medical report document ──────────────
    const now = new Date().toISOString();
    const rawOcrText = extractionResult.text || '';
    const report = {
      id:                 reportId,
      _id:                reportId,
      userId:             userId,
      reportName:         reportName || req.file.originalname.replace(/\.pdf$/i, ''),
      filename:           req.file.originalname,
      originalName:       req.file.originalname,
      storagePath:        storageInfo.storagePath || `medical-reports/${userId}/${reportId}.pdf`,
      storageProvider:    storageInfo.provider || 'cloudinary',
      fileUrl:            storageInfo.fileUrl,
      downloadUrl:        storageInfo.downloadUrl || storageInfo.fileUrl,
      previewUrl:         storageInfo.fileUrl,
      cloudinaryPublicId: storageInfo.publicId || null,
      cloudinaryUrl:      storageInfo.cloudinaryUrl || null,
      mimeType:           req.file.mimetype || 'application/pdf',
      fileSize:           req.file.size,
      uploadDate:         now,
      uploadedAt:         now,
      uploadedAtIso:      now,
      notes:              notes,
      ocrConfidence:      extractionResult.confidence || 0,
      documentType:       extractionResult.documentType || 'digital_pdf',
      processingStatus:   extractionResult.success ? 'completed' : 'ocr_failed',
      rawOcrText:         rawOcrText,
      extractedData: {
        patientInformation: analysis.patientInfo || {},
        medicalInformation: analysis.medicalInfo || {},
        testResults:        analysis.testResults || analysis.extractedTable || []
      },
      analysis: {
        summary:             analysis.summary,
        wellnessExplanation: wellnessText || null,
        findings:            analysis.findings,
        unverifiedFindings:  analysis.unverifiedFindings || [],
        wellnessConcerns:    analysis.wellnessConcerns,
        healthScores:        analysis.healthScores,
        foodProfile:         analysis.foodProfile,
        biomarkers:          analysis.biomarkers,
        analysisConfidence:  analysis.analysisConfidence,
        analysisFailed:      analysis.analysisFailed,
        patientInfo:         analysis.patientInfo || {},
        medicalInfo:         analysis.medicalInfo || {},
        testResults:         analysis.testResults || analysis.extractedTable || [],
        extractedTable:      analysis.extractedTable || [],
        rawOcrText:          rawOcrText,
        // Legacy compatibility
        risks:               analysis.wellnessConcerns.map(c => c.tag),
        recommendedFoods:    analysis.foodProfile.foodsToPrefer,
        avoidFoods:          analysis.foodProfile.foodsToLimit
      }
    };

    // ── 8. Durable file-backed DB persistence ──────────────────
    persistentReportDb.saveReport(userId, report);
    persistentReportDb.saveHealthProfile(userId, {
      ...analysis.healthScores,
      wellnessConcerns: analysis.wellnessConcerns,
      foodProfile: analysis.foodProfile,
      findings: analysis.findings
    });

    // ── 9. Cloud Firestore persistence (if available) ──────────
    let firestoreSaved = false;
    try {
      const db = await getFirestore();
      if (db) {
        const userRef = db.collection('users').doc(userId);
        const admin = getAdmin();
        const FieldValue = admin ? admin.firestore.FieldValue : require('firebase-admin').firestore.FieldValue;

        await withTimeout(userRef.set(
          { medicalReports: FieldValue.arrayUnion(report) },
          { merge: true }
        ), 1500).catch(() => {});

        await withTimeout(
          db.collection('medicalReports').doc(reportId).set(report),
          1500
        ).catch(() => {});

        await updateHealthProfile(db, userId, analysis).catch(() => {});
        firestoreSaved = true;
      }
    } catch (dbErr) {
      console.warn('medicalController: Firestore optional sync notice:', dbErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Medical report uploaded, scanned and saved successfully',
      dbSaved: true,
      firestoreSaved,
      cloudStored: storageInfo.provider === 'cloudinary' || storageInfo.provider === 'firebase',
      report
    });

  } catch (err) {
    if (uploadedTempPath && fs.existsSync(uploadedTempPath)) {
      fs.unlinkSync(uploadedTempPath);
    }
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  Health Profile Update
// ═══════════════════════════════════════════════════════════════

async function updateHealthProfile(db, userId, analysis) {
  try {
    const admin = require('firebase-admin');
    const { findings, wellnessConcerns, healthScores, foodProfile } = analysis;

    const biomarkerMap = {};
    for (const f of findings) {
      biomarkerMap[f.key] = {
        value: f.value,
        unit: f.unit,
        status: f.status,
        label: f.biomarker,
        category: f.category,
        updatedAt: new Date().toISOString()
      };
    }

    const profileUpdate = {
      'healthProfile.lastUpdated':       new Date().toISOString(),
      'healthProfile.overallScore':      healthScores.overall,
      'healthProfile.overallLabel':      healthScores.overallLabel,
      'healthProfile.categoryScores':    healthScores.categories,
      'healthProfile.wellnessConcerns':  wellnessConcerns,
      'healthProfile.foodProfile':       foodProfile,
      'healthProfile.reportCount':       admin.firestore.FieldValue.increment(1),
      ...Object.fromEntries(
        Object.entries(biomarkerMap).map(([k, v]) => [`healthProfile.biomarkers.${k}`, v])
      )
    };

    await db.collection('users').doc(userId).set(profileUpdate, { merge: true });
  } catch (err) {
    console.warn('medicalController: health profile update notice:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/reports
// ═══════════════════════════════════════════════════════════════

exports.getMedicalReports = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'guest_user';
    
    // 1. Get from durable persistent DB
    const savedReports = persistentReportDb.getReports(userId);
    const reportsMap = new Map();

    for (const r of savedReports) {
      const rId = r.id || r._id;
      reportsMap.set(rId, r);
    }

    // 2. Also query Cloud Firestore if connected
    try {
      const db = await getFirestore();
      if (db) {
        const collSnap = await withTimeout(
          db.collection('medicalReports').where('userId', '==', userId).get(),
          1500
        ).catch(() => null);

        if (collSnap && !collSnap.empty) {
          for (const doc of collSnap.docs) {
            const r = doc.data();
            const rId = doc.id;
            if (!reportsMap.has(rId)) {
              reportsMap.set(rId, {
                id: rId,
                _id: rId,
                ...r
              });
            }
          }
        }
      }
    } catch (fbErr) {
      // safe fallback
    }

    const reports = Array.from(reportsMap.values());
    reports.sort((a, b) => new Date(b.uploadedAt || b.uploadDate || 0) - new Date(a.uploadedAt || a.uploadDate || 0));

    return res.status(200).json({ success: true, count: reports.length, reports });
  } catch (err) {
    return res.status(200).json({ success: true, count: 0, reports: [] });
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/report/:reportId
// ═══════════════════════════════════════════════════════════════

exports.getMedicalReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?.uid || req.user?.id || 'guest_user';

    // 1. Check persistent disk DB first
    const persistentMatch = persistentReportDb.getReportById(reportId);
    if (persistentMatch) {
      return res.status(200).json({ success: true, report: persistentMatch });
    }

    // 2. Fallback to Firestore
    try {
      const db = await getFirestore();
      if (db) {
        const docSnap = await withTimeout(
          db.collection('medicalReports').doc(reportId).get(),
          1500
        ).catch(() => null);
        if (docSnap && docSnap.exists) {
          const report = { id: docSnap.id, _id: docSnap.id, ...docSnap.data() };
          return res.status(200).json({ success: true, report });
        }
      }
    } catch (fbErr) {
      // safe catch
    }

    return res.status(404).json({ success: false, message: 'Report not found.' });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  DELETE /api/medical/report/:reportId
// ═══════════════════════════════════════════════════════════════

exports.deleteMedicalReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?.uid || req.user?.id || 'guest_user';

    // 1. Fetch report details to know cloud asset path
    const report = persistentReportDb.getReportById(reportId);

    // 2. Delete cloud asset & local file
    if (report) {
      await deleteReportFile(report);
    }

    // 3. Delete from persistent database
    persistentReportDb.deleteReport(userId, reportId);

    // 4. Delete from Firestore if available
    try {
      const db = await getFirestore();
      if (db) {
        await withTimeout(db.collection('medicalReports').doc(reportId).delete(), 1500).catch(() => {});
        const userRef = db.collection('users').doc(userId);
        const docSnap = await withTimeout(userRef.get(), 1500).catch(() => null);
        if (docSnap && docSnap.exists) {
          const reports = docSnap.data().medicalReports || [];
          const updatedReports = reports.filter(r => (r.id || r._id) !== reportId);
          await withTimeout(userRef.update({ medicalReports: updatedReports }), 1500).catch(() => {});
        }
      }
    } catch (fbErr) {
      // safe catch
    }

    return res.status(200).json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/health-profile
// ═══════════════════════════════════════════════════════════════

exports.getHealthProfile = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'guest_user';

    // Check persistent DB first
    const persistentProfile = persistentReportDb.getHealthProfile(userId);
    if (persistentProfile) {
      return res.status(200).json({ success: true, healthProfile: persistentProfile });
    }

    try {
      const db = await getFirestore();
      if (db) {
        const docSnap = await db.collection('users').doc(userId).get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data.healthProfile) {
            return res.status(200).json({ success: true, healthProfile: data.healthProfile });
          }
        }
      }
    } catch (fbErr) {
      // safe catch
    }

    return res.status(200).json({
      success: true,
      healthProfile: {
        overallScore: 100,
        overallLabel: 'Good',
        categoryScores: {},
        wellnessConcerns: [],
        biomarkers: {},
        foodProfile: { foodsToPrefer: [], foodsToLimit: [], recommendedNutrients: [] },
        reportCount: 0
      }
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  POST /api/medical/manual-values
// ═══════════════════════════════════════════════════════════════

exports.saveManualValues = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'guest_user';
    const { values = {}, notes = '' } = req.body;

    if (!values || Object.keys(values).length === 0) {
      return res.status(400).json({ success: false, message: 'No values provided.' });
    }

    const { REFERENCE_RANGES } = require('../services/medicalAnalysisService');
    let syntheticText = '';
    for (const [key, val] of Object.entries(values)) {
      const ref = REFERENCE_RANGES[key];
      if (ref && !isNaN(parseFloat(val))) {
        syntheticText += `${ref.label} ${val} ${ref.unit} `;
      }
    }

    const analysis = analyzeReport(`${syntheticText} ${notes}`, notes);

    persistentReportDb.saveHealthProfile(userId, {
      ...analysis.healthScores,
      wellnessConcerns: analysis.wellnessConcerns,
      foodProfile: analysis.foodProfile,
      findings: analysis.findings
    });

    try {
      const db = await getFirestore();
      if (db) {
        await updateHealthProfile(db, userId, analysis);
      }
    } catch (dbErr) {
      // safe catch
    }

    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/history
// ═══════════════════════════════════════════════════════════════

exports.getAnalysisHistory = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'guest_user';
    const reports = persistentReportDb.getReports(userId)
      .filter(r => r.analysis && !r.analysis.analysisFailed)
      .map(r => ({
        id:           r.id || r._id,
        reportName:   r.reportName || r.filename,
        uploadDate:   r.uploadDate || r.uploadedAt,
        overallScore: r.analysis?.healthScores?.overall || null,
        overallLabel: r.analysis?.healthScores?.overallLabel || null,
        biomarkerCount: Object.keys(r.analysis?.biomarkers || {}).length,
        topConcerns:  (r.analysis?.wellnessConcerns || []).slice(0, 3)
      }));

    res.status(200).json({ success: true, history: reports });
  } catch (err) {
    next(err);
  }
};
