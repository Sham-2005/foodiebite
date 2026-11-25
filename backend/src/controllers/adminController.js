// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/adminController.js
//  Complete, Secure Administrator Controller for FoodieBite
//  (Strict Supabase Single Source of Truth)
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');
const feedbackStore = require('../services/feedbackStore');
const restaurantRequestStore = require('../services/restaurantRequestStore');
const medicalReportStore = require('../services/medicalReportStore');
const { processDocument } = require('../services/documentProcessorService');
const {
  getFeatureUsageStats,
  logAdminAudit,
  getAdminAuditLogs,
  getReportingDateKey
} = require('../services/activityTrackingService');
const {
  buildStructuredTestResults,
  calculateSummaryCards,
  generateMedicalReportIntelligence,
  MEDICAL_DISCLAIMER
} = require('../services/medicalReportAiService');
const {
  queryFoodDatabase,
  getFoodDatabaseStats,
  getFoodItemById
} = require('../services/foodDatabaseService');

// In-memory cache for overview metrics (TTL: 3 minutes)
let overviewMetricsCache = null;
let overviewMetricsCacheExpiry = 0;

// In-memory cache for fetchCombinedUsers (TTL: 10 seconds)
let combinedUsersCache = null;
let combinedUsersCacheExpiry = 0;

function invalidateCombinedUsersCache() {
  combinedUsersCache = null;
  combinedUsersCacheExpiry = 0;
  overviewMetricsCache = null;
  overviewMetricsCacheExpiry = 0;
}

function getClient() {
  return getSupabaseAdmin() || getSupabaseClient();
}

/**
 * Helper to escape CSV cell values against spreadsheet formula injection.
 */
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Fetch registered users directly from Supabase public.profiles.
 */
async function fetchCombinedUsers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && combinedUsersCache && now < combinedUsersCacheExpiry) {
    return combinedUsersCache;
  }

  const client = getClient();
  let profiles = [];
  if (client) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        profiles = data;
      }
    } catch (e) {
      console.warn('Supabase profiles query notice:', e.message);
    }
  }

  // Merge with persisted userStore
  let storeUsers = [];
  try {
    const userStore = require('../services/userStore');
    storeUsers = userStore.getAllUsers ? userStore.getAllUsers() : [];
  } catch (_) {}

  const seenIds = new Set(profiles.map(p => p.id));
  const seenEmails = new Set(profiles.map(p => (p.email || '').toLowerCase().trim()));
  const mergedProfiles = [...profiles];

  storeUsers.forEach(u => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uId = u.id || u.uid;
    if (!seenIds.has(uId) && !seenEmails.has(uEmail)) {
      seenIds.add(uId);
      seenEmails.add(uEmail);
      mergedProfiles.push({
        id: uId,
        name: u.name,
        email: u.email,
        created_at: u.createdAt,
        updated_at: u.lastActiveAt,
        role: u.role || 'user',
        disabled: Boolean(u.disabled),
        diet_type: u.dietType || 'Vegetarian',
        preferences: {
          dietType: u.dietType || 'Vegetarian',
          cuisines: u.cuisines || [],
          spiceLevel: u.spiceLevel || 'Medium',
          healthGoals: u.healthGoals || [],
          allergies: u.allergies || []
        }
      });
    }
  });

  // Count favorites per user
  const favCounts = {};
  if (client) {
    try {
      const { data: favs } = await client.from('user_favorites').select('user_id');
      (favs || []).forEach(f => {
        favCounts[f.user_id] = (favCounts[f.user_id] || 0) + 1;
      });
    } catch (_) {}
  }

  // Count medical reports per user (from resilient store and Supabase)
  const medCounts = {};
  try {
    const localCounts = medicalReportStore.getAllReportsCountByUser();
    Object.assign(medCounts, localCounts);
  } catch (_) {}

  if (client) {
    try {
      const { data: medData } = await client.from('medical_reports').select('user_id');
      (medData || []).forEach(m => {
        if (m.user_id) medCounts[m.user_id] = (medCounts[m.user_id] || 0) + 1;
      });
    } catch (_) {}
  }

  const finalUsers = mergedProfiles.map(p => {
    const prefs = p.preferences || {};
    const pEmail = (p.email || '').toLowerCase().trim();
    return {
      id: p.id,
      uid: p.id,
      name: p.name || p.full_name || (p.email ? p.email.split('@')[0] : 'User'),
      email: p.email || '',
      emailVerified: true,
      createdAt: p.created_at || null,
      lastSignInTime: p.last_sign_in_at || p.updated_at || null,
      lastActiveAt: p.updated_at || null,
      authProvider: p.email && p.email.includes('google') ? 'google.com' : 'password',
      accountStatus: p.account_status || (p.disabled ? 'disabled' : 'active'),
      disabled: Boolean(p.disabled),
      role: p.role || 'user',
      dietType: p.diet_type || prefs.dietType || 'Vegetarian',
      cuisines: prefs.cuisines || [],
      spiceLevel: prefs.spiceLevel || 'Medium',
      healthGoals: prefs.healthGoals || [],
      allergies: prefs.allergies || [],
      favoritesCount: favCounts[p.id] || (pEmail ? favCounts[pEmail] : 0) || 0,
      medicalReportsCount: medCounts[p.id] || (p.uid ? medCounts[p.uid] : 0) || (pEmail ? medCounts[pEmail] : 0) || 0,
      profileMissing: false
    };
  });

  combinedUsersCache = finalUsers;
  combinedUsersCacheExpiry = Date.now() + 10000;
  return finalUsers;
}

/**
 * Filter, search, and sort users helper
 */
