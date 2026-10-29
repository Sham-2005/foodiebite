// ─────────────────────────────────────────────────────────────
//  backend/src/services/restaurantRequestStore.js
//  Persistence Store for Merchant Restaurant Requests & Approved Restaurants
//  Supports Firestore synchronization with fast in-memory fallback
// ─────────────────────────────────────────────────────────────

const { getFirestoreDb } = require('../config/firebase');

// In-memory store fallback
const requestsMap = new Map();
const approvedRestaurantsMap = new Map();

// Helper to sanitize strings against XSS / prompt injection
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Create a new restaurant addition request from a Merchant
 */
async function createRequest({ merchantId, merchantName, restaurantData }) {
  if (!merchantId) {
    throw new Error('Merchant ID is required.');
  }

  // Validate mandatory fields
  const name = sanitizeString(restaurantData.name);
  const address = sanitizeString(restaurantData.address);
  const phone = sanitizeString(restaurantData.phone);
  const cuisine = sanitizeString(restaurantData.cuisine);
  const description = sanitizeString(restaurantData.description || '');

  if (!name || !address || !cuisine) {
    throw new Error('Restaurant name, address, and cuisine are required.');
  }

  const lat = parseFloat(restaurantData.latitude || restaurantData.lat || 13.0827);
  const lng = parseFloat(restaurantData.longitude || restaurantData.lng || 80.2707);

  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error('Valid latitude (-90 to 90) and longitude (-180 to 180) are required.');
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const submittedAt = new Date().toISOString();

  const cleanedData = {
    name,
    address,
    phone: phone || '+91 9876543210',
    cuisine,
    description,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    openingHours: sanitizeString(restaurantData.openingHours || '10:00 AM - 10:00 PM'),
    dietaryOptions: Array.isArray(restaurantData.dietaryOptions) 
      ? restaurantData.dietaryOptions.map(sanitizeString) 
      : [sanitizeString(restaurantData.dietaryOptions || 'vegetarian')],
    menuInfo: sanitizeString(restaurantData.menuInfo || restaurantData.menu || '')
  };

  const newRequest = {
    requestId,
    id: requestId,
    merchantId,
    merchantName: merchantName || 'Merchant',
    restaurantData: cleanedData,
    status: 'PENDING',
    submittedAt,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null
  };

  // 1. Save to in-memory store
  requestsMap.set(requestId, newRequest);

  // 2. Sync to Firestore if available
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('restaurantRequests').doc(requestId).set(newRequest);
    } catch (err) {
      console.warn('⚠️ Firestore restaurant request write skipped:', err.message);
    }
  }

  return newRequest;
}

/**
 * Get all requests submitted by a specific merchant
 */
async function getRequestsByMerchant(merchantId) {
  const merchantRequests = [];
  for (const req of requestsMap.values()) {
    if (req.merchantId === merchantId) {
      merchantRequests.push(req);
    }
  }

  // Attempt Firestore fetch
  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection('restaurantRequests').where('merchantId', '==', merchantId).get();
      snap.forEach(doc => {
        const data = doc.data();
        if (!requestsMap.has(doc.id)) {
          requestsMap.set(doc.id, data);
          merchantRequests.push(data);
        }
      });
    } catch (err) {
      // safe fallback
    }
  }

  return merchantRequests;
}

/**
 * Get a single restaurant request by ID
 */
async function getRequestById(requestId) {
  if (requestsMap.has(requestId)) {
    return requestsMap.get(requestId);
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const doc = await db.collection('restaurantRequests').doc(requestId).get();
      if (doc.exists) {
        const data = doc.data();
        requestsMap.set(requestId, data);
        return data;
      }
    } catch (err) {
      // safe fallback
    }
  }

  return null;
}

/**
 * Get all restaurant requests (for Admin) with optional status filter
 */
async function getAllRequests(statusFilter = null) {
  const all = Array.from(requestsMap.values());
  if (statusFilter) {
    const norm = statusFilter.toUpperCase();
    return all.filter(r => r.status === norm);
  }
  return all;
}

