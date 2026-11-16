// ─────────────────────────────────────────────────────────────
//  frontend/src/services/storage.web.js
//  FoodieBite Web Platform Storage Abstraction
//  Backed by window.localStorage with safe fallbacks and JSON helpers
// ─────────────────────────────────────────────────────────────

const memoryFallback = new Map();

function getWebStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof global !== 'undefined' && global.localStorage) {
      return global.localStorage;
    }
  } catch (e) {
    console.warn('localStorage access failed; falling back to memory store:', e.message);
  }
  return null;
}

export async function initStorage() {
  return Promise.resolve();
}

export function isHydrated() {
  return true;
}

export async function getItem(key) {
  try {
    const ws = getWebStorage();
    if (ws) {
      return ws.getItem(key);
    }
    return memoryFallback.has(key) ? memoryFallback.get(key) : null;
  } catch (err) {
    console.warn(`[storage.web] getItem failed for "${key}":`, err.message);
    return null;
  }
}

export function getItemSync(key) {
  try {
    const ws = getWebStorage();
    if (ws) {
      return ws.getItem(key);
    }
    return memoryFallback.has(key) ? memoryFallback.get(key) : null;
  } catch (err) {
    console.warn(`[storage.web] getItemSync failed for "${key}":`, err.message);
    return null;
  }
}

export async function setItem(key, value) {
  const strVal = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  try {
    const ws = getWebStorage();
    if (ws) {
      ws.setItem(key, strVal);
    } else {
      memoryFallback.set(key, strVal);
    }
  } catch (err) {
    console.warn(`[storage.web] setItem failed for "${key}":`, err.message);
  }
}

export function setItemSync(key, value) {
  const strVal = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  try {
    const ws = getWebStorage();
    if (ws) {
      ws.setItem(key, strVal);
    } else {
      memoryFallback.set(key, strVal);
    }
  } catch (err) {
    console.warn(`[storage.web] setItemSync failed for "${key}":`, err.message);
  }
}

export async function removeItem(key) {
  try {
    const ws = getWebStorage();
    if (ws) {
      ws.removeItem(key);
    }
    memoryFallback.delete(key);
  } catch (err) {
    console.warn(`[storage.web] removeItem failed for "${key}":`, err.message);
  }
}

export function removeItemSync(key) {
  try {
    const ws = getWebStorage();
    if (ws) {
      ws.removeItem(key);
    }
    memoryFallback.delete(key);
  } catch (err) {
    console.warn(`[storage.web] removeItemSync failed for "${key}":`, err.message);
  }
}

export async function clear() {
  try {
    const ws = getWebStorage();
    if (ws) {
      ws.clear();
    }
    memoryFallback.clear();
  } catch (err) {
    console.warn('[storage.web] clear failed:', err.message);
  }
}

export async function getAllKeys() {
  try {
    const ws = getWebStorage();
    if (ws) {
      return Object.keys(ws);
    }
    return Array.from(memoryFallback.keys());
  } catch (err) {
    console.warn('[storage.web] getAllKeys failed:', err.message);
    return [];
  }
}

export async function multiGet(keys) {
  if (!Array.isArray(keys)) return [];
  try {
    return keys.map(k => [k, getItemSync(k)]);
  } catch (err) {
    console.warn('[storage.web] multiGet failed:', err.message);
    return keys.map(k => [k, null]);
  }
}

export async function multiSet(keyValuePairs) {
  if (!Array.isArray(keyValuePairs)) return;
  try {
    keyValuePairs.forEach(([k, v]) => setItemSync(k, v));
  } catch (err) {
    console.warn('[storage.web] multiSet failed:', err.message);
  }
}

export async function multiRemove(keys) {
  if (!Array.isArray(keys)) return;
  try {
    keys.forEach(k => removeItemSync(k));
  } catch (err) {
    console.warn('[storage.web] multiRemove failed:', err.message);
  }
}

export async function getJSON(key, defaultValue = null) {
  try {
    const val = await getItem(key);
    if (val === null || val === undefined) return defaultValue;
    return JSON.parse(val);
  } catch (err) {
    console.warn(`[storage.web] Failed to parse JSON for "${key}":`, err.message);
    return defaultValue;
  }
}

export function getJSONSync(key, defaultValue = null) {
  try {
    const val = getItemSync(key);
    if (val === null || val === undefined) return defaultValue;
    return JSON.parse(val);
  } catch (err) {
    console.warn(`[storage.web] Failed to parse JSON synchronously for "${key}":`, err.message);
    return defaultValue;
  }
}

export async function setJSON(key, value) {
  try {
    const serialized = JSON.stringify(value);
    await setItem(key, serialized);
  } catch (err) {
    console.warn(`[storage.web] Failed to stringify JSON for "${key}":`, err.message);
  }
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
