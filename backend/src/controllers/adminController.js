// ─────────────────────────────────────────────────────────────
//  src/controllers/adminController.js
//  Complete, Secure Administrator Controller for FoodieBite
//  Handles Paginated Users, Real Analytics, Feature Usage, Audit Logs & CSV Exports
// ─────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { getFirebaseAdmin, getFirestoreDb } = require('../config/firebase');
const {
  getFeatureUsageStats,
  logAdminAudit,
  getAdminAuditLogs,
  getReportingDateKey
} = require('../services/activityTrackingService');

// In-memory cache for overview metrics (TTL: 3 minutes)
let overviewMetricsCache = null;
let overviewMetricsCacheExpiry = 0;

// In-memory cache for fetchCombinedUsers (TTL: 10 seconds) to avoid repeated Firestore queries
let combinedUsersCache = null;
let combinedUsersCacheExpiry = 0;

function invalidateCombinedUsersCache() {
  combinedUsersCache = null;
  combinedUsersCacheExpiry = 0;
  overviewMetricsCache = null;
  overviewMetricsCacheExpiry = 0;
}

/**
 * Helper to escape CSV cell values against spreadsheet formula injection.
 * Prepends a single quote if the value begins with =, +, -, or @.
 */
function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // Formula injection prevention:
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape inner double quotes by doubling them
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Helper to fetch registered users by combining Firebase Auth with Firestore profiles.
 * Gracefully falls back to Firestore if Firebase Admin Auth credentials are not available.
 */
async function fetchCombinedUsers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && combinedUsersCache && now < combinedUsersCacheExpiry) {
    return combinedUsersCache;
  }

  const adminApp = getFirebaseAdmin();
  const db = getFirestoreDb();
  const userStore = require('../services/userStore');

  const userMap = new Map(); // uid -> unified user object

  // 1. Authoritative base from persistent userStore
  const localDirectoryUsers = userStore.getAllUsers();
  localDirectoryUsers.forEach(u => {
    const uid = u.id || u.uid;
    if (uid) {
      userMap.set(uid, {
        id: uid,
        uid: uid,
        name: u.name || (u.email ? u.email.split('@')[0] : 'User'),
        email: u.email || '',
        emailVerified: u.emailVerified !== undefined ? !!u.emailVerified : true,
        createdAt: u.createdAt || null,
        lastSignInTime: u.lastSignInTime || u.lastLoginAt || null,
        lastActiveAt: u.lastActiveAt || u.lastSignInTime || null,
        authProvider: u.authProvider || (u.email && u.email.includes('google') ? 'google.com' : 'password'),
        accountStatus: u.disabled ? 'disabled' : (u.accountStatus || 'active'),
        disabled: !!u.disabled,
        role: u.role || 'user',
        dietType: u.dietType || u.preferences?.dietType || 'Vegetarian',
        cuisines: u.cuisines || u.preferences?.cuisines || [],
        spiceLevel: u.spiceLevel || u.preferences?.spiceLevel || 'Medium',
        healthGoals: u.healthGoals || u.preferences?.healthGoals || [],
        allergies: u.allergies || u.preferences?.allergies || [],
        favoritesCount: Array.isArray(u.favoriteFoods) ? u.favoriteFoods.length : 0,
        profileMissing: false
      });
    }
  });

  const withTimeout = (promise, ms = 600) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

  // 2. Load Firestore user profiles (if connected)
  const firestoreDocs = new Map();
  if (db) {
    try {
      const snap = await withTimeout(db.collection('users').get());
      snap.forEach(doc => {
        firestoreDocs.set(doc.id, doc.data());
      });
    } catch (fsErr) {
      // Non-fatal if offline
    }
  }

  // 3. Authoritative source: Firebase Auth listUsers (if service account configured)
  try {
    if (adminApp && adminApp.auth) {
      let pageToken = undefined;
      do {
        const listResult = await withTimeout(adminApp.auth().listUsers(1000, pageToken));
        for (const userRecord of listResult.users) {
          const profile = firestoreDocs.get(userRecord.uid) || null;
          const prefs = profile?.preferences || {};
          const existing = userMap.get(userRecord.uid);

          const provider = userRecord.providerData?.[0]?.providerId || existing?.authProvider || 'password';

          userMap.set(userRecord.uid, {
            id: userRecord.uid,
            uid: userRecord.uid,
            name: profile?.name || userRecord.displayName || existing?.name || (userRecord.email ? userRecord.email.split('@')[0] : 'User'),
            email: userRecord.email || profile?.email || existing?.email || '',
            emailVerified: !!userRecord.emailVerified,
            createdAt: userRecord.metadata?.creationTime || profile?.createdAt || existing?.createdAt || null,
            lastSignInTime: userRecord.metadata?.lastSignInTime || profile?.lastLoginAt || existing?.lastSignInTime || null,
            lastActiveAt: profile?.lastActiveAt || existing?.lastActiveAt || null,
            authProvider: provider,
            accountStatus: (userRecord.disabled || profile?.disabled === true) ? 'disabled' : 'active',
            disabled: !!userRecord.disabled || profile?.disabled === true,
            role: profile?.role || (userRecord.customClaims?.role) || (userRecord.customClaims?.admin ? 'admin' : (existing?.role || 'user')),
            dietType: prefs.dietType || profile?.dietType || existing?.dietType || 'Not configured',
            cuisines: prefs.cuisines || profile?.cuisines || existing?.cuisines || [],
            spiceLevel: prefs.spiceLevel || profile?.spiceLevel || existing?.spiceLevel || 'Not set',
            healthGoals: prefs.healthGoals || profile?.healthGoals || existing?.healthGoals || [],
            allergies: prefs.allergies || profile?.allergies || existing?.allergies || [],
            favoritesCount: Array.isArray(profile?.favorites) ? profile.favorites.length : (existing?.favoritesCount || 0),
            profileMissing: !profile
          });
        }
        pageToken = listResult.pageToken;
      } while (pageToken);
    }
  } catch (authErr) {
    // Non-fatal if service account credentials are not configured locally
  }

  // 4. Merge Firestore profiles
  for (const [uid, profile] of firestoreDocs.entries()) {
    const prefs = profile?.preferences || {};
    const existing = userMap.get(uid);

    userMap.set(uid, {
      id: uid,
      uid: uid,
      name: profile?.name || existing?.name || (profile?.email ? profile.email.split('@')[0] : 'User'),
      email: profile?.email || existing?.email || '',
      emailVerified: profile?.emailVerified !== undefined ? !!profile.emailVerified : (existing?.emailVerified || false),
      createdAt: profile?.createdAt || profile?.registeredAt || existing?.createdAt || null,
      lastSignInTime: profile?.lastLoginAt || existing?.lastSignInTime || null,
      lastActiveAt: profile?.lastActiveAt || existing?.lastActiveAt || null,
      authProvider: profile?.authProvider || existing?.authProvider || 'password',
      accountStatus: (profile?.disabled === true || existing?.disabled) ? 'disabled' : 'active',
      disabled: profile?.disabled === true || !!existing?.disabled,
      role: profile?.role || existing?.role || 'user',
      dietType: prefs.dietType || profile?.dietType || existing?.dietType || 'Not configured',
      cuisines: prefs.cuisines || profile?.cuisines || existing?.cuisines || [],
      spiceLevel: prefs.spiceLevel || profile?.spiceLevel || existing?.spiceLevel || 'Not set',
      healthGoals: prefs.healthGoals || profile?.healthGoals || existing?.healthGoals || [],
      allergies: prefs.allergies || profile?.allergies || existing?.allergies || [],
      favoritesCount: Array.isArray(profile?.favorites) ? profile.favorites.length : (existing?.favoritesCount || 0),
      profileMissing: false
    });
  }

  const finalUsers = Array.from(userMap.values());
  combinedUsersCache = finalUsers;
  combinedUsersCacheExpiry = Date.now() + 10000; // 10-second TTL
  return finalUsers;
}

