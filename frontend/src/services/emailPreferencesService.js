// ─────────────────────────────────────────────────────────────
//  frontend/src/services/emailPreferencesService.js
//  FoodieBite Automated Email System & Preferences Client Service
//  Interacts directly with Supabase email_preferences & email_delivery_logs
//  Zero Firebase, zero Cloudinary. Supabase is single source of truth.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured, getSupabaseInitError } from '../config/supabaseClient.js';
import { API_BASE_URL } from '../config/apiConfig.js';

const API_BASE = API_BASE_URL;

async function getAuthHeader() {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) {
        return { 'Authorization': `Bearer ${data.session.access_token}` };
      }
    } catch (_) {}
  }
  return {};
}

async function requestBackend(endpoint, method = 'GET', body = null) {
  const authHeaders = await getAuthHeader();
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  return await res.json();
}

const DEFAULT_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch (_) {
    return 'Asia/Kolkata';
  }
})();

const DEFAULT_PREFERENCES = {
  email_enabled: true,
  daily_email_enabled: true,
  preferred_delivery_time: '09:00',
  timezone: DEFAULT_TIMEZONE,
  welcome_email_sent: false,
};

/**
 * Retrieves the current user's email preferences from Supabase.
 * Automatically provisions defaults if no record exists yet.
 * 
 * @param {string} [providedUserId]
 * @returns {Promise<{ success: boolean, preferences?: object, error?: string }>}
 */
export async function getEmailPreferences(providedUserId) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: getSupabaseInitError() || 'Supabase unavailable' };
  }

  try {
    let userId = providedUserId;
    if (!userId) {
      const { data: authData } = await client.auth.getUser();
      userId = authData?.user?.id;
    }

    if (!userId) {
      return { success: false, error: 'User is not authenticated' };
    }

    const { data, error } = await client
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('⚠️ Supabase getEmailPreferences error:', error.message);
      // Fallback: attempt backend API endpoint
      try {
        const backendRes = await requestBackend('/email/preferences', 'GET');
        if (backendRes && backendRes.preferences) {
          return { success: true, preferences: backendRes.preferences };
        }
      } catch (_) {}
      return { success: false, error: error.message };
    }

    if (!data) {
      // Auto-provision initial preferences record for user
      const initialPrefs = {
        user_id: userId,
        ...DEFAULT_PREFERENCES,
        timezone: DEFAULT_TIMEZONE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await client
        .from('email_preferences')
        .insert(initialPrefs)
        .select()
        .single();

      if (insertError) {
        console.warn('⚠️ Could not provision default email preferences:', insertError.message);
        return { success: true, preferences: initialPrefs };
      }

      return { success: true, preferences: inserted };
    }

    return { success: true, preferences: data };
  } catch (err) {
    console.error('❌ getEmailPreferences error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Updates the user's email preferences in Supabase.
 * 
 * @param {object} updates - Fields to update (e.g. daily_email_enabled, preferred_delivery_time, timezone)
 * @param {string} [providedUserId]
 * @returns {Promise<{ success: boolean, preferences?: object, error?: string }>}
 */
export async function updateEmailPreferences(updates, providedUserId) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: getSupabaseInitError() || 'Supabase unavailable' };
  }

  try {
    let userId = providedUserId;
    if (!userId) {
      const { data: authData } = await client.auth.getUser();
      userId = authData?.user?.id;
    }

    if (!userId) {
      return { success: false, error: 'User is not authenticated' };
    }

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('email_preferences')
      .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.warn('⚠️ Supabase updateEmailPreferences error, attempting backend sync:', error.message);
      try {
        const backendRes = await requestBackend('/email/preferences', 'PUT', payload);
        if (backendRes && backendRes.preferences) {
          return { success: true, preferences: backendRes.preferences };
        }
      } catch (_) {}
      return { success: false, error: error.message };
    }

    // Background sync to backend API if alive
    try {
      requestBackend('/email/preferences', 'PUT', payload).catch(() => {});
    } catch (_) {}

    return { success: true, preferences: data };
  } catch (err) {
    console.error('❌ updateEmailPreferences error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Triggers the one-time welcome email for a user upon registration.
 * Backend and Edge Function guarantee idempotency (sent only once).
 * 
 * @param {object} user - { id, email, name, preferences }
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
 */
export async function triggerWelcomeEmail(user) {
  if (!user || !user.email) {
    return { success: false, error: 'Missing user email' };
  }

  try {
    // 1. First attempt backend API route
    const res = await requestBackend('/email/welcome', 'POST', {
      user: {
        id: user.id || user.uid,
        email: user.email,
        name: user.name || user.full_name || user.user_metadata?.name || user.email.split('@')[0],
        dietType: user.dietType,
        cuisines: user.cuisines,
        city: user.city,
      }
    });

    if (res && res.success) {
      return { success: true, skipped: Boolean(res.skipped) };
    }
  } catch (backendErr) {
    console.warn('⚠️ Backend /api/email/welcome route unavailable, falling back to Supabase client:', backendErr.message);
  }

  // 2. Fallback: Check if Supabase client can invoke edge function
  const client = getSupabaseClient();
  if (client && client.functions) {
    try {
      const { data, error } = await client.functions.invoke('welcome-email', {
        body: {
          user_id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
        }
      });
      if (!error && data?.success) {
        return { success: true, skipped: Boolean(data.skipped) };
      }
    } catch (_) {}
  }

  return { success: false, error: 'Could not dispatch welcome email via available channels' };
}

/**
 * Sends a test daily recommendation email to the current user immediately.
 * 
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function sendTestDailyEmail() {
  try {
    const res = await requestBackend('/email/daily-trigger', 'POST', { force: true });
    if (res && res.success) {
      return { success: true, message: res.message || 'Daily recommendation test email sent!' };
    }
    return { success: false, error: res?.message || 'Failed to dispatch test daily email' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error triggering test email' };
  }
}

/**
 * Retrieves delivery logs for the user to verify status (welcome sent, daily sent date, etc.)
 * 
 * @param {string} [providedUserId]
 * @returns {Promise<{ success: boolean, logs?: Array<object>, error?: string }>}
 */
export async function getEmailDeliveryLogs(providedUserId) {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase unavailable' };
  }

  try {
    let userId = providedUserId;
    if (!userId) {
      const { data: authData } = await client.auth.getUser();
      userId = authData?.user?.id;
    }

    if (!userId) return { success: false, error: 'User is not authenticated' };

    const { data, error } = await client
      .from('email_delivery_logs')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(10);

    if (error) return { success: false, error: error.message };
    return { success: true, logs: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  getEmailPreferences,
  updateEmailPreferences,
  triggerWelcomeEmail,
  sendTestDailyEmail,
  getEmailDeliveryLogs,
};
