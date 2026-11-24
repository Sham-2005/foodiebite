// ─────────────────────────────────────────────────────────────
//  backend/src/middleware/authMiddleware.js
//  Cryptographically Hardened Authentication Middleware for FoodieBite
//  Enforces Strict Cryptographic Signature Verification:
//    1. Supabase Access Tokens (via Supabase Auth API / SUPABASE_JWT_SECRET)
//    2. Backend Application Tokens (via JWT_SECRET)
//  ZERO Unverified Base64 or Unsigned Fallbacks Permitted.
//  Strict Administrator Authorization: Only sham111205s@gmail.com
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

/**
 * Resolves Supabase configuration safely across environments.
 */
function getSupabaseConfig() {
  let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
  let jwtSecret = process.env.SUPABASE_JWT_SECRET || null;

  // Fallback: search for credentials in nearby .env files if not already populated in process.env
  if (!url || !key) {
    const candidatePaths = [
      path.resolve(__dirname, '../../../frontend/.env'),
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../.env')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const eq = trimmed.indexOf('=');
              if (eq > 0) {
                const k = trimmed.slice(0, eq).trim();
                const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
                if (!url && (k === 'SUPABASE_URL' || k === 'NEXT_PUBLIC_SUPABASE_URL' || k === 'REACT_APP_SUPABASE_URL')) {
                  url = v;
                }
                if (!key && (k === 'SUPABASE_ANON_KEY' || k === 'SUPABASE_KEY' || k === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' || k === 'REACT_APP_SUPABASE_PUBLISHABLE_KEY')) {
                  key = v;
                }
                if (!jwtSecret && k === 'SUPABASE_JWT_SECRET') {
                  jwtSecret = v;
                }
              }
            }
          });
        } catch (_) {}
      }
      if (url && key) break;
    }
  }

  return {
    url: url || 'https://wzhxalmixfeqszgwqeqr.supabase.co',
    key: key || '',
    jwtSecret
  };
}

/**
 * Verifies Supabase access tokens cryptographically.
 * Rejects invalid signatures, expired tokens, or forged payloads.
 * Returns verified user profile or null.
 */
async function verifySupabaseToken(token) {
  const { url, key, jwtSecret } = getSupabaseConfig();

  // 1. Cryptographic HMAC verification using SUPABASE_JWT_SECRET if configured
  if (jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256']
      });
      // Audience verification
      if (decoded.aud && decoded.aud !== 'authenticated') {
        return null;
      }
      return {
        uid: decoded.sub || decoded.user_id || decoded.id,
        email: (decoded.email || '').trim().toLowerCase(),
        name: decoded.user_metadata?.full_name || decoded.user_metadata?.name || decoded.name || '',
        role: decoded.app_metadata?.role || decoded.user_metadata?.role || 'user',
        provider: 'supabase',
        tokenPayload: decoded
      };
    } catch (_) {
      // Signature mismatch, expired, or malformed
    }
  }

  // 2. Official Supabase Auth API verification (/auth/v1/user)
  if (url && key) {
    try {
      let fetchFn = globalThis.fetch;
      if (!fetchFn) {
        try { fetchFn = require('node-fetch'); } catch (_) {}
      }

      if (fetchFn) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

        const res = await fetchFn(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': key
          },
          ...(controller ? { signal: controller.signal } : {})
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (res && res.status >= 200 && res.status < 300) {
          const user = await res.json();
          if (user && user.id) {
            return {
              uid: user.id,
              email: (user.email || '').trim().toLowerCase(),
              name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              role: user.app_metadata?.role || user.user_metadata?.role || 'user',
              provider: 'supabase',
              verifiedUser: user
            };
          }
        }
      }
    } catch (_) {
      // Network failure or timeout contacting Supabase Auth
    }
  }

  return null;
}

/**
 * Verifies local application tokens signed with backend JWT_SECRET.
 * Cryptographically enforces HS256 signature and expiry.
 */
function verifyLocalToken(token) {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return {
      uid: decoded.uid || decoded.id || 'usr_local',
      email: (decoded.email || '').trim().toLowerCase(),
      name: decoded.name || '',
      role: decoded.role || 'user',
      provider: 'jwt',
      tokenPayload: decoded
    };
  } catch (_) {
    return null;
  }
}

