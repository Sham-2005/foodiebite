// ─────────────────────────────────────────────────────────────
//  backend/src/services/dailyRecommendationService.js
//  FoodieBite — Dynamic Context-Aware Personalized Email Recommendation Engine
//  Generates individualized recommendations per recipient based on:
//    - Dietary preferences (Veg, Vegan, Eggetarian, Non-Veg)
//    - Allergies and explicit food restrictions
//    - Preferred cuisines and spice level
//    - Live climate and weather conditions (when consented & available)
//    - Current meteorological season and seasonal food intelligence
//    - Health goals and consented medical-report insights
//    - Recommendation memory & diversity tracking to eliminate repetition
// ─────────────────────────────────────────────────────────────

'use strict';

const { getFirestoreDb } = require('../config/firebase');
const userStore = require('./userStore');
const brevoService = require('./brevoService');
const weatherService = require('./weatherService');
const { detectSeason, buildContextProfile, normalizeTemperatureCategory, normalizeWeatherCondition } = require('./contextService');
const { buildUserFoodProfile } = require('./profileBuilder');
const persistentReportDb = require('./persistentReportDb');
const { recommendFoods } = require('./recommendationEngine');
const { FALLBACK_FOODS } = require('./foodiebiteFallbackFoods');

// In-memory fallback stores for offline/test environments
const memoryDailyRuns = new Map();
const memoryDailyRecipients = new Map();
let isDailyJobRunning = false;

/**
 * Returns formatted YYYY-MM-DD in Asia/Kolkata timezone
 */
function getKolkataDateString(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Generates stable daily campaign run ID
 */
function getDailyRunId(date = new Date()) {
  const dateStr = getKolkataDateString(date);
  return `daily-recommendations-${dateStr}`;
}

/**
 * Safe Firestore helper with timeout to prevent hanging on offline Firestore
 */
async function safeFirestore(promise, timeoutMs = 500) {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retrieve all active users and evaluate eligibility for daily recommendations
 */
async function getEligibleDailyRecipients(runId = getDailyRunId()) {
  const allUsers = [...userStore.getAllUsers()];
  const db = getFirestoreDb();

  // Merge Firestore users if reachable
  if (db) {
    try {
      const snap = await safeFirestore(db.collection('users').get(), 500);
      if (snap) {
        snap.forEach(doc => {
          const d = doc.data();
          if (d.email && !allUsers.some(u => (u.email || '').toLowerCase() === d.email.toLowerCase())) {
            allUsers.push({
              id: doc.id,
              uid: doc.id,
              ...d
            });
          }
        });
      }
    } catch (_) {}
  }

  // Retrieve already dispatched/submitted recipient emails for this day's runId to enforce idempotency
  const alreadySentSet = new Set();
  for (const r of memoryDailyRecipients.values()) {
    if (r.runId === runId && (r.status === 'submitted' || r.status === 'delivered' || r.status === 'processing')) {
      if (r.email) alreadySentSet.add(r.email.toLowerCase().trim());
    }
  }

  if (db) {
    try {
      const sentSnap = await safeFirestore(
        db.collection('dailyRecommendationRecipients')
          .where('runId', '==', runId)
          .where('status', 'in', ['submitted', 'delivered', 'processing'])
          .get(),
        500
      );
      if (sentSnap) {
        sentSnap.forEach(d => {
          const r = d.data();
          if (r.email) alreadySentSet.add(r.email.toLowerCase().trim());
        });
      }
    } catch (_) {}
  }

  const eligible = [];
  const skipped = [];

  for (const u of allUsers) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !brevoService.isValidEmail(email)) {
      skipped.push({ userId: u.id || u.uid, email: email || 'unknown', reason: 'invalid_email' });
      continue;
    }

    // Check account active status
    if (u.disabled === true || u.accountStatus === 'disabled' || u.accountStatus === 'suspended') {
      skipped.push({ userId: u.id || u.uid, email, reason: 'account_inactive' });
      continue;
    }

    // Check consent & opt-in preference:
    // dailyRecommendationEmails default is true for active accounts unless explicitly set to false
    const optedIn = u.dailyRecommendationEmails !== false &&
      u.preferences?.dailyRecommendationEmails !== false &&
      u.notificationSettings?.dailySuggestions !== false;

    if (!optedIn) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'opted_out' });
      continue;
    }

    // Check unsubscription status
    const isUnsub = await brevoService.isUserUnsubscribed(email, 'recommendations');
    if (isUnsub) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'unsubscribed' });
      continue;
    }

    // Check daily idempotency
    if (alreadySentSet.has(email)) {
      skipped.push({ userId: u.id || u.uid, email, reason: 'already_sent_today' });
      continue;
    }

    eligible.push({
      id: u.id || u.uid,
      uid: u.uid || u.id,
      name: u.name || email.split('@')[0],
      email,
      dietType: u.dietType || u.preferences?.dietType || 'Vegetarian',
      spiceLevel: u.spiceLevel || u.preferences?.spiceLevel || 'Medium',
      healthGoals: u.healthGoals || u.preferences?.healthGoals || [],
      allergies: u.allergies || u.preferences?.allergies || [],
      cuisines: u.cuisines || u.preferences?.cuisines || [],
      location: u.location || u.preferences?.location || null,
      city: u.city || u.preferences?.city || null,
      activeFoodRestrictions: u.activeFoodRestrictions || u.preferences?.activeFoodRestrictions || [],
      recentEmailRecommendations: u.recentEmailRecommendations || u.preferences?.recentEmailRecommendations || [],
      medicalEmailConsent: u.medicalEmailConsent ?? u.preferences?.medicalEmailConsent ?? false,
      preferences: u.preferences || {}
    });
  }

  return { eligible, skipped, runId };
}

