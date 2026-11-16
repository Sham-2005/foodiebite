// ─────────────────────────────────────────────────────────────
//  frontend/src/services/supabaseAuthService.js
//  FoodieBite Supabase Authentication Service
//  Provides Email/Password authentication, session management,
//  resend verification, and password recovery alongside Firebase.
// ─────────────────────────────────────────────────────────────

import { getSupabaseClient, isSupabaseConfigured, getAuthRedirectUrl, getSupabaseInitError } from '../config/supabaseClient.js';
import {
  logLoginSuccess,
  logExplicitLogout,
  logAuthEvent,
  detectPlatform,
} from './supabaseActivityService.js';
import { getProfileById, getMyProfile } from './supabaseProfileService.js';
import { reconcileLegacyUserData } from './userMigrationService.js';

// RFC-compliant email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates basic email structure.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

// In-memory rate-limit cooldown tracker (60 seconds per email) to prevent spamming
const resendCooldowns = new Map();
const resetCooldowns = new Map();
const COOLDOWN_DURATION_MS = 60000;

/**
 * Translates low-level Supabase / GoTrue / SMTP error codes into clear, user-friendly messages.
 * Logs technical details safely without exposing sensitive credentials.
 * 
 * @param {Error|object|string} err
 * @param {string} context
 * @returns {string}
 */
export function mapSupabaseAuthError(err, context = 'auth') {
  if (!err) return 'An unexpected authentication error occurred.';
  const msg = typeof err === 'string' ? err : err.message || '';
  const status = typeof err === 'object' ? err.status : null;

  // Safe technical diagnostic log (no credentials)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`⚠️ [Supabase Auth - ${context}] Diagnostic:`, { message: msg, status });
  }

  // 1. SMTP / Mail delivery failure
  if (/error sending confirmation email/i.test(msg) || /error sending email/i.test(msg)) {
    return 'Unable to send verification email at this moment. The email delivery service is experiencing delays or connection issues. Please wait a minute and use "Resend Verification Email" on the Sign In page.';
  }

  // 2. Email Rate limit / Throttle
  if (/over_email_send_rate_limit|email rate limit/i.test(msg) || status === 429) {
    return 'Too many email requests. Please wait a few minutes before trying again.';
  }

  // 3. Duplicate User / Already registered
  if (/user already registered/i.test(msg)) {
    return 'Email already registered. An account with this email already exists. Please sign in instead, or request a verification email if your account is not yet verified.';
  }

  // 4. Unverified Email
  if (/email not confirmed|email_not_confirmed/i.test(msg)) {
    return 'Your email address has not been verified. Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link or request a new one.';
  }

  // 5. Invalid credentials
  if (/invalid login credentials|invalid credentials/i.test(msg)) {
    return 'Incorrect email or password. Please try again.';
  }

  // 6. Password constraints (min length)
  if (/password.*(should be|must be|at least 6 characters)/i.test(msg)) {
    return 'Password must be at least 6 characters.';
  }

  // 7. Network / Connection errors & Specific Diagnostics
  if (/abort|timeout|timed out|etimedout/i.test(msg)) {
    return 'Connection timed out while communicating with Supabase. Please check your internet connection and try again.';
  }
  if (/enotfound|getaddrinfo|name_not_resolved|cannot resolve host/i.test(msg)) {
    return 'DNS resolution failure: Unable to resolve Supabase project host. Please verify your internet connection and DNS settings.';
  }
  if (/cert_|certificate|ssl|tls|handshake/i.test(msg)) {
    return 'SSL/TLS connection error: Secure connection to Supabase failed.';
  }
  if (status === 401 || status === 403 || /invalid[ _-]?(api[ _-]?)?key|unauthorized/i.test(msg)) {
    return 'Authentication service error: Supabase API key was unauthorized or invalid (HTTP 401/403).';
  }
  if (status === 404) {
    return 'Supabase authentication service endpoint not found (HTTP 404).';
  }
  if (status >= 500 || /service unavailable|bad gateway|project.*paused/i.test(msg)) {
    return 'Supabase project service is temporarily unavailable or paused. Please try again in a few moments.';
  }
  if (/network|failed to fetch|network request failed/i.test(msg)) {
    return 'Network connection failed while reaching Supabase. Please verify your internet connection and try again.';
  }

  // 8. User not found (e.g. resend for non-existent email)
  if (/user not found/i.test(msg)) {
    return 'No account was found for this email address. Please make sure you have registered first.';
  }

  return msg || 'Authentication request failed.';
}

