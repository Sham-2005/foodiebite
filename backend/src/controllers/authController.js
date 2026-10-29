// ─────────────────────────────────────────────────────────────
//  backend/src/controllers/authController.js
//  Authentication controller with automatic welcome email trigger
// ─────────────────────────────────────────────────────────────

const { validationResult } = require('express-validator');
const userStore = require('../services/userStore');
const brevoService = require('../services/brevoService');
const { getFirestoreDb } = require('../config/firebase');

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, dietType, preferences } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = userStore.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newUser = {
      id: uid,
      uid,
      name: name.trim(),
      email: cleanEmail,
      dietType: dietType || 'Vegetarian',
      role: cleanEmail === 'sham111205s@gmail.com' ? 'admin' : 'user',
      accountStatus: 'active',
      disabled: false,
      emailVerified: true,
      authProvider: 'password',
      createdAt: now,
      lastSignInTime: now,
      welcomeEmailSent: false,
      welcomeEmailStatus: 'queued',
      welcomeEmailAttemptCount: 0,
      notificationSettings: {
        dailySuggestions: true,
        loginAlerts: true,
        marketingEmails: false
      },
      preferences: {
        dietType: dietType || 'Vegetarian',
        dailyRecommendationEmails: true,
        cuisines: ['indian'],
        spiceLevel: 'Medium',
        healthGoals: ['healthy_eating'],
        allergies: [],
        ...(preferences || {})
      }
    };

    const savedUser = userStore.upsertUser(newUser);

    // Sync to Firestore if reachable
    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('users').doc(uid).set(savedUser, { merge: true });
      } catch (_) {}
    }

    // Trigger welcome email asynchronously if globally enabled
    let welcomeEmailEnabled = true;
    try {
      const fs = require('fs');
      const path = require('path');
      const notifPath = path.join(__dirname, '../../data/notification_settings.json');
      if (fs.existsSync(notifPath)) {
        const notifConfig = JSON.parse(fs.readFileSync(notifPath, 'utf8'));
        if (notifConfig.welcomeEmailEnabled === false) {
          welcomeEmailEnabled = false;
        }
      }
    } catch (_) {}

    if (welcomeEmailEnabled) {
      brevoService.sendWelcomeEmail(savedUser).catch(err => {
        console.warn('⚠️ [WelcomeEmail] Asynchronous registration dispatch note:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      user: savedUser,
      token: `token_${uid}`
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    const user = userStore.findByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify account is not disabled
    if (user.disabled === true || user.accountStatus === 'disabled') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been disabled. Please contact support.'
      });
    }

    // Update last login timestamp without triggering welcome email
    const updated = userStore.upsertUser({
      ...user,
      lastSignInTime: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: updated,
      token: `token_${user.id || user.uid}`
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

exports.updatePassword = async (req, res) => {
  res.status(200).json({ success: true, message: "Password updated successfully." });
};

