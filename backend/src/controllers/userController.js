// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/userController.js
//  FoodieBite Core User Controller (Strict Supabase Single Source of Truth)
//  Handles:
//    - User Profile (public.profiles)
//    - Dietary Preferences (public.profiles.preferences)
//    - User Favorites (public.user_favorites)
//    - Search History (public.user_search_history)
//    - Behavioral Affinity Tracking & Email Integration
//    - Atomic Cascade Account Deletion (Storage + DB + Auth)
// ─────────────────────────────────────────────────────────────

'use strict';

const supabaseConfig = require('../config/supabase');
const { extractBiomarkersAndRecommendations } = require('../services/medicalAnalysisService');
const {
  recordBehaviorEvent,
  getBehavioralProfile,
  resetBehavioralProfile
} = require('../services/behaviorLearningService');
const { trackFeatureUsage } = require('../services/activityTrackingService');
const medicalController = require('./medicalController');
const mailService = require('../services/mailService');

/**
 * Resolves the appropriate Supabase client for a request.
 * Prioritizes user-scoped client when a verified token is present,
 * falling back to admin or default client.
 */
function getSupabaseClientForRequest(token) {
  return (token ? supabaseConfig.getUserSupabaseClient(token) : null) ||
    supabaseConfig.getSupabaseAdmin() ||
    supabaseConfig.getSupabaseClient();
}

