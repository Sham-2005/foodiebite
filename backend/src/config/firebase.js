// ─────────────────────────────────────────────────────────────
//  backend/src/config/firebase.js
//  Firebase has been completely decommissioned across FoodieBite.
//  Supabase is the sole authentication and database platform.
//  This module provides safe, null/no-op stubs with zero external SDK calls.
// ─────────────────────────────────────────────────────────────

const admin = {
  apps: [],
  initializeApp: () => admin,
  auth: () => null,
  firestore: () => null,
  storage: () => null
};

function getFirebaseAdmin() {
  return null;
}

function isFirebaseAdminInitialized() {
  return false;
}

function getFirestoreDb() {
  return null;
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminInitialized,
  getFirestoreDb,
  admin
};
