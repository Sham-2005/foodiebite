// ─────────────────────────────────────────────────────────────
//  frontend/src/services/googleSigninWebStub.js
//  Web stub for @react-native-google-signin/google-signin
//  Prevents native Google Sign-In from leaking into web builds.
// ─────────────────────────────────────────────────────────────

export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => false,
  signIn: async () => {
    throw new Error('Native Google Sign-In is not supported on web. Use web Google OAuth.');
  },
  signOut: async () => {},
  revokeAccess: async () => {},
  isSignedIn: async () => false,
  getCurrentUser: async () => null,
  clearCachedAccessToken: async () => {},
  getTokens: async () => ({ idToken: null, accessToken: null }),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: '12502',
  PLAY_SERVICES_NOT_AVAILABLE: '12500',
  SIGN_IN_REQUIRED: '4',
};

export const GoogleSigninButton = () => null;

export default {
  GoogleSignin,
  statusCodes,
  GoogleSigninButton,
};
