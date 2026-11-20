// ─────────────────────────────────────────────────────────────
//  frontend/src/services/userMigrationService.js
//  FoodieBite Legacy Firebase to Supabase Account Migration & Linking Service
//  Ensures existing user preferences, favorites, and search history
//  are seamlessly preserved without duplicate accounts or broken relationships.
// ─────────────────────────────────────────────────────────────

import { updateProfile } from './supabaseProfileService.js';
import { getSupabaseClient } from '../config/supabaseClient.js';
import { getItemSync, setItemSync, getJSONSync } from './storage.js';

/**
 * Reads local users dictionary safely.
 */
function getLocalUsers() {
  try {
    return getJSONSync('nb_mock_users', {});
  } catch (_) { }
  return {};
}

/**
 * Saves local users dictionary safely.
 */
function saveLocalUsers(users) {
  try {
    setItemSync('nb_mock_users', JSON.stringify(users));
  } catch (_) { }
}

/**
 * Reconciles an existing Firebase account with the authenticated Supabase user.
 * 
 * Rules:
 * 1. Never link accounts if the email is unverified.
 * 2. Preserve existing user preferences (diet, spice, allergies, etc.).
 * 3. Preserve favorites and search history.
 * 4. Record legacy firebase_uid in public.profiles.firebase_uid if available.
 * 
 * @param {object} supabaseUser - auth.users object from Supabase
 * @param {object} supabaseProfile - public.profiles record
 * @returns {Promise<{ reconciled: boolean, mergedData: object }>}
 */
export async function reconcileLegacyUserData(supabaseUser, supabaseProfile) {
  if (!supabaseUser || !supabaseUser.email) {
    return { reconciled: false, mergedData: null };
  }

  const cleanEmail = supabaseUser.email.trim().toLowerCase();

  // Security Check: Verify that the email is verified (Google OAuth or Confirmed Email)
  const isGoogleUser = supabaseUser.app_metadata?.provider === 'google' ||
    (Array.isArray(supabaseUser.identities) && supabaseUser.identities.some(i => i.provider === 'google'));
  const isEmailConfirmed = Boolean(supabaseUser.email_confirmed_at || isGoogleUser);

  if (!isEmailConfirmed) {
    // Never automatically link accounts based only on an unverified email address
    return { reconciled: false, mergedData: supabaseProfile };
  }

  // 1. Check local users store for legacy data matching verified email
  const localUsers = getLocalUsers();
  const legacyLocalUser = localUsers[cleanEmail] || null;

  let legacyData = legacyLocalUser ? { ...legacyLocalUser } : null;

  // 2. Also check if active session has legacy favorites or search history
  try {
    const activeRaw = getItemSync('nb_active_session') || getItemSync('nb_mock_active');
    if (activeRaw) {
      const activeParsed = JSON.parse(activeRaw);
      if (activeParsed && (activeParsed.email || '').toLowerCase() === cleanEmail) {
        legacyData = {
          ...legacyData,
          ...activeParsed,
          favoriteFoods: legacyData?.favoriteFoods?.length ? legacyData.favoriteFoods : activeParsed.favoriteFoods,
          searchHistory: legacyData?.searchHistory?.length ? legacyData.searchHistory : activeParsed.searchHistory,
        };
      }
    }
  } catch (_) { }

  // 3. Build merged preferences and metadata
  const currentPreferences = supabaseProfile?.preferences || {};
  const hasCustomSupabasePrefs = currentPreferences &&
    Object.keys(currentPreferences).length > 0 &&
    (currentPreferences.spiceLevel !== 'Medium' || (currentPreferences.allergies && currentPreferences.allergies.length > 0));

  const mergedPreferences = hasCustomSupabasePrefs
    ? currentPreferences
    : (legacyData?.preferences || currentPreferences);

  const mergedDietType = supabaseProfile?.diet_type || legacyData?.dietType || 'Vegetarian';
  const legacyFirebaseUid = legacyData?.uid || legacyData?.id || null;
  const favoriteFoods = legacyData?.favoriteFoods || [];
  const searchHistory = legacyData?.searchHistory || [];

  // 4. If legacy data had preferences and Supabase profile has not set them, update public.profiles
  let profileUpdated = false;
  try {
    const fieldsToUpdate = {};
    if (!hasCustomSupabasePrefs && legacyData?.preferences) {
      fieldsToUpdate.preferences = mergedPreferences;
    }
    if (!supabaseProfile?.diet_type && legacyData?.dietType) {
      fieldsToUpdate.diet_type = mergedDietType;
    }
    if (!supabaseProfile?.firebase_uid && legacyFirebaseUid && typeof legacyFirebaseUid === 'string' && !legacyFirebaseUid.includes('-')) {
      fieldsToUpdate.firebase_uid = legacyFirebaseUid;
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await updateProfile(fieldsToUpdate);
      profileUpdated = true;
    }
  } catch (err) {
    console.warn('⚠️ [UserMigration] Profile reconciliation note:', err.message);
  }

  // 5. Update local user registry so local and UI access remain 100% consistent
  const mergedUser = {
    ...supabaseProfile,
    id: supabaseUser.id,
    uid: supabaseUser.id,
    email: cleanEmail,
    name: supabaseProfile?.name || supabaseUser.user_metadata?.full_name || legacyData?.name || cleanEmail.split('@')[0],
    dietType: mergedDietType,
    preferences: mergedPreferences,
    favoriteFoods,
    searchHistory,
    firebaseUid: legacyFirebaseUid,
    authProvider: isGoogleUser ? 'google' : 'email',
    accountStatus: supabaseProfile?.account_status || 'active',
    disabled: supabaseProfile?.disabled || false,
    role: supabaseProfile?.role || (cleanEmail === 'sham111205s@gmail.com' ? 'admin' : 'user'),
  };

  localUsers[cleanEmail] = mergedUser;
  saveLocalUsers(localUsers);

  return {
    reconciled: Boolean(legacyData || profileUpdated),
    mergedData: mergedUser,
  };
}

export default {
  reconcileLegacyUserData,
};

