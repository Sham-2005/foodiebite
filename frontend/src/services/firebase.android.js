// ─────────────────────────────────────────────────────────────
//  frontend/src/services/firebase.android.js
//  Firebase has been completely decommissioned in FoodieBite.
//  Supabase is the sole authentication and database platform.
// ─────────────────────────────────────────────────────────────

export const isFirebaseConfigured = false;
export const app = null;
export const auth = null;
export const db = null;
export const storage = null;

export const collection = () => null;
export const doc = () => null;
export const query = () => null;
export const where = () => null;
export const orderBy = () => null;
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const getDocs = async () => ({ docs: [], empty: true, forEach: () => {} });
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const onSnapshot = () => () => {};
export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (...items) => items;
export const arrayRemove = (...items) => items;

export default {
  isFirebaseConfigured,
  app,
  auth,
  db,
  storage,
};
