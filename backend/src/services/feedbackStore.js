// ─────────────────────────────────────────────────────────────
//  backend/src/services/feedbackStore.js
//  FoodieBite — Feedback Management Store (Strict Supabase PostgreSQL)
// ─────────────────────────────────────────────────────────────

'use strict';

const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getClient() {
  return getSupabaseAdmin() || getSupabaseClient();
}

/**
 * Persist new user feedback directly to Supabase public.user_feedback
 */
async function addFeedback(feedbackDoc) {
  const client = getClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const rawUserId = feedbackDoc.userId || feedbackDoc.uid || feedbackDoc.user_id;
  const validUserId = (rawUserId && UUID_REGEX.test(rawUserId)) ? rawUserId : null;

  const validCategory = ['general', 'bug', 'recommendation', 'feature_request', 'dietary_safety'].includes(feedbackDoc.category)
    ? feedbackDoc.category
    : 'general';

  const validRating = Math.max(1, Math.min(5, parseInt(feedbackDoc.rating, 10) || 5));

  const insertPayload = {
    user_id: validUserId,
    user_email: feedbackDoc.email || feedbackDoc.user_email || 'anonymous@foodiebite.com',
    user_name: feedbackDoc.name || feedbackDoc.user_name || 'Anonymous User',
    rating: validRating,
    category: validCategory,
    message: feedbackDoc.message || '',
    status: feedbackDoc.status || 'pending',
    admin_notes: feedbackDoc.admin_notes || feedbackDoc.internalNotes || null,
    created_at: feedbackDoc.createdAt || new Date().toISOString()
  };

  const { data, error } = await client
    .from('user_feedback')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    console.error('❌ [feedbackStore.addFeedback] Supabase error:', error.message);
    throw new Error(`Failed to save feedback to Supabase: ${error.message}`);
  }

  return {
    ...data,
    id: data.id,
    name: data.user_name,
    email: data.user_email,
    userId: data.user_id,
    createdAt: data.created_at
  };
}

/**
 * Retrieve all feedback from Supabase with filtering
 */
async function getAllFeedback(filters = {}) {
  const client = getClient();
  if (!client) return [];

  let query = client.from('user_feedback').select('*').order('created_at', { ascending: false });

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category.toLowerCase().trim());
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status.toLowerCase().trim());
  }

  if (filters.rating && filters.rating !== 'all') {
    const r = parseInt(filters.rating, 10);
    if (!isNaN(r)) query = query.eq('rating', r);
  }

  const { data, error } = await query;
  if (error) {
    console.error('❌ [feedbackStore.getAllFeedback] Supabase error:', error.message);
    return [];
  }

  let list = (data || []).map(d => ({
    id: d.id,
    uid: d.user_id,
    userId: d.user_id,
    name: d.user_name,
    email: d.user_email,
    rating: d.rating,
    category: d.category,
    message: d.message,
    status: d.status,
    internalNotes: d.admin_notes,
    admin_notes: d.admin_notes,
    createdAt: d.created_at,
    updatedAt: d.resolved_at || d.created_at,
    resolvedAt: d.resolved_at
  }));

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().toLowerCase();
    list = list.filter(f =>
      (f.message && f.message.toLowerCase().includes(term)) ||
      (f.name && f.name.toLowerCase().includes(term)) ||
      (f.email && f.email.toLowerCase().includes(term)) ||
      (f.id && f.id.toLowerCase().includes(term))
    );
  }

  return list;
}

/**
 * Retrieve feedback by ID from Supabase
 */
async function getFeedbackById(id) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('user_feedback')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    uid: data.user_id,
    userId: data.user_id,
    name: data.user_name,
    email: data.user_email,
    rating: data.rating,
    category: data.category,
    message: data.message,
    status: data.status,
    internalNotes: data.admin_notes,
    admin_notes: data.admin_notes,
    createdAt: data.created_at,
    updatedAt: data.resolved_at || data.created_at,
    resolvedAt: data.resolved_at
  };
}

/**
 * Update feedback ticket in Supabase
 */
async function updateFeedback(id, updates) {
  const client = getClient();
  if (!client) throw new Error('Supabase client unavailable');

  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.internalNotes !== undefined) dbUpdates.admin_notes = updates.internalNotes;
  if (updates.admin_notes !== undefined) dbUpdates.admin_notes = updates.admin_notes;
  if (updates.status === 'resolved' || updates.status === 'closed') {
    dbUpdates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('user_feedback')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update feedback in Supabase: ${error.message}`);
  }

  return data ? {
    id: data.id,
    name: data.user_name,
    email: data.user_email,
    rating: data.rating,
    category: data.category,
    message: data.message,
    status: data.status,
    internalNotes: data.admin_notes,
    admin_notes: data.admin_notes,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at
  } : null;
}

/**
 * Delete feedback ticket from Supabase
 */
async function deleteFeedback(id) {
  const client = getClient();
  if (!client) return true;

  const { error } = await client
    .from('user_feedback')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete feedback in Supabase: ${error.message}`);
  }

  return true;
}

module.exports = {
  addFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback
};