/**
 * Registers a new user with email and password.
 * Automatically computes redirect URL and passes emailRedirectTo for email confirmation.
 * 
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.fullName
 * @param {string} [params.dietType='Vegetarian']
 * @param {number|string} [params.age]
 * @param {string} [params.gender]
 * @param {object} [params.preferences]
 * @param {string} [params.redirectTo]
 * @returns {Promise<{
 *   success: boolean,
 *   user?: any,
 *   session?: any,
 *   requiresVerification?: boolean,
 *   error?: string,
 *   code?: string
 * }>}
 */
export async function registerWithEmail({
  email,
  password,
  fullName,
  dietType = 'Vegetarian',
  age,
  gender,
  preferences,
  redirectTo,
}) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Email and password are required', code: 'MISSING_FIELDS' };
  }

  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address', code: 'INVALID_EMAIL' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const emailRedirectTo = redirectTo || getAuthRedirectUrl();

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName || '',
          name: fullName || '',
          dietType,
          age: age || null,
          gender: gender || null,
          preferences: preferences || {},
          platform: detectPlatform(),
        },
      },
    });

    if (error) {
      const friendlyMsg = mapSupabaseAuthError(error, 'signUp');
      return {
        success: false,
        error: friendlyMsg,
        rawError: error.message,
        code: error.status === 429 ? 'RATE_LIMIT' : 'SIGNUP_FAILED',
      };
    }

    // Check for duplicate registration attempt (Supabase returns empty identities when email already exists)
    const isDuplicateEmail = Boolean(
      data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
    );
    if (isDuplicateEmail) {
      return {
        success: false,
        error: 'An account with this email already exists. Please sign in instead, or request a verification link if not yet verified.',
        code: 'USER_ALREADY_EXISTS',
      };
    }

    // If session is active (email confirmation disabled or auto-confirmed), retrieve the provisioned profile
    let profile = null;
    let profilePending = false;

    if (data.session && data.user?.id) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const profileResult = await getProfileById(data.user.id);
        if (profileResult?.success && profileResult.profile) {
          profile = profileResult.profile;
          break;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }
      if (!profile) {
        profilePending = true;
      }
    }

    // Determine if confirmation email was sent (session is null when email confirmation is enabled)
    const requiresVerification = Boolean(
      data.user && !data.session && data.user.identities && data.user.identities.length > 0
    );

    return {
      success: true,
      user: data.user,
      session: data.session,
      profile,
      profilePending,
      requiresVerification,
      message: requiresVerification
        ? 'Account registered successfully! Please check your inbox (and spam folder) to verify your email before signing in.'
        : 'Registration successful',
    };
  } catch (err) {
    const friendlyMsg = mapSupabaseAuthError(err, 'signUpCatch');
    return { success: false, error: friendlyMsg, rawError: err.message, code: 'UNEXPECTED_ERROR' };
  }
}

/**
 * Resends the confirmation/verification email for an unconfirmed account.
 * Enforces a 60-second cooldown per email to prevent duplicate requests and rate limits.
 * 
 * @param {object} params
 * @param {string} params.email
 * @param {string} [params.redirectTo]
 * @returns {Promise<{
 *   success: boolean,
 *   message?: string,
 *   error?: string,
 *   code?: string,
 *   remainingSeconds?: number
 * }>}
 */
