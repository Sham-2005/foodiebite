// ─────────────────────────────────────────────────────────────
//  frontend/src/services/googleAuth.android.js
//  FoodieBite Android Native Google Authentication
//  Authenticates natively via @react-native-google-signin/google-signin
//  and exchanges Google ID token with Supabase Auth (signInWithIdToken)
//  Persists session to AsyncStorage and synchronizes AppContext state.
// ─────────────────────────────────────────────────────────────

import { signInWithGoogleIdToken, registerNativeSignOutHandler } from './supabaseAuthService.js';
import { getSupabaseClient, getSupabaseInitError } from '../config/supabaseClient.js';
import { saveSession, savePreferences } from './localStorageService.js';
import { setItem, removeItem, setItemSync, removeItemSync } from './storage.js';

let GoogleSigninModule = null;
let statusCodes = {
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: '12502',
  PLAY_SERVICES_NOT_AVAILABLE: '12500',
  SIGN_IN_REQUIRED: '4',
};

try {
  const gModule = require('@react-native-google-signin/google-signin');
  if (gModule) {
    GoogleSigninModule = gModule.GoogleSignin;
    if (gModule.statusCodes) {
      statusCodes = gModule.statusCodes;
    }
  }
} catch (_) {}

// Google Web Client ID from Google Cloud project: my-bot-504415 (Client: foodiebite android / web)
export const GOOGLE_WEB_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID ||
  process.env.GOOGLE_WEB_CLIENT_ID ||
  '287461588416-2hor5lhin1q5terr8piah6qgss0klbnd.apps.googleusercontent.com';

const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

let isConfigured = false;

export function configureGoogleSignIn() {
  if (GoogleSigninModule && typeof GoogleSigninModule.configure === 'function') {
    GoogleSigninModule.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    isConfigured = true;
  }
}

/**
 * Initiates native Android Google Sign-In and exchanges the ID token with Supabase Auth.
 * 
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, user: object, session: object, profile: object }>}
 */