/**
 * Approve a pending restaurant request (Admin operation)
 */
async function approveRequest(requestId, adminInfo = {}) {
  const reqItem = await getRequestById(requestId);
  if (!reqItem) {
    throw new Error('Restaurant request not found.');
  }

  if (reqItem.status === 'APPROVED') {
    return reqItem;
  }

  const reviewedAt = new Date().toISOString();
  const reviewedBy = adminInfo.email || adminInfo.id || 'Admin';

  reqItem.status = 'APPROVED';
  reqItem.reviewedAt = reviewedAt;
  reqItem.reviewedBy = reviewedBy;
  reqItem.rejectionReason = null;

  // Publish to Approved Restaurants dataset
  const approvedRestaurant = {
    id: `merchant_rest_${requestId}`,
    requestId,
    merchantId: reqItem.merchantId,
    name: reqItem.restaurantData.name,
    address: reqItem.restaurantData.address,
    phone: reqItem.restaurantData.phone,
    cuisine: reqItem.restaurantData.cuisine,
    description: reqItem.restaurantData.description,
    latitude: reqItem.restaurantData.latitude,
    longitude: reqItem.restaurantData.longitude,
    lat: reqItem.restaurantData.lat,
    lng: reqItem.restaurantData.lng,
    openingHours: reqItem.restaurantData.openingHours,
    dietaryOptions: reqItem.restaurantData.dietaryOptions,
    menuInfo: reqItem.restaurantData.menuInfo,
    category: 'restaurant',
    status: 'APPROVED',
    rating: 4.8,
    isMerchantApproved: true,
    approvedAt: reviewedAt,
    approvedBy: reviewedBy
  };

  approvedRestaurantsMap.set(approvedRestaurant.id, approvedRestaurant);
  requestsMap.set(requestId, reqItem);

  // Sync to Firestore if available
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('restaurantRequests').doc(requestId).set(reqItem);
      await db.collection('approvedRestaurants').doc(approvedRestaurant.id).set(approvedRestaurant);
    } catch (err) {
      console.warn('⚠️ Firestore approval sync skipped:', err.message);
    }
  }

  return reqItem;
}

/**
 * Reject a pending restaurant request (Admin operation)
 */
async function rejectRequest(requestId, adminInfo = {}, rejectionReason) {
  const reqItem = await getRequestById(requestId);
  if (!reqItem) {
    throw new Error('Restaurant request not found.');
  }

  const reason = sanitizeString(rejectionReason);
  if (!reason || reason.trim() === '') {
    throw new Error('A valid reason for rejection is required.');
  }

  const reviewedAt = new Date().toISOString();
  const reviewedBy = adminInfo.email || adminInfo.id || 'Admin';

  reqItem.status = 'REJECTED';
  reqItem.rejectionReason = reason;
  reqItem.reviewedAt = reviewedAt;
  reqItem.reviewedBy = reviewedBy;

  // Remove from approved map if previously approved
  const approvedId = `merchant_rest_${requestId}`;
  approvedRestaurantsMap.delete(approvedId);
  requestsMap.set(requestId, reqItem);

  // Sync to Firestore if available
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection('restaurantRequests').doc(requestId).set(reqItem);
      await db.collection('approvedRestaurants').doc(approvedId).delete();
    } catch (err) {
      console.warn('⚠️ Firestore rejection sync skipped:', err.message);
    }
  }

  return reqItem;
}

/**
 * Get all published APPROVED restaurants (visible to Users & Nearby Discovery)
 */
async function getApprovedRestaurants() {
  return Array.from(approvedRestaurantsMap.values()).filter(r => r.status === 'APPROVED');
}

/**
 * Clear in-memory state (useful for test isolation)
 */
function clearStore() {
  requestsMap.clear();
  approvedRestaurantsMap.clear();
}

module.exports = {
  createRequest,
  getRequestsByMerchant,
  getRequestById,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getApprovedRestaurants,
  clearStore
};