export async function resendVerificationEmail({ email, redirectTo }) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, error: 'Email address is required', code: 'MISSING_EMAIL' };
  }

  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address', code: 'INVALID_EMAIL' };
  }

  // Check 60s client-side cooldown
  const now = Date.now();
  const nextAllowed = resendCooldowns.get(cleanEmail) || 0;
  if (now < nextAllowed) {
    const remainingSec = Math.ceil((nextAllowed - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingSec} seconds before requesting another verification email.`,
      code: 'COOLDOWN_ACTIVE',
      remainingSeconds: remainingSec,
    };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const emailRedirectTo = redirectTo || getAuthRedirectUrl();

    const { error } = await client.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      const friendlyMsg = mapSupabaseAuthError(error, 'resendVerification');
      return {
        success: false,
        error: friendlyMsg,
        rawError: error.message,
        code: error.status === 429 ? 'RATE_LIMIT' : 'RESEND_FAILED',
      };
    }

    // Set cooldown
    resendCooldowns.set(cleanEmail, Date.now() + COOLDOWN_DURATION_MS);

    // Audit log
    await logAuthEvent({
      eventType: 'verification_email_resent',
      provider: 'email',
      metadata: { email: cleanEmail },
    }).catch(() => {});

    return {
      success: true,
      message: `Verification email sent to ${cleanEmail}! Please check your inbox and spam folder.`,
    };
  } catch (err) {
    const friendlyMsg = mapSupabaseAuthError(err, 'resendVerificationCatch');
    return { success: false, error: friendlyMsg, rawError: err.message, code: 'UNEXPECTED_ERROR' };
  }
}

/**
 * Authenticates an existing user with email and password.
 * Attaches isUnverified: true if email has not been confirmed.
 * 
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{
 *   success: boolean,
 *   user?: any,
 *   session?: any,
 *   profile?: any,
 *   error?: string,
 *   isUnverified?: boolean,
 *   code?: string
 * }>}
 */
export async function loginWithEmail({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter both email and password', code: 'MISSING_FIELDS' };
  }

  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address', code: 'INVALID_EMAIL' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const isUnverified = /email not confirmed|email_not_confirmed/i.test(error.message || '');
      const friendlyMsg = mapSupabaseAuthError(error, 'login');

      // Log failed attempt asynchronously
      logAuthEvent({
        eventType: 'login_failed',
        provider: 'email',
        metadata: { email: cleanEmail, error: error.message },
      }).catch(() => {});

      return {
        success: false,
        error: friendlyMsg,
        rawError: error.message,
        isUnverified,
        code: isUnverified ? 'EMAIL_NOT_CONFIRMED' : 'LOGIN_FAILED',
      };
    }

    // 1. Log successful login
    await logLoginSuccess('email', { email: cleanEmail });

    // 2. Fetch associated user profile
    const profileRes = await getMyProfile();

    return {
      success: true,
      user: data.user,
      session: data.session,
      profile: profileRes.profile || null,
    };
  } catch (err) {
    const friendlyMsg = mapSupabaseAuthError(err, 'loginCatch');
    return { success: false, error: friendlyMsg, rawError: err.message, code: 'UNEXPECTED_ERROR' };
  }
}

/**
 * Initiates Google OAuth authentication via Supabase GoTrue.
 * Compatible with Web (browser redirect) and mobile deep-linking.
 * 
 * @param {object} [options]
 * @param {string} [options.redirectTo]
 * @returns {Promise<{ success: boolean, url?: string, data?: any, error?: string }>}
 */
export async function signInWithGoogleOAuth(options = {}) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const canonicalRedirect = options.redirectTo || getAuthRedirectUrl('auth/callback');

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: canonicalRedirect,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { success: false, error: mapSupabaseAuthError(error, 'googleOAuth'), rawError: error.message };
    }

    return { success: true, url: data?.url, data };
  } catch (err) {
    return { success: false, error: mapSupabaseAuthError(err, 'googleOAuthCatch'), rawError: err.message };
  }
}

/**
 * Exchanges a Google ID Token (from native Android Google Sign-In or Capacitor)
 * directly for an authenticated Supabase session.
 * 
 * @param {object} params
 * @param {string} params.idToken
 * @param {string} [params.nonce]
 * @returns {Promise<{ success: boolean, user?: any, session?: any, profile?: any, error?: string }>}
 */
export async function signInWithGoogleIdToken({ idToken, nonce }) {
  if (!idToken) {
    return { success: false, error: 'Google ID token is required', code: 'MISSING_ID_TOKEN' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const { data, error } = await client.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce,
    });

    if (error) {
      return { success: false, error: mapSupabaseAuthError(error, 'googleIdToken'), rawError: error.message };
    }

    // 1. Log successful login
    await logLoginSuccess('google', { email: data.user?.email });

    // 2. Fetch associated user profile (with retry for trigger propagation)
    let profile = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const profileRes = await getProfileById(data.user.id);
        if (profileRes?.success && profileRes.profile) {
          profile = profileRes.profile;
          break;
        }
      } catch (_) {}
      if (attempt < 3) await new Promise((r) => setTimeout(r, 150 * attempt));
    }

    // 3. Verify account disabled status
    if (profile && (profile.disabled === true || profile.account_status === 'disabled')) {
      await logout();
      return { success: false, error: 'Your account has been disabled. Please contact support.' };
    }

    // 4. Reconcile legacy Firebase user data (preferences, favorites)
    if (data.user && profile) {
      try {
        await reconcileLegacyUserData(data.user, profile);
      } catch (_) {}
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      profile: profile || null,
    };
  } catch (err) {
    return { success: false, error: mapSupabaseAuthError(err, 'googleIdTokenCatch'), rawError: err.message };
  }
}

/**
 * Processes incoming OAuth callback from Web redirect or Android deep link (foodiebite://auth-callback).
 * Extracts session tokens or exchanges PKCE authorization codes.
 * 
 * @param {string|object} [urlOrParams]
 * @returns {Promise<{ success: boolean, user?: any, session?: any, profile?: any, error?: string }>}
 */
export async function handleOAuthCallback(urlOrParams) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is unavailable' };
  }

  try {
    let rawUrl = '';
    if (typeof urlOrParams === 'string') {
      rawUrl = urlOrParams;
    } else if (typeof window !== 'undefined' && window.location) {
      rawUrl = window.location.href;
    }

    // 1. Check if an explicit OAuth error is present in query or hash fragment
    if (rawUrl) {
      if (rawUrl.includes('error=') || rawUrl.includes('error_description=')) {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost/${rawUrl.replace(/^[a-z]+:\/\//, '')}`);
        const params = new URLSearchParams(urlObj.search || urlObj.hash.replace(/^#/, ''));
        const errorDesc = params.get('error_description') || params.get('error') || 'Google authentication was cancelled or failed.';
        return { success: false, error: mapSupabaseAuthError(errorDesc, 'oauthCallbackParams') };
      }
    }

    // 2. Resolve or exchange session
    let session = null;

    if (rawUrl) {
      const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `http://localhost/${rawUrl.replace(/^[a-z]+:\/\//, '')}`);
      const code = urlObj.searchParams.get('code');

      // PKCE flow: If an authorization code is present, exchange it for a session
      if (code && typeof client.auth.exchangeCodeForSession === 'function') {
        const { data: exchangeData, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeData?.session) {
          session = exchangeData.session;
        } else if (exchangeError) {
          // Concurrency resilience: Check getSession() with polling in case parallel client initialization (_initialize)
          // or another process already completed the exchange in background
          for (let attempt = 1; attempt <= 4; attempt++) {
            const { data: parallelSessionData } = await client.auth.getSession();
            if (parallelSessionData?.session) {
              session = parallelSessionData.session;
              break;
            }
            if (attempt < 4) await new Promise((r) => setTimeout(r, 150));
          }
          if (!session) {
            return { success: false, error: mapSupabaseAuthError(exchangeError, 'exchangeCode') };
          }
        }
      }

      // Implicit flow: Check for access_token and refresh_token in hash fragment
      if (!session && urlObj.hash && urlObj.hash.includes('access_token=')) {
        const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken && typeof client.auth.setSession === 'function') {
          const { data: setData, error: setSessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setData?.session) {
            session = setData.session;
          } else if (setSessionError) {
            console.warn('setSession from hash error:', setSessionError.message);
          }
        }
      }
    }

    // 3. If no session from code or hash, check if an existing session is active (e.g. page refresh)
    if (!session) {
      try {
        const { data: activeSessionData } = await client.auth.getSession();
        if (activeSessionData?.session) {
          session = activeSessionData.session;
        }
      } catch (_) {}
    }

    // 4. Polling recovery: wait up to 800ms for background initialization/storage write to settle
    if (!session) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        await new Promise((r) => setTimeout(r, 200));
        const { data: pollData } = await client.auth.getSession();
        if (pollData?.session) {
          session = pollData.session;
          break;
        }
      }
    }

    if (!session) {
      return { success: false, error: 'No authentication session found in callback. Please try signing in again.' };
    }

    // Ensure session contains full user details from getSession / getUser
    if (!session.user) {
      try {
        const { data: fullSessionData } = await client.auth.getSession();
        if (fullSessionData?.session?.user) {
          session = fullSessionData.session;
        } else {
          const { data: userData } = await client.auth.getUser();
          if (userData?.user) {
            session = { ...session, user: userData.user };
          }
        }
      } catch (_) {}
    }

    const user = session.user || null;
    if (!user) {
      return { success: false, error: 'Failed to retrieve user information from session.' };
    }

    // 5. Clean URL query/hash parameters to prevent replay/stale tokens
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      try {
        const cleanPath = window.location.pathname || '/auth/callback';
        window.history.replaceState({}, document.title, cleanPath);
      } catch (_) {}
    }

    // 6. Log OAuth login success
    try {
      await logLoginSuccess('google', { email: user?.email });
    } catch (_) {}

    // 7. Retrieve provisioned profile (with graceful fallback)
    let profile = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const pRes = await getMyProfile();
        if (pRes?.success && pRes.profile) {
          profile = pRes.profile;
          break;
        }
      } catch (_) {}
      if (attempt < 3) await new Promise((r) => setTimeout(r, 150 * attempt));
    }

    // 8. Verify account disabled status
    if (profile && (profile.disabled === true || profile.account_status === 'disabled')) {
      await logout();
      return { success: false, error: 'Your account has been disabled. Please contact support.' };
    }

    // 9. Reconcile existing legacy Firebase account preferences and favorites
    if (user && profile) {
      try {
        await reconcileLegacyUserData(user, profile);
      } catch (_) {}
    }

    return {
      success: true,
      user,
      session,
      profile,
    };
  } catch (err) {
    return { success: false, error: mapSupabaseAuthError(err, 'handleOAuthCallbackCatch') };
  }
}