/**
 * Dynamically generate a context-aware subject line based on the user's specific context & recommendations
 */
function generateDynamicSubjectLine(user, contextProfile, picks = []) {
  const weather = contextProfile?.weather;
  const healthGoals = (user.healthGoals || user.preferences?.healthGoals || []).map(g => String(g).toLowerCase().trim());
  const diet = String(user.dietType || user.preferences?.dietType || 'Vegetarian').toLowerCase();
  const season = contextProfile?.season?.name || 'summer';

  // 1. Dominant Weather Trigger (hot, rainy, cold)
  if (weather && weather.condition) {
    if (weather.isRainy || weather.conditionCategory === 'rainy') {
      return '🌧️ Warm & Comforting Dishes for Today\'s Rainy Weather | FoodieBite';
    }
    if (weather.category === 'hot') {
      return `☀️ Refreshing, Cooling Food Picks for a Warm Day (${Math.round(weather.temperature)}°C) | FoodieBite`;
    }
    if (weather.category === 'cold' || weather.category === 'cool') {
      return `❄️ Nourishing, Warm Food Picks to Fuel Your Day (${Math.round(weather.temperature)}°C) | FoodieBite`;
    }
  }

  // 2. Health Goal Trigger
  if (healthGoals.includes('muscle_gain') || healthGoals.includes('high_protein')) {
    return '💪 High-Protein Food Picks to Power Your Fitness Goals | FoodieBite';
  }
  if (healthGoals.includes('weight_loss') || healthGoals.includes('low_calorie')) {
    return '🥗 Light, Nutrient-Dense Food Ideas for Your Health Goals | FoodieBite';
  }
  if (healthGoals.includes('diabetic_friendly') || healthGoals.includes('low_sugar')) {
    return '🌿 Low-GI & Balanced Food Recommendations for You | FoodieBite';
  }

  // 3. Eating Type & Cultural Trigger
  if (diet.includes('vegan')) {
    return '🌱 Delicious Plant-Based Food Picks Handcrafted for You | FoodieBite';
  }
  if (diet.includes('eggetarian')) {
    return '🍳 Flavorful Eggetarian & Wholesome Picks for Today | FoodieBite';
  }
  if (diet.includes('vegetarian')) {
    return '🥘 Handcrafted Vegetarian Specials Tailored for You | FoodieBite';
  }
  if (diet.includes('non')) {
    return '🍗 Protein-Packed Food Ideas Handcrafted for You Today | FoodieBite';
  }

  // 4. Seasonal Fallback Trigger
  const displaySeason = season.charAt(0).toUpperCase() + season.slice(1);
  return `🍂 Today's Fresh ${displaySeason} Picks for Your Food Preferences | FoodieBite`;
}

/**
 * Filter and rank candidates to ensure recommendation diversity and respect memory
 */
function selectDiverseRecommendations(candidateFoods, recentHistory = [], targetCount = 3) {
  if (!Array.isArray(candidateFoods) || candidateFoods.length === 0) return [];

  const recentSet = new Set(recentHistory.map(id => String(id).toLowerCase().trim()));
  const freshFoods = [];
  const repeatedFoods = [];

  for (const food of candidateFoods) {
    const fId = String(food.id || '').toLowerCase().trim();
    const fName = String(food.name || '').toLowerCase().trim();

    if (recentSet.has(fId) || recentSet.has(fName)) {
      repeatedFoods.push(food);
    } else {
      freshFoods.push(food);
    }
  }

  // Prioritize fresh foods that haven't been sent recently; fill remaining slots with repeated foods if needed
  let selected = [];
  if (freshFoods.length >= targetCount) {
    selected = freshFoods.slice(0, targetCount);
  } else {
    selected = [...freshFoods, ...repeatedFoods.slice(0, targetCount - freshFoods.length)];
  }

  // Ensure diversity across food categories (e.g., avoid 3 rice dishes)
  const categorySeen = new Set();
  const diverseList = [];
  const remaining = [];

  for (const item of selected) {
    const cat = (item.category || item.name || '').toLowerCase();
    if (!categorySeen.has(cat)) {
      categorySeen.add(cat);
      diverseList.push(item);
    } else {
      remaining.push(item);
    }
  }

  return [...diverseList, ...remaining].slice(0, targetCount);
}