/**
 * Filter, search, and sort users helper
 */
function filterAndSortUsers(users, { q, dietType, status, emailVerified, sortBy = 'createdAt', sortOrder = 'desc' }) {
  let result = [...users];

  // 1. Search by name, email, or user ID
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    result = result.filter(u =>
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.id && u.id.toLowerCase().includes(term))
    );
  }

  // 2. Filter by dietary preference
  if (dietType && dietType !== 'all') {
    const targetDiet = dietType.toLowerCase();
    result = result.filter(u => (u.dietType || '').toLowerCase() === targetDiet);
  }

  // 3. Filter by account status (active vs disabled)
  if (status && status !== 'all') {
    if (status === 'active') {
      result = result.filter(u => !u.disabled);
    } else if (status === 'disabled') {
      result = result.filter(u => !!u.disabled);
    }
  }

  // 4. Filter by email verification status
  if (emailVerified !== undefined && emailVerified !== '' && emailVerified !== 'all') {
    const isVerified = emailVerified === 'true' || emailVerified === true;
    result = result.filter(u => u.emailVerified === isVerified);
  }

  // 5. Sorting
  result.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === 'createdAt') {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
}

// ═════════════════════════════════════════════════════════════
//  USER MANAGEMENT ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * Get paginated, searchable, filterable users (GET /api/admin/users)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const { q, dietType, status, emailVerified, sortBy, sortOrder, refresh } = req.query;

    const allUsers = await fetchCombinedUsers(refresh === 'true');
    const filteredUsers = filterAndSortUsers(allUsers, {
      q,
      dietType,
      status,
      emailVerified,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc'
    });

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedUsers = filteredUsers.slice(startIndex, startIndex + limit);

    res.status(200).json({
      success: true,
      users: pagedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('getAllUsers failed:', err.message);
    next(err);
  }
};