let nativeSignOutHandler = null;

/**
 * Registers an optional native sign-out handler (e.g. from googleAuth.android.js).
 * Keeps native-only dependencies isolated to platform-specific code.
 */
export function registerNativeSignOutHandler(handler) {
  nativeSignOutHandler = handler;
}

/**
 * Logs out the currently authenticated user.
 * Records an explicit logout event before terminating the session.
 * 
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function logout() {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    // 1. Audit explicit logout event while session context is still valid
    await logExplicitLogout();

    // 2. Clear native Google sign-in cache if registered by platform code
    if (typeof nativeSignOutHandler === 'function') {
      try {
        await nativeSignOutHandler();
      } catch (_) {}
    }

    // 3. Sign out from Supabase GoTrue
    const { error } = await client.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves the currently authenticated Supabase user.
 * 
 * @returns {Promise<{ user: any | null, error?: string }>}
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return { user: null };
  const client = getSupabaseClient();
  if (!client) return { user: null };

  try {
    const { data, error } = await client.auth.getUser();
    if (error) return { user: null, error: error.message };
    return { user: data.user || null };
  } catch (err) {
    return { user: null, error: err.message };
  }
}

/**
 * Retrieves the active session (including access and refresh tokens).
 * 
 * @returns {Promise<{ session: any | null, error?: string }>}
 */
