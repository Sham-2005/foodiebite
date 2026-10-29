import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth,
  signInWithEmailAndPassword as webSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as webCreateUserWithEmailAndPassword,
  signOut as webSignOut,
  onAuthStateChanged as webOnAuthStateChanged,
  sendPasswordResetEmail as webSendPasswordResetEmail,
  signInWithPopup as webSignInWithPopup,
  signInWithCredential as webSignInWithCredential,
  GoogleAuthProvider as webGoogleAuthProvider,
  updatePassword as webUpdatePassword,
  updateProfile as webUpdateProfile,
  sendEmailVerification as webSendEmailVerification
} from 'firebase/auth';
import { 
  getFirestore,
  collection as webCollection,
  doc as webDoc,
  query as webQuery,
  where as webWhere,
  orderBy as webOrderBy,
  getDoc as webGetDoc,
  getDocs as webGetDocs,
  setDoc as webSetDoc,
  updateDoc as webUpdateDoc,
  deleteDoc as webDeleteDoc,
  onSnapshot as webOnSnapshot,
  arrayUnion as webArrayUnion,
  arrayRemove as webArrayRemove,
  serverTimestamp as webServerTimestamp
} from 'firebase/firestore';
import {
  getStorage,
  ref as webStorageRef,
  uploadBytes as webUploadBytes,
  uploadBytesResumable as webUploadBytesResumable,
  getDownloadURL as webGetDownloadURL,
  deleteObject as webDeleteObject
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const isFirebaseConfigured = 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== 'YOUR_FIREBASE_PROJECT_ID' &&
  firebaseConfig.projectId.trim() !== '';

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('❌ Web Firebase init failed:', error);
  }
}

export { app, auth, db, storage, isFirebaseConfigured };

// Firestore exports
export {
  webCollection as collection,
  webDoc as doc,
  webQuery as query,
  webWhere as where,
  webOrderBy as orderBy,
  webGetDoc as getDoc,
  webGetDocs as getDocs,
  webSetDoc as setDoc,
  webUpdateDoc as updateDoc,
  webDeleteDoc as deleteDoc,
  webOnSnapshot as onSnapshot,
  webArrayUnion as arrayUnion,
  webArrayRemove as arrayRemove,
  webServerTimestamp as serverTimestamp
};

// Storage exports
export {
  webStorageRef as ref,
  webUploadBytes as uploadBytes,
  webUploadBytesResumable as uploadBytesResumable,
  webGetDownloadURL as getDownloadURL,
  webDeleteObject as deleteObject
};

// Auth exports
export {
  webSignInWithEmailAndPassword as signInWithEmailAndPassword,
  webCreateUserWithEmailAndPassword as createUserWithEmailAndPassword,
  webSignOut as signOut,
  webOnAuthStateChanged as onAuthStateChanged,
  webSendPasswordResetEmail as sendPasswordResetEmail,
  webSignInWithPopup as signInWithPopup,
  webSignInWithCredential as signInWithCredential,
  webGoogleAuthProvider as GoogleAuthProvider,
  webUpdatePassword as updatePassword,
  webUpdateProfile as updateProfile,
  webSendEmailVerification as sendEmailVerification
};
