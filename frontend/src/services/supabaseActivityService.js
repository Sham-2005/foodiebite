// ─────────────────────────────────────────────────────────────
//  frontend/src/services/supabaseActivityService.js
//  FoodieBite Supabase Authentication Activity Logging Service
//  Tracks login, logout, and session lifecycle events securely.
//  Note: Passwords, tokens, and credentials are NEVER stored.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured, getSupabaseInitError } from '../config/supabaseClient.js';

/**
 * Detects current runtime platform safely.
 * @returns {'web' | 'android' | 'ios' | 'unknown'}
 */
export function detectPlatform() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'web';
  }
  try {
    const { Platform } = require('react-native');
    if (Platform && Platform.OS) {
      return Platform.OS === 'android' ? 'android' : (Platform.OS === 'ios' ? 'ios' : 'web');
    }
  } catch (_) {}
  return 'web';
}

/**
 * Sanitizes metadata to strictly strip any sensitive parameters.
 * @param {Record<string, any>} metadata
 * @returns {Record<string, any>}
 */
function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};
  const cleaned = { ...metadata };
  const forbiddenKeys = [
    'password', 'pass', 'pwd', 'confirmPassword',
    'token', 'access_token', 'accessToken', 'refreshToken', 'refresh_token',
    'secret', 'apiKey', 'api_key', 'credential', 'auth_token'
  ];

  forbiddenKeys.forEach(key => {
    delete cleaned[key];
  });

  return cleaned;
}

/**
 * Logs an authentication event to public.auth_activity_logs.
 * 
 * @param {object} params
 * @param {'login_success' | 'logout_explicit' | 'token_refreshed' | 'password_reset_requested' | 'password_reset_completed' | 'signup_completed' | 'login_failed' | 'session_expired'} params.eventType
 * @param {'email' | 'google' | 'apple' | 'anonymous' | 'system'} [params.provider='email']
 * @param {'web' | 'android' | 'ios' | 'backend' | 'unknown'} [params.platform]
 * @param {Record<string, any>} [params.metadata={}]
 * @returns {Promise<{ success: boolean, logId?: string, error?: string }>}
 */
export async function logAuthEvent({
  eventType,
  provider = 'email',
  platform,
  metadata = {},
}) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return { success: false, error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable' };
  }

  const resolvedPlatform = platform || detectPlatform();
  const safeMetadata = sanitizeMetadata(metadata);

  try {
    // 1. Preferred method: Security Definer RPC (public.log_auth_event)
    const { data: rpcData, error: rpcError } = await client.rpc('log_auth_event', {
      p_event_type: eventType,
      p_provider: provider,
      p_platform: resolvedPlatform,
      p_metadata: safeMetadata,
    });

    if (!rpcError && rpcData) {
      return { success: true, logId: rpcData };
    }

    // 2. Fallback: Direct insert if RPC is pending or user has direct permission
    const user = (await client.auth.getUser())?.data?.user;
    if (user?.id) {
      const { data: insertData, error: insertError } = await client
        .from('auth_activity_logs')
        .insert({
          user_id: user.id,
          event_type: eventType,
          provider,
          platform: resolvedPlatform,
          metadata: safeMetadata,
        })
        .select('id')
        .single();

      if (!insertError && insertData) {
        return { success: true, logId: insertData.id };
      }
    }

    return {
      success: false,
      error: rpcError?.message || 'Failed to record auth activity log',
    };
  } catch (err) {
    // Audit logging should never crash the main application flow
    console.warn('⚠️ [Supabase Auth Activity] Logging note:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Convenience helper to log successful logins.
 */
export async function logLoginSuccess(provider = 'email', metadata = {}) {
  return logAuthEvent({
    eventType: 'login_success',
    provider,
    metadata,
  });
}

/**
 * Convenience helper to log explicit user logouts.
 * Strictly distinct from passive session expiration.
 */
export async function logExplicitLogout(metadata = {}) {
  return logAuthEvent({
    eventType: 'logout_explicit',
    provider: 'system',
    metadata,
  });
}

/**
 * Convenience helper to log passive session expiration.
 */
export async function logSessionExpired(metadata = {}) {
  return logAuthEvent({
    eventType: 'session_expired',
    provider: 'system',
    metadata,
  });
}

/**
 * Retrieves the authenticated user's activity logs.
 * RLS enforces that non-admin users only see their own records.
 * 
 * @param {number} [limit=20]
 * @returns {Promise<{ success: boolean, logs?: any[], error?: string }>}
 */
export async function getUserActivityLogs(limit = 20) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', logs: [] };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return { success: false, error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable', logs: [] };
  }

  try {
    const { data, error } = await client
      .from('auth_activity_logs')
      .select('id, event_type, provider, platform, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message, logs: [] };
    }

    return { success: true, logs: data || [] };
  } catch (err) {
    return { success: false, error: err.message, logs: [] };
  }
}

export default {
  logAuthEvent,
  logLoginSuccess,
  logExplicitLogout,
  logSessionExpired,
  getUserActivityLogs,
  detectPlatform,
};