/**
 * Get individual user details (GET /api/admin/users/:id)
 * Excludes sensitive health data, passwords, and raw medical reports.
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminApp = getFirebaseAdmin();
    const db = getFirestoreDb();

    let authRecord = null;
    try {
      if (adminApp && adminApp.auth) {
        authRecord = await adminApp.auth().getUser(id);
      }
    } catch (e) {
      // User not in auth or auth offline
    }

    let profileDoc = null;
    if (db) {
      try {
        const snap = await db.collection('users').doc(id).get();
        if (snap.exists) {
          profileDoc = snap.data();
        }
      } catch (e) {
        console.warn(`Firestore read failed for user ${id}:`, e.message);
      }
    }

    if (!authRecord && !profileDoc) {
      const userStore = require('../services/userStore');
      profileDoc = userStore.getUserById(id) || userStore.findByEmail(id);
    }

    if (!authRecord && !profileDoc) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    if (profileDoc && profileDoc.medicalReports) {
      delete profileDoc.medicalReports;
    }

    const prefs = profileDoc?.preferences || {};

    const userEmail = (authRecord?.email || profileDoc?.email || '').toLowerCase().trim();

    // ── 1. Aggregate REAL Sent Emails for this User ───────────
    const sentEmails = [];
    if (db && userEmail) {
      try {
        // Query email_logs collection
        const emailSnap = await db.collection('email_logs')
          .where('recipient', '==', userEmail)
          .get();
        emailSnap.forEach(doc => {
          const d = doc.data();
          sentEmails.push({
            id: doc.id,
            subject: d.subject || 'Notification from FoodieBite',
            recipient: d.recipient || userEmail,
            sender: d.sender || 'FoodieBite <onboarding@resend.dev>',
            status: d.status || 'delivered',
            timestamp: d.timestamp || null,
            type: d.type || 'system_email'
          });
        });
      } catch (eErr) {
        console.warn('⚠️ Could not query email_logs:', eErr.message);
      }

      // If user doc has welcomeEmailSent: true and not in email_logs
      if (profileDoc?.welcomeEmailSent === true && !sentEmails.some(e => (e.subject || '').includes('Welcome'))) {
        sentEmails.push({
          id: `welcome_${id}`,
          subject: 'Welcome to FoodieBite! 🍏 Your Personalized Nutrition Journey Begins',
          recipient: userEmail,
          sender: 'FoodieBite <onboarding@resend.dev>',
          status: 'delivered',
          timestamp: profileDoc.welcomeEmailSentAt || profileDoc.createdAt || authRecord?.metadata?.creationTime || null,
          type: 'welcome'
        });
      }

      // Check feedback resolution emails sent to this user
      try {
        const fbSnap = await db.collection('feedback').where('email', '==', userEmail).get();
        fbSnap.forEach(doc => {
          const fb = doc.data();
          if (fb.status === 'resolved' && fb.replyMessage) {
            sentEmails.push({
              id: `resolution_${doc.id}`,
              subject: 'Re: Your FoodieBite Feedback Resolution',
              recipient: userEmail,
              sender: 'FoodieBite Support <onboarding@resend.dev>',
              status: 'delivered',
              timestamp: fb.resolvedAt || fb.updatedAt || fb.createdAt || null,
              type: 'support_resolution',
              details: fb.replyMessage
            });
          }
        });
      } catch (fbErr) {
        console.warn('⚠️ Could not query feedback resolution emails:', fbErr.message);
      }
    }

    // Sort emails newest first
    sentEmails.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });

    // ── 2. Aggregate REAL Activity Logs for this User ──────────
    const realActivities = [];

    // A. Registration Event
    const regTime = authRecord?.metadata?.creationTime || profileDoc?.createdAt || profileDoc?.registeredAt;
    if (regTime) {
      realActivities.push({
        id: `act_reg_${id}`,
        type: 'registration',
        title: 'Account Registered',
        details: `Account created with email ${userEmail || 'registered user'}`,
        timestamp: new Date(regTime).toISOString()
      });
    }

    // B. Last Sign In
    const loginTime = authRecord?.metadata?.lastSignInTime || profileDoc?.lastLoginAt;
    if (loginTime) {
      realActivities.push({
        id: `act_login_${id}`,
        type: 'login',
        title: 'User Signed In',
        details: 'User authenticated into FoodieBite session',
        timestamp: new Date(loginTime).toISOString()
      });
    }

    // C. Password Changed / Security Events
    if (profileDoc?.passwordUpdatedAt || profileDoc?.passwordChangedAt) {
      realActivities.push({
        id: `act_pwd_${id}`,
        type: 'password_change',
        title: 'Password Updated',
        details: 'User successfully updated account password',
        timestamp: new Date(profileDoc.passwordUpdatedAt || profileDoc.passwordChangedAt).toISOString()
      });
    } else if (authRecord?.tokensValidAfterTime && regTime) {
      const validAfter = new Date(authRecord.tokensValidAfterTime).getTime();
      const created = new Date(regTime).getTime();
      // If tokensValidAfterTime is noticeably after creation time, password was updated
      if (validAfter - created > 60000) {
        realActivities.push({
          id: `act_pwd_token_${id}`,
          type: 'password_change',
          title: 'Password / Credentials Changed',
          details: 'Account credentials updated and authentication tokens refreshed',
          timestamp: new Date(validAfter).toISOString()
        });
      }
    }

    // D. Profile & Dietary Preferences Updated
    const prefTime = profileDoc?.preferencesUpdatedAt || profileDoc?.updatedAt;
    if (prefTime) {
      realActivities.push({
        id: `act_pref_${id}`,
        type: 'preference_update',
        title: 'Dietary Preference Set',
        details: `Diet type configured to ${prefs.dietType || profileDoc?.dietType || 'Vegetarian'}`,
        timestamp: new Date(prefTime).toISOString()
      });
    }

    if (db) {
      // E. Feedback Submitted
      try {
        const fbSnap = await db.collection('feedback').where('email', '==', userEmail).get();
        fbSnap.forEach(doc => {
          const fb = doc.data();
          if (fb.createdAt) {
            realActivities.push({
              id: `act_fb_${doc.id}`,
              type: 'feedback',
              title: `Feedback Submitted (${'⭐'.repeat(fb.rating || 5)})`,
              details: fb.message ? (fb.message.length > 70 ? fb.message.slice(0, 67) + '...' : fb.message) : 'Feedback submitted',
              timestamp: new Date(fb.createdAt).toISOString()
            });
          }
        });
      } catch (fbErr) {
        console.warn('⚠️ Could not query user feedback:', fbErr.message);
      }

      // F. Admin Audit Actions on this User
      try {
        const auditSnap = await db.collection('admin_audit_logs').where('details.targetUserId', '==', id).get();
        auditSnap.forEach(doc => {
          const a = doc.data();
          if (a.timestamp) {
            realActivities.push({
              id: `act_adm_${doc.id}`,
              type: 'admin_action',
              title: `Admin Action: ${a.action}`,
              details: `Executed by administrator (${a.adminEmail || 'admin'})`,
              timestamp: new Date(a.timestamp).toISOString()
            });
          }
        });
      } catch (auditErr) {
        console.warn('⚠️ Could not query user admin_audit_logs:', auditErr.message);
      }
    }

    // H. Behavioral interaction events
    const rawEvents = profileDoc?.behavioralEvents || [];
    rawEvents.slice(-10).reverse().forEach(ev => {
      if (ev.timestamp) {
        realActivities.push({
          id: `act_beh_${ev.timestamp}_${Math.random()}`,
          type: 'food_interaction',
          title: `Food Activity: ${String(ev.type || 'interaction').replace(/_/g, ' ')}`,
          details: ev.foodName ? `Food: ${ev.foodName}` : (ev.cuisine ? `Cuisine: ${ev.cuisine}` : 'App interaction'),
          timestamp: new Date(ev.timestamp).toISOString()
        });
      }
    });

    // Sort activities descending by timestamp
    realActivities.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });

    const userDetails = {
      id: id,
      uid: id,
      name: profileDoc?.name || authRecord?.displayName || (userEmail ? userEmail.split('@')[0] : 'User'),
      email: userEmail,
      emailVerified: authRecord ? !!authRecord.emailVerified : !!profileDoc?.emailVerified,
      createdAt: authRecord?.metadata?.creationTime || profileDoc?.createdAt || null,
      lastSignInTime: authRecord?.metadata?.lastSignInTime || profileDoc?.lastLoginAt || null,
      lastActiveAt: profileDoc?.lastActiveAt || null,
      disabled: authRecord ? !!authRecord.disabled : profileDoc?.disabled === true,
      role: profileDoc?.role || (authRecord?.customClaims?.role) || (authRecord?.customClaims?.admin ? 'admin' : 'user'),
      dietType: prefs.dietType || profileDoc?.dietType || 'Not configured',
      cuisines: prefs.cuisines || profileDoc?.cuisines || [],
      spiceLevel: prefs.spiceLevel || profileDoc?.spiceLevel || 'Not set',
      healthGoals: prefs.healthGoals || profileDoc?.healthGoals || [],
      allergies: prefs.allergies || profileDoc?.allergies || [],
      favoritesCount: Array.isArray(profileDoc?.favorites) ? profileDoc.favorites.length : 0,
      emails: sentEmails,
      activities: realActivities,
      recentActivity: realActivities.slice(0, 10),
      profileMissing: !profileDoc
    };

    // Log administrative inspection audit
    await logAdminAudit(req.user, 'VIEW_USER_DETAILS', { targetUserId: id, targetEmail: userDetails.email });

    res.status(200).json({ success: true, user: userDetails });
  } catch (err) {
    next(err);
  }
};

/**
 * Export filtered users to CSV (GET /api/admin/users/export)
 * Enforces field restrictions and spreadsheet formula injection protection.
 */
