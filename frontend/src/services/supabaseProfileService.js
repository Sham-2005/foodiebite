// ─────────────────────────────────────────────────────────────
//  frontend/src/services/supabaseProfileService.js
//  FoodieBite Supabase User Profile Management Service
//  Manages public.profiles records linked to auth.users.
//  Enforces Row Level Security and role immutability.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured, getSupabaseInitError } from '../config/supabaseClient.js';

/**
 * Retrieves the currently authenticated user's profile.
 * 
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function getMyProfile() {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return { success: false, error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable' };
  }

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return { success: false, error: authError?.message || 'No active authenticated session' };
    }

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        ...data,
        createdAtFormatted: data.created_at ? new Date(data.created_at).toLocaleDateString() : null,
        lastLoginFormatted: data.last_login_at ? new Date(data.last_login_at).toLocaleString() : null,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves a user profile by UUID.
 * Subject to RLS: Users can only retrieve their own profile unless admin.
 * 
 * @param {string} userId
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function getProfileById(userId) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return { success: false, error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable' };
  }

  if (!userId) {
    return { success: false, error: 'User ID is required' };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        ...data,
        createdAtFormatted: data.created_at ? new Date(data.created_at).toLocaleDateString() : null,
        lastLoginFormatted: data.last_login_at ? new Date(data.last_login_at).toLocaleString() : null,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Updates the user's full name and display name.
 * 
 * @param {string} fullName
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function updateProfileName(fullName) {
  const cleanName = (fullName || '').trim();
  if (!cleanName) {
    return { success: false, error: 'Name cannot be empty' };
  }

  return updateProfile({
    full_name: cleanName,
    name: cleanName,
  });
}

/**
 * Updates the user's phone number.
 * 
 * @param {string} phoneNumber
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function updateProfilePhone(phoneNumber) {
  return updateProfile({
    phone_number: (phoneNumber || '').trim(),
  });
}

/**
 * Updates the user's avatar / profile picture URL.
 * 
 * @param {string} avatarUrl
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function updateProfileAvatar(avatarUrl) {
  return updateProfile({
    avatar_url: avatarUrl || '',
    profile_picture_url: avatarUrl || '',
  });
}

/**
 * Safely updates non-sensitive user profile details.
 * Strictly prevents modification of role, disabled, or account_status.
 * 
 * @param {object} fields
 * @returns {Promise<{ success: boolean, profile?: any, error?: string }>}
 */
export async function updateProfile(fields = {}) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return { success: false, error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable' };
  }

  // Strip sensitive privilege fields on client-side before sending
  const sanitized = { ...fields };
  delete sanitized.role;
  delete sanitized.disabled;
  delete sanitized.account_status;
  delete sanitized.id;
  delete sanitized.created_at;

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return { success: false, error: 'Authentication required to update profile' };
    }

    const { data, error } = await client
      .from('profiles')
      .update(sanitized)
      .eq('id', authData.user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      profile: {
        ...data,
        createdAtFormatted: data.created_at ? new Date(data.created_at).toLocaleDateString() : null,
        lastLoginFormatted: data.last_login_at ? new Date(data.last_login_at).toLocaleString() : null,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Checks if the current user has verified administrative privileges.
 * Queries public.is_admin() RPC.
 * 
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin() {
  if (!isSupabaseConfigured) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client.rpc('is_admin');
    if (error) return false;
    return Boolean(data);
  } catch (_) {
    return false;
  }
}

/**
 * Helper to extract account creation date.
 */
export function getAccountCreationDate(profile) {
  if (!profile?.created_at) return null;
  return new Date(profile.created_at);
}

/**
 * Helper to extract last login date.
 */
export function getLastLoginDate(profile) {
  if (!profile?.last_login_at && !profile?.last_sign_in_time) return null;
  return new Date(profile.last_login_at || profile.last_sign_in_time);
}

export default {
  getMyProfile,
  getProfileById,
  updateProfileName,
  updateProfilePhone,
  updateProfileAvatar,
  updateProfile,
  checkIsAdmin,
  getAccountCreationDate,
  getLastLoginDate,
};

