const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload  = require('../middleware/upload');
const {
  getProfile, updateProfile,
  getPreferences, updatePreferences,
  getFavorites,
  addFavoriteFood, removeFavoriteFood,
  uploadMedicalReport, getMedicalReports, deleteMedicalReport,
  getSearchHistory, clearSearchHistory,
  sendTestDailyEmail,
  recordBehavioralEvent, getBehaviorProfile, resetBehaviorLearning,
  syncUser
} = require('../controllers/userController');

// User sync endpoint (reconciles client authentication with backend & Firestore)
router.post('/sync', syncUser);

router.use(protect);

router.get('/profile',  getProfile);
router.put('/profile',  updateProfile);

router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

router.post('/test-daily-email', sendTestDailyEmail);

router.get('/favorites',                        getFavorites);
router.post('/favorites/food',                  addFavoriteFood);
router.delete('/favorites/food/:foodId',        removeFavoriteFood);

router.get('/medical',              getMedicalReports);
router.post('/medical',             upload.single('report'), uploadMedicalReport);
router.delete('/medical/:reportId', deleteMedicalReport);

router.get('/search-history',    getSearchHistory);
router.delete('/search-history', clearSearchHistory);

// ── Phase 5: Behavioral Learning & Preference Control Endpoints ──
router.post('/behavior/event',       recordBehavioralEvent);
router.get('/behavior/profile',      getBehaviorProfile);
router.post('/behavior/reset',       resetBehaviorLearning);
router.delete('/behavior/learning',  resetBehaviorLearning);

module.exports = router;