/**
 * Formulates a tailored, individual justification for a recommended dish
 */
function buildPersonalizedFoodReason(food, userProfile, contextProfile) {
  const factors = [];
  const diet = userProfile.dietType || 'Vegetarian';
  const spice = userProfile.spiceLevel || 'Medium';
  const goals = (userProfile.healthGoals || []).map(g => g.toLowerCase());
  const weather = contextProfile?.weather;
  const season = contextProfile?.season?.name;

  // 1. Dietary match
  factors.push(`Matches your ${diet} preference`);

  // 2. Goal or nutritional strength
  if (goals.includes('muscle_gain') && food.protein >= 12) {
    factors.push(`delivers ${food.protein}g protein to support muscle recovery`);
  } else if (goals.includes('weight_loss') && food.calories <= 320) {
    factors.push(`nutrient-dense at only ${food.calories} kcal`);
  } else if (food.fiber >= 4) {
    factors.push(`high in dietary fiber (${food.fiber}g) for digestive wellness`);
  }

  // 3. Climate or seasonal suitability
  if (weather && weather.category === 'hot' && (/salad|curd|yogurt|cucumber|melon|coconut|juice/i.test(food.name || '') || food.tags?.includes('cooling'))) {
    factors.push('naturally refreshing and hydrating for warm afternoon dining');
  } else if (weather && (weather.category === 'cold' || weather.category === 'cool') && (/soup|dal|warm|khichdi|ginger|broth/i.test(food.name || ''))) {
    factors.push('warm and nourishing for cooler temperatures');
  } else if (weather && weather.isRainy && (/soup|dal|steamed|warm/i.test(food.name || ''))) {
    factors.push('comforting, hot, and light for a rainy day');
  } else if (season && food.contextTags?.weather?.includes(season)) {
    factors.push(`aligned with in-season ${season} fresh ingredients`);
  }

  return factors.join(', ') + '.';
}

/**
 * Generate personalized recommendations and email content for a user
 */