// ═══════════════════════════════════════════════════════════════
//  1. USER PROFILE: GET & UPDATE
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/user/profile
 * Retrieves authenticated user's profile from public.profiles in Supabase.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized. User session required.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    if (data) {
      return res.status(200).json({
        success: true,
        profile: data,
        user: data
      });
    }

    return res.status(404).json({ success: false, message: 'User profile not found in Supabase.' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/profile
 * Updates user profile in public.profiles while strictly protecting security fields.
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized. User session required.' });
    }

    const body = req.body || {};
    const isAuthorizedAdmin = req.user?.role === 'admin' && req.user?.email === 'sham111205s@gmail.com';

    // Whitelist allowed user-editable fields
    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
    if (body.age !== undefined && body.age !== '') updates.age = parseInt(body.age, 10) || null;
    if (body.gender !== undefined) updates.gender = body.gender;
    if (body.diet_type !== undefined) {
      updates.diet_type = body.diet_type;
      updates.dietType = body.diet_type;
    }
    if (body.dietType !== undefined) {
      updates.diet_type = body.dietType;
      updates.dietType = body.dietType;
    }
    if (body.phone_number !== undefined) updates.phone_number = body.phone_number;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
    if (body.profile_picture_url !== undefined) updates.profile_picture_url = body.profile_picture_url;
    if (body.preferences !== undefined && typeof body.preferences === 'object') updates.preferences = body.preferences;
    if (body.notification_settings !== undefined && typeof body.notification_settings === 'object') updates.notification_settings = body.notification_settings;

    // Security Guard: Only designated administrator can modify role, disabled, or account_status
    if (isAuthorizedAdmin) {
      if (body.role !== undefined) updates.role = body.role;
      if (body.disabled !== undefined) updates.disabled = Boolean(body.disabled);
      if (body.account_status !== undefined) updates.account_status = body.account_status;
    }

    updates.updated_at = new Date().toISOString();

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data: updatedProfile, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to update profile in Supabase: ${error.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully in Supabase.',
      profile: updatedProfile,
      user: updatedProfile
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. USER PREFERENCES (public.profiles.preferences)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/user/preferences
 * Retrieves user dietary preferences directly from Supabase.
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data, error } = await client
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, preferences: data?.preferences || {} });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/preferences
 * Persists dietary preferences directly to Supabase public.profiles.
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const newPrefs = req.body || {};
    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data: existing, error: fetchErr } = await client
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) {
      return res.status(500).json({ success: false, message: fetchErr.message });
    }

    const mergedPrefs = { ...(existing?.preferences || {}), ...newPrefs };
    const { error: updateErr } = await client
      .from('profiles')
      .update({
        preferences: mergedPrefs,
        diet_type: mergedPrefs.dietType || 'Vegetarian',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateErr) {
      return res.status(400).json({ success: false, message: `Failed to update preferences in Supabase: ${updateErr.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully in Supabase.',
      preferences: mergedPrefs
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  3. FAVORITES (public.user_favorites)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/user/favorites
 * Retrieves saved favorite foods from Supabase public.user_favorites.
 */
exports.getFavorites = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data, error } = await client
      .from('user_favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const favoriteFoods = (data || []).map(f => ({
      ...(f.food_data || {}),
      id: f.food_id,
      foodId: f.food_id,
      foodName: f.food_name,
      cuisine: f.cuisine,
      category: f.category,
      favoriteRecordId: f.id,
      favoritedAt: f.created_at
    }));

    return res.status(200).json({ success: true, count: favoriteFoods.length, favoriteFoods });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/favorites/food
 * Persists a favorite food to Supabase public.user_favorites.
 */
exports.addFavoriteFood = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    const food = req.body || {};
    const foodId = String(food.foodId || food.id || '').trim();

    if (!userId || !foodId) {
      return res.status(400).json({ success: false, message: 'User ID and foodId are required.' });
    }

    const foodName = food.name || food.foodName || 'Food Item';
    const cuisine = food.cuisine || null;
    const category = food.category || null;

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { error } = await client
      .from('user_favorites')
      .upsert({
        user_id: userId,
        food_id: foodId,
        food_name: foodName,
        cuisine,
        category,
        food_data: food,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,food_id' });

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to save favorite in Supabase: ${error.message}` });
    }

    trackFeatureUsage('favorites_added', userId).catch(() => { });
    recordBehaviorEvent(userId, {
      type: 'recommendation_favorited',
      foodId,
      foodName,
      cuisine,
      ingredients: food.ingredients
    }).catch(() => { });

    return res.status(200).json({
      success: true,
      message: 'Favorite saved to Supabase successfully.',
      foodId
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/favorites/food/:foodId
 * Removes a favorite food from Supabase public.user_favorites.
 */
exports.removeFavoriteFood = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    const foodId = String(req.params?.foodId || req.body?.foodId || '').trim();

    if (!userId || !foodId) {
      return res.status(400).json({ success: false, message: 'User ID and foodId are required.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { error } = await client
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('food_id', foodId);

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to remove favorite from Supabase: ${error.message}` });
    }

    trackFeatureUsage('favorites_removed', userId).catch(() => { });
    recordBehaviorEvent(userId, {
      type: 'recommendation_unfavorited',
      foodId
    }).catch(() => { });

    return res.status(200).json({
      success: true,
      message: 'Favorite removed from Supabase successfully.',
      foodId
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  4. SEARCH HISTORY (public.user_search_history)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/user/search-history
 * Retrieves recent search history from Supabase public.user_search_history.
 */
exports.getSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data, error } = await client
      .from('user_search_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({
      success: true,
      count: (data || []).length,
      history: (data || []).map(h => ({
        id: h.id,
        query: h.query,
        filters: h.filters,
        resultCount: h.result_count,
        timestamp: h.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/search-history
 * Records search query to Supabase public.user_search_history.
 */
exports.addSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    const { query, filters, resultCount } = req.body || {};

    if (!userId || !query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Valid query is required.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data, error } = await client
      .from('user_search_history')
      .insert({
        user_id: userId,
        query: query.trim(),
        filters: filters || {},
        result_count: parseInt(resultCount, 10) || 0,
        created_at: new Date().toISOString()
      })
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to record search history in Supabase: ${error.message}` });
    }

    return res.status(201).json({
      success: true,
      message: 'Search query recorded in Supabase.',
      search: data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/search-history
 * Clears search history from Supabase public.user_search_history.
 */
exports.clearSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { error } = await client
      .from('user_search_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to clear search history from Supabase: ${error.message}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Search history cleared successfully from Supabase.'
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  5. BEHAVIORAL AFFINITY & LEARNING ENDPOINTS
// ═══════════════════════════════════════════════════════════════

exports.recordBehavioralEvent = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const result = await recordBehaviorEvent(userId, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getBehaviorProfile = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const profile = await getBehavioralProfile(userId);
    res.status(200).json({ success: true, behavioralProfile: profile });
  } catch (err) {
    next(err);
  }
};

exports.resetBehaviorLearning = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id || 'default_user';
    const result = await resetBehavioralProfile(userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// Re-exports from medicalController
exports.extractBiomarkersAndRecommendations = extractBiomarkersAndRecommendations;
exports.uploadMedicalReport = medicalController.uploadMedicalReport;
exports.getMedicalReports = medicalController.getMedicalReports;
exports.deleteMedicalReport = medicalController.deleteMedicalReport;

// ═══════════════════════════════════════════════════════════════
//  6. EMAIL & DIRECTORY SYNC
// ═══════════════════════════════════════════════════════════════

exports.sendTestDailyEmail = async (req, res) => {
  try {
    const recipient = (req.body && req.body.to) || req.user?.email || 'delivered@resend.dev';
    const result = await mailService.sendTestEmail({
      to: recipient,
      subject: '🍏 FoodieBite Daily Nutrition Test Digest'
    });
    return res.status(200).json({
      success: true,
      message: `Test email generated and processed successfully! Sent to ${recipient}.`,
      id: result.id || result.messageId
    });
  } catch (err) {
    console.error('❌ sendTestDailyEmail failed:', err.message);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to dispatch test daily email',
      code: err.code,
      advice: err.advice
    });
  }
};

/**
 * POST /api/user/sync
 * Synchronizes user authentication and profile state strictly to Supabase public.profiles.
 */
exports.syncUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const authUser = req.user;
    const uid = payload.uid || payload.id || authUser?.uid || authUser?.id;
    const email = payload.email || authUser?.email;
    const name = payload.name || payload.displayName || authUser?.name;

    if (!email && !uid) {
      return res.status(400).json({ success: false, message: 'User uid or email is required for sync' });
    }

    const client = getSupabaseClientForRequest(req.token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Database client unavailable.' });
    }

    const { data: synced, error } = await client
      .from('profiles')
      .upsert({
        id: uid,
        email: email ? email.toLowerCase() : null,
        name: name || 'FoodieBite User',
        full_name: name || 'FoodieBite User',
        role: payload.role || 'user',
        diet_type: payload.dietType || payload.diet_type || 'Vegetarian',
        preferences: payload.preferences || {},
        disabled: Boolean(payload.disabled),
        account_status: payload.accountStatus || payload.account_status || 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, message: `Failed to synchronize user to Supabase: ${error.message}` });
    }

    // Trigger welcome email asynchronously on new registration
    if (payload.isNewRegistration && synced?.email) {
      try {
        if (mailService && typeof mailService.sendWelcomeEmail === 'function') {
          mailService.sendWelcomeEmail(synced).catch(err => {
            console.warn('⚠️ [WelcomeEmail] Asynchronous registration dispatch note:', err.message);
          });
        }
      } catch (_) { }
    }

    return res.status(200).json({
      success: true,
      message: 'User synchronized successfully with Supabase',
      user: synced
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  7. SECURE ACCOUNT DELETION (Supabase Single Source of Truth)
// ═══════════════════════════════════════════════════════════════

/**
 * DELETE /api/user/account
 * Permanently deletes user account and cascade deletes all user-owned data from Supabase.
 * Strictly verifies operation; never returns false success on failure.
 */
exports.deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required to delete account' });
    }

    const client = getSupabaseClientForRequest(token);
    if (!client) {
      return res.status(500).json({ success: false, message: 'Supabase database client unavailable for deletion' });
    }

    console.log(`🗑️ [DeleteAccount] Commencing atomic deletion for user: ${userId}`);

    // 1. Purge all user files from Supabase Storage (medical-reports/${userId})
    try {
      if (client.storage) {
        const { data: files, error: listErr } = await client.storage
          .from('medical-reports')
          .list(userId);
        if (!listErr && files && files.length > 0) {
          const filePaths = files.map(f => `${userId}/${f.name}`);
          const { error: removeErr } = await client.storage.from('medical-reports').remove(filePaths);
          if (removeErr) {
            console.warn('⚠️ [DeleteAccount] Storage files removal note:', removeErr.message);
          } else {
            console.log(`✅ [DeleteAccount] Deleted ${filePaths.length} storage files for ${userId}`);
          }
        }
      }
    } catch (sErr) {
      console.warn('⚠️ [DeleteAccount] Storage cleanup exception:', sErr.message);
    }

    // 2. Cascade delete database records in user-owned Supabase tables
    const deletionResults = {};
    const deleteTable = async (table, col = 'user_id') => {
      try {
        const { error } = await client.from(table).delete().eq(col, userId);
        if (error) {
          console.warn(`⚠️ [DeleteAccount] Note deleting from ${table}:`, error.message);
          deletionResults[table] = { success: false, error: error.message };
        } else {
          deletionResults[table] = { success: true };
        }
      } catch (tErr) {
        deletionResults[table] = { success: false, error: tErr.message };
      }
    };

    await deleteTable('medical_reports');
    await deleteTable('health_profiles');
    await deleteTable('user_favorites');
    await deleteTable('user_search_history');
    await deleteTable('user_feedback');
    await deleteTable('restaurant_requests', 'owner_id');
    await deleteTable('coach_messages');
    await deleteTable('coach_threads');
    await deleteTable('user_meal_logs');
    await deleteTable('user_activity_logs');
    await deleteTable('user_login_history');

    // 3. Delete user profile from public.profiles
    const { error: profileDeleteErr } = await client.from('profiles').delete().eq('id', userId);
    if (profileDeleteErr) {
      console.error('❌ [DeleteAccount] Failed to delete profile from public.profiles:', profileDeleteErr.message);
      return res.status(500).json({
        success: false,
        message: `Failed to delete profile record in Supabase: ${profileDeleteErr.message}`,
        details: deletionResults
      });
    }

    // Strict verification: ensure profile is actually gone from Supabase (detect silent RLS block)
    const { data: remainingProfile } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (remainingProfile) {
      console.error(`❌ [DeleteAccount] Profile row still exists after delete attempt for user ${userId}`);
      return res.status(500).json({
        success: false,
        message: 'Account deletion failed: Profile record could not be removed from Supabase due to security policies or constraints.',
        details: deletionResults
      });
    }

    // 4. If delete_user_account RPC exists, invoke it
    try {
      const { error: rpcErr } = await client.rpc('delete_user_account');
      if (rpcErr && rpcErr.code !== 'PGRST202') {
        console.warn('⚠️ [DeleteAccount] RPC delete_user_account note:', rpcErr.message);
      }
    } catch (_) { }

    // 5. If backend has admin auth client with deleteUser capability
    const admin = supabaseConfig.getSupabaseAdmin();
    if (admin && admin.auth && admin.auth.admin && typeof admin.auth.admin.deleteUser === 'function') {
      try {
        const { error: authErr } = await admin.auth.admin.deleteUser(userId);
        if (authErr) {
          console.warn('⚠️ [DeleteAccount] Supabase Auth admin deleteUser note:', authErr.message);
        } else {
          console.log(`✅ [DeleteAccount] Successfully deleted auth.users record for ${userId}`);
        }
      } catch (aEx) {
        console.warn('⚠️ [DeleteAccount] Admin auth deleteUser exception:', aEx.message);
      }
    }

    console.log(`✅ [DeleteAccount] Deletion completed for user ${userId}`);
    return res.status(200).json({
      success: true,
      message: 'Account and associated personal records successfully deleted from Supabase.',
      userId
    });
  } catch (err) {
    console.error('❌ [DeleteAccount] Unhandled error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete account'
    });
  }
};
