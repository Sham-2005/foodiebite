// ─────────────────────────────────────────────────────────────
//  backend/src/routes/restaurantRoutes.js
//  User & Public Approved Restaurants Route
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const restaurantRequestStore = require('../services/restaurantRequestStore');

/**
 * GET /api/restaurants/approved
 * Returns all merchant restaurants that have status === 'APPROVED'
 */
router.get('/approved', async (req, res, next) => {
  try {
    const approved = await restaurantRequestStore.getApprovedRestaurants();
    return res.status(200).json({
      success: true,
      count: approved.length,
      restaurants: approved
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
