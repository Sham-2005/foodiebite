// ─────────────────────────────────────────────────────────────
//  frontend/src/services/storage.js
//  FoodieBite Universal Storage Dispatcher (ES Module)
//  Delegates to storage.web.js in universal/web/Node environments.
//  Metro automatically resolves storage.android.js on native Android.
// ─────────────────────────────────────────────────────────────

import * as webModule from './storage.web.js';

const resolved = webModule.default || webModule;

export const initStorage = resolved.initStorage;
export const isHydrated = resolved.isHydrated;
export const getItem = resolved.getItem;
export const getItemSync = resolved.getItemSync;
export const setItem = resolved.setItem;
export const setItemSync = resolved.setItemSync;
export const removeItem = resolved.removeItem;
export const removeItemSync = resolved.removeItemSync;
export const clear = resolved.clear;
export const getAllKeys = resolved.getAllKeys;
export const multiGet = resolved.multiGet;
export const multiSet = resolved.multiSet;
export const multiRemove = resolved.multiRemove;
export const getJSON = resolved.getJSON;
export const getJSONSync = resolved.getJSONSync;
export const setJSON = resolved.setJSON;

export default resolved;