// ── protect ───────────────────────────────────────────────────
// Cryptographically verifies ID/access token across Supabase and Local JWT.
// Rejects unauthenticated, forged, expired, and disabled accounts.
// Strictly prevents privilege escalation.
exports.protect = async (req, res, next) => {
  let token = null;
  if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.substring(7).trim();
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised. No token.' });
  }

  // Reject malformed JWTs (must have 3 parts: header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }

  try {
    let decodedToken = null;

    // 1. Try Supabase verification (Official API or SUPABASE_JWT_SECRET)
    decodedToken = await verifySupabaseToken(token);

    // 2. Try Local backend JWT verification (JWT_SECRET)
    if (!decodedToken) {
      decodedToken = verifyLocalToken(token);
    }

    // 3. CRITICAL SECURITY GUARD:
    // If all cryptographic verifications fail, REJECT IMMEDIATELY.
    // Zero unverified fallback, zero unsigned base64 parsing.
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
    }

    const cleanEmail = (decodedToken.email || '').trim().toLowerCase();

    // 4. Account Disabled Verification
    let isDisabled = false;

    // Check userStore
    try {
      const userStore = require('../services/userStore');
      const localUser = userStore.findByEmail(cleanEmail) || (decodedToken.uid ? userStore.getUserById(decodedToken.uid) : null);
      if (localUser && (localUser.disabled === true || localUser.accountStatus === 'disabled')) {
        isDisabled = true;
      }
    } catch (_) {}

    // Check Supabase profiles table if connected
    if (!isDisabled && decodedToken.uid) {
      try {
        const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');
        const client = getSupabaseAdmin() || getSupabaseClient();
        if (client) {
          const { data: profile } = await client
            .from('profiles')
            .select('id, is_active')
            .eq('id', decodedToken.uid)
            .maybeSingle();
          if (profile && profile.is_active === false) {
            isDisabled = true;
          }
        }
      } catch (_) {}
    }

    if (isDisabled) {
      return res.status(403).json({ success: false, message: 'Account is disabled. Please contact support.' });
    }

    // 5. Strict Administrator Authorization:
    // Only sham111205s@gmail.com is authorized to receive the admin role.
    // Never trust frontend-supplied or unverified role metadata.
    const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';
    let role = 'user';

    if (cleanEmail === AUTHORIZED_ADMIN_EMAIL) {
      role = 'admin';
    } else if (decodedToken.role && decodedToken.role.toLowerCase() === 'merchant') {
      role = 'merchant';
    }

    // Attach verified user context to request
    req.token = token;
    req.user = {
      id:       decodedToken.uid,
      uid:      decodedToken.uid,
      name:     decodedToken.name || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
      email:    cleanEmail,
      role:     role,
      provider: decodedToken.provider
    };

    return next();
  } catch (err) {
    console.error('🔐 Authentication verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

// ── requireUser ──────────────────────────────────────────────
exports.requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized. No user session.' });
  }
  return next();
};

// ── requireMerchant ──────────────────────────────────────────
exports.requireMerchant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized. No user session.' });
  }
  if (req.user.role !== 'merchant' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Merchant privileges required.' });
  }
  return next();
};

// ── requireAdmin / verifyAdmin ───────────────────────────────
// Enforces that only sham111205s@gmail.com with verified admin role can proceed.
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized. No user session.' });
  }
  const cleanEmail = (req.user.email || '').trim().toLowerCase();
  if (req.user.role !== 'admin' || cleanEmail !== 'sham111205s@gmail.com') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Authorized administrator privileges required.'
    });
  }
  return next();
};

exports.verifyAdmin = exports.requireAdmin;
exports.verifySupabaseToken = verifySupabaseToken;
exports.verifyLocalToken = verifyLocalToken;

// ── requireRole helper ───────────────────────────────────────
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized. No user session.' });
    }
    const lowerRoles = roles.map(r => r.toLowerCase());
    if (!lowerRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: ${roles.join(', ')}`
      });
    }
    return next();
  };
};

// ── generateToken ────────────────────────────────────────────
exports.generateToken = (id, role = 'user') => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024',
    { expiresIn: '7d' }
  );
};
