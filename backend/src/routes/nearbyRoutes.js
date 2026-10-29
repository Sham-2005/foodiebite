// ─────────────────────────────────────────────────────────────
//  backend/src/routes/nearbyRoutes.js
//  Routing Definitions for Nearby Restaurant and Geocoding APIs
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const nearbyController = require('../controllers/nearbyController');
const { protect } = require('../middleware/authMiddleware');

// Mount authentication protection universally on nearby discovery
router.use(protect);

router.get('/restaurants', nearbyController.searchNearby);
router.get('/geocode', nearbyController.geocodeAddress);

module.exports = router;
