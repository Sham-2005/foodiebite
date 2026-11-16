// ─────────────────────────────────────────────────────────────
//  frontend/src/services/localStoragePolyfill.js
//  Backward-compatibility bridge delegating to the centralized storage service.
// ─────────────────────────────────────────────────────────────

import storage, { initStorage } from './storage.js';

export async function hydrateLocalStorage() {
  await initStorage();
}

export default storage;
