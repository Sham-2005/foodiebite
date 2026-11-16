// ─────────────────────────────────────────────────────────────
//  frontend/src/services/supabaseService.js
//  FoodieBite Supabase Unified Service Hub
//  Exposes connection testing, demo query, authentication,
//  profile management, and activity logging services.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY } from '../config/supabaseClient.js';
import { fetchDemoFoods } from './demoFoodService.js';
import * as authService from './supabaseAuthService.js';
import * as profileService from './supabaseProfileService.js';
import * as activityService from './supabaseActivityService.js';

export { fetchDemoFoods };
export { authService, profileService, activityService };

// Re-export common auth methods
export const {
  registerWithEmail,
  loginWithEmail,
  signInWithGoogleOAuth,
  signInWithGoogleIdToken,
  handleOAuthCallback,
  logout,
  getCurrentUser,
  getCurrentSession,
  resetPassword,
  updatePassword,
  resendVerificationEmail,
  onAuthStateChange,
} = authService;

// Re-export common profile methods
export const {
  getMyProfile,
  getProfileById,
  updateProfileName,
  updateProfilePhone,
  updateProfileAvatar,
  updateProfile,
  checkIsAdmin,
} = profileService;

// Re-export common activity methods
export const {
  logAuthEvent,
  logLoginSuccess,
  logExplicitLogout,
  logSessionExpired,
  getUserActivityLogs,
} = activityService;

/**
 * Tests connection to the remote Supabase project.
 * Pings the official Supabase Auth health endpoint (/auth/v1/health) with timeout
 * and categorized diagnostic errors (DNS, timeout, TLS, HTTP status).
 * Also safely verifies the 'connection_test' table if accessible.
 * 
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{
 *   connected: boolean,
 *   status: 'Connected' | 'Connection Failed' | 'Configuration Missing',
 *   message: string,
 *   latencyMs?: number,
 *   data?: any,
 *   errorCode?: string,
 *   httpStatus?: number
 * }>}
 */
export async function testSupabaseConnection(timeoutMs = 8000) {
  const startTime = Date.now();

  if (!isSupabaseConfigured) {
    return {
      connected: false,
      status: 'Configuration Missing',
      message: 'Supabase credentials are not configured or still have placeholder values in .env.',
      latencyMs: 0,
    };
  }

  const client = getSupabaseClient();
  const targetUrl = (client && client.supabaseUrl) || DEFAULT_SUPABASE_URL;
  const targetKey = (client && client.supabaseKey) || DEFAULT_SUPABASE_KEY;

  if (!targetUrl || !targetKey) {
    return {
      connected: false,
      status: 'Configuration Missing',
      message: 'Supabase URL or API key is missing.',
      latencyMs: 0,
    };
  }

  const healthUrl = `${targetUrl.replace(/\/$/, '')}/auth/v1/health`;

  // 1. Check network connectivity & health against Supabase Auth endpoint
  try {
    let controller = null;
    let timer = null;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => {
        try { controller.abort(); } catch (_) {}
      }, timeoutMs);
    }

    const fetchOptions = {
      method: 'GET',
      headers: {
        'apikey': targetKey,
        'Authorization': `Bearer ${targetKey}`,
      },
    };

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(healthUrl, fetchOptions);
    if (timer) clearTimeout(timer);

    const latencyMs = Date.now() - startTime;
    const status = response.status;

    if (status === 200) {
      // Auth endpoint reachable; check database table optionally if client is initialized
      let dbData = null;
      let dbNote = '';
      if (client && typeof client.from === 'function') {
        try {
          const { data: tableData, error: dbError } = await client
            .from('connection_test')
            .select('*')
            .limit(1);

          if (!dbError && tableData) {
            dbData = tableData;
            dbNote = ' and verified connection_test table';
          }
        } catch (_) {
          // PostgREST errors do not negate valid Auth connectivity
        }
      }

      return {
        connected: true,
        status: 'Connected',
        message: `Successfully connected to Supabase Auth service${dbNote}.`,
        latencyMs,
        httpStatus: 200,
        data: dbData,
      };
    }

    // Specific HTTP status code diagnostics
    if (status === 401 || status === 403) {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'UNAUTHORIZED',
        httpStatus: status,
        message: `Supabase rejected request (HTTP ${status}): Invalid or unauthorized API key.`,
        latencyMs,
      };
    }

    if (status === 404) {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'NOT_FOUND',
        httpStatus: 404,
        message: `Supabase auth endpoint not found (HTTP 404) at ${healthUrl}. Please verify project URL.`,
        latencyMs,
      };
    }

    if (status >= 500) {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'SERVER_ERROR',
        httpStatus: status,
        message: `Supabase project returned server error (HTTP ${status}). Project may be paused or restarting.`,
        latencyMs,
      };
    }

    return {
      connected: false,
      status: 'Connection Failed',
      errorCode: 'HTTP_ERROR',
      httpStatus: status,
      message: `Supabase returned unexpected HTTP status ${status}.`,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const msg = (err && err.message) ? err.message : String(err);
    const code = (err && err.code) ? err.code : '';

    if (err.name === 'AbortError' || /timeout|etimedout/i.test(msg) || code === 'ETIMEDOUT') {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'TIMEOUT',
        message: `Connection timed out after ${timeoutMs}ms attempting to reach Supabase. Check internet connectivity.`,
        latencyMs,
      };
    }

    if (/enotfound|getaddrinfo|name_not_resolved/i.test(msg) || code === 'ENOTFOUND') {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'DNS_FAILURE',
        message: 'DNS lookup failed: Unable to resolve Supabase project host.',
        latencyMs,
      };
    }

    if (/certificate|ssl|tls|handshake|self signed/i.test(msg) || /CERT_/i.test(code)) {
      return {
        connected: false,
        status: 'Connection Failed',
        errorCode: 'TLS_FAILURE',
        message: `Secure TLS/SSL connection failed: ${msg}`,
        latencyMs,
      };
    }

    return {
      connected: false,
      status: 'Connection Failed',
      errorCode: 'NETWORK_ERROR',
      message: `Network error attempting to reach Supabase: ${msg}`,
      latencyMs,
    };
  }
}

/**
 * Fetches rows from the 'connection_test' table.
 * 
 * @returns {Promise<{ success: boolean, data?: any[], error?: string }>}
 */
export async function fetchConnectionTest() {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured in .env',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabase client unavailable',
    };
  }

  try {
    const { data, error } = await client
      .from('connection_test')
      .select('*')
      .order('tested_at', { ascending: false })
      .limit(5);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

export default {
  testSupabaseConnection,
  fetchConnectionTest,
  fetchDemoFoods,
  ...authService,
  ...profileService,
  ...activityService,
};
