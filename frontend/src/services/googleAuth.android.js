import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, signInWithCredential, GoogleAuthProvider } from './firebase.android';

export async function loginWithGoogle() {
  GoogleSignin.configure({
    webClientId: '433101398092-qd8ui8oog0mbhipv5dra31l55f4klm8u.apps.googleusercontent.com',
    offlineAccess: true,
  });

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();
  
  // In newer versions of google-signin, the response has a data field
  const idToken = signInResult.idToken || (signInResult.data && signInResult.data.idToken);
  
  if (!idToken) {
    throw new Error('Google Sign-In failed: No ID token returned.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}