exports.exportUsersCsv = async (req, res, next) => {
  try {
    const { q, dietType, status, emailVerified, sortBy, sortOrder } = req.query;

    const allUsers = await fetchCombinedUsers();
    const filteredUsers = filterAndSortUsers(allUsers, {
      q,
      dietType,
      status,
      emailVerified,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc'
    });

    // Permitted columns only:
    // User ID, Name, Email, Registration Date, Email Verification Status, Dietary Preference, Account Status, Role
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Registration Date',
      'Email Verification Status',
      'Dietary Preference',
      'Account Status',
      'Role'
    ];

    const rows = filteredUsers.map(u => [
      sanitizeCsvValue(u.id || u.uid),
      sanitizeCsvValue(u.name || ''),
      sanitizeCsvValue(u.email || ''),
      sanitizeCsvValue(u.createdAt ? new Date(u.createdAt).toISOString() : 'N/A'),
      sanitizeCsvValue(u.emailVerified ? 'Verified' : 'Unverified'),
      sanitizeCsvValue(u.dietType || 'Not configured'),
      sanitizeCsvValue(u.disabled ? 'Disabled' : 'Active'),
      sanitizeCsvValue(u.role || 'user')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    // Audit log
    await logAdminAudit(req.user, 'EXPORT_USERS_CSV', {
      exportedCount: filteredUsers.length,
      filters: { q, dietType, status, emailVerified }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="foodiebite_users_export.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('exportUsersCsv error:', err.message);
    next(err);
  }
};

/**
 * Update user details or role (PUT /api/admin/users/:id)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, name, disabled } = req.body;
    const db = getFirestoreDb();

    if (db) {
      const userDocRef = db.collection('users').doc(id);
      const updates = {};
      if (role !== undefined) updates.role = role;
      if (name !== undefined) updates.name = name;
      if (disabled !== undefined) updates.disabled = disabled;
      updates.updatedAt = new Date().toISOString();

      await userDocRef.set(updates, { merge: true });
    }

    await logAdminAudit(req.user, 'UPDATE_USER', { targetUserId: id, updates: { role, name, disabled } });
    invalidateCombinedUsersCache();

    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Disable or enable user account (PUT /api/admin/users/:id/disable)
 */
exports.disableUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body;
    const isDisabled = !!disabled;
    const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

    // Verify requester is authorized administrator
    const requesterEmail = (req.user?.email || '').trim().toLowerCase();
    if (requesterEmail !== AUTHORIZED_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the authorized administrator may disable accounts.'
      });
    }

    const db = getFirestoreDb();
    const adminApp = getFirebaseAdmin();
    const userStore = require('../services/userStore');

    // Retrieve target user info to check email
    let targetEmail = '';
    const localUser = userStore.getUserById(id);
    if (localUser) targetEmail = localUser.email;
    if (!targetEmail && db) {
      try {
        const uDoc = await db.collection('users').doc(id).get();
        if (uDoc.exists) targetEmail = uDoc.data().email;
      } catch (_) {}
    }
    if (!targetEmail && adminApp && adminApp.auth) {
      try {
        const fbRec = await adminApp.auth().getUser(id);
        if (fbRec) targetEmail = fbRec.email;
      } catch (_) {}
    }

    const cleanTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (cleanTargetEmail === AUTHORIZED_ADMIN_EMAIL || id === 'DIzyGlgaTgTW6MP1MVMVmEuIug93' || id === req.user?.uid || id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Operation blocked: Cannot disable the authorized administrator account.'
      });
    }

    // 1. Update in Firestore
    if (db) {
      try {
        await db.collection('users').doc(id).set({
          disabled: isDisabled,
          accountStatus: isDisabled ? 'disabled' : 'active',
          disabledAt: isDisabled ? new Date().toISOString() : null
        }, { merge: true });
      } catch (dbErr) {
        console.warn(`Firestore disabled status sync note for ${id}:`, dbErr.message);
      }
    }

    // 2. Update in Firebase Auth & revoke sessions if disabled
    try {
      if (adminApp && adminApp.auth) {
        await adminApp.auth().updateUser(id, { disabled: isDisabled });
        if (isDisabled) {
          await adminApp.auth().revokeRefreshTokens(id);
        }
      }
    } catch (authErr) {
      console.warn(`Auth disabled status sync warning for ${id}:`, authErr.message);
    }

    // 3. Update in userStore
    userStore.updateUser(id, {
      disabled: isDisabled,
      accountStatus: isDisabled ? 'disabled' : 'active',
      disabledAt: isDisabled ? new Date().toISOString() : null
    });

    await logAdminAudit(req.user, isDisabled ? 'DISABLE_USER' : 'ENABLE_USER', {
      targetUserId: id,
      targetEmail: cleanTargetEmail || 'unknown'
    });
    invalidateCombinedUsersCache();

    res.status(200).json({
      success: true,
      message: `User account has been ${isDisabled ? 'disabled' : 'enabled'} successfully`,
      disabled: isDisabled
    });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════
