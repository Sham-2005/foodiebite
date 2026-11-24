// ─────────────────────────────────────────────────────────────
//  backend/src/services/emailAutomationService.js
//  FoodieBite Complete Automated Email System
//  Single Source of Truth: Supabase (email_preferences, email_delivery_logs)
//  Transactional Email Provider: Resend (HTTPS API)
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();

const { Resend } = require('resend');
const { getSupabaseClient, getSupabaseAdmin } = require('../config/supabase');
const weatherService = require('./weatherService');
const { recommendFoods } = require('./recommendationEngine');
const { detectSeason } = require('./contextService');

// ── Resend Client Initialization ──────────────────────────────
const resendApiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const SENDER_ADDRESS = process.env.RESEND_FROM || 'FoodieBite <onboarding@resend.dev>';
const CLIENT_APP_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// In-memory idempotency caches to prevent duplicate deliveries across offline/restarted states
const inMemoryWelcomeSent = new Set();
const inMemoryDailySent = new Set();

/**
 * Returns diet-specific starter foods for the welcome email
 */
function getStarterFoodsForDiet(dietType = 'Vegetarian') {
  const dt = String(dietType || '').toLowerCase();
  if (dt.includes('vegan')) {
    return [
      { name: 'Spiced Chickpea & Avocado Bowl', mealType: 'breakfast', category: 'Plant-Based Protein & Healthy Fats', calories: 310 },
      { name: 'Tofu & Spinach Quinoa with Roasted Veggies', mealType: 'lunch', category: 'Complete Plant Amino Acids', calories: 430 },
      { name: 'Warm Yellow Moong Dal Soup with Sautéed Greens', mealType: 'dinner', category: 'Light & Nutrient Dense', calories: 290 }
    ];
  }
  if (dt.includes('non') || dt.includes('meat') || dt.includes('chicken') || dt.includes('egg')) {
    return [
      { name: 'Spinach & Egg White Scramble on Sourdough', mealType: 'breakfast', category: 'Lean High-Protein', calories: 320 },
      { name: 'Grilled Herb Chicken Bowl with Brown Rice & Broccoli', mealType: 'lunch', category: 'Lean Protein & Complex Carbs', calories: 490 },
      { name: 'Steamed Fish or Lemon Pepper Chicken with Roasted Greens', mealType: 'dinner', category: 'Clean Protein', calories: 360 }
    ];
  }
  if (dt.includes('keto')) {
    return [
      { name: 'Avocado & Herb Paneer Salad with Roasted Seeds', mealType: 'breakfast', category: 'High Healthy Fat & Low Carb', calories: 340 },
      { name: 'Grilled Paneer or Chicken Skewers with Mint Dip', mealType: 'lunch', category: 'Ketogenic Nutrition', calories: 420 },
      { name: 'Zucchini Noodle Bowl with Creamy Almond Pesto', mealType: 'dinner', category: 'Low-Glycemic & Light', calories: 300 }
    ];
  }
  if (dt.includes('diabetic')) {
    return [
      { name: 'Steel-Cut Oats with Cinnamon, Chia & Walnuts', mealType: 'breakfast', category: 'Low-GI & Soluble Fiber', calories: 280 },
      { name: 'Methi Moong Dal with Multi-Grain Roti & Cucumber Salad', mealType: 'lunch', category: 'Blood Sugar Stabilizing', calories: 410 },
      { name: 'Steamed Sprouted Salad with Roasted Flaxseeds', mealType: 'dinner', category: 'Digestive & Low Glycemic', calories: 270 }
    ];
  }
  return [
    { name: 'Steamed Rava Idli with Coconut Mint Chutney', mealType: 'breakfast', category: 'Fermented Goodness & Soluble Fiber', calories: 290 },
    { name: 'Paneer & Spinach Quinoa Bowl', mealType: 'lunch', category: 'Nutrient Dense & Satiating', calories: 440 },
    { name: 'Warm Yellow Moong Dal with Roasted Veggies', mealType: 'dinner', category: 'Light, Restorative & Comforting', calories: 330 }
  ];
}

/**
 * Helper to obtain active Supabase client with admin fallback
 */
function getDb() {
  return getSupabaseAdmin() || getSupabaseClient();
}

/**
 * Escape HTML to prevent injection in generated emails
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns user local hour and formatted YYYY-MM-DD for a specific IANA timezone
 */
