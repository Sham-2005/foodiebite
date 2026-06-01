// ─────────────────────────────────────────────────────────────
//  src/services/firebase.js
//  Initialises Firebase Client SDK (Auth, Firestore)
// ─────────────────────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Check if configured (e.g. project ID is populated with their active database id)
const isFirebaseConfigured = 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID' &&
  firebaseConfig.projectId.trim() !== '';

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase Client SDK initialized successfully with project:', firebaseConfig.projectId);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Client SDK:', error);
  }
} else {
  console.warn(
    '⚠️ Firebase keys are missing or set to placeholder in .env. Running in premium LocalStorage Mock Mode.'
  );
}

export { app, auth, db, isFirebaseConfigured };
