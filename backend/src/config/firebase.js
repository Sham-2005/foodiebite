// ─────────────────────────────────────────────────────────────
//  src/config/firebase.js
//  Centralized Firebase Admin & Firestore Singleton Initializer
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let adminInitialized = false;

function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'food-app-3d216';
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (saPath && fs.existsSync(saPath)) {
      const saKey = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(saKey),
        projectId
      });
      console.log(`✅ Firebase Admin initialized with service account certificate for project: ${projectId}`);
    } else {
      admin.initializeApp({
        projectId
      });
      console.log(`ℹ️ Firebase Admin initialized with project config (${projectId})`);
    }
    adminInitialized = true;
  } catch (err) {
    console.error('⚠️ Firebase Admin initialization warning:', err.message);
  }

  return admin;
}

function isFirebaseAdminInitialized() {
  return admin.apps.length > 0;
}

function getFirestoreDb() {
  try {
    getFirebaseAdmin();
    return admin.firestore();
  } catch (err) {
    console.warn('⚠️ Firestore unavailable:', err.message);
    return null;
  }
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminInitialized,
  getFirestoreDb,
  admin
};
