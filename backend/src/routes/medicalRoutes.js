const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload  = require('../middleware/upload');

const {
  uploadMedicalReport,
  getMedicalReports,
  getMedicalReport,
  deleteMedicalReport,
  getHealthProfile,
  saveManualValues,
  getAnalysisHistory
} = require('../controllers/medicalController');

// All medical routes require authentication
router.use(protect);

// ── Report CRUD ──────────────────────────────────────────────
router.post('/upload',           upload.single('report'), uploadMedicalReport);
router.get('/reports',           getMedicalReports);
router.get('/report/:reportId',  getMedicalReport);
router.delete('/report/:reportId', deleteMedicalReport);

// ── Health profile ───────────────────────────────────────────
router.get('/health-profile',    getHealthProfile);

// ── Manual biomarker entry ───────────────────────────────────
router.post('/manual-values',    saveManualValues);

// ── Analysis history ─────────────────────────────────────────
router.get('/history',           getAnalysisHistory);

module.exports = router;
