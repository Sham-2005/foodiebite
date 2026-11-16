// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/userController.js
//  FoodieBite Core User Controller (Supabase PostgreSQL Integrated)
//  Handles:
//    - User Profile (public.profiles)
//    - Dietary Preferences (public.profiles.preferences)
//    - User Favorites (public.user_favorites)
//    - Search History (public.user_search_history)
//    - Behavioral Affinity Tracking & Email Integration
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const { getUserSupabaseClient, getSupabaseClient, getSupabaseAdmin } = require('../config/supabase');
const { extractBiomarkersAndRecommendations } = require('../services/medicalAnalysisService');
const {
  recordBehaviorEvent,
  getBehavioralProfile,
  resetBehavioralProfile
} = require('../services/behaviorLearningService');
const { trackFeatureUsage } = require('../services/activityTrackingService');
const medicalController = require('./medicalController');
const mailService = require('../services/mailService');

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

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();

    if (client) {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        return res.status(200).json({
          success: true,
          profile: data,
          user: data
        });
      }
    }

    // Fallback to local userStore if profile is not yet in Supabase
    const userStore = require('../services/userStore');
    let localUser = userStore.findById(userId) || (req.user?.email ? userStore.findByEmail(req.user.email) : null);
    if (!localUser && req.user?.email) {
      localUser = userStore.upsertUser({
        id: userId,
        uid: userId,
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
        role: req.user.role || 'user',
        dietType: 'Vegetarian',
        diet_type: 'Vegetarian',
        account_status: 'active',
        disabled: false,
        preferences: {
          dietType: 'Vegetarian',
          spiceLevel: 'Medium',
          cuisines: ['indian'],
          healthGoals: ['healthy_eating'],
          allergies: []
        }
      });
    }
    if (localUser) {
      return res.status(200).json({
        success: true,
        profile: localUser,
        user: localUser
      });
    }

    return res.status(404).json({ success: false, message: 'User profile not found.' });
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

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    let updatedProfile = null;

    if (client) {
      const { data, error } = await client
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .maybeSingle();

      if (data) {
        updatedProfile = data;
      }
    }

    // Synchronize to userStore for directory caching
    const userStore = require('../services/userStore');
    const existingLocal = userStore.findById(userId) || {
      id: userId,
      uid: userId,
      email: req.user?.email || '',
      role: 'user',
      disabled: false,
      account_status: 'active',
      accountStatus: 'active',
      diet_type: 'Vegetarian',
      dietType: 'Vegetarian'
    };
    const mergedLocal = {
      ...existingLocal,
      ...updates,
      diet_type: updates.diet_type || existingLocal.diet_type || existingLocal.dietType || 'Vegetarian',
      dietType: updates.dietType || updates.diet_type || existingLocal.dietType || 'Vegetarian',
      account_status: existingLocal.account_status || 'active',
      accountStatus: existingLocal.accountStatus || 'active',
      role: isAuthorizedAdmin && updates.role ? updates.role : (existingLocal.role || 'user'),
      disabled: isAuthorizedAdmin && updates.disabled !== undefined ? updates.disabled : (existingLocal.disabled || false)
    };
    userStore.upsertUser(mergedLocal);
    const fromStore = userStore.findById(userId) || {};
    const syncedUser = {
      ...mergedLocal,
      ...fromStore,
      role: isAuthorizedAdmin && updates.role ? updates.role : (existingLocal.role || 'user'),
      disabled: isAuthorizedAdmin && updates.disabled !== undefined ? updates.disabled : (existingLocal.disabled || false),
      account_status: isAuthorizedAdmin && updates.account_status ? updates.account_status : (existingLocal.account_status || 'active'),
      diet_type: updates.diet_type || mergedLocal.diet_type || fromStore.dietType || 'Vegetarian'
    };

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile: updatedProfile || syncedUser,
      user: updatedProfile || syncedUser
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. USER PREFERENCES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/user/preferences
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      const { data } = await client
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .maybeSingle();

      if (data && data.preferences) {
        return res.status(200).json({ success: true, preferences: data.preferences });
      }
    }

    const userStore = require('../services/userStore');
    const local = userStore.findById(userId) || (req.user?.email ? userStore.findByEmail(req.user.email) : null);
    return res.status(200).json({ success: true, preferences: local?.preferences || {} });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/preferences
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const newPrefs = req.body || {};
    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();

    let mergedPrefs = newPrefs;
    if (client) {
      const { data: existing } = await client.from('profiles').select('preferences').eq('id', userId).maybeSingle();
      mergedPrefs = { ...(existing?.preferences || {}), ...newPrefs };

      await client.from('profiles').update({
        preferences: mergedPrefs,
        diet_type: mergedPrefs.dietType || 'Vegetarian',
        updated_at: new Date().toISOString()
      }).eq('id', userId);
    }

    const userStore = require('../services/userStore');
    const existing = userStore.findById(userId) || { id: userId, uid: userId, email: req.user?.email || '' };
    userStore.upsertUser({ ...existing, preferences: mergedPrefs, dietType: mergedPrefs.dietType });

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully.',
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
 */