async function buildDailyRecommendationForUser(user, options = {}) {
  const userId = user.id || user.uid;

  // 1. Determine local weather for consented location (or options override)
  let weather = options.weather !== undefined ? options.weather : null;
  if (weather === null && (user.location || user.city || user.preferences?.location || user.preferences?.city)) {
    weather = await weatherService.getWeatherForUser(user);
  }

  // 2. Determine region and season
  const userRegion = user.location?.country || user.preferences?.country || 'India';
  const detectedSeasonData = detectSeason(new Date(), userRegion);
  const season = options.season || detectedSeasonData;

  // 3. Voluntary Medical Report & Consent Verification
  const hasMedicalConsent = user.medicalEmailConsent === true ||
    user.preferences?.medicalEmailConsent === true ||
    user.consent?.medicalEmailPersonalization === true;

  let healthProfile = null;
  if (hasMedicalConsent && userId) {
    healthProfile = persistentReportDb.getHealthProfile(userId);
  }

  // 4. Construct Unified UserFoodProfile
  const rawUserData = {
    ...user,
    healthProfile,
    preferences: {
      ...(user.preferences || {}),
      dietType: user.dietType || user.preferences?.dietType || 'Vegetarian',
      spiceLevel: user.spiceLevel || user.preferences?.spiceLevel || 'Medium',
      cuisines: user.cuisines || user.preferences?.cuisines || ['indian'],
      healthGoals: user.healthGoals || user.preferences?.healthGoals || ['healthy_eating'],
      allergies: user.allergies || user.preferences?.allergies || []
    }
  };
  const unifiedProfile = buildUserFoodProfile(rawUserData);

  // 5. Construct Centralized Context Profile
  const contextProfile = buildContextProfile({
    currentTime: new Date().toISOString(),
    mealPeriod: options.mealPeriod || 'lunch',
    weather,
    season,
    recentRecommendations: user.recentEmailRecommendations || [],
    userProfile: unifiedProfile
  });

  // 6. Run Two-Pass Recommendation Engine
  const candidateResult = recommendFoods(FALLBACK_FOODS, unifiedProfile, contextProfile, 25);
  const candidatePool = candidateResult.foods || [];

  if (candidatePool.length === 0) {
    return {
      success: false,
      reason: 'no_safe_recommendations',
      picks: []
    };
  }

  // 7. Apply Recommendation Diversity & Memory Filter
  const safePicks = selectDiverseRecommendations(candidatePool, user.recentEmailRecommendations || [], 3);

  // 8. Formulate Personalization Rationale Summary
  const userDiet = unifiedProfile.dietType.charAt(0).toUpperCase() + unifiedProfile.dietType.slice(1);
  let personalizationReason = `Handcrafted for your ${userDiet} lifestyle`;
  if (unifiedProfile.allergies && unifiedProfile.allergies.length > 0) {
    personalizationReason += ` with strict zero-${unifiedProfile.allergies.join(', ')} allergy safety`;
  }
  if (unifiedProfile.healthGoals && unifiedProfile.healthGoals.length > 0) {
    personalizationReason += ` and optimized for ${unifiedProfile.healthGoals.map(g => g.replace(/_/g, ' ')).join(', ')}`;
  }
  if (hasMedicalConsent && healthProfile && unifiedProfile.preferredFoodTags && unifiedProfile.preferredFoodTags.length > 0) {
    personalizationReason += ` (supported by consented wellness preferences: ${unifiedProfile.preferredFoodTags.slice(0, 2).join(', ')})`;
  }
  personalizationReason += '.';

  // 9. Generate Context-Aware Subject Line
  const subject = generateDynamicSubjectLine(user, contextProfile, safePicks);

  // 10. Generate Content Details
  const firstName = brevoService.extractFirstName(user.name, user.email);
  const clientAppUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const unsubToken = brevoService.generateUnsubscribeToken(user.email);
  const unsubUrl = `${clientAppUrl}/unsubscribe?email=${encodeURIComponent(user.email)}&type=recommendations&token=${unsubToken}`;

  // Build Climate Card Block (omitted cleanly if weather is null)
  let climateHtml = '';
  let climateText = '';
  if (weather && weather.condition) {
    const tempStr = typeof weather.temperature === 'number' ? `${weather.temperature}°C` : '';
    const condStr = weather.condition;
    const seasonStr = season.name ? season.name.charAt(0).toUpperCase() + season.name.slice(1) : 'Seasonal';

    climateHtml = `
      <div style="background-color: #1a1f29; border: 1px solid #272d3b; border-radius: 12px; padding: 14px 16px; margin: 16px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #FF8C5A; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            🌤️ Today's Climate &bull; ${brevoService.escapeHtml(weather.locationName || 'Local')}
          </span>
          <span style="background-color: rgba(255,107,53,0.15); color: #FF8C5A; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
            ${brevoService.escapeHtml(seasonStr)}
          </span>
        </div>
        <p style="color: #cbd5e1; font-size: 13px; margin: 0 0 6px 0; line-height: 1.4;">
          <strong>${brevoService.escapeHtml(condStr)}</strong>${tempStr ? ` &bull; <strong>${tempStr}</strong>` : ''}
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
          ${brevoService.escapeHtml(weather.hydrationTip || 'Enjoy balanced, fresh meals paired with proper hydration.')}
        </p>
      </div>
    `;

    climateText = `\n--- Today's Climate ---\nCondition: ${condStr}${tempStr ? ` (${tempStr})` : ''} in ${weather.locationName || 'Local Area'}\nSeason: ${seasonStr}\nTip: ${weather.hydrationTip || 'Stay hydrated throughout the day.'}\n`;
  }

  // Build Personalized Food Cards
  let htmlFoodCards = '';
  let textFoodList = '';

  safePicks.forEach((p, idx) => {
    const itemReason = buildPersonalizedFoodReason(p, unifiedProfile, contextProfile);
    const nutritionInfo = p.calories ? ` (${p.calories} kcal${p.protein ? ` | ${p.protein}g protein` : ''}${p.fiber ? ` | ${p.fiber}g fiber` : ''})` : '';
    const desc = p.description || `${p.name} prepared with wholesome ingredients aligned with your nutrition goals.`;
    const foodLink = `${clientAppUrl}/home?food=${encodeURIComponent(p.id || p.name)}`;

    textFoodList += `\n${idx + 1}. ${p.name}${nutritionInfo}\n   ${desc}\n   Why we picked this: ${itemReason}\n`;

    const nutritionBadge = p.calories
      ? `<span style="background-color: rgba(255,107,53,0.12); color: #FF6B35; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,107,53,0.3);">${p.calories} kcal${p.protein ? ` &bull; ${p.protein}g protein` : ''}</span>`
      : '';

    // Verified food image or styled fallback
    const imageHtml = p.image
      ? `<img src="${brevoService.escapeHtml(p.image)}" alt="${brevoService.escapeHtml(p.name)}" style="width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />`
      : '';

    htmlFoodCards += `
      <div style="background-color: #1a1f29; border: 1px solid #272d3b; border-radius: 12px; padding: 16px; margin-bottom: 14px;">
        ${imageHtml}
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
          <h3 style="color: #ffffff; font-size: 16px; margin: 0; font-weight: 700;">
            <span style="color: #FF6B35; margin-right: 6px;">${idx + 1}.</span> ${brevoService.escapeHtml(p.name)}
          </h3>
          ${nutritionBadge}
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 6px 0 10px 0;">
          ${brevoService.escapeHtml(desc)}
        </p>
        <div style="background-color: rgba(255, 255, 255, 0.03); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
          <p style="color: #FF8C5A; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0 0 2px 0;">Why this matches you:</p>
          <p style="color: #cbd5e1; font-size: 12px; line-height: 1.4; margin: 0;">${brevoService.escapeHtml(itemReason)}</p>
        </div>
        <a href="${foodLink}" style="color: #FF8C5A; font-size: 12px; font-weight: 600; text-decoration: none;">
          View details on FoodieBite &rarr;
        </a>
      </div>
    `;
  });

  // Dynamic Tip Selection
  let dailyTip = 'Mindful hydration and steady meals support sustained daily focus and vitality.';
  if (weather && weather.isRainy) {
    dailyTip = 'On rainy days, freshly prepared and steamed hot meals are gentler on digestion and provide comforting immunity.';
  } else if (weather && weather.category === 'hot') {
    dailyTip = 'Drink water before feeling thirsty and incorporate naturally cooling ingredients like curd, cucumber, or tender coconut into your afternoon meals.';
  } else if (unifiedProfile.healthGoals.includes('muscle_gain')) {
    dailyTip = 'Distribute your protein intake across each meal to optimize muscle protein synthesis and daily recovery.';
  }

  // Medical Disclaimer Note (only if medical consent was utilized)
  let medicalDisclaimerHtml = '';
  let medicalDisclaimerText = '';
  if (hasMedicalConsent && healthProfile) {
    medicalDisclaimerHtml = `
      <p style="color: #64748b; font-size: 11px; line-height: 1.4; margin: 12px 0 0 0; text-align: center;">
        * FoodieBite recommendations are for general nutritional wellness and do not replace professional medical guidance.
      </p>
    `;
    medicalDisclaimerText = `\n* Notice: FoodieBite recommendations are for general nutritional wellness and do not replace professional medical advice.\n`;
  }

  // Profile completion prompt (if profile has missing fields)
  let profilePromptHtml = '';
  const isProfileIncomplete = !user.cuisines || user.cuisines.length === 0 || !user.healthGoals || user.healthGoals.length === 0;
  if (isProfileIncomplete) {
    profilePromptHtml = `
      <div style="background-color: rgba(255, 107, 53, 0.05); border: 1px dashed rgba(255, 107, 53, 0.4); border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center;">
        <p style="color: #cbd5e1; font-size: 12px; margin: 0 0 6px 0;">
          💡 <strong>Want even more personalized dishes?</strong> Complete your cuisine preferences and health goals anytime!
        </p>
        <a href="${clientAppUrl}/profile" style="color: #FF6B35; font-size: 12px; font-weight: 700; text-decoration: none;">
          Update Taste Profile &rarr;
        </a>
      </div>
    `;
  }

  // Assemble Complete Plain Text
  const text = `Hello ${firstName},

Ready to discover fresh culinary inspiration tailored specifically for you today?

${climateText}
Your Personalized Food Picks:
${textFoodList}
Why these picks?
${personalizationReason}

Today's Food Tip:
${dailyTip}

Your Dietary Profile:
- Eating Type: ${userDiet}
- Preferred Spice: ${unifiedProfile.spiceLevel}
- Health Goals: ${unifiedProfile.healthGoals.map(g => g.replace(/_/g, ' ')).join(', ')}

Explore FoodieBite to discover more dishes matching your preferences: ${clientAppUrl}/home
${medicalDisclaimerText}
Enjoy your day!
The FoodieBite Team

---
To unsubscribe from daily recommendations: ${unsubUrl}
Manage your notification settings at: ${clientAppUrl}/profile
`;

  // Assemble Complete Responsive HTML
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1217; color: #ffffff; padding: 24px;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #161a22; border-radius: 16px; border: 1px solid #272d3b; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); padding: 26px 24px; text-align: center;">
          <span style="font-size: 38px;">🍽️</span>
          <h1 style="color: #ffffff; margin: 6px 0 0 0; font-size: 22px; font-weight: 800;">Your Personalized Food Picks</h1>
          <p style="color: rgba(255,255,255,0.92); margin: 4px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Context-Aware Nutrition by FoodieBite</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #ffffff; font-size: 17px; margin: 0 0 8px 0;">Hello ${brevoService.escapeHtml(firstName)}, 👋</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
            FoodieBite has curated fresh food ideas matching your lifestyle, today's climate, and personal nutrition goals.
          </p>

          ${climateHtml}

          <h3 style="color: #FF6B35; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 12px 0;">
            Today's Handcrafted Picks:
          </h3>
          ${htmlFoodCards}

          <div style="background-color: rgba(255, 107, 53, 0.08); border-left: 3px solid #FF6B35; padding: 14px; border-radius: 8px; margin: 18px 0;">
            <p style="margin: 0 0 4px 0; color: #FF6B35; font-weight: 700; font-size: 12px; text-transform: uppercase;">Why these picks?</p>
            <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${brevoService.escapeHtml(personalizationReason)}</p>
          </div>

          <div style="background-color: #1a1f29; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <p style="margin: 0 0 4px 0; color: #38bdf8; font-weight: 700; font-size: 12px; text-transform: uppercase;">💡 Today's Food Tip</p>
            <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${brevoService.escapeHtml(dailyTip)}</p>
          </div>

          ${profilePromptHtml}

          <div style="text-align: center; margin: 24px 0 16px 0;">
            <a href="${clientAppUrl}/home" style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 24px; font-size: 14px; font-weight: 700; display: inline-block;">
              Explore More Dishes &rarr;
            </a>
          </div>

          ${medicalDisclaimerHtml}

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 16px 0 4px 0;">
            Enjoy your meals and have a wonderful day!
          </p>
          <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">
            <strong>The FoodieBite Team</strong>
          </p>
        </div>

        <div style="background-color: #0f1217; padding: 16px; text-align: center; border-top: 1px solid #1f2532;">
          <p style="color: #475569; font-size: 11px; margin: 0 0 6px 0;">
            You are receiving this daily personalized email because daily suggestions are enabled for your FoodieBite account.
          </p>
          <div style="margin-top: 6px;">
            <a href="${unsubUrl}" style="color: #64748b; font-size: 11px; text-decoration: underline; margin-right: 12px;">
              Unsubscribe from Daily Recommendations
            </a>
            <a href="${clientAppUrl}/profile" style="color: #64748b; font-size: 11px; text-decoration: underline;">
              Manage Notification Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    success: true,
    subject,
    html,
    text,
    picks: safePicks,
    context: {
      weather: weather ? { condition: weather.condition, temperature: weather.temperature, category: weather.category, location: weather.locationName } : null,
      season: season.name,
      mealPeriod: contextProfile.mealPeriod
    },
    userProfile: {
      dietType: userDiet,
      spiceLevel: unifiedProfile.spiceLevel,
      healthGoals: unifiedProfile.healthGoals,
      allergies: unifiedProfile.allergies
    },
    personalizationReason,
    dailyTip
  };
}

