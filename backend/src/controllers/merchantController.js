// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/merchantController.js
//  Merchant Dashboard & Restaurant Request Management
// ─────────────────────────────────────────────────────────────

const restaurantRequestStore = require('../services/restaurantRequestStore');

/**
 * Submit a restaurant addition request (POST /api/merchant/restaurant-requests)
 */
exports.createRestaurantRequest = async (req, res, next) => {
  try {
    const merchantId = req.user.id || req.user.uid;
    const merchantName = req.user.name || req.user.email || 'Merchant';
    const restaurantData = req.body.restaurantData || req.body;

    const request = await restaurantRequestStore.createRequest({
      merchantId,
      merchantName,
      restaurantData
    });

    return res.status(201).json({
      success: true,
      message: 'Restaurant request submitted successfully.',
      status: 'PENDING',
      request
    });
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('Valid latitude')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * Get all requests submitted by the logged-in merchant (GET /api/merchant/restaurant-requests)
 */
exports.getMerchantRequests = async (req, res, next) => {
  try {
    const merchantId = req.user.id || req.user.uid;
    const requests = await restaurantRequestStore.getRequestsByMerchant(merchantId);

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get details of a single restaurant request (GET /api/merchant/restaurant-requests/:id)
 * Enforces Merchant Isolation: Merchant A cannot view Merchant B's request.
 */
exports.getMerchantRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const merchantId = req.user.id || req.user.uid;

    const request = await restaurantRequestStore.getRequestById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Restaurant request not found.' });
    }

    if (request.merchantId !== merchantId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own restaurant requests.' });
    }

    return res.status(200).json({
      success: true,
      request
    });
  } catch (err) {
    next(err);
  }
};
