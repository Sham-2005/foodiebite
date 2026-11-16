// ─────────────────────────────────────────────────────────────
//  frontend/src/config/supabaseClient.js
//  FoodieBite Supabase Client (Singleton Initialization)
//  Reads credentials from environment variables safely.
//  Configures platform-appropriate persistent storage:
//    - Web: window.localStorage
//    - Android: @react-native-async-storage/async-storage
//  Note: Firebase remains the active primary database & auth provider.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import storage from '../services/storage.js';

// Canonical FoodieBite Supabase credentials from project configuration
export const DEFAULT_SUPABASE_URL = 'https://wzhxalmixfeqszgwqeqr.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_0U9ivqp4zI4L6uTBVIgDgg_IgQYSIiB';

// Resolve environment variables supporting both NEXT_PUBLIC_ and REACT_APP_ naming
// If bundled in Metro / mobile where process.env is not injected by DefinePlugin, fall back to canonical credentials
const rawSupabaseUrl =
  (typeof process !== 'undefined' && (
    process.env?.NEXT_PUBLIC_SUPABASE_URL ||
    process.env?.REACT_APP_SUPABASE_URL
  )) ||
  '';

const rawSupabaseKey =
  (typeof process !== 'undefined' && (
    process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env?.REACT_APP_SUPABASE_ANON_KEY
  )) ||
  '';

const supabaseUrl = (rawSupabaseUrl && rawSupabaseUrl.trim() !== '' && !rawSupabaseUrl.includes('YOUR_PROJECT_REF'))
  ? rawSupabaseUrl
  : DEFAULT_SUPABASE_URL;

const supabaseKey = (rawSupabaseKey && rawSupabaseKey.trim() !== '' && rawSupabaseKey !== 'YOUR_PUBLISHABLE_KEY')
  ? rawSupabaseKey
  : DEFAULT_SUPABASE_KEY;

// Check if credentials exist and are not default placeholder
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  supabaseKey !== 'YOUR_PUBLISHABLE_KEY' &&
  !supabaseUrl.includes('YOUR_PROJECT_REF')
);

// Resolve platform storage adapter safely:
// - Web: window.localStorage (via storage abstraction)
// - Android / React Native: @react-native-async-storage/async-storage
let platformStorage = storage;

try {
  let isMobile = false;
  try {
    const { Platform } = require('react-native');
    isMobile = Boolean(Platform && Platform.OS !== 'web');
  } catch (_) {}

  if (isMobile) {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
      if (AsyncStorage) {
        platformStorage = AsyncStorage;
      }
    } catch (_) {
      platformStorage = storage;
    }
  }
} catch (_) {
  platformStorage = storage;
}

// Helper to resolve the canonical redirect URL across Web and Mobile
export function getAuthRedirectUrl(path = '') {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    return path ? `${origin}/${path.replace(/^\//, '')}` : origin;
  }
  return path ? `foodiebite://${path.replace(/^\//, '')}` : 'foodiebite://';
}

/**
 * Ensures a WHATWG-compliant URL implementation is active in environments
 * (such as bare React Native / Hermes) where global URL lacks standard properties
 * like .protocol or .hostname required by @supabase/supabase-js.
 */
export function ensureUrlSupport() {
  let needsPolyfill = false;
  try {
    if (typeof URL === 'undefined') {
      needsPolyfill = true;
    } else {
      const test = new URL('https://test.supabase.co/path');
      if (!test.protocol || !test.hostname) {
        needsPolyfill = true;
      }
    }
  } catch (_) {
    needsPolyfill = true;
  }

  if (needsPolyfill) {
    try {
      const { setupURLPolyfill } = require('react-native-url-polyfill');
      if (typeof setupURLPolyfill === 'function') {
        setupURLPolyfill();
      }
    } catch (_) {
      try {
        const { URL: fallbackURL, URLSearchParams: fallbackSearchParams } = require('whatwg-url-without-unicode');
        if (fallbackURL) globalThis.URL = fallbackURL;
        if (fallbackSearchParams) globalThis.URLSearchParams = fallbackSearchParams;
      } catch (_) {}
    }
  }
}

// Ensure URL polyfill immediately on module evaluation
ensureUrlSupport();

// Singleton client instance and last initialization error
let supabaseInstance = null;
let lastInitError = null;

export function getSupabaseInitError() {
  return lastInitError;
}

function initSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!isSupabaseConfigured) {
    lastInitError = 'Supabase credentials are not configured or still have placeholder values in .env';
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '⚠️ [Supabase] Client not initialized: Missing or placeholder environment variables.\n' +
        'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in frontend/.env.'
      );
    }
    return null;
  }

  // Double-check URL polyfill is active before calling createClient
  ensureUrlSupport();

  try {
    const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const hasAuthParams = isWeb &&
      Boolean(window.location && (
        (window.location.hash && window.location.hash.includes('access_token')) ||
        (window.location.search && window.location.search.includes('code='))
      ));

    const clientOptions = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: isWeb ? hasAuthParams : false, // Mobile should never attempt window.location URL parsing
      },
    };

    if (platformStorage && typeof platformStorage.getItem === 'function') {
      clientOptions.auth.storage = platformStorage;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, clientOptions);
    lastInitError = null;

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('🔌 [Supabase] Initialized client for project URL:', supabaseUrl);
    }
    return supabaseInstance;
  } catch (err) {
    lastInitError = err?.message || String(err);
    console.error('❌ [Supabase] Client initialization error:', lastInitError);
    return null;
  }
}

// Initial eager initialization
initSupabaseClient();

/**
 * Returns the singleton Supabase client or null if unconfigured.
 * Automatically attempts lazy initialization if the client is not yet active.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    return initSupabaseClient();
  }
  return supabaseInstance;
}

/**
 * Resilient proxy export for direct `supabase` imports (e.g. `supabase.auth` or `supabase.from`).
 * Guarantees that property access triggers client retrieval/initialization.
 */
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error(`Cannot access supabase.${String(prop)}: Supabase client is unavailable (${lastInitError || 'unconfigured'}).`);
    }
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  }
});

export default supabase;