export async function getCurrentSession() {
  if (!isSupabaseConfigured) return { session: null };
  const client = getSupabaseClient();
  if (!client) return { session: null };

  try {
    const { data, error } = await client.auth.getSession();
    if (error) return { session: null, error: error.message };
    return { session: data.session || null };
  } catch (err) {
    return { session: null, error: err.message };
  }
}

/**
 * Sends a password reset email link with cooldown protection.
 * 
 * @param {string} email
 * @param {string} [redirectTo]
 * @returns {Promise<{ success: boolean, message?: string, error?: string, code?: string }>}
 */
export async function resetPassword(email, redirectTo) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Email address is required', code: 'MISSING_EMAIL' };
  }

  if (!isValidEmail(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address', code: 'INVALID_EMAIL' };
  }

  // 60-second cooldown protection
  const now = Date.now();
  const nextAllowed = resetCooldowns.get(cleanEmail) || 0;
  if (now < nextAllowed) {
    const remainingSec = Math.ceil((nextAllowed - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingSec} seconds before requesting another password reset.`,
      code: 'COOLDOWN_ACTIVE',
    };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured', code: 'CLIENT_UNCONFIGURED' };
  }

  const client = getSupabaseClient();
  if (!client) {
    const detail = getSupabaseInitError();
    return {
      success: false,
      error: detail ? `Supabase client is unavailable: ${detail}` : 'Supabase client is unavailable',
      code: 'CLIENT_UNAVAILABLE'
    };
  }

  try {
    const emailRedirectTo = redirectTo || getAuthRedirectUrl('reset-password');

    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: emailRedirectTo,
    });

    if (error) {
      const friendlyMsg = mapSupabaseAuthError(error, 'resetPassword');
      return {
        success: false,
        error: friendlyMsg,
        rawError: error.message,
        code: error.status === 429 ? 'RATE_LIMIT' : 'RESET_FAILED',
      };
    }

    resetCooldowns.set(cleanEmail, Date.now() + COOLDOWN_DURATION_MS);

    // Log password reset request
    await logAuthEvent({
      eventType: 'password_reset_requested',
      provider: 'email',
      metadata: { email: cleanEmail },
    }).catch(() => {});

    return {
      success: true,
      message: 'Password reset link sent successfully! Please check your inbox and spam folder.',
    };
  } catch (err) {
    const friendlyMsg = mapSupabaseAuthError(err, 'resetPasswordCatch');
    return { success: false, error: friendlyMsg, rawError: err.message, code: 'UNEXPECTED_ERROR' };
  }
}

/**
 * Updates the user's password using an authenticated session.
 * 
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function updatePassword(newPassword) {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is unavailable' };
  }

  try {
    const { error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: mapSupabaseAuthError(error, 'updatePassword') };
    }

    // Log password update event
    await logAuthEvent({
      eventType: 'password_reset_completed',
      provider: 'email',
    }).catch(() => {});

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  } catch (err) {
    return { success: false, error: mapSupabaseAuthError(err, 'updatePasswordCatch') };
  }
}

/**
 * Subscribes to Supabase authentication state changes.
 * 
 * @param {(event: string, session: any) => void} callback
 * @returns {{ unsubscribe: () => void } | null}
 */
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return subscription;
  } catch (err) {
    console.warn('⚠️ [Supabase Auth] onAuthStateChange setup note:', err.message);
    return null;
  }
}

export default {
  registerWithEmail,
  loginWithEmail,
  signInWithGoogleOAuth,
  signInWithGoogleIdToken,
  handleOAuthCallback,
  logout,
  getCurrentUser,
  getCurrentSession,
  resetPassword,
  updatePassword,
  resendVerificationEmail,
  onAuthStateChange,
  mapSupabaseAuthError,
  isValidEmail,
};