exports.getFavorites = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('user_favorites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const favoriteFoods = data.map(f => ({
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
      }
    }

    const userStore = require('../services/userStore');
    const local = userStore.findById(userId) || (req.user?.email ? userStore.findByEmail(req.user.email) : null);
    const favoriteFoods = local?.favoriteFoods || [];
    return res.status(200).json({ success: true, count: favoriteFoods.length, favoriteFoods });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/favorites/food
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

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      // Upsert enforces duplicate prevention via UNIQUE constraint on (user_id, food_id)
      await client
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
    }

    trackFeatureUsage('favorites_added', userId).catch(() => {});
    recordBehaviorEvent(userId, {
      type: 'recommendation_favorited',
      foodId,
      foodName,
      cuisine,
      ingredients: food.ingredients
    }).catch(() => {});

    const userStore = require('../services/userStore');
    let local = userStore.findById(userId);
    if (!local) {
      local = userStore.upsertUser({ id: userId, uid: userId, email: req.user?.email || '', favoriteFoods: [] });
    }
    const favs = local.favoriteFoods || [];
    if (!favs.some(f => (f.foodId || f.id) === foodId)) {
      userStore.updateUser(userId, { favoriteFoods: [...favs, { ...food, foodId, id: foodId }] });
    }

    return res.status(200).json({
      success: true,
      message: 'Favorite saved and behavioral affinity updated.',
      foodId
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/favorites/food/:foodId
 */
exports.removeFavoriteFood = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    const foodId = String(req.params?.foodId || req.body?.foodId || '').trim();

    if (!userId || !foodId) {
      return res.status(400).json({ success: false, message: 'User ID and foodId are required.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      await client
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('food_id', foodId);
    }

    trackFeatureUsage('favorites_removed', userId).catch(() => {});
    recordBehaviorEvent(userId, {
      type: 'recommendation_unfavorited',
      foodId
    }).catch(() => {});

    const userStore = require('../services/userStore');
    const local = userStore.findById(userId);
    if (local && local.favoriteFoods) {
      userStore.updateUser(userId, {
        favoriteFoods: local.favoriteFoods.filter(f => (f.foodId || f.id) !== foodId)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Favorite removed and behavioral affinity updated.',
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
 */
exports.getSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('user_search_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        return res.status(200).json({
          success: true,
          count: data.length,
          history: data.map(h => ({
            id: h.id,
            query: h.query,
            filters: h.filters,
            resultCount: h.result_count,
            timestamp: h.created_at
          }))
        });
      }
    }

    const userStore = require('../services/userStore');
    const local = userStore.findById(userId);
    return res.status(200).json({ success: true, count: 0, history: local?.searchHistory || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/search-history
 */
exports.addSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    const { query, filters, resultCount } = req.body || {};

    if (!userId || !query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Valid query is required.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    let inserted = null;

    if (client) {
      const { data } = await client
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

      inserted = data;
    }

    const userStore = require('../services/userStore');
    let local = userStore.findById(userId);
    if (!local) {
      local = userStore.upsertUser({ id: userId, uid: userId, email: req.user?.email || '', searchHistory: [] });
    }
    const currentHist = local.searchHistory || [];
    userStore.updateUser(userId, {
      searchHistory: [{ query: query.trim(), filters: filters || {}, resultCount: parseInt(resultCount, 10) || 0, timestamp: new Date().toISOString() }, ...currentHist].slice(0, 50)
    });

    return res.status(201).json({
      success: true,
      message: 'Search query recorded.',
      search: inserted || { query }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/search-history
 */
exports.clearSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const token = req.token;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    const client = (token ? getUserSupabaseClient(token) : null) || getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      await client
        .from('user_search_history')
        .delete()
        .eq('user_id', userId);
    }

    const userStore = require('../services/userStore');
    userStore.updateUser(userId, { searchHistory: [] });

    return res.status(200).json({
      success: true,
      message: 'Search history cleared successfully.'
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
exports.getMedicalReports    = medicalController.getMedicalReports;
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

exports.syncUser = async (req, res) => {
  try {
    const payload = req.body || {};
    const authUser = req.user;
    const userData = {
      ...payload,
      uid: payload.uid || payload.id || authUser?.uid || authUser?.id,
      email: payload.email || authUser?.email,
      name: payload.name || payload.displayName || authUser?.name
    };

    if (!userData.email && !userData.uid) {
      return res.status(400).json({ success: false, message: 'User uid or email is required for sync' });
    }

    const { upsertUser } = require('../services/userStore');
    const synced = upsertUser(userData);

    // Sync to Supabase public.profiles if client available
    try {
      const client = getSupabaseAdmin() || getSupabaseClient();
      if (client && synced && synced.uid) {
        client.from('profiles').upsert({
          id: synced.uid,
          email: synced.email,
          name: synced.name,
          role: synced.role || 'user',
          diet_type: synced.dietType || 'Vegetarian',
          preferences: synced.preferences || {},
          disabled: Boolean(synced.disabled),
          account_status: synced.accountStatus || 'active'
        }, { onConflict: 'id' }).catch(() => {});
      }
    } catch (_) {}

    // Trigger welcome email asynchronously on new registration
    if (payload.isNewRegistration && !synced.welcomeEmailSent && synced.email) {
      try {
        const brevoService = require('../services/brevoService');
        brevoService.sendWelcomeEmail(synced).catch(err => {
          console.warn('⚠️ [WelcomeEmail] Asynchronous registration dispatch note:', err.message);
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      message: 'User synchronized successfully with admin directory',
      user: synced
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
