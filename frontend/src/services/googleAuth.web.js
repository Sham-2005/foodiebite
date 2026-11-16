// ─────────────────────────────────────────────────────────────
//  frontend/src/services/googleAuth.web.js
//  FoodieBite Web Google Authentication powered by Supabase GoTrue
// ─────────────────────────────────────────────────────────────

import { signInWithGoogleOAuth } from './supabaseAuthService.js';

/**
 * Initiates Google OAuth login on Web via Supabase GoTrue.
 * Redirects to Google authorization dialog and returns to /auth/callback.
 * 
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, url?: string, data?: any }>}
 */
export async function loginWithGoogle(options = {}) {
  const result = await signInWithGoogleOAuth(options);
  if (!result.success) {
    throw new Error(result.error || 'Google authentication failed');
  }
  return result;
}

/**
 * Web Google Sign-Out is handled via Supabase session termination.
 * No native Google Play Services session cleanup is needed on web.
 */
export async function signOutFromGoogle() {
  return Promise.resolve();
}

export default { loginWithGoogle, signOutFromGoogle };