export async function loginWithGoogle(options = {}) {
  if (!GoogleSigninModule) {
    throw new Error('Native Google Sign-In is not initialized or supported in this environment.');
  }

  // Pre-validate Supabase client readiness before starting Google account selection
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    const initErr = getSupabaseInitError();
    throw new Error(`Supabase client is unavailable: ${initErr || 'Initialization failed'}`);
  }

  try {
    // 1. Ensure Google Sign-In is configured with Web Client ID
    configureGoogleSignIn();

    // 2. Verify Google Play Services is available on device
    await GoogleSigninModule.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Always clear local Google Play Services session before launching the sign-in intent.
    // This forces Google Play Services to open the account selection dialog / account picker
    // so the user can choose which Google account to use, rather than auto-selecting the previous one.
    try {
      if (typeof GoogleSigninModule.signOut === 'function') {
        console.log('[GoogleAuthAndroid] Pre-clearing local Google session to force account picker');
        await GoogleSigninModule.signOut();
      }
    } catch (_) {
      // Ignored if no cached account existed
    }

    // 3. Initiate native Google account picker & sign-in
    console.log('[GoogleAuthAndroid] Launching Google Sign-In account picker');
    const signInResult = await GoogleSigninModule.signIn();
    let idToken = signInResult?.idToken || (signInResult?.data && signInResult.data.idToken);
    if (!idToken && typeof GoogleSigninModule.getTokens === 'function') {
      try {
        const tokens = await GoogleSigninModule.getTokens();
        idToken = tokens?.idToken;
      } catch (_) {}
    }

    if (!idToken) {
      throw new Error('Google Sign-In failed: No ID token returned from Google Play Services.');
    }

    // 4. Exchange Google ID token with Supabase Auth via signInWithIdToken
    const authRes = await signInWithGoogleIdToken({ idToken });
    if (!authRes.success || !authRes.session || !authRes.user) {
      // Clean up Google native session on failure so subsequent attempts start fresh
      if (typeof GoogleSigninModule.signOut === 'function') {
        await GoogleSigninModule.signOut().catch(() => {});
      }
      throw new Error(authRes.error || 'Failed to authenticate Google credentials with Supabase.');
    }

    if (!authRes.user?.email || !authRes.user?.id) {
      throw new Error('Supabase authentication returned invalid user data.');
    }

    // 5. Enforce role verification: check Supabase profile role first, with admin email verification
    const cleanEmail = (authRes.user.email || '').trim().toLowerCase();
    const profileRole = authRes.profile?.role;
    const isAdmin = profileRole === 'admin' || (profileRole !== 'user' && cleanEmail === AUTHORIZED_ADMIN_EMAIL);
    const role = isAdmin ? 'admin' : 'user';

    console.log(`[GoogleAuthAndroid] Authenticated user email: ${cleanEmail}, role: ${role}`);

    // 6. Check profile completion status
    const isProfileComplete = Boolean(
      isAdmin ||
      authRes.profile?.profileCompleted === true ||
      (authRes.profile?.age && authRes.profile?.gender)
    );

    // 7. Assemble standardized user data adhering to FoodieBite active user schema
    const userData = {
      id: authRes.user.id,
      uid: authRes.user.id,
      name: authRes.profile?.name || authRes.user.user_metadata?.full_name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role,
      dietType: authRes.profile?.diet_type || 'Vegetarian',
      age: authRes.profile?.age || '',
      gender: authRes.profile?.gender || '',
      profileCompleted: isProfileComplete,
      accountStatus: authRes.profile?.account_status || 'active',
      disabled: authRes.profile?.disabled || false,
      preferences: authRes.profile?.preferences || {
        dietType: 'Vegetarian',
        spiceLevel: 'Medium',
        cuisines: ['indian'],
        healthGoals: ['healthy_eating'],
        country: 'in',
        allergies: [],
        minGrade: 'c',
        emailNotifications: true,
      },
      favoriteFoods: authRes.profile?.favoriteFoods || [],
      searchHistory: authRes.profile?.searchHistory || [],
      authProvider: 'google',
    };

    // 8. Persist authentication token and session state to AsyncStorage via storage service
    try {
      await setItem('nb_token', authRes.session.access_token);
      await setItem('nb_active_session', JSON.stringify({ ...userData, token: authRes.session.access_token }));
      await setItem('nb_active_user', JSON.stringify(userData));
      await setItem('nb_mock_active', JSON.stringify(userData));
      saveSession({ ...userData, token: authRes.session.access_token });
      if (userData.preferences) {
        savePreferences(userData.preferences);
      }

      // 9. If designated administrator, persist admin session tokens; otherwise clear
      if (isAdmin) {
        const sessionPayload = { success: true, token: authRes.session.access_token, user: userData };
        await setItem('foodiebite_admin_session', JSON.stringify(sessionPayload));
      } else {
        await removeItem('foodiebite_admin_session');
      }
    } catch (storageErr) {
      console.warn('[GoogleAuthAndroid] Non-fatal storage persistence notice:', storageErr?.message || storageErr);
    }

    return {
      success: true,
      user: userData,
      session: authRes.session,
      profile: authRes.profile,
    };
  } catch (err) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED || /cancel/i.test(err.message || '')) {
      throw new Error('Google Sign-In was cancelled.');
    } else if (err.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign-In is already in progress.');
    } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is not available or outdated on this device.');
    } else if (err.message && (err.message.includes('Supabase') || err.message.includes('DNS') || err.message.includes('SSL/TLS'))) {
      throw err;
    } else if (/network|offline|timeout/i.test(err.message || '')) {
      throw new Error('Network connection error. Please check your device internet connection and try again.');
    }
    throw err;
  }
}

/**
 * Signs out from Google Sign-In natively on Android so account picker is cleared.
 * NOTE: Intentionally calls signOut() and NOT revokeAccess() to preserve authorization.
 */
export async function signOutFromGoogle() {
  try {
    if (GoogleSigninModule && typeof GoogleSigninModule.signOut === 'function') {
      await GoogleSigninModule.signOut();
      console.log('[GoogleAuthAndroid] Google Play Services local session signed out successfully');
    }
  } catch (err) {
    console.warn('[GoogleAuthAndroid] Google Sign-Out warning:', err?.message || err);
  }
}

registerNativeSignOutHandler(signOutFromGoogle);

export default { loginWithGoogle, signOutFromGoogle, configureGoogleSignIn };
