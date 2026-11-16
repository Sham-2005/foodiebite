// ─────────────────────────────────────────────────────────────
//  frontend/src/services/storage.android.js
//  FoodieBite Android Platform Storage Abstraction
//  Backed by @react-native-async-storage/async-storage
//  Includes fast in-memory cache for synchronous reads and defensive shims
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryCache = new Map();
let hydrated = false;
let hydrationPromise = null;

/**
 * Hydrates in-memory cache from AsyncStorage on application startup.
 * Prevents race conditions during initial component rendering.
 */
export async function initStorage() {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getAllKeys === 'function') {
        const keys = await AsyncStorage.getAllKeys();
        if (Array.isArray(keys) && keys.length > 0) {
          const pairs = await AsyncStorage.multiGet(keys);
          pairs.forEach(([k, v]) => {
            if (v !== null && v !== undefined) {
              memoryCache.set(k, String(v));
            }
          });
        }
      }
      hydrated = true;
      console.log(`[storage.android] Hydrated ${memoryCache.size} keys from AsyncStorage.`);
    } catch (err) {
      console.warn('[storage.android] initStorage hydration warning:', err.message);
      hydrated = true; // Still allow app execution using cache
    } finally {
      hydrationPromise = null;
    }
  })();

  return hydrationPromise;
}

export function isHydrated() {
  return hydrated;
}

export async function getItem(key) {
  try {
    const val = await AsyncStorage.getItem(key);
    if (val !== null && val !== undefined) {
      memoryCache.set(key, String(val));
      return val;
    }
    // Check fallback in memoryCache if AsyncStorage returned null during transient initialization
    if (memoryCache.has(key)) {
      return memoryCache.get(key);
    }
    return null;
  } catch (err) {
    console.warn(`[storage.android] AsyncStorage.getItem failed for "${key}":`, err.message);
    return memoryCache.has(key) ? memoryCache.get(key) : null;
  }
}

export function getItemSync(key) {
  return memoryCache.has(key) ? memoryCache.get(key) : null;
}

export async function setItem(key, value) {
  const strVal = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  memoryCache.set(key, strVal);
  try {
    await AsyncStorage.setItem(key, strVal);
  } catch (err) {
    console.warn(`[storage.android] AsyncStorage.setItem failed for "${key}":`, err.message);
  }
}

export function setItemSync(key, value) {
  const strVal = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  memoryCache.set(key, strVal);
  AsyncStorage.setItem(key, strVal).catch(err => {
    console.warn(`[storage.android] Background AsyncStorage.setItem failed for "${key}":`, err.message);
  });
}

export async function removeItem(key) {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage.android] AsyncStorage.removeItem failed for "${key}":`, err.message);
  }
}

export function removeItemSync(key) {
  memoryCache.delete(key);
  AsyncStorage.removeItem(key).catch(err => {
    console.warn(`[storage.android] Background AsyncStorage.removeItem failed for "${key}":`, err.message);
  });
}

export async function clear() {
  memoryCache.clear();
  try {
    await AsyncStorage.clear();
  } catch (err) {
    console.warn('[storage.android] AsyncStorage.clear failed:', err.message);
  }
}

export async function getAllKeys() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys || [];
  } catch (err) {
    console.warn('[storage.android] AsyncStorage.getAllKeys failed:', err.message);
    return Array.from(memoryCache.keys());
  }
}

export async function multiGet(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  try {
    return await AsyncStorage.multiGet(keys);
  } catch (err) {
    console.warn('[storage.android] AsyncStorage.multiGet failed:', err.message);
    return keys.map(k => [k, getItemSync(k)]);
  }
}

export async function multiSet(keyValuePairs) {
  if (!Array.isArray(keyValuePairs) || keyValuePairs.length === 0) return;
  keyValuePairs.forEach(([k, v]) => {
    memoryCache.set(k, String(v));
  });
  try {
    await AsyncStorage.multiSet(keyValuePairs);
  } catch (err) {
    console.warn('[storage.android] AsyncStorage.multiSet failed:', err.message);
  }
}

export async function multiRemove(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return;
  keys.forEach(k => memoryCache.delete(k));
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (err) {
    console.warn('[storage.android] AsyncStorage.multiRemove failed:', err.message);
  }
}

export async function getJSON(key, defaultValue = null) {
  try {
    const val = await getItem(key);
    if (val === null || val === undefined) return defaultValue;
    return JSON.parse(val);
  } catch (err) {
    console.warn(`[storage.android] JSON parse failed for "${key}":`, err.message);
    return defaultValue;
  }
}

export function getJSONSync(key, defaultValue = null) {
  try {
    const val = getItemSync(key);
    if (val === null || val === undefined) return defaultValue;
    return JSON.parse(val);
  } catch (err) {
    console.warn(`[storage.android] JSON parse sync failed for "${key}":`, err.message);
    return defaultValue;
  }
}

export async function setJSON(key, value) {
  try {
    const serialized = JSON.stringify(value);
    await setItem(key, serialized);
  } catch (err) {
    console.warn(`[storage.android] JSON stringify failed for "${key}":`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Defensive global.localStorage shim
// Guarantees zero unhandled ReferenceError if third-party modules access localStorage
// ─────────────────────────────────────────────────────────────
if (typeof global !== 'undefined') {
  try {
    const shim = {
      getItem: (k) => getItemSync(k),
      setItem: (k, v) => setItemSync(k, v),
      removeItem: (k) => removeItemSync(k),
      clear: () => {
        memoryCache.clear();
        AsyncStorage.clear().catch(() => {});
      },
      key: (i) => Array.from(memoryCache.keys())[i] || null,
      get length() {
        return memoryCache.size;
      }
    };

    if (!global.localStorage) {
      global.localStorage = shim;
    }
    if (!global.sessionStorage) {
      global.sessionStorage = shim;
    }
  } catch (_) {}
}

const storage = {
  initStorage,
  isHydrated,
  getItem,
  getItemSync,
  setItem,
  setItemSync,
  removeItem,
  removeItemSync,
  clear,
  getAllKeys,
  multiGet,
  multiSet,
  multiRemove,
  getJSON,
  getJSONSync,
  setJSON
};

export default storage;