//  OVERVIEW & METRICS ENDPOINTS
// ═════════════════════════════════════════════════════════════

/**
 * Get Overview Dashboard Metrics (GET /api/admin/metrics/overview)
 * Includes Total Users, New Today, New This Week, New This Month,
 * Active Users in the Last 30 Days (via recorded activity), and Verified Emails.
 */
exports.getOverviewMetrics = async (req, res, next) => {
  try {
    const now = Date.now();
    const bypassCache = req.query.refresh === 'true';

    // Serve from cache if still valid
    if (!bypassCache && overviewMetricsCache && now < overviewMetricsCacheExpiry) {
      return res.status(200).json({
        success: true,
        cached: true,
        metrics: overviewMetricsCache
      });
    }

    const allUsers = await fetchCombinedUsers();
    const totalUsers = allUsers.length;

    // Date boundaries (UTC consistent reporting boundaries)
    const currentDate = new Date();
    const todayMidnight = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate())).getTime();

    // Start of current week (Sunday midnight UTC)
    const currentDayOfWeek = currentDate.getUTCDay();
    const startOfWeek = new Date(todayMidnight - currentDayOfWeek * 24 * 60 * 60 * 1000).getTime();

    // Start of current month (1st of month UTC)
    const startOfMonth = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1)).getTime();

    // 30 days cutoff
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let newToday = 0;
    let newThisWeek = 0;
    let newThisMonth = 0;
    let verifiedEmailAccounts = 0;
    let activeUsersLast30Days = 0;

    for (const u of allUsers) {
      const regTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      if (regTime >= todayMidnight) newToday++;
      if (regTime >= startOfWeek) newThisWeek++;
      if (regTime >= startOfMonth) newThisMonth++;

      if (u.emailVerified) verifiedEmailAccounts++;

      // Active user definition: actual recorded activity within 30 days
      const lastActiveTime = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
      if (lastActiveTime >= thirtyDaysAgo) {
        activeUsersLast30Days++;
      }
    }

    const computedMetrics = {
      totalRegisteredUsers: totalUsers,
      newRegistrationsToday: newToday,
      newRegistrationsThisWeek: newThisWeek,
      newRegistrationsThisMonth: newThisMonth,
      activeUsersInLast30Days: activeUsersLast30Days,
      verifiedEmailAccounts: verifiedEmailAccounts,
      activeUserTrackingStatus: 'active_recorded_events', // based on actual recorded activity
      reportingTimezone: 'UTC',
      updatedAt: new Date().toISOString()
    };

    // Cache for 3 minutes
    overviewMetricsCache = computedMetrics;
    overviewMetricsCacheExpiry = now + 3 * 60 * 1000;

    res.status(200).json({
      success: true,
      cached: false,
      metrics: computedMetrics
    });
  } catch (err) {
    console.error('getOverviewMetrics error:', err.message);
    next(err);
  }
};