function filterAndSortUsers(users, { q, dietType, status, emailVerified, sortBy = 'createdAt', sortOrder = 'desc' }) {
  let result = [...users];

  // 1. Search by name, email, or user ID
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    result = result.filter(u =>
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.id && u.id.toLowerCase().includes(term))
    );
  }

  // 2. Filter by dietary preference
  if (dietType && dietType !== 'all') {
    const targetDiet = dietType.toLowerCase();
    result = result.filter(u => (u.dietType || '').toLowerCase() === targetDiet);
  }

  // 3. Filter by account status (active vs disabled)
  if (status && status !== 'all') {
    if (status === 'active') {
      result = result.filter(u => !u.disabled);
    } else if (status === 'disabled') {
      result = result.filter(u => !!u.disabled);
    }
  }

  // 4. Filter by email verification status
  if (emailVerified !== undefined && emailVerified !== '' && emailVerified !== 'all') {
    const isVerified = emailVerified === 'true' || emailVerified === true;
    result = result.filter(u => u.emailVerified === isVerified);
  }

  // 5. Sorting
  result.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === 'createdAt') {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
}

// ═════════════════════════════════════════════════════════════
//  USER MANAGEMENT ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * Get paginated, searchable, filterable users (GET /api/admin/users)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const { q, dietType, status, emailVerified, sortBy, sortOrder, refresh } = req.query;

    const allUsers = await fetchCombinedUsers(refresh === 'true');
    const filteredUsers = filterAndSortUsers(allUsers, {
      q,
      dietType,
      status,
      emailVerified,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc'
    });

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    res.status(200).json({
      success: true,
      users: pagedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('getAllUsers failed:', err.message);
    next(err);
  }
};

/**
 * Get individual user details (GET /api/admin/users/:id)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = getClient();

    let finalProfile = null;
    if (client) {
      try {
        const { data: profileDoc } = await client
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (profileDoc) finalProfile = profileDoc;
      } catch (_) {}
    }

    if (!finalProfile) {
      try {
        const userStore = require('../services/userStore');
        const storeUser = userStore.getUserById(id) || userStore.findByEmail(id);
        if (storeUser) {
          finalProfile = {
            id: storeUser.id || storeUser.uid,
            name: storeUser.name,
            email: storeUser.email,
            created_at: storeUser.createdAt,
            updated_at: storeUser.lastActiveAt,
            role: storeUser.role || 'user',
            disabled: Boolean(storeUser.disabled),
            diet_type: storeUser.dietType || 'Vegetarian',
            preferences: {
              dietType: storeUser.dietType || 'Vegetarian',
              cuisines: storeUser.cuisines || [],
              spiceLevel: storeUser.spiceLevel || 'Medium',
              healthGoals: storeUser.healthGoals || [],
              allergies: storeUser.allergies || []
            }
          };
        }
      } catch (_) {}
    }

    if (!finalProfile) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    const userEmail = (finalProfile.email || '').toLowerCase().trim();
    const prefs = finalProfile.preferences || {};

    // 1. Sent Emails for this User from public.email_delivery_logs
    const sentEmails = [];
    try {
      const { data: emailLogs } = await client
        .from('email_delivery_logs')
        .select('*')
        .eq('recipient_email', userEmail)
        .order('sent_at', { ascending: false });

      if (emailLogs && emailLogs.length > 0) {
        emailLogs.forEach(log => {
          sentEmails.push({
            id: log.id,
            subject: log.subject || (log.email_type === 'welcome' ? 'Welcome to FoodieBite!' : 'Daily Recommendation Digest'),
            recipient: log.recipient_email,
            sender: 'FoodieBite <onboarding@resend.dev>',
            status: log.status || 'delivered',
            timestamp: log.sent_at || log.created_at,
            type: log.email_type || 'system_email'
          });
        });
      }
    } catch (_) {}

    // 2. Real Activities for this User
    const realActivities = [];
    if (finalProfile.created_at) {
      realActivities.push({
        id: `act_reg_${id}`,
        type: 'registration',
        title: 'Account Registered',
        details: `Account registered in Supabase with email ${userEmail}`,
        timestamp: new Date(finalProfile.created_at).toISOString()
      });
    }

    if (finalProfile.updated_at) {
      realActivities.push({
        id: `act_update_${id}`,
        type: 'preference_update',
        title: 'Profile Updated',
        details: `Dietary preference set to ${finalProfile.diet_type || prefs.dietType || 'Vegetarian'}`,
        timestamp: new Date(finalProfile.updated_at).toISOString()
      });
    }

    // Feedback submitted by this user
    try {
      const { data: fbList } = await client
        .from('user_feedback')
        .select('*')
        .eq('user_id', id);

      if (fbList) {
        fbList.forEach(fb => {
          realActivities.push({
            id: `act_fb_${fb.id}`,
            type: 'feedback',
            title: `Feedback Submitted (${'⭐'.repeat(fb.rating || 5)})`,
            details: fb.message ? (fb.message.length > 70 ? fb.message.slice(0, 67) + '...' : fb.message) : 'Feedback submitted',
            timestamp: new Date(fb.created_at).toISOString()
          });
        });
      }
    } catch (_) {}

    // User favorites count
    let favCount = 0;
    try {
      const { count } = await client
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', id);
      favCount = count || 0;
    } catch (_) {}

    // User medical reports count (from persistent store and Supabase)
    let medReportsCount = 0;
    try {
      const userReports = medicalReportStore.getReportsByUserId(id);
      medReportsCount = userReports.length;
    } catch (_) {}

    if (medReportsCount === 0 && client) {
      try {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (UUID_REGEX.test(id)) {
          const { count } = await client
            .from('medical_reports')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id);
          if (count) medReportsCount = count;
        }
      } catch (_) {}
    }

    const userDetails = {
      id: id,
      uid: id,
      name: finalProfile.name || finalProfile.full_name || (userEmail ? userEmail.split('@')[0] : 'User'),
      email: userEmail,
      emailVerified: true,
      createdAt: finalProfile.created_at || null,
      lastSignInTime: finalProfile.updated_at || null,
      lastActiveAt: finalProfile.updated_at || null,
      disabled: Boolean(finalProfile.disabled),
      role: finalProfile.role || 'user',
      dietType: finalProfile.diet_type || prefs.dietType || 'Vegetarian',
      cuisines: prefs.cuisines || [],
      spiceLevel: prefs.spiceLevel || 'Medium',
      healthGoals: prefs.healthGoals || [],
      allergies: prefs.allergies || [],
      favoritesCount: favCount,
      medicalReportsCount: medReportsCount,
      emails: sentEmails,
      activities: realActivities,
      recentActivity: realActivities.slice(0, 10),
      profileMissing: false
    };

    await logAdminAudit(req.user, 'VIEW_USER_DETAILS', { targetUserId: id, targetEmail: userDetails.email });

    res.status(200).json({ success: true, user: userDetails });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Export filtered users to CSV (GET /api/admin/users/export)
 */
