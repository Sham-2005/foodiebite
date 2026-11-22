// ─────────────────────────────────────────────────────────────
//  frontend/src/config/apiConfig.js
//  FoodieBite Single Source of Truth for Backend API Configuration
//  Unifies Web and Android to use https://foodiebite-backend.onrender.com
// ─────────────────────────────────────────────────────────────

let Platform = { OS: 'web' };
try {
  Platform = require('react-native').Platform || Platform;
} catch (_) {}

/**
 * Canonical Render Production Backend URL
 * Single source of truth across Web and Android
 */
export const PRODUCTION_BACKEND_URL = 'https://foodiebite-backend.onrender.com';
export const LOCAL_BACKEND_URL = 'http://localhost:5000';
export const ANDROID_EMULATOR_BACKEND_URL = 'http://10.0.2.2:5000';

/**
 * Reads any environment variable override safely
 */
function getRawEnvApiUrl() {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.REACT_APP_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      ''
    );
  }
  return '';
}

/**
 * Resolves the root backend base URL (without /api suffix)
 * Handles Web (localhost vs production GitHub Pages / custom domains)
 * and Android (emulator vs production native app).
 */
export function resolveBackendBaseUrl() {
  const rawEnv = getRawEnvApiUrl().trim();
  const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const isAndroid = Platform?.OS === 'android';

  // 1. If explicit environment variable is set
  if (rawEnv !== '') {
    const stripped = rawEnv.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    
    // Safety guard: if running on production Web or production Android, never allow localhost leaks
    if (isWeb && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && stripped.includes('localhost')) {
      return PRODUCTION_BACKEND_URL;
    }
    if (isAndroid && typeof __DEV__ !== 'undefined' && !__DEV__ && stripped.includes('localhost')) {
      return PRODUCTION_BACKEND_URL;
    }
    return stripped;
  }

  // 2. Web Runtime Environment Resolution
  if (isWeb && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return LOCAL_BACKEND_URL;
    }
    // Remote domain (e.g. GitHub Pages https://sham-2005.github.io or custom domain)
    return PRODUCTION_BACKEND_URL;
  }

  // 3. Android / Mobile Runtime Environment Resolution
  if (isAndroid) {
    // In local development on Android emulator with explicit dev flag
    if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof process !== 'undefined' && process.env?.USE_LOCAL_BACKEND === 'true') {
      return ANDROID_EMULATOR_BACKEND_URL;
    }
    // Default for Android production APK is always Render production backend
    return PRODUCTION_BACKEND_URL;
  }

  // Fallback default is Render production backend
  return PRODUCTION_BACKEND_URL;
}

// Canonical static/runtime resolved instances
export const BACKEND_BASE_URL = resolveBackendBaseUrl();
export const API_BASE_URL = `${BACKEND_BASE_URL}/api`;

/**
 * Dynamic getters ensuring live evaluation
 */
export function getBackendBaseUrl() {
  return resolveBackendBaseUrl();
}

export function getApiBaseUrl() {
  return `${resolveBackendBaseUrl()}/api`;
}

/**
 * Helper to construct a full API URL
 * @param {string} endpoint - e.g. '/foods/search' or 'foods/search'
 * @returns {string} - e.g. 'https://foodiebite-backend.onrender.com/api/foods/search'
 */
export function getApiUrl(endpoint = '') {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${getApiBaseUrl()}${clean}`;
}

/**
 * Helper to construct a full backend root URL (for uploads, static assets, etc.)
 * @param {string} path - e.g. '/uploads/image.png'
 * @returns {string} - e.g. 'https://foodiebite-backend.onrender.com/uploads/image.png'
 */
export function getBackendUrl(path = '') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${getBackendBaseUrl()}${clean}`;
}

export function isProductionEnvironment() {
  const base = resolveBackendBaseUrl();
  return base === PRODUCTION_BACKEND_URL;
}

export default {
  PRODUCTION_BACKEND_URL,
  LOCAL_BACKEND_URL,
  ANDROID_EMULATOR_BACKEND_URL,
  BACKEND_BASE_URL,
  API_BASE_URL,
  resolveBackendBaseUrl,
  getBackendBaseUrl,
  getApiBaseUrl,
  getApiUrl,
  getBackendUrl,
  isProductionEnvironment
};
