// ─────────────────────────────────────────────────────────────
//  backend/src/services/userStore.js
//  FoodieBite User Store with Supabase PostgreSQL Synchronization
// ─────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin, getSupabaseClient } = require('../config/supabase');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users_directory.json');

// In-memory cache
const usersMap = new Map();

/**
 * Initialize and load persisted user directory
 */
function initStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(u => {
          if (u.id || u.uid) {
            usersMap.set(u.id || u.uid, u);
          }
        });
      }
    }

    // Ensure authorized administrator account exists as admin
    const defaultAccounts = [
      {
        id: 'DIzyGlgaTgTW6MP1MVMVmEuIug93',
        uid: 'DIzyGlgaTgTW6MP1MVMVmEuIug93',
        name: 'SHAM S',
        email: 'sham111205s@gmail.com',
        role: 'admin',
        authProvider: 'google.com',
        accountStatus: 'active',
        disabled: false,
        emailVerified: true,
        dietType: 'Vegetarian',
        createdAt: '2026-01-15T00:00:00.000Z',
        lastSignInTime: new Date().toISOString()
      }
    ];

    usersMap.delete('admin_root');
    for (const [key, u] of usersMap.entries()) {
      if ((u.email || '').trim().toLowerCase() === 'admin@foodiebite.com') {
        usersMap.delete(key);
      }
    }

    defaultAccounts.forEach(acc => {
      const existing = findByEmail(acc.email);
      if (!existing) {
        usersMap.set(acc.id, acc);
      } else {
        usersMap.set(existing.id || existing.uid || acc.id, {
          ...existing,
          role: 'admin'
        });
      }
    });

    persist();
  } catch (err) {
    console.warn('⚠️ userStore initialization warning:', err.message);
  }
}

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to persist user directory:', err.message);
  }
}

function findByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  for (const u of usersMap.values()) {
    if ((u.email || '').trim().toLowerCase() === clean) {
      return u;
    }
  }
  return null;
}

function getAllUsers() {
  return Array.from(usersMap.values());
}

function getUserById(id) {
  if (!id) return null;
  return usersMap.get(id) || null;
}

/**
 * Upsert user record and sync to Supabase public.profiles
 */
function upsertUser(userData) {
  if (!userData) return null;

  const email = (userData.email || '').trim().toLowerCase();
  const uid = userData.uid || userData.id || (email ? `usr_${email.replace(/[^a-z0-9]/g, '_')}` : `usr_${Date.now()}`);

  const existingByUid = usersMap.get(uid);
  const existingByEmail = findByEmail(email);
  const existing = existingByUid || existingByEmail;

  const nowIso = new Date().toISOString();

  const isAuthorizedAdmin = (email === 'sham111205s@gmail.com');
  const role = isAuthorizedAdmin ? 'admin' : (userData.role === 'merchant' ? 'merchant' : 'user');

  let authProvider = userData.authProvider || existing?.authProvider || 'password';
  if (userData.providerId) authProvider = userData.providerId;
  if (!authProvider && email.includes('google')) authProvider = 'google.com';

  const merged = {
    id: uid,
    uid: uid,
    name: userData.name || userData.displayName || existing?.name || (email ? email.split('@')[0] : 'FoodieBite User'),
    email: email || existing?.email || '',
    authProvider: authProvider,
    role: role,
    accountStatus: userData.disabled ? 'disabled' : (userData.accountStatus || existing?.accountStatus || 'active'),
    disabled: userData.disabled !== undefined ? !!userData.disabled : (existing?.disabled || false),
    emailVerified: userData.emailVerified !== undefined ? !!userData.emailVerified : (existing?.emailVerified !== undefined ? existing.emailVerified : true),
    dietType: userData.dietType || userData.preferences?.dietType || existing?.dietType || 'Vegetarian',
    createdAt: existing?.createdAt || userData.createdAt || nowIso,
    lastSignInTime: userData.lastSignInTime || userData.lastLoginAt || nowIso,
    lastActiveAt: nowIso,
    preferences: {
      ...(existing?.preferences || {}),
      ...(userData.preferences || {}),
      dietType: userData.dietType || userData.preferences?.dietType || existing?.dietType || 'Vegetarian'
    }
  };

  if (existing && existing.id !== uid) {
    usersMap.delete(existing.id);
  }

  usersMap.set(uid, merged);
  persist();

  // Async sync to Supabase public.profiles
  try {
    const client = getSupabaseAdmin() || getSupabaseClient();
    if (client && uid) {
      client.from('profiles').upsert({
        id: uid,
        email: merged.email,
        name: merged.name,
        role: merged.role,
        diet_type: merged.dietType,
        preferences: merged.preferences,
        disabled: merged.disabled,
        account_status: merged.accountStatus,
        updated_at: nowIso
      }, { onConflict: 'id' }).catch(() => {});
    }
  } catch (_) {}

  return merged;
}

function updateUser(id, updates) {
  const existing = usersMap.get(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    uid: existing.uid,
    updatedAt: new Date().toISOString()
  };

  if (updates.disabled !== undefined) {
    updated.accountStatus = updates.disabled ? 'disabled' : 'active';
  }

  usersMap.set(id, updated);
  persist();

  // Async sync to Supabase public.profiles
  try {
    const client = getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.disabled !== undefined) {
        dbUpdates.disabled = Boolean(updates.disabled);
        dbUpdates.account_status = updates.disabled ? 'disabled' : 'active';
      }
      if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
      if (updates.dietType !== undefined) dbUpdates.diet_type = updates.dietType;
      dbUpdates.updated_at = new Date().toISOString();

      client.from('profiles').update(dbUpdates).eq('id', id).catch(() => {});
    }
  } catch (_) {}

  return updated;
}

function deleteUser(id) {
  const existed = usersMap.delete(id);
  if (existed) persist();

  // Async delete from Supabase public.profiles
  try {
    const client = getSupabaseAdmin() || getSupabaseClient();
    if (client) {
      client.from('profiles').delete().eq('id', id).catch(() => {});
    }
  } catch (_) {}

  return existed;
}

// Auto-init on module load
initStore();

module.exports = {
  getAllUsers,
  getUserById,
  findById: getUserById,
  findByEmail,
  upsertUser,
  updateUser,
  deleteUser
};