/**
 * Execute the automated daily recommendations email run.
 * Handles rate limits, Brevo daily quota, batches of 10, run & recipient persistence.
 * Guarantees recipient isolation: failure for one user never stops other users.
 */
async function executeDailyRecommendationRun(options = {}) {
  if (isDailyJobRunning && !options.force) {
    console.warn('⚠️ [DailyRecommendations] Another daily recommendation job is currently in progress. Skipping overlapping run.');
    return { success: false, reason: 'overlapping_execution_prevented' };
  }

  isDailyJobRunning = true;
  const now = new Date();
  const runId = options.runId || getDailyRunId(now);
  const runDate = getKolkataDateString(now);
  const db = getFirestoreDb();

  console.log(`\n🚀 [DailyRecommendations] Starting dynamic personalized run: ${runId} (Date: ${runDate} Asia/Kolkata)...`);

  const runDoc = {
    runId,
    runDate,
    timezone: 'Asia/Kolkata',
    status: 'processing',
    triggerType: options.triggerType || 'scheduled',
    startedAt: now.toISOString(),
    completedAt: null,
    eligibleCount: 0,
    submittedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    skippedCount: 0,
    queuedCount: 0,
    personalizationStats: {
      vegetarian: 0,
      vegan: 0,
      eggetarian: 0,
      nonVegetarian: 0,
      weatherAware: 0,
      seasonalAware: 0,
      medicalConsentAware: 0
    },
    notes: ''
  };

  memoryDailyRuns.set(runId, runDoc);
  if (db) {
    try {
      await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
    } catch (_) {}
  }

  try {
    // 1. Evaluate recipients
    const { eligible, skipped } = await getEligibleDailyRecipients(runId);
    runDoc.eligibleCount = eligible.length;
    runDoc.skippedCount = skipped.length;

    // Record skipped recipients
    for (const sk of skipped) {
      const recId = `${runId}_${sk.email}`;
      const recDoc = {
        runId,
        userId: sk.userId || 'unknown',
        email: sk.email,
        status: 'skipped',
        skipReason: sk.reason,
        attemptCount: 0,
        completedAt: new Date().toISOString()
      };
      memoryDailyRecipients.set(recId, recDoc);
      if (db) {
        try {
          safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
        } catch (_) {}
      }
    }

    if (eligible.length === 0) {
      console.log(`ℹ️ [DailyRecommendations] No eligible recipients for ${runId}.`);
      runDoc.status = 'completed';
      runDoc.completedAt = new Date().toISOString();
      memoryDailyRuns.set(runId, runDoc);
      if (db) {
        try {
          await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
        } catch (_) {}
      }
      isDailyJobRunning = false;
      return { success: true, runDoc };
    }

    // 2. Check Brevo Quota
    const status = await brevoService.getBrevoAccountStatus();
    const remainingQuota = typeof status.creditsRemainingToday === 'number' ? status.creditsRemainingToday : 300;
    console.log(`📊 [DailyRecommendations] Brevo quota remaining: ${remainingQuota} | Eligible recipients: ${eligible.length}`);

    const BATCH_SIZE = parseInt(process.env.BREVO_BATCH_SIZE, 10) || 10;
    const BATCH_DELAY_MS = parseInt(process.env.BREVO_BATCH_DELAY_MS, 10) || 300;

    let submitted = 0;
    let failed = 0;
    let queued = 0;

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const currentQuotaCheck = remainingQuota - submitted;
      const batch = eligible.slice(i, i + BATCH_SIZE);

      for (const user of batch) {
        const recId = `${runId}_${user.email}`;

        // Check if Brevo quota exhausted for the day
        if (currentQuotaCheck <= 0) {
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'queued',
            skipReason: 'quota_exhausted',
            attemptCount: 0,
            lastAttemptAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          queued++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
          continue;
        }

        // Generate individualized, context-aware recommendation for this specific user
        let recData;
        try {
          recData = await buildDailyRecommendationForUser(user);
        } catch (genErr) {
          console.error(`⚠️ [DailyRecommendations] Recommendation generation failed for ${user.email}:`, genErr.message);
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'skipped',
            skipReason: 'generation_error',
            attemptCount: 0,
            completedAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          runDoc.skippedCount++;
          continue;
        }

        if (!recData || !recData.success) {
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'skipped',
            skipReason: recData?.reason || 'no_safe_recommendations',
            attemptCount: 0,
            completedAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          runDoc.skippedCount++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
          continue;
        }

        // Update personalization statistics
        const dietLower = (user.dietType || '').toLowerCase();
        if (dietLower.includes('vegan')) runDoc.personalizationStats.vegan++;
        else if (dietLower.includes('eggetarian')) runDoc.personalizationStats.eggetarian++;
        else if (dietLower.includes('non')) runDoc.personalizationStats.nonVegetarian++;
        else runDoc.personalizationStats.vegetarian++;

        if (recData.context?.weather) runDoc.personalizationStats.weatherAware++;
        if (recData.context?.season) runDoc.personalizationStats.seasonalAware++;
        if (user.medicalEmailConsent) runDoc.personalizationStats.medicalConsentAware++;

        // Send via Brevo
        try {
          const sendRes = await brevoService.sendTransactionalEmail({
            to: user.email,
            toName: user.name,
            subject: recData.subject,
            html: recData.html,
            text: recData.text,
            tags: ['daily-recommendation', runId]
          });

          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'submitted',
            providerMessageId: sendRes.messageId || null,
            attemptCount: 1,
            subject: recData.subject,
            recommendations: recData.picks.map(p => ({ id: p.id, name: p.name, calories: p.calories })),
            lastAttemptAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          submitted++;

          // Update user's recommendation memory to reduce repetition
          const newlyRecommendedIds = recData.picks.map(p => p.id || p.name);
          const existingHistory = user.recentEmailRecommendations || [];
          const updatedHistory = Array.from(new Set([...existingHistory, ...newlyRecommendedIds])).slice(-20);
          userStore.updateUser(user.id || user.uid, { recentEmailRecommendations: updatedHistory });

          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
        } catch (sendErr) {
          console.error(`❌ [DailyRecommendations] Send failed for ${user.email}:`, sendErr.message);
          const recDoc = {
            runId,
            userId: user.id || user.uid,
            email: user.email,
            status: 'failed',
            failureReason: sendErr.message,
            attemptCount: 1,
            lastAttemptAt: new Date().toISOString()
          };
          memoryDailyRecipients.set(recId, recDoc);
          failed++;
          if (db) {
            try {
              safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(recDoc, { merge: true }), 300);
            } catch (_) {}
          }
        }
      }

      // Small throttle delay between batches
      if (i + BATCH_SIZE < eligible.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    runDoc.submittedCount = submitted;
    runDoc.failedCount = failed;
    runDoc.queuedCount = queued;
    runDoc.status = failed > 0 && submitted === 0 ? 'failed' : 'completed';
    runDoc.completedAt = new Date().toISOString();

    memoryDailyRuns.set(runId, runDoc);
    if (db) {
      try {
        await safeFirestore(db.collection('dailyRecommendationRuns').doc(runId).set(runDoc, { merge: true }), 500);
      } catch (_) {}
    }

    console.log(`✅ [DailyRecommendations] Completed run ${runId}: Submitted: ${submitted}, Failed: ${failed}, Queued: ${queued}, Skipped: ${runDoc.skippedCount}`);
    return { success: true, runDoc };
  } catch (err) {
    console.error(`❌ [DailyRecommendations] Fatal error executing run ${runId}:`, err);
    runDoc.status = 'failed';
    runDoc.notes = err.message;
    runDoc.completedAt = new Date().toISOString();
    memoryDailyRuns.set(runId, runDoc);
    return { success: false, error: err.message, runDoc };
  } finally {
    isDailyJobRunning = false;
  }
}