/**
 * Get User Analytics Trends (GET /api/admin/metrics/user-analytics)
 * Generates registration trends, dietary distribution, and active user timelines.
 */
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const range = req.query.range || '30d'; // 7d, 30d, 90d
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;

    const allUsers = await fetchCombinedUsers();
    const now = Date.now();
    const cutoffTime = now - days * 24 * 60 * 60 * 1000;

    // 1. Dietary Preference Distribution
    const dietCounts = {};
    for (const u of allUsers) {
      const diet = u.dietType || 'Not configured';
      dietCounts[diet] = (dietCounts[diet] || 0) + 1;
    }

    const dietaryDistribution = Object.entries(dietCounts).map(([label, count]) => ({
      label,
      count,
      percentage: allUsers.length > 0 ? Math.round((count / allUsers.length) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // 2. Daily Registration Timeline
    const timelineMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = getReportingDateKey(d);
      timelineMap.set(key, 0);
    }

    for (const u of allUsers) {
      if (u.createdAt) {
        const uDate = new Date(u.createdAt);
        const key = getReportingDateKey(uDate);
        if (timelineMap.has(key)) {
          timelineMap.set(key, timelineMap.get(key) + 1);
        }
      }
    }

    let runningTotal = 0;
    const registrationsTimeline = Array.from(timelineMap.entries()).map(([date, count]) => {
      runningTotal += count;
      return { date, count, cumulative: runningTotal };
    });

    res.status(200).json({
      success: true,
      range,
      days,
      totalUsers: allUsers.length,
      dietaryDistribution,
      registrationsTimeline
    });
  } catch (err) {
    console.error('getUserAnalytics error:', err.message);
    next(err);
  }
};

/**
 * Get Feature Usage Analytics (GET /api/admin/metrics/feature-usage)
 */
exports.getFeatureUsageAnalytics = async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const stats = await getFeatureUsageStats(days);

    res.status(200).json({
      success: true,
      ...stats
    });
  } catch (err) {
    console.error('getFeatureUsageAnalytics error:', err.message);
    next(err);
  }
};

/**
 * Get Admin Audit Logs (GET /api/admin/audit-logs)
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const logs = await getAdminAuditLogs(limit);

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════
//  EXISTING ADMIN ENDPOINTS (PRESERVED)
// ═════════════════════════════════════════════════════════════

/**
 * Medical reports are private to the individual user and excluded from the Admin Dashboard (GET /api/admin/reports)
 */
exports.getAllReports = async (req, res, next) => {
  try {
    // Medical reports contain sensitive personal health information and are strictly excluded from admin APIs
    res.status(200).json({
      success: true,
      reports: [],
      message: 'Medical reports are private personal health records and are not accessible to administrators.'
    });
  } catch (err) {
    next(err);
  }
};

const feedbackStore = require('../services/feedbackStore');

/**
 * Get all feedback with search, category/rating/status filtering, and pagination (GET /api/admin/feedback)
 */
