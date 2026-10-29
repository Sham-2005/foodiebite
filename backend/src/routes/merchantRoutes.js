// ─────────────────────────────────────────────────────────────
//  backend/src/routes/merchantRoutes.js
//  Merchant API Endpoints Protected by protect and requireMerchant
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { protect, requireMerchant } = require('../middleware/authMiddleware');
const merchantController = require('../controllers/merchantController');

// All merchant routes require authentication and merchant role
router.use(protect);
router.use(requireMerchant);

router.post('/restaurant-requests', merchantController.createRestaurantRequest);
router.get('/restaurant-requests', merchantController.getMerchantRequests);
router.get('/restaurant-requests/:id', merchantController.getMerchantRequestById);

module.exports = router;
