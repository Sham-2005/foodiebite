// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/nearbyController.js
//  Controller for Geocoding and Nearby Restaurant Queries
// ─────────────────────────────────────────────────────────────

const { getFirestoreDb } = require('../config/firebase');
const nearbyService = require('../services/nearby/nearbyService');

// Helper to resolve Firestore connection
function getDb() {
  return getFirestoreDb();
}

/**
 * Handle nearby restaurant search
 */
exports.searchNearby = async (req, res) => {
  const { lat, lng, radius, query, cuisine, diet, exclusions, category, budget, maxResults } = req.query;
  const userId = req.user?.id || req.user?.uid;

  let userPrefs = {};

  // 1. Fetch user preference data from Firestore if available
  const db = getDb();
  if (db && userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        userPrefs = userData.preferences || {};
        // Merge allergies directly if specified at root
        if (userData.allergies) {
          userPrefs.allergies = userData.allergies;
        }
      }
    } catch (dbErr) {
      console.warn('⚠️ [Nearby Controller] Skipped user preference fetch (DB connection warning):', dbErr.message);
    }
  }

  // 2. Execute nearby search with validation
  try {
    const result = await nearbyService.searchNearby({
      lat,
      lng,
      radius: radius ? parseFloat(radius) : 5000, // Default 5 km radius
      query,
      cuisine,
      diet,
      exclusions,
      category,
      budget,
      maxResults,
      userPrefs
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[Nearby Controller] Search execution failed:', err.message);

    // If it's a validation error, return 400 Bad Request
    const isValidationError = err.message.includes('Latitude') ||
                             err.message.includes('Longitude') ||
                             err.message.includes('radius') ||
                             err.message.includes('maxResults');

    if (isValidationError) {
      return res.status(400).json({
        success: false,
        results: [],
        error: err.message
      });
    }

    // Otherwise return 500 without leaking stack trace
    return res.status(500).json({
      success: false,
      results: [],
      error: 'Nearby search is temporarily unavailable.'
    });
  }
};

/**
 * Handle Nominatim geocoding proxy
 */
exports.geocodeAddress = async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Query parameter q is required.'
    });
  }

  try {
    const result = await nearbyService.geocode(q.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode the specified address.'
      });
    }

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[Nearby Controller] Geocoding execution failed:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Geocoding service is temporarily unavailable.'
    });
  }
};
