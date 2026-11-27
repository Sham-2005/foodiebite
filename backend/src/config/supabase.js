// ─────────────────────────────────────────────────────────────
//  backend/src/config/supabase.js
//  FoodieBite Centralized Backend Supabase Client Configuration
//  Provides:
//    1. Standard client for public/anon operations (RLS enforced)
//    2. Scoped client for user-specific operations (with Authorization header)
//    3. Admin client for privileged background / administrative operations
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  '';

const supabaseKey = process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  '';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (process.env.SUPABASE_KEY && process.env.SUPABASE_KEY.startsWith('eyJ') && process.env.SUPABASE_KEY.length > 100 ? process.env.SUPABASE_KEY : null);

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  !supabaseUrl.includes('YOUR_PROJECT_REF')
);

let supabaseClient = null;
let supabaseAdminClient = null;

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    if (serviceRoleKey && serviceRoleKey.trim() !== '') {
      supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  } catch (err) {
    console.error('❌ [Backend Supabase] Failed to initialize client:', err.message);
  }
} else {
  console.warn('⚠️ [Backend Supabase] Client not initialized: SUPABASE_URL or SUPABASE_ANON_KEY missing.');
}

/**
 * Returns the default centralized backend Supabase client.
 */
function getSupabaseClient() {
  return supabaseClient;
}

/**
 * Returns a Supabase client scoped to an authenticated user's access token.
 * Queries executed with this client will have auth.uid() populated in Postgres,
 * strictly enforcing PostgreSQL Row-Level Security (RLS) policies.
 * 
 * @param {string} userToken - Verified Bearer access token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getUserSupabaseClient(userToken) {
  if (!isSupabaseConfigured || !userToken) {
    return supabaseClient;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
}

let mockSupabaseAdmin = null;

/**
 * Sets or clears a mock Supabase admin client for isolated unit testing.
 * @param {object|null} mock
 */
function setMockSupabaseAdmin(mock) {
  mockSupabaseAdmin = mock;
}

/**
 * Returns the privileged admin Supabase client (service role) if configured,
 * or falls back to standard client or test mock if injected.
 */
function getSupabaseAdmin() {
  return mockSupabaseAdmin || supabaseAdminClient || supabaseClient;
}

module.exports = {
  isSupabaseConfigured,
  getSupabaseClient,
  getUserSupabaseClient,
  getSupabaseAdmin,
  setMockSupabaseAdmin,
  supabaseUrl,
  supabaseKey,
};