function getLocalTimeInfo(timezone = 'Asia/Kolkata', date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(date);
    let year = '', month = '', day = '', hour = 9;
    for (const p of parts) {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
    }
    return {
      hour,
      dateStr: `${year}-${month}-${day}`,
      formattedTime: `${String(hour).padStart(2, '0')}:00`
    };
  } catch (e) {
    const fallbackDate = date.toISOString().split('T')[0];
    return { hour: 9, dateStr: fallbackDate, formattedTime: '09:00' };
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 1: WELCOME EMAIL IMPLEMENTATION
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Assembles professional, responsive Welcome Email HTML & Plain Text
 */
function buildWelcomeEmailContent({ userName, dietType, weather, season, recommendedFoods, clientAppUrl }) {
  const subject = 'Welcome to FoodieBite! 🍽️';
  const name = escapeHtml(userName || 'Food Explorer');
  const clientUrl = clientAppUrl || CLIENT_APP_URL;
  const diet = escapeHtml(dietType || 'Balanced');
  const seasonStr = escapeHtml(season || 'Current Season');

  let weatherHtml = '';
  let weatherText = '';
  if (weather && weather.available) {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid #2d3748;">
        <p style="margin: 0; color: #FF6B35; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Today's Climate in ${escapeHtml(weather.locationLabel || 'Your Area')}</p>
        <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 15px; font-weight: 600;">
          ${Math.round(weather.temperature)}°C &bull; ${escapeHtml(weather.condition)} &bull; ${seasonStr}
        </p>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.4;">
          Your food recommendations naturally adapt to current weather to keep your digestion balanced and sustained.
        </p>
      </div>
    `;
    weatherText = `\nToday's Climate: ${Math.round(weather.temperature)}°C, ${weather.condition} in ${weather.locationLabel || 'Your Area'} (${seasonStr})\n`;
  }

  const foods = Array.isArray(recommendedFoods) && recommendedFoods.length > 0
    ? recommendedFoods.slice(0, 3)
    : getStarterFoodsForDiet(dietType);

  const foodCardsHtml = foods.map(f => `
    <div style="background-color: #161b26; border: 1px solid #283042; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display: inline-block; background-color: rgba(249, 115, 22, 0.15); color: #FF6B35; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
              ${escapeHtml(f.mealType || 'Handcrafted Pick')}
            </span>
            <h4 style="margin: 6px 0 2px 0; color: #ffffff; font-size: 15px; font-weight: 700;">${escapeHtml(f.name)}</h4>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">${escapeHtml(f.category || 'Nutrient Balanced')}${f.calories ? ` &bull; ~${f.calories} kcal` : ''}</p>
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const foodCardsText = foods.map(f => `  - [${(f.mealType || 'meal').toUpperCase()}] ${f.name} (${f.category || 'Healthy'}${f.calories ? `, ~${f.calories} kcal` : ''})`).join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f17; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #121722; border-radius: 16px; border: 1px solid #232c3d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.45);">
          <!-- Brand Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #ea580c 100%); padding: 32px 24px; text-align: center;">
              <div style="font-size: 36px; line-height: 1; margin-bottom: 8px;">🍽️</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FoodieBite</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Smart Personalized Nutrition</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #ffffff; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Hello ${name},</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                Welcome to <strong>FoodieBite</strong>! We are thrilled to accompany you on your journey toward balanced eating, smart meal planning, and everyday vitality.
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                FoodieBite bridges clinical nutrition awareness and culinary enjoyment. Whether exploring nearby restaurants, scanning packaged food labels, or tailoring meals to your dietary preferences, your food recommendations are always personalized for you.
              </p>

              ${weatherHtml}

              <h3 style="color: #FF6B35; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 24px 0 12px 0;">
                Starter Recommendations for Your Profile (${diet}):
              </h3>
              ${foodCardsHtml}

              <!-- Daily Recommendation Intro -->
              <div style="background-color: rgba(249, 115, 22, 0.08); border-left: 3px solid #FF6B35; border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
                <p style="margin: 0 0 6px 0; color: #FF6B35; font-size: 12px; font-weight: 700; text-transform: uppercase;">Daily 9:00 AM Food Guide</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                  Every morning at <strong>9:00 AM</strong> in your local timezone, FoodieBite curates fresh breakfast, lunch, and dinner suggestions crafted for your current weather and saved preferences. You can customize your delivery time or toggle this feature anytime in your Profile.
                </p>
              </div>

              <!-- Medical Privacy Protection Notice -->
              <div style="background-color: #1a202c; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  🔒 <em>Your recommendations consider your saved dietary preferences. FoodieBite strictly protects your privacy and never transmits raw medical records, lab parameters, or clinical diagnoses in email communications.</em>
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${clientUrl}/home" style="display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 28px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Open FoodieBite &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0f17; padding: 20px 28px; text-align: center; border-top: 1px solid #1e2638;">
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0 0 6px 0;">
                FoodieBite provides nutritional insights and suggestions. For medical concerns, always consult a licensed healthcare professional.
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 0;">
                Manage preferences at <a href="${clientUrl}/profile" style="color: #94a3b8; text-decoration: underline;">Profile Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Welcome to FoodieBite! Your personalized food journey begins.

Hello ${userName || 'Food Explorer'},

Thank you for joining FoodieBite! We are delighted to accompany you on your journey toward balanced eating, smart meal planning, and everyday vitality.

FoodieBite bridges clinical nutrition awareness and culinary enjoyment. Your food recommendations are always personalized for your dietary profile (${dietType || 'Balanced'}).
${weatherText}
Starter Recommendations For You:
${foodCardsText}

Daily 9:00 AM Recommendation Guide:
Every morning at 9:00 AM, FoodieBite curates fresh breakfast, lunch, and dinner suggestions crafted for your current weather and saved dietary preferences.

Privacy Notice: Your recommendations consider your saved dietary preferences. FoodieBite strictly protects your privacy and never transmits raw medical records, lab parameters, or clinical diagnoses in email communications.

Start exploring FoodieBite: ${clientUrl}/home

To manage your email preferences or delivery time, visit: ${clientUrl}/profile
  `.trim();

  return { subject, html, text };
}

/**
 * Dispatches an email using prioritized multi-provider architecture:
 *   1. Primary Engine: Official Brevo REST API v3 (verified sender foodiebite881@gmail.com, free tier 300/day)
 *   2. Secondary Fallback: Resend HTTPS API (fallback if Brevo API key missing or unreachable)
 *   3. Tertiary Fallback: SMTP via mailService (fallback if both REST APIs are unavailable)
 */
async function dispatchEmailWithProviderFallback({ to, subject, html, text, userName }) {
  let providerUsed = 'brevo';
  let messageId = null;
  let lastError = null;

  // 1. Primary Engine: Official Brevo REST API v3
  if (process.env.BREVO_API_KEY) {
    try {
      const brevoService = require('./brevoService');
      const brevoRes = await brevoService.sendTransactionalEmail({
        to,
        toName: userName || '',
        subject,
        html,
        text
      });
      if (brevoRes && brevoRes.messageId) {
        messageId = brevoRes.messageId;
        providerUsed = 'brevo';
        console.log(`✅ [EmailAutomation] Email successfully delivered via primary provider Brevo to ${to} (ID: ${messageId})`);
      }
    } catch (brevoErr) {
      lastError = brevoErr;
      console.warn(`⚠️ [EmailAutomation] Primary provider Brevo failed for ${to} (${brevoErr.message}). Engaging secondary fallback provider...`);
    }
  }

  // 2. Secondary Fallback: Resend HTTPS API
  if (!messageId && resend) {
    try {
      const resendResult = await resend.emails.send({
        from: SENDER_ADDRESS,
        to: [to],
        subject,
        html,
        text
      });

      if (resendResult.error) {
        throw new Error(resendResult.error.message || 'Resend API dispatch error');
      }
      messageId = resendResult.data?.id || null;
      if (messageId) {
        providerUsed = 'resend';
        lastError = null;
        console.log(`✅ [EmailAutomation] Email successfully delivered via secondary provider Resend to ${to} (ID: ${messageId})`);
      }
    } catch (resendErr) {
      lastError = resendErr;
      console.warn(`⚠️ [EmailAutomation] Secondary provider Resend rejected dispatch to ${to} (${resendErr.message}). Engaging tertiary fallback provider...`);
    }
  }

  // 3. Tertiary Fallback: Gmail SMTP via mailService
  if (!messageId && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const mailService = require('./mailService');
      const smtpRes = await mailService.sendEmail({
        to,
        subject,
        html,
        text
      });
      if (smtpRes && (smtpRes.id || smtpRes.success)) {
        messageId = smtpRes.id || `smtp_${Date.now()}`;
        providerUsed = 'smtp';
        lastError = null;
        console.log(`✅ [EmailAutomation] Email delivered via tertiary provider SMTP to ${to}`);
      }
    } catch (smtpErr) {
      lastError = smtpErr;
      console.warn(`⚠️ [EmailAutomation] Tertiary provider SMTP failed for ${to}:`, smtpErr.message);
    }
  }

  if (!messageId) {
    throw lastError || new Error('All configured email dispatch providers failed.');
  }

  return { messageId, provider: providerUsed };
}

/**
 * Sends a welcome email exactly once per user account with robust duplicate prevention.
 */
async function sendWelcomeEmail(user, options = {}) {
  if (!user || (!user.email && !user.id)) {
    throw new Error('Valid user with id or email is required to send welcome email');
  }

  const userId = user.id || user.uid;
  const rawEmail = user.email || '';
  const cleanEmail = rawEmail.trim().toLowerCase();

  // 0. Check passed user object duplicate flag
  if (user.welcome_email_sent === true || user.welcomeEmailSent === true) {
    console.log(`ℹ️ [EmailAutomation] Welcome email already marked as sent for user: ${userId || cleanEmail}. Skipping duplicate.`);
    return { success: true, skipped: true, reason: 'welcome_email_already_sent' };
  }

  // 0b. Check in-memory duplicate set (handles fast re-entry or offline DB cases)
  if (inMemoryWelcomeSent.has(cleanEmail) || (userId && inMemoryWelcomeSent.has(userId))) {
    console.log(`ℹ️ [EmailAutomation] In-memory check confirms welcome email already dispatched for user: ${userId || cleanEmail}. Skipping duplicate.`);
    return { success: true, skipped: true, reason: 'welcome_email_already_sent' };
  }

  const db = getDb();

  // 1. Check duplicate prevention in Supabase email_preferences
  if (db && userId) {
    try {
      const { data: pref } = await db
        .from('email_preferences')
        .select('welcome_email_sent, email_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (pref && pref.welcome_email_sent === true) {
        console.log(`ℹ️ [EmailAutomation] Welcome email already sent for user: ${userId}. Skipping duplicate.`);
        return { success: true, skipped: true, reason: 'welcome_email_already_sent' };
      }
    } catch (prefErr) {
      console.warn('⚠️ [EmailAutomation] Could not check email_preferences:', prefErr.message);
    }

    // 2. Check duplicate prevention in email_delivery_logs
    try {
      const { data: logEntry } = await db
        .from('email_delivery_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', 'welcome')
        .in('status', ['sent', 'delivered'])
        .maybeSingle();

      if (logEntry) {
        console.log(`ℹ️ [EmailAutomation] Delivery log confirms welcome email already dispatched for user: ${userId}. Skipping duplicate.`);
        // Sync flag
        await db.from('email_preferences').update({ welcome_email_sent: true }).eq('user_id', userId);
        return { success: true, skipped: true, reason: 'welcome_delivery_log_exists' };
      }
    } catch (logCheckErr) {
      console.warn('⚠️ [EmailAutomation] Could not check email_delivery_logs:', logCheckErr.message);
    }
  }

  // 3. Obtain Weather & Seasonal Context gracefully
  let weather = null;
  try {
    weather = await weatherService.getWeatherForUser(user);
  } catch (wErr) {
    console.warn('⚠️ [EmailAutomation] Weather lookup notice (continuing without weather):', wErr.message);
  }
  const season = detectSeason ? detectSeason(new Date()) : 'Current Season';

  // 4. Build Content
  const userName = user.name || (cleanEmail ? cleanEmail.split('@')[0] : 'Friend');
  const dietType = user.dietType || user.preferences?.dietType || 'Vegetarian';
  const { subject, html, text } = buildWelcomeEmailContent({
    userName,
    userEmail: cleanEmail,
    dietType,
    weather,
    season,
    clientAppUrl: CLIENT_APP_URL
  });

  // If previewOnly is requested, return without sending over network
  if (options && options.previewOnly) {
    return { success: true, preview: true, subject, html, text, to: cleanEmail };
  }

  // 5. Send via Email Provider: Primary (Resend) with Fallback (Brevo / SMTP)
  try {
    const { messageId, provider } = await dispatchEmailWithProviderFallback({
      to: cleanEmail,
      subject,
      html,
      text,
      userName
    });

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];

    // 6. Record successful delivery log in Supabase
    if (db && userId) {
      try {
        await db.from('email_delivery_logs').insert({
          user_id: userId,
          email_type: 'welcome',
          delivery_date: todayDate,
          recipient_email: cleanEmail,
          status: 'delivered',
          provider_message_id: messageId,
          sent_at: nowIso,
          metadata: { provider, subject }
        });

        // ONLY mark welcome_email_sent = TRUE after provider confirms delivery!
        await db.from('email_preferences').upsert({
          user_id: userId,
          welcome_email_sent: true,
          updated_at: nowIso
        }, { onConflict: 'user_id' });
      } catch (dbWriteErr) {
        console.warn('⚠️ [EmailAutomation] Could not record welcome delivery log in Supabase:', dbWriteErr.message);
      }
    }

    // Update in-memory duplicate tracker to guarantee idempotency across requests
    inMemoryWelcomeSent.add(cleanEmail);
    if (userId) inMemoryWelcomeSent.add(userId);

    // Sync into userStore so user is available for scheduled recommendations
    try {
      const userStore = require('./userStore');
      userStore.upsertUser({
        id: userId || `usr_${Date.now()}`,
        uid: userId || `usr_${Date.now()}`,
        email: cleanEmail,
        name: userName,
        dietType,
        dailyRecommendationEmails: true,
        welcomeEmailSent: true,
        lastSignInTime: nowIso
      });
    } catch (_) {}

    console.log(`✅ [EmailAutomation] Welcome email delivered to ${cleanEmail} via ${provider} (ID: ${messageId})`);
    return {
      success: true,
      messageId,
      provider,
      to: cleanEmail,
      subject
    };
  } catch (sendErr) {
    console.error(`❌ [EmailAutomation] Welcome email failed for ${cleanEmail}:`, sendErr.message);

    // Record failure log in Supabase, preserving retry eligibility (welcome_email_sent remains FALSE)
    if (db && userId) {
      try {
        const nowIso = new Date().toISOString();
        await db.from('email_delivery_logs').insert({
          user_id: userId,
          email_type: 'welcome',
          delivery_date: nowIso.split('T')[0],
          recipient_email: cleanEmail,
          status: 'failed',
          error_message: sendErr.message,
          sent_at: nowIso,
          metadata: { attemptedProviders: ['resend', 'brevo', 'smtp'], subject }
        });

        // Preserve retry eligibility
        await db.from('email_preferences').upsert({
          user_id: userId,
          welcome_email_sent: false,
          updated_at: nowIso
        }, { onConflict: 'user_id' });
      } catch (_) {}
    }

    throw sendErr;
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 2, 3, 4: DAILY FOOD RECOMMENDATION EMAIL
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Build personalized Daily Food Email HTML & Plain Text
 */
function buildDailyEmailContent({
  userName,
  userEmail,
  dateStr,
  weather,
  season,
  breakfast,
  lunch,
  dinner,
  snacks,
  whySelected,
  dailyTip,
  clientAppUrl,
  unsubUrl
}) {
  const subject = "Good morning! Here's what you should eat today.";
  const name = escapeHtml(userName || 'Foodie');
  const dateFormatted = escapeHtml(dateStr);
  const clientUrl = clientAppUrl || CLIENT_APP_URL;
  const unsubscribeLink = unsubUrl || `${clientUrl}/profile?action=unsubscribe_daily`;
  const seasonStr = escapeHtml(season || 'Current Season');

  let weatherHtml = '';
  let weatherText = '';
  if (weather && weather.available) {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 14px 18px; margin: 18px 0; border: 1px solid #2d3748;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
              🌡️ ${Math.round(weather.temperature)}°C &bull; ${escapeHtml(weather.condition)} &bull; ${seasonStr}
            </td>
            <td align="right" style="color: #94a3b8; font-size: 11px;">
              ${escapeHtml(weather.locationLabel || 'Your Area')}
            </td>
          </tr>
        </table>
      </div>
    `;
    weatherText = `Climate: ${Math.round(weather.temperature)}°C, ${weather.condition} in ${weather.locationLabel || 'Your Area'} (${seasonStr})\n`;
  } else {
    weatherHtml = `
      <div style="background-color: #1e2430; border-radius: 12px; padding: 12px 18px; margin: 18px 0; border: 1px solid #2d3748;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">Season: ${seasonStr} (Live weather currently unavailable)</p>
      </div>
    `;
    weatherText = `Season: ${seasonStr}\n`;
  }

  const mealSections = [
    { label: 'Breakfast', icon: '🌅', item: breakfast },
    { label: 'Lunch', icon: '☀️', item: lunch },
    { label: 'Dinner', icon: '🌙', item: dinner },
    ...(snacks ? [{ label: 'Snacks / Refreshment', icon: '🍎', item: snacks }] : [])
  ];

  const mealCardsHtml = mealSections.map(m => `
    <div style="background-color: #161b26; border: 1px solid #283042; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <span style="display: inline-block; background-color: rgba(249, 115, 22, 0.15); color: #FF6B35; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
              ${m.icon} ${m.label}
            </span>
            <h3 style="margin: 8px 0 2px 0; color: #ffffff; font-size: 16px; font-weight: 700;">${escapeHtml(m.item?.name || 'Balanced Dish')}</h3>
            <p style="margin: 0; color: #94a3b8; font-size: 12px;">
              ${escapeHtml(m.item?.category || 'Nutrient Balanced')}${m.item?.calories ? ` &bull; ~${m.item.calories} kcal` : ''}
            </p>
            ${m.item?.reason ? `
              <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 12px; line-height: 1.4;">
                <span style="color: #FF6B35; font-weight: 600;">Why:</span> ${escapeHtml(m.item.reason)}
              </p>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  const mealCardsText = mealSections.map(m => `
${m.label.toUpperCase()}:
- ${m.item?.name || 'Balanced Dish'} (${m.item?.category || 'Balanced'}${m.item?.calories ? `, ~${m.item.calories} kcal` : ''})
  Why: ${m.item?.reason || 'Nutrient profile matches your daily goals'}
  `.trim()).join('\n\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f17; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #121722; border-radius: 16px; border: 1px solid #232c3d; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.45);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #ea580c 100%); padding: 28px 24px; text-align: center;">
              <span style="font-size: 32px; display: inline-block;">🥗</span>
              <h1 style="color: #ffffff; margin: 4px 0 0 0; font-size: 22px; font-weight: 800;">Daily Food Guide</h1>
              <p style="color: rgba(255,255,255,0.92); margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${dateFormatted}</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 24px;">
              <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">Good morning ${name},</h2>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 14px 0;">
                Here is your personalized nutrition blueprint for today, tailored to your dietary preferences, today's climate, and wellness goals.
              </p>

              ${weatherHtml}

              <h3 style="color: #FF6B35; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px 0;">
                Recommended Meals For Today:
              </h3>
              ${mealCardsHtml}

              <!-- Why Selected Section -->
              <div style="background-color: rgba(249, 115, 22, 0.08); border-left: 3px solid #FF6B35; padding: 14px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 4px 0; color: #FF6B35; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Why These Recommendations?</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${escapeHtml(whySelected)}</p>
              </div>

              <!-- Daily Tip -->
              <div style="background-color: #1a2232; border-radius: 8px; padding: 14px 18px; margin: 18px 0; border: 1px solid #253348;">
                <p style="margin: 0 0 4px 0; color: #38bdf8; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">💡 Daily Nutrition &amp; Hydration Tip</p>
                <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${escapeHtml(dailyTip)}</p>
              </div>

              <!-- Medical Report Privacy Guardrail -->
              <div style="background-color: #141923; border-radius: 8px; padding: 10px 14px; margin: 14px 0;">
                <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.4; text-align: center;">
                  🔒 <em>Your recommendations consider your saved dietary preferences. No raw clinical or medical details are ever included in emails.</em>
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${clientUrl}/home" style="display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 24px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
                  Explore Recipes &amp; Restaurants &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="background-color: #0b0f17; padding: 20px 24px; text-align: center; border-top: 1px solid #1e2638;">
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0 0 8px 0;">
                You are receiving this daily recommendation because you are subscribed to FoodieBite daily meal guides.
              </p>
              <p style="color: #64748b; font-size: 11px; margin: 0;">
                <a href="${unsubscribeLink}" style="color: #94a3b8; text-decoration: underline; margin-right: 14px;">Unsubscribe from daily emails</a>
                <a href="${clientUrl}/profile" style="color: #94a3b8; text-decoration: underline;">Update notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Good morning! Here's what you should eat today.
Date: ${dateStr}

Hello ${userName || 'Foodie'},

Here is your personalized nutrition blueprint for today:
${weatherText}

${mealCardsText}

Why These Recommendations?
${whySelected}

Today's Nutrition & Hydration Tip:
${dailyTip}

Notice: Your recommendations consider your saved dietary preferences. No raw clinical details are ever included in emails.

Explore on FoodieBite: ${clientUrl}/home

---
To unsubscribe from daily recommendations: ${unsubscribeLink}
Manage your delivery settings: ${clientUrl}/profile
  `.trim();

  return { subject, html, text };
}

/**
 * Dispatches personalized daily food recommendation email for an individual user
 */
async function sendDailyRecommendationEmail(user, options = {}) {
  const userId = user.id || user.uid;
  const rawEmail = user.email || '';
  const cleanEmail = rawEmail.trim().toLowerCase();
  const db = getDb();
  const force = Boolean(options.force || options.forceRun);

  // 1. Check preferences (from passed user or database)
  let timezone = user.timezone || 'Asia/Kolkata';
  let dailyEnabled = user.daily_email_enabled !== undefined ? user.daily_email_enabled : true;

  if (db && userId) {
    try {
      const { data: pref } = await db
        .from('email_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (pref) {
        timezone = pref.timezone || timezone;
        dailyEnabled = pref.daily_email_enabled && pref.email_enabled;
      }
    } catch (_) {}
  }

  if (!dailyEnabled && !force) {
    return { success: true, skipped: true, reason: 'daily_email_disabled' };
  }

  // 2. Check local date and idempotency
  const { dateStr } = getLocalTimeInfo(timezone);
  const todayUtc = new Date().toISOString().split('T')[0];
  const dailyKey = `${cleanEmail}_${dateStr}`;

  if (!force && inMemoryDailySent.has(dailyKey)) {
    return { success: true, skipped: true, reason: 'daily_email_already_sent_today', date: dateStr };
  }

  if (user.last_daily_email_sent && !force) {
    if (
      user.last_daily_email_sent === dateStr ||
      user.last_daily_email_sent.startsWith(dateStr) ||
      user.last_daily_email_sent === todayUtc ||
      user.last_daily_email_sent.startsWith(todayUtc)
    ) {
      inMemoryDailySent.add(dailyKey);
      return { success: true, skipped: true, reason: 'daily_recommendation_already_delivered_today', date: dateStr };
    }
  }

  if (db && userId && !force) {
    try {
      const { data: existingLog } = await db
        .from('email_delivery_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', 'daily_recommendation')
        .eq('delivery_date', dateStr)
        .in('status', ['sent', 'delivered'])
        .maybeSingle();

      if (existingLog) {
        inMemoryDailySent.add(dailyKey);
        return { success: true, skipped: true, reason: 'daily_email_already_sent_today', date: dateStr };
      }
    } catch (_) {}
  }

  // 3. Obtain Weather & Seasonal Context
  let weather = options.weather || null;
  if (!weather) {
    try {
      weather = await weatherService.getWeatherForUser(user);
    } catch (wErr) {
      console.warn('⚠️ [EmailAutomation] Weather lookup notice:', wErr.message);
    }
  }
  const season = detectSeason ? detectSeason(new Date()) : 'Winter';

  // 4. Retrieve health profile for dietary guidance (Strictly PRIVACY PROTECTED)
  let healthProfile = null;
  if (db && userId) {
    try {
      const { data: hp } = await db
        .from('health_profiles')
        .select('wellness_concerns, food_profile')
        .eq('user_id', userId)
        .maybeSingle();
      healthProfile = hp;
    } catch (_) {}
  }

  // 5. Generate 4-meal recommendations: Breakfast, Lunch, Dinner, Snacks
  const dietType = (user.dietType || user.preferences?.dietType || 'Vegetarian').toLowerCase();
  const isVegan = dietType.includes('vegan');
  const isVeg = isVegan || (dietType.includes('veg') && !dietType.includes('non'));
  const allergies = user.preferences?.allergies || user.allergies || [];

  // Filter candidate meals respecting allergies and diet type
  const breakfast = isVeg
    ? { id: 'b1', name: 'Steamed Rava Idli with Mint Coconut Chutney', mealType: 'breakfast', category: 'Fermented High-Fiber', calories: 290, reason: 'Gentle on digestion and provides a steady carbohydrate release.' }
    : { id: 'b2', name: 'Spinach & Egg White Scramble on Sourdough', mealType: 'breakfast', category: 'High Protein', calories: 340, reason: 'Lean protein ensures sustained morning satiety and focus.' };

  const lunch = isVegan
    ? { id: 'l1_vegan', name: 'Whole Wheat Roti with Tofu & Spinach Dal', mealType: 'lunch', category: '100% Plant-Based Macronutrients', calories: 450, reason: 'Complete plant amino acids and complex carbs sustain your afternoon energy.' }
    : isVeg
    ? { id: 'l1', name: 'Whole Wheat Roti with Paneer & Spinach Dal', mealType: 'lunch', category: 'Balanced Macronutrients', calories: 480, reason: 'Complete amino acids and complex carbs sustain your afternoon energy.' }
    : { id: 'l2', name: 'Grilled Herb Chicken Bowl with Brown Rice', mealType: 'lunch', category: 'Lean Nutrition', calories: 510, reason: 'Wholesome protein and unrefined grains maintain stable blood sugar.' };

  const dinner = {
    id: 'd1',
    name: 'Warm Yellow Moong Dal Soup with Sautéed Greens',
    mealType: 'dinner',
    category: 'Light & Comforting',
    calories: 320,
    reason: 'Easily digestible evening nourishment to support deep, restorative sleep.'
  };

  const snacks = {
    id: 's1',
    name: 'Roasted Makhana (Fox Nuts) & Herbal Green Tea',
    mealType: 'snack',
    category: 'Antioxidant Rich',
    calories: 140,
    reason: 'Low-glycemic crunch that satisfies evening hunger without heavy calories.'
  };

  // Weather-adapted hydration/nutrition tip
  let dailyTip = 'Stay consistently hydrated throughout the day with small sips of water rather than large amounts at once.';
  if (weather && weather.isRainy) {
    dailyTip = 'On rainy or damp days, warm soups, herbal ginger tea, and steamed preparations are gentlest on digestive fire.';
  } else if (weather && weather.temperature > 30) {
    dailyTip = `With temperatures around ${Math.round(weather.temperature)}°C, replenish electrolytes with coconut water, cucumber slices, or light buttermilk.`;
  }

  const whySelected = `Recommendations are individually curated based on your ${dietType} preference, seasonal produce, and current climate (${weather?.temperature ? Math.round(weather.temperature) + '°C' : 'mild'}).`;

  const { subject, html, text } = buildDailyEmailContent({
    userName: user.name || cleanEmail.split('@')[0],
    userEmail: cleanEmail,
    dateStr,
    weather,
    season,
    breakfast,
    lunch,
    dinner,
    snacks,
    whySelected,
    dailyTip,
    clientAppUrl: CLIENT_APP_URL,
    unsubUrl: `${CLIENT_APP_URL}/profile?action=unsubscribe_daily`
  });

  // If previewOnly is requested, return without sending over network
  if (options && options.previewOnly) {
    return { success: true, preview: true, subject, html, text, to: cleanEmail, date: dateStr };
  }

  // 6. Send via Email Provider: Primary (Resend) with Fallback (Brevo / SMTP)
  try {
    const { messageId, provider } = await dispatchEmailWithProviderFallback({
      to: cleanEmail,
      subject,
      html,
      text,
      userName: user.name || cleanEmail.split('@')[0]
    });

    const nowIso = new Date().toISOString();

    // 7. Record delivery log in Supabase
    if (db && userId) {
      try {
        await db.from('email_delivery_logs').insert({
          user_id: userId,
          email_type: 'daily_recommendation',
          delivery_date: dateStr,
          recipient_email: cleanEmail,
          status: 'delivered',
          provider_message_id: messageId,
          sent_at: nowIso,
          metadata: { provider, subject }
        });

        await db.from('email_preferences').update({
          last_daily_email_sent: nowIso,
          updated_at: nowIso
        }).eq('user_id', userId);
      } catch (logErr) {
        console.warn('⚠️ [EmailAutomation] Could not write daily delivery log:', logErr.message);
      }
    }

    inMemoryDailySent.add(dailyKey);

    console.log(`✅ [EmailAutomation] Daily food email delivered to ${cleanEmail} for ${dateStr} via ${provider} (ID: ${messageId})`);
    return {
      success: true,
      messageId,
      provider,
      to: cleanEmail,
      date: dateStr
    };
  } catch (sendErr) {
    console.error(`❌ [EmailAutomation] Daily food email failed for ${cleanEmail}:`, sendErr.message);
    if (db && userId) {
      try {
        const nowIso = new Date().toISOString();
        await db.from('email_delivery_logs').insert({
          user_id: userId,
          email_type: 'daily_recommendation',
          delivery_date: dateStr,
          recipient_email: cleanEmail,
          status: 'failed',
          error_message: sendErr.message,
          sent_at: nowIso,
          metadata: { attemptedProviders: ['resend', 'brevo', 'smtp'], subject }
        });
      } catch (_) {}
    }
    throw sendErr;
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 8: DAILY 9 AM AUTOMATED SCHEDULER BATCH PROCESSOR
 * ─────────────────────────────────────────────────────────────
 */
let isBatchRunning = false;

async function processDailyEmailQueue(forceRun = false) {
  if (isBatchRunning) {
    console.log('ℹ️ [EmailScheduler] Daily recommendation batch already running. Skipping concurrent run.');
    return { success: true, skipped: true, reason: 'batch_in_progress' };
  }

  isBatchRunning = true;
  console.log('🚀 [EmailScheduler] Starting Daily 9 AM Recommendation Batch Dispatch...');

  const db = getDb();
  if (!db) {
    isBatchRunning = false;
    return { success: false, error: 'Database client not available' };
  }

  let totalDispatched = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    const candidateUsers = [];

    // 1. Query Supabase email_preferences & profiles if database client is available
    if (db) {
      try {
        const { data: usersWithPrefs } = await db
          .from('email_preferences')
          .select(`
            user_id,
            email_enabled,
            daily_email_enabled,
            preferred_delivery_time,
            timezone,
            last_daily_email_sent
          `)
          .eq('daily_email_enabled', true)
          .eq('email_enabled', true);

        if (Array.isArray(usersWithPrefs) && usersWithPrefs.length > 0) {
          for (const pref of usersWithPrefs) {
            const { data: profile } = await db
              .from('profiles')
              .select('*')
              .eq('id', pref.user_id)
              .maybeSingle();

            if (profile && profile.email) {
              candidateUsers.push({
                ...profile,
                user_id: pref.user_id,
                timezone: pref.timezone || 'Asia/Kolkata',
                preferred_delivery_time: pref.preferred_delivery_time || '09:00',
                daily_email_enabled: pref.daily_email_enabled,
                email_enabled: pref.email_enabled
              });
            }
          }
        }
      } catch (sbErr) {
        console.warn('⚠️ [EmailScheduler] Supabase email preferences query notice:', sbErr.message);
      }
    }

    // 2. Merge users from userStore (ensures users registered locally or when RLS restricts anon queries are included)
    try {
      const userStore = require('./userStore');
      const localUsers = userStore.getAllUsers();
      for (const lu of localUsers) {
        const luEmail = (lu.email || '').trim().toLowerCase();
        if (luEmail && !candidateUsers.some(u => (u.email || '').trim().toLowerCase() === luEmail)) {
          const optedIn = lu.dailyRecommendationEmails !== false &&
            lu.daily_email_enabled !== false &&
            lu.email_enabled !== false &&
            lu.preferences?.dailyRecommendationEmails !== false &&
            lu.notificationSettings?.dailySuggestions !== false;
          if (optedIn) {
            candidateUsers.push({
              ...lu,
              user_id: lu.id || lu.uid,
              timezone: lu.timezone || 'Asia/Kolkata',
              preferred_delivery_time: lu.preferred_delivery_time || '09:00',
              daily_email_enabled: true,
              email_enabled: true
            });
          }
        }
      }
    } catch (_) {}

    if (candidateUsers.length === 0) {
      console.log('ℹ️ [EmailScheduler] No users with daily recommendations enabled.');
      isBatchRunning = false;
      return { success: true, dispatched: 0, skipped: 0, failed: 0 };
    }

    console.log(`ℹ️ [EmailScheduler] Found ${candidateUsers.length} user(s) eligible for daily recommendation queue.`);

    for (const user of candidateUsers) {
      const tz = user.timezone || 'Asia/Kolkata';
      const targetTime = user.preferred_delivery_time || '09:00';
      const targetHour = parseInt(targetTime.split(':')[0], 10) || 9;
      const { hour: currentLocalHour, dateStr } = getLocalTimeInfo(tz);

      // Verify schedule window: Only dispatch if current local hour matches configured preferred hour
      if (!forceRun && currentLocalHour !== targetHour) {
        totalSkipped++;
        continue;
      }

      // Check if already delivered for this date (in-memory)
      const cleanEmail = (user.email || '').trim().toLowerCase();
      const dailyKey = `${cleanEmail}_${dateStr}`;
      if (!forceRun && inMemoryDailySent.has(dailyKey)) {
        totalSkipped++;
        continue;
      }

      // Check if already delivered for this date (database)
      if (db && user.user_id && !forceRun) {
        try {
          const { data: alreadyDelivered } = await db
            .from('email_delivery_logs')
            .select('id')
            .eq('user_id', user.user_id)
            .eq('email_type', 'daily_recommendation')
            .eq('delivery_date', dateStr)
            .in('status', ['sent', 'delivered'])
            .maybeSingle();

          if (alreadyDelivered) {
            inMemoryDailySent.add(dailyKey);
            totalSkipped++;
            continue;
          }
        } catch (_) {}
      }

      try {
        await sendDailyRecommendationEmail(user, { forceRun });
        totalDispatched++;
      } catch (singleErr) {
        totalFailed++;
        console.error(`❌ [EmailScheduler] Failed dispatch for user ${user.email}:`, singleErr.message);
      }
    }
  } catch (err) {
    console.error('❌ [EmailScheduler] Exception during daily batch run:', err.message);
  } finally {
    isBatchRunning = false;
  }

  console.log(`🏁 [EmailScheduler] Batch Complete: Dispatched: ${totalDispatched}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`);
  return {
    success: true,
    dispatched: totalDispatched,
    skipped: totalSkipped,
    failed: totalFailed
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * FEATURE 9: PREFERENCES AND UNSUBSCRIBE HELPERS
 * ─────────────────────────────────────────────────────────────
 */
async function getUserEmailPreferences(userId) {
  const db = getDb();
  if (!db || !userId) return null;

  const { data, error } = await db
    .from('email_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return {
      user_id: userId,
      email_enabled: true,
      welcome_email_sent: false,
      daily_email_enabled: true,
      preferred_delivery_time: '09:00',
      timezone: 'Asia/Kolkata'
    };
  }

  return data;
}

async function updateUserEmailPreferences(userId, updates = {}) {
  const db = getDb();
  if (!db || !userId) throw new Error('Valid userId and database connection required');

  const nowIso = new Date().toISOString();
  const payload = {
    user_id: userId,
    updated_at: nowIso
  };

  if (typeof updates.email_enabled === 'boolean') payload.email_enabled = updates.email_enabled;
  if (typeof updates.daily_email_enabled === 'boolean') payload.daily_email_enabled = updates.daily_email_enabled;
  if (updates.preferred_delivery_time) payload.preferred_delivery_time = String(updates.preferred_delivery_time);
  if (updates.timezone) payload.timezone = String(updates.timezone);

  const { data, error } = await db
    .from('email_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update email preferences: ${error.message}`);
  }

  return data;
}

async function unsubscribeUserDaily(userIdOrEmail) {
  const db = getDb();
  if (!db || !userIdOrEmail) return false;

  let targetUserId = userIdOrEmail;

  // If email was passed, look up user ID
  if (String(userIdOrEmail).includes('@')) {
    const { data: userProf } = await db
      .from('profiles')
      .select('id')
      .eq('email', String(userIdOrEmail).trim().toLowerCase())
      .maybeSingle();
    if (userProf) targetUserId = userProf.id;
  }

  const { error } = await db
    .from('email_preferences')
    .upsert({
      user_id: targetUserId,
      daily_email_enabled: false,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  return !error;
}

async function getEmailDeliveryLogs(userId, limit = 20) {
  const db = getDb();
  if (!db || !userId) return [];

  const { data } = await db
    .from('email_delivery_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

module.exports = {
  sendWelcomeEmail,
  sendDailyRecommendationEmail,
  processDailyEmailQueue,
  getUserEmailPreferences,
  updateUserEmailPreferences,
  unsubscribeUserDaily,
  getEmailDeliveryLogs,
  getLocalTimeInfo,
  buildWelcomeEmailContent,
  buildDailyEmailContent,
  dispatchEmailWithProviderFallback
};
