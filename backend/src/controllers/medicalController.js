// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/medicalController.js
//  FoodieBite Standardized Supabase-Only Medical Intelligence Controller
//  Architecture:
//    - Primary Storage: Supabase Storage Bucket 'medical-reports' (Private)
//    - Primary Database: Supabase PostgreSQL public.medical_reports & public.health_profiles
//    - In-Memory OCR / Analysis Pipeline: Temporary document text extraction with immediate cleanup
//    - ZERO permanent disk files, ZERO Cloudinary, ZERO Firebase dependencies
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getUserSupabaseClient, getSupabaseClient, getSupabaseAdmin } = require('../config/supabase');
const { processDocument } = require('../services/documentProcessorService');
const { analyzeReport } = require('../services/medicalAnalysisService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim());
}

/**
 * Optional Gemini wellness explanation generator (gracefully bypassed if key not set)
 */
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
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  POST /api/medical/upload
//  Receives PDF file for temporary OCR analysis, then cleans up.
// ═══════════════════════════════════════════════════════════════
exports.uploadMedicalReport = async (req, res, next) => {
  const uploadedTempPath = req.file?.path;

  try {
    // 1. File validation
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const ALLOWED_MIMES = ['application/pdf', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    const mimeOk = ALLOWED_MIMES.includes(req.file.mimetype);
    const extOk = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(fileExt);

    if (!mimeOk || !extOk) {
      if (uploadedTempPath && fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF and image files are accepted for medical reports.'
      });
    }

    if (req.file.size > MAX_SIZE_BYTES) {
      if (uploadedTempPath && fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum allowed size is 20 MB.'
      });
    }

    const { notes = '', reportName = '' } = req.body;
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const reportId = crypto.randomUUID();

    // 2. OCR / text extraction (in-memory temporary processing)
    let extractionResult;
    try {
      extractionResult = await processDocument(uploadedTempPath, req.file.mimetype);
    } catch (ocrErr) {
      console.warn('medicalController: OCR process error (safe catch):', ocrErr.message);
      extractionResult = {
        success: false,
        text: '',
        rejectionReason: 'ocr_error',
        userMessage: 'Text extraction failed. Report will be saved without analysis.'
      };
    }

    // 3. Reject handwritten / non-medical if unparseable
    if (!extractionResult.success && extractionResult.rejectionReason !== 'ocr_error') {
      if (uploadedTempPath && fs.existsSync(uploadedTempPath)) fs.unlinkSync(uploadedTempPath);
      return res.status(422).json({
        success: false,
        rejectionReason: extractionResult.rejectionReason,
        message: extractionResult.userMessage
      });
    }

    // 4. Run deterministic biomarker analysis
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
        biomarkers: {},
        findings: [],
        unverifiedFindings: [],
        wellnessConcerns: [],
        healthScores: { categories: {}, overall: 100, overallLabel: 'Good' },
        foodProfile: { foodsToLimit: [], foodsToPrefer: [], recommendedNutrients: [], unverifiedFoodRestrictions: [] },
        summary: 'Report processed. Deterministic extraction complete.',
        analysisConfidence: 0,
        analysisFailed: true
      };
    }

    // 5. Optional Gemini wellness explanation
    const wellnessText = await generateWellnessExplanation(
      analysis.wellnessConcerns,
      analysis.foodProfile
    );

    // 6. Build response payload (ZERO disk storage or Cloudinary)
    const now = new Date().toISOString();
    const rawOcrText = extractionResult.text || '';
    const cleanFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${reportId}-${cleanFileName}`;

    const report = {
      id: reportId,
      _id: reportId,
      userId: userId,
      user_id: userId,
      reportName: reportName || cleanFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      filename: cleanFileName,
      originalName: cleanFileName,
      original_filename: cleanFileName,
      storagePath: storagePath,
      storage_path: storagePath,
      storageProvider: 'supabase',
      fileUrl: '',
      downloadUrl: '',
      previewUrl: '',
      mimeType: req.file.mimetype || 'application/pdf',
      fileSize: req.file.size,
      uploadDate: now,
      uploadedAt: now,
      uploadedAtIso: now,
      notes: notes,
      ocrConfidence: extractionResult.confidence || 95,
      documentType: extractionResult.documentType || 'digital_pdf',
      processingStatus: extractionResult.success ? 'completed' : 'ocr_failed',
      rawOcrText: rawOcrText,
      extractedData: {
        patientInformation: analysis.patientInfo || {},
        medicalInformation: analysis.medicalInfo || {},
        testResults: analysis.testResults || analysis.extractedTable || []
      },
      analysis: {
        summary: analysis.summary,
        wellnessExplanation: wellnessText || null,
        findings: analysis.findings,
        unverifiedFindings: analysis.unverifiedFindings || [],
        wellnessConcerns: analysis.wellnessConcerns,
        healthScores: analysis.healthScores,
        foodProfile: analysis.foodProfile,
        biomarkers: analysis.biomarkers,
        analysisConfidence: analysis.analysisConfidence,
        analysisFailed: analysis.analysisFailed,
        patientInfo: analysis.patientInfo || {},
        medicalInfo: analysis.medicalInfo || {},
        testResults: analysis.testResults || analysis.extractedTable || [],
        rawOcrText: rawOcrText,
        recommendedFoods: analysis.foodProfile?.foodsToPrefer || [],
        avoidFoods: analysis.foodProfile?.foodsToLimit || []
      }
    };

    // 7. Supabase Database Persistence (if requested directly via backend API)
    let supabaseSaved = false;
    const token = req.token;
    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client && isValidUUID(userId)) {
      try {
        const { error: repInsertError } = await client
          .from('medical_reports')
          .insert({
            id: reportId,
            user_id: userId,
            report_name: report.reportName,
            original_filename: cleanFileName,
            storage_path: storagePath,
            file_url: storagePath,
            file_size_bytes: req.file.size || 0,
            mime_type: report.mimeType,
            document_type: extractionResult.documentType || 'digital_pdf',
            processing_status: extractionResult.success ? 'completed' : 'ocr_failed',
            ocr_confidence: extractionResult.confidence || 95,
            raw_ocr_text: rawOcrText,
            notes: notes || '',
            extracted_data: report.extractedData,
            analysis: report.analysis,
            created_at: now,
            updated_at: now
          });

        if (!repInsertError) {
          supabaseSaved = true;
        }

        // Upsert health profile
        try {
          await client
            .from('health_profiles')
            .upsert({
              user_id: userId,
              overall_score: analysis.healthScores?.overall ?? 100,
              overall_label: analysis.healthScores?.overallLabel || 'Good',
              category_scores: analysis.healthScores?.categories || {},
              wellness_concerns: analysis.wellnessConcerns || [],
              food_profile: analysis.foodProfile || {},
              findings: analysis.findings || [],
              last_updated: now
            }, { onConflict: 'user_id' });
        } catch (_) {}
      } catch (sbErr) {
        console.warn('medicalController: Supabase persistence warning:', sbErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Medical report processed and analyzed successfully',
      supabaseSaved,
      storageProvider: 'supabase',
      report
    });
  } catch (err) {
    next(err);
  } finally {
    // CRITICAL: Always delete the temporary uploaded file immediately.
    // Zero permanent files on disk.
    if (uploadedTempPath && fs.existsSync(uploadedTempPath)) {
      try {
        fs.unlinkSync(uploadedTempPath);
      } catch (_) {}
    }
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/reports
//  Queries Supabase PostgreSQL exclusively
// ═══════════════════════════════════════════════════════════════
exports.getMedicalReports = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (!client || !isValidUUID(userId)) {
      return res.status(200).json({ success: true, count: 0, reports: [] });
    }

    const { data: sbReports, error: sbErr } = await client
      .from('medical_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (sbErr) {
      console.warn('medicalController: Supabase reports select error:', sbErr.message);
      return res.status(200).json({ success: true, count: 0, reports: [] });
    }

    const reports = (sbReports || []).map(r => ({
      id: r.id,
      _id: r.id,
      userId: r.user_id,
      user_id: r.user_id,
      reportName: r.report_name,
      report_name: r.report_name,
      filename: r.original_filename || r.report_name,
      originalName: r.original_filename || r.report_name,
      original_filename: r.original_filename || r.report_name,
      storagePath: r.storage_path,
      storage_path: r.storage_path,
      storageProvider: 'supabase',
      fileUrl: r.file_url,
      downloadUrl: r.file_url,
      previewUrl: r.file_url,
      mimeType: r.mime_type,
      fileSize: r.file_size_bytes,
      uploadDate: r.created_at,
      uploadedAt: r.created_at,
      uploadedAtIso: r.created_at,
      notes: r.notes,
      ocrConfidence: r.ocr_confidence,
      documentType: r.document_type,
      processingStatus: r.processing_status,
      rawOcrText: r.raw_ocr_text,
      extractedData: r.extracted_data || {},
      analysis: r.analysis || {}
    }));

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/report/:reportId
// ═══════════════════════════════════════════════════════════════
exports.getMedicalReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (!client || !isValidUUID(reportId) || !isValidUUID(userId)) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const { data: r, error } = await client
      .from('medical_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !r) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    return res.status(200).json({
      success: true,
      report: {
        id: r.id,
        _id: r.id,
        userId: r.user_id,
        user_id: r.user_id,
        reportName: r.report_name,
        report_name: r.report_name,
        filename: r.original_filename || r.report_name,
        originalName: r.original_filename || r.report_name,
        original_filename: r.original_filename || r.report_name,
        storagePath: r.storage_path,
        storage_path: r.storage_path,
        storageProvider: 'supabase',
        fileUrl: r.file_url,
        downloadUrl: r.file_url,
        previewUrl: r.file_url,
        mimeType: r.mime_type,
        fileSize: r.file_size_bytes,
        uploadDate: r.created_at,
        uploadedAt: r.created_at,
        uploadedAtIso: r.created_at,
        notes: r.notes,
        ocrConfidence: r.ocr_confidence,
        documentType: r.document_type,
        processingStatus: r.processing_status,
        rawOcrText: r.raw_ocr_text,
        extractedData: r.extracted_data || {},
        analysis: r.analysis || {}
      }
    });
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
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (!client || !isValidUUID(reportId) || !isValidUUID(userId)) {
      return res.status(200).json({ success: true, message: 'Report deleted successfully' });
    }

    // 1. Fetch storage_path before deleting record
    const { data: existingReport } = await client
      .from('medical_reports')
      .select('storage_path')
      .eq('id', reportId)
      .eq('user_id', userId)
      .maybeSingle();

    // 2. Delete database record
    await client
      .from('medical_reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', userId);

    // 3. Delete physical storage asset from Supabase Storage bucket 'medical-reports'
    if (existingReport?.storage_path) {
      const cleanPath = existingReport.storage_path.startsWith('medical-reports/')
        ? existingReport.storage_path.replace(/^medical-reports\//, '')
        : existingReport.storage_path;

      await client.storage
        .from('medical-reports')
        .remove([cleanPath])
        .catch(() => {});
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
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client && isValidUUID(userId)) {
      const { data: hp, error } = await client
        .from('health_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && hp) {
        return res.status(200).json({
          success: true,
          healthProfile: {
            overallScore: hp.overall_score,
            overallLabel: hp.overall_label,
            categoryScores: hp.category_scores || {},
            wellnessConcerns: hp.wellness_concerns || [],
            foodProfile: hp.food_profile || { foodsToPrefer: [], foodsToLimit: [], recommendedNutrients: [] },
            findings: hp.findings || [],
            lastUpdated: hp.last_updated
          }
        });
      }
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
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;
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

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client && isValidUUID(userId)) {
      try {
        await client
          .from('health_profiles')
          .upsert({
            user_id: userId,
            overall_score: analysis.healthScores?.overall ?? 100,
            overall_label: analysis.healthScores?.overallLabel || 'Good',
            category_scores: analysis.healthScores?.categories || {},
            wellness_concerns: analysis.wellnessConcerns || [],
            food_profile: analysis.foodProfile || {},
            findings: analysis.findings || [],
            last_updated: new Date().toISOString()
          }, { onConflict: 'user_id' });
      } catch (_) {}
    }

    return res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  GET /api/medical/history
// ═══════════════════════════════════════════════════════════════
exports.getAnalysisHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid || 'guest_user';
    const token = req.token;

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (!client || !isValidUUID(userId)) {
      return res.status(200).json({ success: true, history: [] });
    }

    const { data: reports, error } = await client
      .from('medical_reports')
      .select('id, report_name, created_at, analysis')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !reports) {
      return res.status(200).json({ success: true, history: [] });
    }

    const history = reports.map(r => ({
      id: r.id,
      reportName: r.report_name,
      uploadDate: r.created_at,
      overallScore: r.analysis?.healthScores?.overall || null,
      overallLabel: r.analysis?.healthScores?.overallLabel || null,
      biomarkerCount: Object.keys(r.analysis?.biomarkers || {}).length,
      topConcerns: (r.analysis?.wellnessConcerns || []).slice(0, 3)
    }));

    return res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
};