/**
 * Send a test recommendation email to a given recipient with custom profile overrides
 */
async function sendTestDailyRecommendationEmail(targetEmail, profileOverrides = {}) {
  if (!targetEmail || !brevoService.isValidEmail(targetEmail)) {
    throw new Error('Valid email address is required for test email');
  }

  const testUser = {
    id: 'test_admin_recipient',
    name: targetEmail.split('@')[0],
    email: targetEmail,
    dietType: profileOverrides.dietType || 'Vegetarian',
    allergies: profileOverrides.allergies || [],
    spiceLevel: profileOverrides.spiceLevel || 'Medium',
    healthGoals: profileOverrides.healthGoals || ['healthy_eating'],
    cuisines: profileOverrides.cuisines || ['indian'],
    city: profileOverrides.city || 'Chennai'
  };

  const recData = await buildDailyRecommendationForUser(testUser, profileOverrides);
  if (!recData.success) {
    throw new Error('Could not generate safe food recommendations for test profile: ' + recData.reason);
  }

  const result = await brevoService.sendTransactionalEmail({
    to: targetEmail,
    toName: testUser.name,
    subject: `[TEST PREVIEW] ${recData.subject}`,
    html: recData.html,
    text: recData.text,
    tags: ['test', 'daily-recommendation-preview']
  });

  return {
    success: true,
    messageId: result.messageId,
    previewContent: {
      subject: recData.subject,
      picks: recData.picks,
      context: recData.context,
      personalizationReason: recData.personalizationReason
    }
  };
}

