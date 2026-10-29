import { auth, signInWithPopup, GoogleAuthProvider } from './firebase.web';

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}
