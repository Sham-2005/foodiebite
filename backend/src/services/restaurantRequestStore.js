// ─────────────────────────────────────────────────────────────
//  backend/src/services/restaurantRequestStore.js
//  FoodieBite — Restaurant Requests Store (Strict Supabase Single Source of Truth)
// ─────────────────────────────────────────────────────────────

'use strict';

const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getClient() {
  return getSupabaseAdmin() || getSupabaseClient();
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Create a new restaurant addition request
 */
async function createRequest({ merchantId, merchantName, restaurantData }) {
  const client = getClient();
  if (!client) throw new Error('Database client unavailable');

  const name = sanitizeString(restaurantData.name);
  const address = sanitizeString(restaurantData.address);
  const phone = sanitizeString(restaurantData.phone);
  const cuisine = sanitizeString(restaurantData.cuisine);
  const email = sanitizeString(restaurantData.email || restaurantData.contactEmail || 'merchant@foodiebite.com');

  if (!name || !address || !cuisine) {
    throw new Error('Restaurant name, address, and cuisine are required.');
  }

  const validOwnerId = (merchantId && UUID_REGEX.test(merchantId)) ? merchantId : null;
  const cuisinesArr = Array.isArray(restaurantData.cuisines)
    ? restaurantData.cuisines.map(sanitizeString)
    : [cuisine];

  const dietaryOfferings = Array.isArray(restaurantData.dietaryOptions)
    ? restaurantData.dietaryOptions
    : [restaurantData.dietaryOptions || 'vegetarian'];

  const { data, error } = await client
    .from('restaurant_requests')
    .insert({
      owner_id: validOwnerId,
      restaurant_name: name,
      cuisines: cuisinesArr,
      address,
      contact_phone: phone || '+91 9876543210',
      contact_email: email,
      dietary_offerings: dietaryOfferings,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to submit restaurant request in Supabase: ${error.message}`);
  }

  return {
    id: data.id,
    requestId: data.id,
    merchantId: data.owner_id,
    merchantName: merchantName || 'Merchant',
    restaurantData: {
      name: data.restaurant_name,
      address: data.address,
      phone: data.contact_phone,
      cuisine: data.cuisines?.[0] || 'Multi-Cuisine',
      cuisines: data.cuisines,
      dietaryOptions: data.dietary_offerings
    },
    status: data.status.toUpperCase(),
    submittedAt: data.created_at
  };
}

/**
 * Get requests submitted by a merchant
 */
async function getRequestsByMerchant(merchantId) {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('restaurant_requests')
    .select('*')
    .eq('owner_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) return [];

  return (data || []).map(d => ({
    id: d.id,
    requestId: d.id,
    merchantId: d.owner_id,
    restaurantData: {
      name: d.restaurant_name,
      address: d.address,
      phone: d.contact_phone,
      cuisine: d.cuisines?.[0] || 'Multi-Cuisine',
      cuisines: d.cuisines,
      dietaryOptions: d.dietary_offerings
    },
    status: d.status.toUpperCase(),
    rejectionReason: d.rejection_reason,
    submittedAt: d.created_at,
    reviewedAt: d.reviewed_at
  }));
}

/**
 * Get single request by ID
 */
async function getRequestById(requestId) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('restaurant_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    requestId: data.id,
    merchantId: data.owner_id,
    restaurantData: {
      name: data.restaurant_name,
      address: data.address,
      phone: data.contact_phone,
      cuisine: data.cuisines?.[0] || 'Multi-Cuisine',
      cuisines: data.cuisines,
      dietaryOptions: data.dietary_offerings
    },
    status: data.status.toUpperCase(),
    rejectionReason: data.rejection_reason,
    submittedAt: data.created_at,
    reviewedAt: data.reviewed_at
  };
}

/**
 * Get all requests (for Admin)
 */
async function getAllRequests(statusFilter = null) {
  const client = getClient();
  if (!client) return [];

  let query = client.from('restaurant_requests').select('*').order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter.toLowerCase());
  }

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map(d => ({
    id: d.id,
    requestId: d.id,
    merchantId: d.owner_id,
    restaurantData: {
      name: d.restaurant_name,
      address: d.address,
      phone: d.contact_phone,
      cuisine: d.cuisines?.[0] || 'Multi-Cuisine',
      cuisines: d.cuisines,
      dietaryOptions: d.dietary_offerings
    },
    status: d.status.toUpperCase(),
    rejectionReason: d.rejection_reason,
    submittedAt: d.created_at,
    reviewedAt: d.reviewed_at
  }));
}

/**
 * Approve request
 */
async function approveRequest(requestId, adminInfo = {}) {
  const client = getClient();
  if (!client) throw new Error('Database client unavailable');

  const now = new Date().toISOString();
  const { data: updatedReq, error: reqErr } = await client
    .from('restaurant_requests')
    .update({
      status: 'approved',
      rejection_reason: null,
      reviewed_at: now
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (reqErr) throw new Error(`Approval failed: ${reqErr.message}`);

  // Insert into approved_restaurants
  await client.from('approved_restaurants').upsert({
    request_id: requestId,
    name: updatedReq.restaurant_name,
    cuisines: updatedReq.cuisines || [],
    address: updatedReq.address,
    rating: 4.8,
    is_active: true,
    dietary_tags: updatedReq.dietary_offerings || [],
    created_at: now
  }, { onConflict: 'request_id' }).catch(() => {});

  return {
    id: updatedReq.id,
    requestId: updatedReq.id,
    status: 'APPROVED',
    reviewedAt: now,
    restaurantData: {
      name: updatedReq.restaurant_name,
      address: updatedReq.address
    }
  };
}

/**
 * Reject request
 */
async function rejectRequest(requestId, adminInfo = {}, rejectionReason) {
  const client = getClient();
  if (!client) throw new Error('Database client unavailable');

  const reason = sanitizeString(rejectionReason);
  if (!reason || reason.trim() === '') {
    throw new Error('A valid reason for rejection is required.');
  }

  const now = new Date().toISOString();
  const { data: updatedReq, error: reqErr } = await client
    .from('restaurant_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: now
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (reqErr) throw new Error(`Rejection failed: ${reqErr.message}`);

  // Remove from approved_restaurants if it was approved
  await client.from('approved_restaurants').delete().eq('request_id', requestId).catch(() => {});

  return {
    id: updatedReq.id,
    requestId: updatedReq.id,
    status: 'REJECTED',
    rejectionReason: reason,
    reviewedAt: now
  };
}

/**
 * Get all published APPROVED restaurants
 */
async function getApprovedRestaurants() {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('approved_restaurants')
    .select('*')
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error) return [];
  return data || [];
}

function clearStore() {}

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
