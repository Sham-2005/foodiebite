export * from './firebase.web';
export { app, auth, db, storage, isFirebaseConfigured } from './firebase.web';
export {
  collection, doc, query, where, orderBy, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, arrayRemove, serverTimestamp,
  ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, signInWithCredential, GoogleAuthProvider,
  updatePassword, updateProfile, sendEmailVerification
} from './firebase.web';