/**
 * Retry failed recipients for a given daily run ID
 */
async function retryDailyRunFailures(runId = getDailyRunId()) {
  const failedRecipients = [];
  for (const r of memoryDailyRecipients.values()) {
    if (r.runId === runId && (r.status === 'failed' || r.status === 'queued')) {
      failedRecipients.push(r);
    }
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await safeFirestore(
        db.collection('dailyRecommendationRecipients')
          .where('runId', '==', runId)
          .where('status', 'in', ['failed', 'queued'])
          .get(),
        500
      );
      if (snap) {
        snap.forEach(d => {
          const r = d.data();
          if (!failedRecipients.some(fr => fr.email === r.email)) {
            failedRecipients.push(r);
          }
        });
      }
    } catch (_) {}
  }

  if (failedRecipients.length === 0) {
    return { success: true, retriedCount: 0, message: 'No failed or queued recipients to retry for this run' };
  }

  let retriedCount = 0;
  for (const fr of failedRecipients) {
    try {
      const user = userStore.findByEmail(fr.email) || { email: fr.email, name: fr.email.split('@')[0] };
      const recData = await buildDailyRecommendationForUser(user);
      if (recData.success) {
        const sendRes = await brevoService.sendTransactionalEmail({
          to: fr.email,
          toName: user.name,
          subject: recData.subject,
          html: recData.html,
          text: recData.text,
          tags: ['daily-recommendation-retry', runId]
        });

        const recId = `${runId}_${fr.email}`;
        const updated = {
          ...fr,
          status: 'submitted',
          attemptCount: (fr.attemptCount || 1) + 1,
          providerMessageId: sendRes.messageId || null,
          lastAttemptAt: new Date().toISOString()
        };
        memoryDailyRecipients.set(recId, updated);
        if (db) {
          try {
            safeFirestore(db.collection('dailyRecommendationRecipients').doc(recId).set(updated, { merge: true }), 300);
          } catch (_) {}
        }
        retriedCount++;
      }
    } catch (e) {
      console.warn(`Retry failed for ${fr.email}:`, e.message);
    }
  }

  return { success: true, retriedCount, totalFailed: failedRecipients.length };
}

/**
 * Get daily runs history and summary
 */
async function getDailyRunsHistory(limitCount = 10) {
  const runs = Array.from(memoryDailyRuns.values());
  const db = getFirestoreDb();

  if (db) {
    try {
      const snap = await safeFirestore(db.collection('dailyRecommendationRuns').orderBy('startedAt', 'desc').limit(limitCount).get(), 500);
      if (snap) {
        snap.forEach(d => {
          const data = d.data();
          if (!runs.some(r => r.runId === data.runId)) {
            runs.push(data);
          }
        });
      }
    } catch (_) {}
  }

  runs.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  return runs.slice(0, limitCount);
}

module.exports = {
  getKolkataDateString,
  getDailyRunId,
  getEligibleDailyRecipients,
  generateDynamicSubjectLine,
  selectDiverseRecommendations,
  buildPersonalizedFoodReason,
  buildDailyRecommendationForUser,
  executeDailyRecommendationRun,
  sendTestDailyRecommendationEmail,
  retryDailyRunFailures,
  getDailyRunsHistory,
  isJobRunning: () => isDailyJobRunning
};
