import firebaseApp from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const isFirebaseConfigured = true;
const db = firestore();
const authInstance = auth();

export { authInstance as auth, db, isFirebaseConfigured };

// Firestore exports
export function collection(dbInstance, path) {
  return firestore().collection(path);
}

export function doc(dbOrCol, pathOrId, ...moreSegments) {
  if (dbOrCol && typeof dbOrCol === 'object' && typeof dbOrCol.collection === 'function') {
    return dbOrCol.doc(pathOrId);
  }
  const fullPath = [pathOrId, ...moreSegments].filter(Boolean).join('/');
  return firestore().doc(fullPath);
}

export function query(collectionRef, ...queryConstraints) {
  let q = collectionRef;
  queryConstraints.forEach(constraint => {
    q = constraint(q);
  });
  return q;
}

export function where(field, op, val) {
  return (q) => q.where(field, op, val);
}

export function orderBy(field, dir = 'asc') {
  return (q) => q.orderBy(field, dir);
}

export async function getDoc(docRef) {
  const snap = await docRef.get();
  return {
    exists: () => snap.exists,
    data: () => snap.data(),
    id: snap.id
  };
}

export async function getDocs(queryRef) {
  const snap = await queryRef.get();
  return {
    docs: snap.docs.map(docSnap => ({
      exists: () => docSnap.exists,
      data: () => docSnap.data(),
      id: docSnap.id
    }))
  };
}

export async function setDoc(docRef, data, options) {
  if (options && options.merge) {
    return docRef.set(data, { merge: true });
  }
  return docRef.set(data);
}

export async function updateDoc(docRef, data) {
  return docRef.update(data);
}

export async function deleteDoc(docRef) {
  return docRef.delete();
}

export function onSnapshot(ref, onNext, onError) {
  return ref.onSnapshot(
    snap => {
      if (snap && typeof snap.exists === 'boolean') {
        onNext({
          exists: () => snap.exists,
          data: () => snap.data(),
          id: snap.id
        });
      } else if (snap && snap.docs) {
        onNext({
          docs: snap.docs.map(docSnap => ({
            exists: () => docSnap.exists,
            data: () => docSnap.data(),
            id: docSnap.id
          })),
          forEach: (callback) => {
            snap.docs.forEach(docSnap => {
              callback({
                exists: () => docSnap.exists,
                data: () => docSnap.data(),
                id: docSnap.id
              });
            });
          }
        });
      } else {
        onNext(snap);
      }
    },
    err => {
      if (onError) onError(err);
      else console.warn('onSnapshot error:', err);
    }
  );
}

export const arrayUnion = firestore.FieldValue.arrayUnion;
export const arrayRemove = firestore.FieldValue.arrayRemove;
export const serverTimestamp = firestore.FieldValue.serverTimestamp;

// Auth exports
export async function signInWithEmailAndPassword(authInst, email, password) {
  return auth().signInWithEmailAndPassword(email, password);
}

export async function createUserWithEmailAndPassword(authInst, email, password) {
  return auth().createUserWithEmailAndPassword(email, password);
}

export async function signOut(authInst) {
  return auth().signOut();
}

export function onAuthStateChanged(authInst, callback) {
  return auth().onAuthStateChanged(callback);
}

export async function sendPasswordResetEmail(authInst, email) {
  return auth().sendPasswordResetEmail(email);
}

export async function signInWithCredential(authInst, credential) {
  return auth().signInWithCredential(credential);
}

export async function updatePassword(user, newPassword) {
  return user.updatePassword(newPassword);
}

export async function updateProfile(user, profileData) {
  return user.updateProfile(profileData);
}

export async function sendEmailVerification(user) {
  return user.sendEmailVerification();
}

export const GoogleAuthProvider = auth.GoogleAuthProvider;