exports.getAllFeedback = async (req, res, next) => {
  try {
    const { category, status, rating, q, page, limit } = req.query;
    const feedbackList = await feedbackStore.getAllFeedback({ category, status, rating, q });
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const total = feedbackList.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const paginated = (page && limit)
      ? feedbackList.slice((pageNum - 1) * limitNum, pageNum * limitNum)
      : feedbackList;

    res.status(200).json({
      success: true,
      feedback: paginated,
      total,
      page: pageNum,
      totalPages
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update feedback status, internal admin notes, and reviewer tracking (PUT /api/admin/feedback/:id)
 */
exports.updateFeedbackStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, internalNotes, replyMessage } = req.body;
    const adminUser = req.user;

    const existing = await feedbackStore.getFeedbackById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Feedback ticket ${id} not found` });
    }

    const updates = {
      status: status || existing.status,
      internalNotes: internalNotes !== undefined ? internalNotes : (existing.internalNotes || null),
      reviewedBy: adminUser?.email || adminUser?.id || 'admin@foodiebite.com',
      reviewedAt: new Date().toISOString()
    };

    if (replyMessage) {
      updates.replyMessage = replyMessage;
    }

    const updated = await feedbackStore.updateFeedback(id, updates);

    // If replyMessage is provided, optionally send email reply to user
    if (replyMessage && existing.email) {
      try {
        const mailService = require('../services/mailService');
        await mailService.sendFeedbackResolutionEmail({
          name: existing.name,
          email: existing.email,
          replyMessage,
          originalMessage: existing.message
        });
      } catch (e) {
        console.warn('Feedback reply email note:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Feedback ticket updated successfully',
      feedback: updated
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete feedback (DELETE /api/admin/feedback/:id)
 */
exports.deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    await feedbackStore.deleteFeedback(id);
    res.status(200).json({ success: true, message: 'Feedback ticket removed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all AI logs (GET /api/admin/ai-logs)
 */
exports.getAiLogs = async (req, res, next) => {
  try {
    const db = getFirestoreDb();
    const logs = [];

    if (db) {
      try {
        const snapshot = await db.collection('ai_logs').orderBy('timestamp', 'desc').limit(100).get();
        snapshot.forEach(doc => {
          logs.push({ id: doc.id, ...doc.data() });
        });
      } catch (dbErr) {
        console.error('Firestore ai_logs read failed:', dbErr.message);
      }
    }
    res.status(200).json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};

/**
 * Legacy summary analytics (GET /api/admin/analytics)
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const db = getFirestoreDb();
    const allUsers = await fetchCombinedUsers();
    let totalUsers = allUsers.length;
    let activeUsers = allUsers.filter(u => !u.disabled).length;
    let totalFeedback = 0;
    let avgFeedbackRating = 0;
    let totalAiQueries = 0;
    let geminiCount = 0;
    let fallbackCount = 0;
    let aiSuccessRate = 100;

    if (db) {
      try {
        const feedbackSnap = await db.collection('feedback').get();
        totalFeedback = feedbackSnap.size;
        let ratingSum = 0;
        feedbackSnap.forEach(doc => {
          ratingSum += doc.data().rating || 0;
        });
        avgFeedbackRating = totalFeedback > 0 ? (ratingSum / totalFeedback).toFixed(2) : 0;
      } catch (dbErr) {
        console.error('Analytics feedback read failed:', dbErr.message);
      }

      try {
        const logsSnap = await db.collection('ai_logs').get();
        totalAiQueries = logsSnap.size;
        let successCount = 0;
        logsSnap.forEach(doc => {
          const data = doc.data();
          if (data.source === 'gemini') geminiCount++;
          if (data.source === 'fallback') fallbackCount++;
          if (data.success === true) successCount++;
        });
        aiSuccessRate = totalAiQueries > 0 ? ((successCount / totalAiQueries) * 100).toFixed(1) : 100;
      } catch (dbErr) {
        console.error('Analytics ai_logs read failed:', dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      analytics: {
        totalUsers,
        activeUsers,
        totalFeedback,
        avgFeedbackRating,
        totalAiQueries,
        geminiCount,
        fallbackCount,
        aiSuccessRate
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Restaurant requests endpoints
 */
exports.getRestaurantRequests = async (req, res, next) => {
  try {
    const restaurantRequestStore = require('../services/restaurantRequestStore');
    const { status } = req.query;
    const requests = await restaurantRequestStore.getAllRequests(status);

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    next(err);
  }
};

exports.getRestaurantRequestById = async (req, res, next) => {
  try {
    const restaurantRequestStore = require('../services/restaurantRequestStore');
    const { id } = req.params;
    const request = await restaurantRequestStore.getRequestById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Restaurant request not found.' });
    }

    return res.status(200).json({
      success: true,
      request
    });
  } catch (err) {
    next(err);
  }
};

exports.approveRestaurantRequest = async (req, res, next) => {
  try {
    const restaurantRequestStore = require('../services/restaurantRequestStore');
    const { id } = req.params;

    const request = await restaurantRequestStore.approveRequest(id, req.user);
    await logAdminAudit(req.user, 'APPROVE_RESTAURANT_REQUEST', { requestId: id });

    return res.status(200).json({
      success: true,
      message: 'Restaurant request approved successfully.',
      status: 'APPROVED',
      request
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

exports.rejectRestaurantRequest = async (req, res, next) => {
  try {
    const restaurantRequestStore = require('../services/restaurantRequestStore');
    const { id } = req.params;
    const { rejectionReason, reason } = req.body;

    const finalReason = rejectionReason || reason;
    const request = await restaurantRequestStore.rejectRequest(id, req.user, finalReason);
    await logAdminAudit(req.user, 'REJECT_RESTAURANT_REQUEST', { requestId: id, reason: finalReason });

    return res.status(200).json({
      success: true,
      message: 'Restaurant request rejected successfully.',
      status: 'REJECTED',
      request
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.includes('reason for rejection is required')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * Permanently delete user account and associated application records (DELETE /api/admin/users/:id)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

    // Verify requester is authorized administrator
    const requesterEmail = (req.user?.email || '').trim().toLowerCase();
    if (requesterEmail !== AUTHORIZED_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only the authorized administrator may delete accounts.'
      });
    }

    const db = getFirestoreDb();
    const adminApp = getFirebaseAdmin();
    const userStore = require('../services/userStore');

    // Retrieve target user info to check email
    let targetEmail = '';
    const localUser = userStore.getUserById(id);
    if (localUser) targetEmail = localUser.email;

    if (!targetEmail && db) {
      try {
        const uDoc = await db.collection('users').doc(id).get();
        if (uDoc.exists) targetEmail = uDoc.data().email;
      } catch (_) {}
    }

    if (!targetEmail && adminApp && adminApp.auth) {
      try {
        const fbRec = await adminApp.auth().getUser(id);
        if (fbRec) targetEmail = fbRec.email;
      } catch (_) {}
    }

    const cleanTargetEmail = (targetEmail || '').trim().toLowerCase();
    if (cleanTargetEmail === AUTHORIZED_ADMIN_EMAIL || id === 'DIzyGlgaTgTW6MP1MVMVmEuIug93' || id === req.user?.uid || id === req.user?.id) {
      return res.status(400).json({
        success: false,
        message: 'Operation blocked: Cannot delete the authorized administrator account.'
      });
    }

    // 1. Delete from Firebase Auth if exists
    if (adminApp && adminApp.auth) {
      try {
        await adminApp.auth().deleteUser(id);
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn(`Auth deletion note for ${id}:`, authErr.message);
        }
      }
    }

    // 2. Delete from Firestore: user document & subcollections
    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore connection timeout')), 1000));
        const userDocRef = db.collection('users').doc(id);

        // Fast probe to verify if Firestore is online
        await Promise.race([userDocRef.get(), timeoutPromise]);

        const subcollections = [
          'settings', 'preferences', 'loginHistory', 'activityLogs',
          'threads', 'mealLogs', 'gamification', 'emailHistory',
          'medicalReports', 'deficiencies'
        ];

        for (const sub of subcollections) {
          try {
            const snap = await userDocRef.collection(sub).get();
            if (!snap.empty) {
              const batch = db.batch();
              snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
              await batch.commit();
            }
          } catch (_) {}
        }

        // Delete top-level medicalReports for this user
        try {
          const medSnap = await db.collection('medicalReports').where('userId', '==', id).get();
          if (!medSnap.empty) {
            const medBatch = db.batch();
            medSnap.docs.forEach(docSnap => medBatch.delete(docSnap.ref));
            await medBatch.commit();
          }
        } catch (_) {}

        // Delete top-level feedback submitted by this user
        try {
          const fbSnap = await db.collection('feedback').where('userId', '==', id).get();
          if (!fbSnap.empty) {
            const fbBatch = db.batch();
            fbSnap.docs.forEach(docSnap => fbBatch.delete(docSnap.ref));
            await fbBatch.commit();
          }
        } catch (_) {}

        // Delete top-level searchHistory for this user
        try {
          const shSnap = await db.collection('searchHistory').where('userId', '==', id).get();
          if (!shSnap.empty) {
            const shBatch = db.batch();
            shSnap.docs.forEach(docSnap => shBatch.delete(docSnap.ref));
            await shBatch.commit();
          }
        } catch (_) {}

        // Finally delete the user master document
        await userDocRef.delete();
      } catch (dbErr) {
        console.warn(`Firestore user deletion warning for ${id}:`, dbErr.message);
      }
    }

    // 3. Delete from userStore
    userStore.deleteUser(id);

    // 4. Log admin audit
    await logAdminAudit(req.user, 'DELETE_USER', {
      targetUserId: id,
      targetEmail: cleanTargetEmail || 'unknown'
    });
    invalidateCombinedUsersCache();

    return res.status(200).json({
      success: true,
      permanent: true,
      message: 'User account and all associated records permanently deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════
//  ADMIN NOTIFICATION SETTINGS CONTROLLERS
// ═════════════════════════════════════════════════════════════

const NOTIF_SETTINGS_FILE = path.join(__dirname, '../../data/notification_settings.json');

const defaultGlobalNotificationSettings = {
  welcomeEmailEnabled: true,
  dailyRecommendationsEnabled: true,
  dailyRecommendationCron: '0 9 * * *',
  dailyRecommendationTimezone: 'Asia/Kolkata',
  marketingEmailsEnabled: false,
  securityAlertsEnabled: true,
  feedbackAlertsEnabled: true,
  updatedAt: new Date().toISOString()
};

function readGlobalNotificationSettings() {
  try {
    if (fs.existsSync(NOTIF_SETTINGS_FILE)) {
      return { ...defaultGlobalNotificationSettings, ...JSON.parse(fs.readFileSync(NOTIF_SETTINGS_FILE, 'utf8')) };
    }
  } catch (_) {}
  return { ...defaultGlobalNotificationSettings };
}

function writeGlobalNotificationSettings(settings) {
  try {
    const dir = path.dirname(NOTIF_SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NOTIF_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error persisting notification settings:', e);
  }
}

exports.getNotificationSettings = async (req, res, next) => {
  try {
    const db = getFirestoreDb();
    let settings = readGlobalNotificationSettings();
    if (db) {
      try {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ __timedOut: true }), 1000));
        const snap = await Promise.race([
          db.collection('system').doc('notifications').get(),
          timeoutPromise
        ]);
        if (snap && !snap.__timedOut && snap.exists) {
          settings = { ...settings, ...snap.data() };
        }
      } catch (_) {}
    }
    res.status(200).json({ success: true, settings });
  } catch (err) {
    if (next) next(err);
    else res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateNotificationSettings = async (req, res, next) => {
  try {
    const incoming = req.body || {};
    let current = readGlobalNotificationSettings();
    const updated = {
      ...current,
      ...incoming,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'sham111205s@gmail.com'
    };

    writeGlobalNotificationSettings(updated);

    const db = getFirestoreDb();
    if (db) {
      try {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ __timedOut: true }), 1000));
        await Promise.race([
          db.collection('system').doc('notifications').set(updated, { merge: true }),
          timeoutPromise
        ]);
      } catch (_) {}
    }

    // Synchronize with background daily scheduler
    try {
      const scheduler = require('../services/scheduler');
      await scheduler.updateSchedule({
        cron: updated.dailyRecommendationCron,
        enabled: updated.dailyRecommendationsEnabled,
        timezone: updated.dailyRecommendationTimezone
      });
    } catch (schedErr) {
      console.warn('Scheduler sync warning:', schedErr.message);
    }

    await logAdminAudit(req.user, 'UPDATE_NOTIFICATION_SETTINGS', { settings: updated });

    res.status(200).json({
      success: true,
      message: 'Notification settings saved successfully.',
      settings: updated
    });
  } catch (err) {
    next(err);
  }
};