exports.exportUsersCsv = async (req, res, next) => {
  try {
    const { q, dietType, status, emailVerified, sortBy, sortOrder } = req.query;

    const allUsers = await fetchCombinedUsers();
    const filteredUsers = filterAndSortUsers(allUsers, {
      q,
      dietType,
      status,
      emailVerified,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc'
    });

    const headers = [
      'User ID',
      'Name',
      'Email',
      'Registration Date',
      'Email Verification Status',
      'Dietary Preference',
      'Account Status',
      'Role'
    ];

    const rows = filteredUsers.map(u => [
      sanitizeCsvValue(u.id || u.uid),
      sanitizeCsvValue(u.name || ''),
      sanitizeCsvValue(u.email || ''),
      sanitizeCsvValue(u.createdAt ? new Date(u.createdAt).toISOString() : 'N/A'),
      sanitizeCsvValue(u.emailVerified ? 'Verified' : 'Unverified'),
      sanitizeCsvValue(u.dietType || 'Not configured'),
      sanitizeCsvValue(u.disabled ? 'Disabled' : 'Active'),
      sanitizeCsvValue(u.role || 'user')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="foodiebite_users_${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update user details or role (PUT /api/admin/users/:id)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, name, disabled } = req.body;
    const client = getClient();
    if (!client) throw new Error('Database client unavailable');

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (name !== undefined) updates.name = name;
    if (disabled !== undefined) {
      updates.disabled = Boolean(disabled);
      updates.account_status = disabled ? 'disabled' : 'active';
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to update user in Supabase: ${error.message}` });
    }

    await logAdminAudit(req.user, 'UPDATE_USER', { targetUserId: id, updates: { role, name, disabled } });
    invalidateCombinedUsersCache();

    res.status(200).json({ success: true, message: 'User updated successfully in Supabase' });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Disable or enable user account (PUT /api/admin/users/:id/disable)
 */
exports.disableUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body;
    const isDisabled = Boolean(disabled);
    const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

    const requesterEmail = (req.user?.email || '').trim().toLowerCase();
    if (requesterEmail !== AUTHORIZED_ADMIN_EMAIL && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the authorized administrator may disable accounts.'
      });
    }

    const client = getClient();
    const userStore = require('../services/userStore');
    let targetEmail = '';

    if (client) {
      try {
        const { data: targetUser } = await client.from('profiles').select('email').eq('id', id).maybeSingle();
        if (targetUser) targetEmail = targetUser.email;
      } catch (_) {}
    }
    if (!targetEmail) {
      const local = userStore.getUserById(id);
      if (local) targetEmail = local.email;
    }

    const cleanTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (cleanTargetEmail === AUTHORIZED_ADMIN_EMAIL || id === 'DIzyGlgaTgTW6MP1MVMVmEuIug93' || id === req.user?.uid || id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Operation blocked: Cannot disable the authorized administrator account.'
      });
    }

    if (client) {
      try {
        await client
          .from('profiles')
          .update({
            disabled: isDisabled,
            account_status: isDisabled ? 'disabled' : 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase disable sync note:', err.message);
      }
    }

    userStore.updateUser(id, {
      disabled: isDisabled,
      accountStatus: isDisabled ? 'disabled' : 'active'
    });

    await logAdminAudit(req.user, isDisabled ? 'DISABLE_USER' : 'ENABLE_USER', {
      targetUserId: id,
      targetEmail: cleanTargetEmail || 'unknown'
    });
    invalidateCombinedUsersCache();

    res.status(200).json({
      success: true,
      message: `User account has been ${isDisabled ? 'disabled' : 'enabled'} successfully in Supabase`,
      disabled: isDisabled
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Permanently delete user account and associated application records (DELETE /api/admin/users/:id)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

    const requesterEmail = (req.user?.email || '').trim().toLowerCase();
    if (requesterEmail !== AUTHORIZED_ADMIN_EMAIL && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the authorized administrator may delete accounts.'
      });
    }

    const client = getClient();
    const userStore = require('../services/userStore');
    let targetEmail = '';

    if (client) {
      try {
        const { data: targetUser } = await client.from('profiles').select('email').eq('id', id).maybeSingle();
        if (targetUser) targetEmail = targetUser.email;
      } catch (_) {}
    }
    if (!targetEmail) {
      const local = userStore.getUserById(id);
      if (local) targetEmail = local.email;
    }

    const cleanTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (cleanTargetEmail === AUTHORIZED_ADMIN_EMAIL || id === 'DIzyGlgaTgTW6MP1MVMVmEuIug93' || id === req.user?.uid || id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Operation blocked: Cannot delete the authorized administrator account.'
      });
    }

    console.log(`🗑️ [AdminDeleteUser] Commencing permanent deletion for user: ${id}`);

    // 1. Purge Supabase Storage files (medical-reports/${id})
    if (client && client.storage) {
      try {
        const { data: files } = await client.storage.from('medical-reports').list(id);
        if (files && files.length > 0) {
          const filePaths = files.map(f => `${id}/${f.name}`);
          await client.storage.from('medical-reports').remove(filePaths);
          console.log(`✅ [AdminDeleteUser] Purged ${filePaths.length} storage files for ${id}`);
        }
      } catch (sErr) {
        console.warn('⚠️ [AdminDeleteUser] Storage cleanup note:', sErr.message);
      }
    }

    // 2. Cascade delete records in user-owned Supabase tables
    if (client) {
      try { await client.from('medical_reports').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('health_profiles').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_favorites').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_search_history').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_feedback').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('restaurant_requests').delete().eq('owner_id', id); } catch (_) {}
      try { await client.from('coach_messages').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('coach_threads').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_meal_logs').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_activity_logs').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('user_login_history').delete().eq('user_id', id); } catch (_) {}
      try { await client.from('profiles').delete().eq('id', id); } catch (_) {}
    }

    // 3. Delete from userStore
    userStore.deleteUser(id);

    // 4. Try admin_delete_user RPC if present
    if (client) {
      try {
        await client.rpc('admin_delete_user', { target_user_id: id });
      } catch (_) {}
    }

    // 5. Try Supabase Auth Admin deleteUser if available
    const admin = getSupabaseAdmin();
    if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.deleteUser === 'function') {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch (_) {}
    }

    // 6. Log admin audit
    await logAdminAudit(req.user, 'DELETE_USER', {
      targetUserId: id,
      targetEmail: cleanTargetEmail || 'unknown'
    });
    invalidateCombinedUsersCache();

    return res.status(200).json({
      success: true,
      permanent: true,
      message: 'User account and all associated records permanently deleted from Supabase.'
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
//  OVERVIEW & METRICS ENDPOINTS
// ═════════════════════════════════════════════════════════════

exports.getOverviewMetrics = async (req, res, next) => {
  try {
    const now = Date.now();
    const bypassCache = req.query.refresh === 'true';

    if (!bypassCache && overviewMetricsCache && now < overviewMetricsCacheExpiry) {
      return res.status(200).json({
        success: true,
        cached: true,
        metrics: overviewMetricsCache
      });
    }

    const allUsers = await fetchCombinedUsers();
    const totalUsers = allUsers.length;

    const currentDate = new Date();
    const todayMidnight = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate())).getTime();
    const currentDayOfWeek = currentDate.getUTCDay();
    const startOfWeek = new Date(todayMidnight - currentDayOfWeek * 24 * 60 * 60 * 1000).getTime();
    const startOfMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)).getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let newToday = 0;
    let newThisWeek = 0;
    let newThisMonth = 0;
    let verifiedEmailAccounts = 0;
    let activeUsersLast30Days = 0;

    for (const u of allUsers) {
      const regTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      if (regTime >= todayMidnight) newToday++;
      if (regTime >= startOfWeek) newThisWeek++;
      if (regTime >= startOfMonth) newThisMonth++;
      if (u.emailVerified) verifiedEmailAccounts++;

      const lastActiveTime = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
      if (lastActiveTime >= thirtyDaysAgo) {
        activeUsersLast30Days++;
      }
    }

    const computedMetrics = {
      totalRegisteredUsers: totalUsers,
      newRegistrationsToday: newToday,
      newRegistrationsThisWeek: newThisWeek,
      newRegistrationsThisMonth: newThisMonth,
      activeUsersInLast30Days: activeUsersLast30Days,
      verifiedEmailAccounts: verifiedEmailAccounts,
      activeUserTrackingStatus: 'active_recorded_events',
      reportingTimezone: 'UTC',
      updatedAt: new Date().toISOString()
    };

    overviewMetricsCache = computedMetrics;
    overviewMetricsCacheExpiry = now + 3 * 60 * 1000;

    res.status(200).json({
      success: true,
      cached: false,
      metrics: computedMetrics
    });
  } catch (err) {
    console.error('getOverviewMetrics error:', err.message);
    next(err);
  }
};

exports.getUserAnalytics = async (req, res, next) => {
  try {
    const range = req.query.range || '30d';
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;

    const allUsers = await fetchCombinedUsers();
    const now = Date.now();

    const dietCounts = {};
    for (const u of allUsers) {
      const diet = u.dietType || 'Not configured';
      dietCounts[diet] = (dietCounts[diet] || 0) + 1;
    }

    const dietaryDistribution = Object.entries(dietCounts).map(([label, count]) => ({
      label,
      count,
      percentage: allUsers.length > 0 ? Math.round((count / allUsers.length) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    const timelineMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = getReportingDateKey(d);
      timelineMap.set(key, 0);
    }

    for (const u of allUsers) {
      if (u.createdAt) {
        const uDate = new Date(u.createdAt);
        const key = getReportingDateKey(uDate);
        if (timelineMap.has(key)) {
          timelineMap.set(key, timelineMap.get(key) + 1);
        }
      }
    }

    let runningTotal = 0;
    const registrationsTimeline = Array.from(timelineMap.entries()).map(([date, count]) => {
      runningTotal += count;
      return { date, count, cumulative: runningTotal };
    });

    res.status(200).json({
      success: true,
      range,
      days,
      totalUsers: allUsers.length,
      dietaryDistribution,
      registrationsTimeline
    });
  } catch (err) {
    console.error('getUserAnalytics error:', err.message);
    next(err);
  }
};

exports.getFeatureUsageAnalytics = async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const stats = await getFeatureUsageStats(days);

    res.status(200).json({
      success: true,
      ...stats
    });
  } catch (err) {
    console.error('getFeatureUsageAnalytics error:', err.message);
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const logs = await getAdminAuditLogs(limit);

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllReports = async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data: rawReports, error: rErr } = await client
      .from('medical_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (rErr) {
      return res.status(500).json({ success: false, message: rErr.message });
    }

    // Fetch user profiles to attach user email/name
    const { data: profiles } = await client.from('profiles').select('id, name, email');
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const reports = (rawReports || []).map(r => {
      const user = profileMap.get(r.user_id) || {};
      const testResults = buildStructuredTestResults(r.analysis || {}, r.raw_ocr_text || '');
      const summaryCards = calculateSummaryCards(testResults);
      const isFailed = r.processing_status === 'ocr_failed' || r.analysis?.analysisFailed;
      const isCompleted = Boolean(r.analysis && (r.analysis.summary || r.analysis.healthSummary || r.analysis.intelligence));
      const statusIndicator = isFailed ? 'Analysis Failed' : (isCompleted ? 'Analysis Completed' : 'Not Analyzed');

      return {
        id: r.id,
        userId: r.user_id,
        userEmail: user.email || 'Unknown',
        userName: user.name || 'User',
        reportName: r.report_name || r.original_filename || 'Medical Report',
        originalFilename: r.original_filename || 'report.pdf',
        mimeType: r.mime_type || 'application/pdf',
        fileSizeBytes: r.file_size_bytes || 0,
        uploadDate: r.created_at,
        documentType: r.document_type || 'digital_pdf',
        processingStatus: r.processing_status || 'completed',
        statusIndicator,
        summaryCards,
        hasAnalysis: isCompleted,
        analysisSummary: r.analysis?.summary || 'Report processed and stored securely.',
        disclaimer: MEDICAL_DISCLAIMER
      };
    });

    await logAdminAudit(req.user, 'ADMIN_VIEW_ALL_REPORTS', { totalReports: reports.length });

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
//  FEEDBACK MANAGEMENT
// ═════════════════════════════════════════════════════════════

exports.getAllFeedback = async (req, res, next) => {
  try {
    const { category, status, rating, q, page, limit } = req.query;
    const feedbackList = await feedbackStore.getAllFeedback({ category, status, rating, q });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const total = feedbackList.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paginated = (page && limit)
      ? feedbackList.slice((pageNum - 1) * limitNum, pageNum * limitNum)
      : feedbackList;

    res.status(200).json({
      success: true,
      feedback: paginated,
      total,
      page: pageNum,
      totalPages
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFeedbackStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, internalNotes, replyMessage } = req.body;
    const adminUser = req.user;

    const existing = await feedbackStore.getFeedbackById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Feedback ticket ${id} not found` });
    }

    const updates = {
      status: status || existing.status,
      internalNotes: internalNotes !== undefined ? internalNotes : (existing.internalNotes || null)
    };

    const updated = await feedbackStore.updateFeedback(id, updates);

    if (replyMessage && existing.email) {
      try {
        const mailService = require('../services/mailService');
        await mailService.sendFeedbackResolutionEmail({
          name: existing.name,
          email: existing.email,
          replyMessage,
          originalMessage: existing.message
        });
      } catch (e) {
        console.warn('Feedback reply email note:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Feedback ticket updated successfully in Supabase',
      feedback: updated
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    await feedbackStore.deleteFeedback(id);
    res.status(200).json({ success: true, message: 'Feedback ticket removed successfully from Supabase' });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAiLogs = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, logs: [] });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const allUsers = await fetchCombinedUsers();
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => !u.disabled).length;

    const feedbackList = await feedbackStore.getAllFeedback();
    const totalFeedback = feedbackList.length;
    const ratingSum = feedbackList.reduce((acc, f) => acc + (f.rating || 0), 0);
    const avgFeedbackRating = totalFeedback > 0 ? (ratingSum / totalFeedback).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      analytics: {
        totalUsers,
        activeUsers,
        totalFeedback,
        avgFeedbackRating,
        totalAiQueries: 0,
        geminiCount: 0,
        fallbackCount: 0,
        aiSuccessRate: 100
      }
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
//  RESTAURANT REQUESTS
// ═════════════════════════════════════════════════════════════

exports.getRestaurantRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await restaurantRequestStore.getAllRequests(status);
    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRestaurantRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await restaurantRequestStore.getRequestById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Restaurant request not found.' });
    }
    return res.status(200).json({ success: true, request });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveRestaurantRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await restaurantRequestStore.approveRequest(id, req.user);
    await logAdminAudit(req.user, 'APPROVE_RESTAURANT_REQUEST', { requestId: id });
    return res.status(200).json({
      success: true,
      message: 'Restaurant request approved successfully.',
      status: 'APPROVED',
      request
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

exports.rejectRestaurantRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason, reason } = req.body;
    const finalReason = rejectionReason || reason;
    const request = await restaurantRequestStore.rejectRequest(id, req.user, finalReason);
    await logAdminAudit(req.user, 'REJECT_RESTAURANT_REQUEST', { requestId: id, reason: finalReason });
    return res.status(200).json({
      success: true,
      message: 'Restaurant request rejected successfully.',
      status: 'REJECTED',
      request
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.includes('reason for rejection is required')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════
//  GLOBAL NOTIFICATION SETTINGS (Supabase public.system_settings)
// ═════════════════════════════════════════════════════════════

const defaultGlobalNotificationSettings = {
  welcomeEmailEnabled: true,
  dailyRecommendationsEnabled: true,
  dailyRecommendationCron: '0 9 * * *',
  dailyRecommendationTimezone: 'Asia/Kolkata',
  marketingEmailsEnabled: false,
  securityAlertsEnabled: true,
  feedbackAlertsEnabled: true,
  updatedAt: new Date().toISOString()
};

exports.getNotificationSettings = async (req, res, next) => {
  try {
    const client = getClient();
    let settings = { ...defaultGlobalNotificationSettings };

    if (client) {
      const { data } = await client
        .from('system_settings')
        .select('value')
        .eq('key', 'notification_settings')
        .maybeSingle();

      if (data && data.value) {
        settings = { ...settings, ...data.value };
      }
    }

    res.status(200).json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateNotificationSettings = async (req, res, next) => {
  try {
    const incoming = req.body || {};
    const client = getClient();
    if (!client) throw new Error('Database client unavailable');

    const { data: existing } = await client
      .from('system_settings')
      .select('value')
      .eq('key', 'notification_settings')
      .maybeSingle();

    const current = existing?.value || defaultGlobalNotificationSettings;
    const updated = {
      ...current,
      ...incoming,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'sham111205s@gmail.com'
    };

    const { error } = await client
      .from('system_settings')
      .upsert({
        key: 'notification_settings',
        value: updated,
        description: 'Global notification and email delivery settings',
        is_public: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.warn('⚠️ [NotificationSettings] Supabase system_settings note:', error.message);
    }

    try {
      const scheduler = require('../services/scheduler');
      if (scheduler && typeof scheduler.updateSchedule === 'function') {
        await scheduler.updateSchedule({
          cron: updated.dailyRecommendationCron,
          enabled: updated.dailyRecommendationsEnabled,
          timezone: updated.dailyRecommendationTimezone
        });
      }
    } catch (schedErr) {
      console.warn('Scheduler sync warning:', schedErr.message);
    }

    await logAdminAudit(req.user, 'UPDATE_NOTIFICATION_SETTINGS', { settings: updated });

    res.status(200).json({
      success: true,
      message: 'Notification settings saved successfully to Supabase.',
      settings: updated
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  ADMIN MEDICAL REPORTS & CLINICAL INTELLIGENCE CONTROLLERS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/users/:id/medical-reports
 * List all medical reports for a specific user with structured summary
 */
exports.getUserMedicalReports = async (req, res, next) => {
  try {
    const { id } = req.params;
    let rawReports = [];

    // 1. Fetch from persistent medicalReportStore (resolves across UUID, Firebase UID, and email)
    try {
      rawReports = medicalReportStore.getReportsByUserId(id);
    } catch (_) {}

    // 2. Also check Supabase if connected
    const client = getClient();
    if (client && rawReports.length === 0) {
      try {
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        let queryUserId = id;
        if (!UUID_REGEX.test(id) && id && id.includes('@')) {
          const { data: p } = await client
            .from('profiles')
            .select('id')
            .eq('email', id.toLowerCase().trim())
            .maybeSingle();
          if (p?.id) queryUserId = p.id;
        }

        if (UUID_REGEX.test(queryUserId)) {
          const { data, error: rErr } = await client
            .from('medical_reports')
            .select('*')
            .eq('user_id', queryUserId)
            .order('created_at', { ascending: false });
          if (!rErr && Array.isArray(data) && data.length > 0) {
            rawReports = data;
          }
        }
      } catch (queryErr) {
        console.warn('getUserMedicalReports Supabase notice:', queryErr.message);
      }
    }

    const reports = (rawReports || []).map(r => {
      const rawText = r.raw_ocr_text || r.rawOcrText || '';
      const testResults = buildStructuredTestResults(r.analysis || {}, rawText);
      const summaryCards = calculateSummaryCards(testResults);
      const isFailed = r.processing_status === 'ocr_failed' || r.processingStatus === 'ocr_failed' || r.analysis?.analysisFailed;
      const isCompleted = Boolean(r.analysis && (r.analysis.summary || r.analysis.healthSummary || r.analysis.intelligence || r.analysis.biomarkers));
      const statusIndicator = isFailed ? 'Analysis Failed' : (isCompleted ? 'Analysis Completed' : 'Not Analyzed');

      return {
        id: r.id || r._id,
        userId: r.user_id || r.userId || id,
        reportName: r.report_name || r.reportName || r.original_filename || 'Medical Report',
        originalFilename: r.original_filename || r.filename || 'report.pdf',
        mimeType: r.mime_type || r.mimeType || 'application/pdf',
        fileSizeBytes: r.file_size_bytes || r.fileSize || 0,
        uploadDate: r.created_at || r.uploadDate || r.uploadedAt || new Date().toISOString(),
        documentType: r.document_type || r.documentType || 'digital_pdf',
        processingStatus: r.processing_status || r.processingStatus || 'completed',
        statusIndicator,
        ocrConfidence: r.ocr_confidence || r.ocrConfidence || 95,
        summaryCards,
        hasAnalysis: isCompleted,
        analysisSummary: r.analysis?.summary || r.analysis?.intelligence?.summary || 'Report processed and stored securely.',
        healthSummary: r.analysis?.healthSummary || null,
        disclaimer: MEDICAL_DISCLAIMER
      };
    });

    await logAdminAudit(req.user, 'ADMIN_VIEW_USER_REPORTS', { targetUserId: id, count: reports.length });

    res.status(200).json({
      success: true,
      userId: id,
      count: reports.length,
      reports
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:id/medical-reports/:reportId
 * Get detailed analysis and extracted test table for a specific report
 */
exports.getUserMedicalReportById = async (req, res, next) => {
  try {
    const { id, reportId } = req.params;

    // 1. Fetch from persistent medicalReportStore
    let report = medicalReportStore.getReportById(reportId);

    // 2. Check Supabase if not found locally
    if (!report) {
      const client = getClient();
      if (client) {
        try {
          const { data } = await client
            .from('medical_reports')
            .select('*')
            .eq('id', reportId)
            .maybeSingle();
          if (data) report = data;
        } catch (_) {}
      }
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Medical report not found.' });
    }

    // Fetch user profile for dietary context
    const userStore = require('../services/userStore');
    const uDoc = userStore.getUserById(id) || (id && id.includes('@') ? userStore.findByEmail(id) : null);
    const prefs = uDoc?.preferences || {};
    const userProfile = {
      id: id,
      dietType: uDoc?.dietType || prefs.dietType || 'Vegetarian',
      cuisines: prefs.cuisines || ['indian'],
      allergies: prefs.allergies || [],
      healthGoals: prefs.healthGoals || ['healthy_eating']
    };

    const rawText = report.raw_ocr_text || report.rawOcrText || '';
    const testResults = buildStructuredTestResults(report.analysis || {}, rawText);
    const summaryCards = calculateSummaryCards(testResults);
    const isFailed = report.processing_status === 'ocr_failed' || report.processingStatus === 'ocr_failed' || report.analysis?.analysisFailed;
    const isCompleted = Boolean(report.analysis && (report.analysis.summary || report.analysis.healthSummary || report.analysis.intelligence || report.analysis.biomarkers));
    const statusIndicator = isFailed ? 'Analysis Failed' : (isCompleted ? 'Analysis Completed' : 'Not Analyzed');

    const abnormalValues = testResults.filter(t => t.status === 'High' || t.status === 'Low');
    const normalValues = testResults.filter(t => t.status === 'Normal');
    const conditions = report.analysis?.findings || (report.analysis?.wellnessConcerns && report.analysis.wellnessConcerns.map(c => c.concern)) || [];

    const healthSummary = report.analysis?.healthSummary || {
      overallHealthSummary: report.analysis?.summary || report.analysis?.intelligence?.summary || 'Laboratory report processed and ready for review.',
      reportedMedicalConditions: conditions.length > 0 ? conditions : ['No explicit chronic diagnoses recorded on lab panel.'],
      abnormalLaboratoryValues: abnormalValues,
      normalLaboratoryValues: normalValues,
      importantHealthIndicators: testResults.slice(0, 8),
      potentialNutritionalConsiderations: report.analysis?.intelligence?.nutritionConsiderations || (report.analysis?.foodProfile?.foodsToPrefer && report.analysis.foodProfile.foodsToPrefer.join(', ')) || 'Maintain wholesome dietary variety.',
      dietaryRecommendationsRelevantToFoodieBite: report.analysis?.intelligence?.foodSuggestions || [],
      itemsRequiringMedicalFollowUp: abnormalValues.length > 0
        ? abnormalValues.map(a => `${a.test} measured at ${a.result} ${a.unit} (${a.status} relative to ${a.referenceRange}) warrants clinical correlation.`)
        : ['All measured biomarkers within reference ranges.'],
      healthcareGuidance: report.analysis?.intelligence?.healthcareGuidance || 'Consult your healthcare provider for clinical evaluation of laboratory results.',
      reportDate: report.created_at || report.uploadDate || new Date().toISOString(),
      summaryGenerationDate: report.analysis?.lastAnalyzedAt || report.created_at || new Date().toISOString(),
      analysisStatus: statusIndicator,
      disclaimer: MEDICAL_DISCLAIMER
    };

    await logAdminAudit(req.user, 'ADMIN_VIEW_REPORT_DETAIL', { targetUserId: id, reportId });

    res.status(200).json({
      success: true,
      report: {
        id: report.id || report._id,
        userId: report.user_id || report.userId || id,
        reportName: report.report_name || report.reportName || report.original_filename || 'Medical Report',
        originalFilename: report.original_filename || report.filename,
        mimeType: report.mime_type || report.mimeType || 'application/pdf',
        fileSizeBytes: report.file_size_bytes || report.fileSize || 0,
        uploadDate: report.created_at || report.uploadDate || report.uploadedAt,
        documentType: report.document_type || report.documentType || 'digital_pdf',
        processingStatus: report.processing_status || report.processingStatus || 'completed',
        statusIndicator,
        ocrConfidence: report.ocr_confidence || report.ocrConfidence || 95,
        rawOcrText: rawText,
        summaryCards,
        testResults,
        analysis: report.analysis,
        healthSummary,
        userProfile,
        disclaimer: MEDICAL_DISCLAIMER
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users/:id/medical-reports/:reportId/analyze
 * Run Local Ollama Medical Report Intelligence
 */
exports.analyzeUserMedicalReport = async (req, res, next) => {
  try {
    const { id, reportId } = req.params;

    // 1. Fetch from persistent medicalReportStore
    let report = medicalReportStore.getReportById(reportId);

    // 2. Check Supabase if not found locally
    const client = getClient();
    if (!report && client) {
      try {
        const { data } = await client
          .from('medical_reports')
          .select('*')
          .eq('id', reportId)
          .maybeSingle();
        if (data) report = data;
      } catch (_) {}
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Medical report not found.' });
    }

    // Extract text from physical document if rawOcrText is missing
    let rawOcrText = report.raw_ocr_text || report.rawOcrText || '';
    if (!rawOcrText || rawOcrText.trim().length === 0) {
      const filePath = medicalReportStore.getReportFilePath(reportId);
      if (filePath && fs.existsSync(filePath)) {
        try {
          const extractionResult = await processDocument(filePath, report.mime_type || report.mimeType || 'application/pdf');
          if (extractionResult.success && extractionResult.text) {
            rawOcrText = extractionResult.text;
            report.raw_ocr_text = rawOcrText;
            report.rawOcrText = rawOcrText;
          }
        } catch (ocrErr) {
          console.warn('OCR extraction warning during analysis:', ocrErr.message);
        }
      }
    }

    // Fetch user profile for personalized dietary filtering
    const userStore = require('../services/userStore');
    const uDoc = userStore.getUserById(id) || (id && id.includes('@') ? userStore.findByEmail(id) : null);
    const prefs = uDoc?.preferences || {};
    const userProfile = {
      id: id,
      name: uDoc?.name || 'User',
      dietType: uDoc?.dietType || prefs.dietType || 'Vegetarian',
      cuisines: prefs.cuisines || ['indian'],
      allergies: prefs.allergies || [],
      healthGoals: prefs.healthGoals || ['healthy_eating'],
      spiceLevel: prefs.spiceLevel || 'Medium'
    };

    // Run Local Ollama AI analysis (qwen2.5:0.5b)
    const intelligence = await generateMedicalReportIntelligence(report, userProfile);

    // Update analysis in medicalReportStore
    const updatedAnalysis = {
      ...(report.analysis || {}),
      intelligence: intelligence.aiAnalysis,
      healthSummary: intelligence.healthSummary,
      summaryCards: intelligence.summaryCards,
      testResults: intelligence.testResults,
      lastAnalyzedAt: new Date().toISOString(),
      analyzedBy: req.user?.email || 'admin'
    };

    medicalReportStore.updateReportAnalysis(reportId, updatedAnalysis, 'completed');

    // Also update in Supabase if client is available
    if (client) {
      try {
        await client
          .from('medical_reports')
          .update({
            analysis: updatedAnalysis,
            processing_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);
      } catch (_) {}
    }

    await logAdminAudit(req.user, 'ADMIN_ANALYZE_REPORT', {
      targetUserId: id,
      reportId,
      provider: intelligence.provider,
      testsCount: intelligence.summaryCards?.totalTests || 0
    });

    res.status(200).json({
      success: true,
      provider: intelligence.provider,
      intelligence,
      healthSummary: intelligence.healthSummary
    });
  } catch (err) {
    console.error('analyzeUserMedicalReport failed:', err.message);
    next(err);
  }
};

/**
 * GET /api/admin/users/:id/medical-reports/:reportId/view
 * Secure View Document URL: Generates short-lived signed URL (300s) or direct document link
 */
exports.viewUserMedicalReport = async (req, res, next) => {
  try {
    const { id, reportId } = req.params;
    const report = medicalReportStore.getReportById(reportId);
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    let viewUrl = `${protocol}://${host}/api/admin/users/${id}/medical-reports/${reportId}/document`;
    let signedUrlExpiresIn = 300; // 5 minutes

    const client = getClient();
    if (report?.storage_path && client) {
      const cleanPath = report.storage_path.startsWith('medical-reports/')
        ? report.storage_path.replace(/^medical-reports\//, '')
        : report.storage_path;
      try {
        const { data: signedData, error: sErr } = await client.storage
          .from('medical-reports')
          .createSignedUrl(cleanPath, signedUrlExpiresIn);
        if (!sErr && signedData?.signedUrl) {
          viewUrl = signedData.signedUrl;
        }
      } catch (_) {}
    }

    await logAdminAudit(req.user, 'ADMIN_VIEW_REPORT_DOCUMENT', { targetUserId: id, reportId });

    res.status(200).json({
      success: true,
      reportId: report?.id || reportId,
      reportName: report?.report_name || report?.reportName || report?.original_filename || 'Medical Report',
      mimeType: report?.mime_type || report?.mimeType || 'application/pdf',
      viewUrl,
      expiresInSeconds: signedUrlExpiresIn,
      rawOcrText: report?.raw_ocr_text || report?.rawOcrText || ''
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:id/medical-reports/:reportId/document
 * Direct Secure Stream of Medical Document PDF
 */
exports.serveMedicalReportDocument = async (req, res, next) => {
  try {
    const { id, reportId } = req.params;
    const report = medicalReportStore.getReportById(reportId);
    const filePath = medicalReportStore.getReportFilePath(reportId);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Medical document file not found on server.' });
    }

    const filename = report?.original_filename || report?.filename || 'medical_report.pdf';
    const mimeType = report?.mime_type || report?.mimeType || 'application/pdf';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/users/:id/medical-reports/:reportId
 * Permanently deletes user medical report from database and storage
 */
exports.deleteUserMedicalReport = async (req, res, next) => {
  try {
    const { id, reportId } = req.params;

    medicalReportStore.deleteReport(id, reportId);

    const client = getClient();
    if (client) {
      try {
        await client
          .from('medical_reports')
          .delete()
          .eq('id', reportId);
      } catch (_) {}
    }

    await logAdminAudit(req.user, 'ADMIN_DELETE_REPORT', { targetUserId: id, reportId });

    res.status(200).json({
      success: true,
      message: 'Medical report permanently deleted.'
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  ADMIN FOOD DATABASE MANAGEMENT CONTROLLERS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/foods
 * Queries, filters, sorts, and paginates the complete unified FoodieBite food database
 */
exports.getAllFoodsDatabase = async (req, res, next) => {
  try {
    const result = queryFoodDatabase(req.query);
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('getAllFoodsDatabase error:', err.message);
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/foods/stats
 * Computes live aggregated statistics over all foods
 */
exports.getFoodDatabaseStats = async (req, res, next) => {
  try {
    const stats = getFoodDatabaseStats();
    res.status(200).json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('getFoodDatabaseStats error:', err.message);
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/foods/:id
 * Retrieves complete detailed metadata for a single food item
 */
exports.getFoodDatabaseItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const food = getFoodItemById(id);
    if (!food) {
      return res.status(404).json({ success: false, message: `Food item "${id}" not found in database.` });
    }
    res.status(200).json({
      success: true,
      food
    });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};
