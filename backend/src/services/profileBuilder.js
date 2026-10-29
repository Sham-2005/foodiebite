// ─────────────────────────────────────────────────────────────
//  backend/src/services/profileBuilder.js
//  Phase 2 — Unified User Food Profile Builder
//
//  buildUserFoodProfile(userData) transforms the raw Firestore user
//  document into a single, normalized UserFoodProfile object that
//  every AI consumer (coachController, foodController,
//  recommendationEngine) accepts identically.
//
//  DESIGN RULES
//  ─────────────
//  1. No external APIs are called here.
//  2. Nutritional targets are only computed when all required inputs
//     are present (age, gender, weight, height, activityLevel).
//  3. Medical restrictions from healthProfile are split into:
//       activeFoodRestrictions  — confirmed findings, used for hard exclusion
//       informationalRestrictions — low-confidence findings, UI-only
//  4. This file is the single source of truth for profile normalization.
// ─────────────────────────────────────────────────────────────

'use strict';

const { biomarkerRules } = require('../config/ruleConfigLoader');
const { normalizeFastingConfig } = require('./contextService');

// ── Activity multipliers for TDEE calculation (Mifflin-St Jeor) ──
const ACTIVITY_MULTIPLIERS = {
  sedentary:     1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active:   1.725,
  extra_active:  1.9,
  // Accept friendly label variants as well
  light:         1.375,
  moderate:      1.55,
  active:        1.725,
  very:          1.725,
};

/**
 * Compute BMI when height (cm) and weight (kg) are both valid.
 * Returns null if inputs are missing or invalid.
 * @param {number} weightKg
 * @param {number} heightCm
 * @returns {number|null}
 */
function computeBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

/**
 * Compute Basal Metabolic Rate using the Mifflin-St Jeor equation.
 * Returns null if any required input is missing.
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} ageYears
 * @param {string} gender  'male'|'female'|'other'
 * @returns {number|null} BMR in kcal/day
 */
function computeBMR(weightKg, heightCm, ageYears, gender) {
  if (!weightKg || !heightCm || !ageYears) return null;
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return null;

  const g = (gender || '').toLowerCase();
  if (g === 'male') {
    return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5);
  } else if (g === 'female') {
    return Math.round((10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161);
  }
  // For 'other' / unknown: use the average of male + female formulas
  const male   = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5;
  const female = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161;
  return Math.round((male + female) / 2);
}

/**
 * Compute daily calorie target (TDEE).
 * Returns null if BMR cannot be computed.
 * @param {number|null} bmr
 * @param {string} activityLevel
 * @returns {number|null}
 */
function computeCalorieTarget(bmr, activityLevel) {
  if (!bmr) return null;
  const key    = (activityLevel || '').toLowerCase().replace(/\s+/g, '_');
  const factor = ACTIVITY_MULTIPLIERS[key] || ACTIVITY_MULTIPLIERS.sedentary;
  return Math.round(bmr * factor);
}

/**
 * Compute recommended daily protein intake in grams.
 * Uses 1.2 g/kg for general health, 1.6 g/kg for muscle gain,
 * 1.0 g/kg for weight loss.
 * Returns null if weight is not available.
 * @param {number|null} weightKg
 * @param {string[]} healthGoals
 * @returns {number|null}
 */
function computeProteinTarget(weightKg, healthGoals) {
  if (!weightKg || weightKg <= 0) return null;
  const goals = (healthGoals || []).map(g => g.toLowerCase());
  let multiplier = 1.2;
  if (goals.includes('muscle_gain'))  multiplier = 1.6;
  if (goals.includes('weight_loss'))  multiplier = 1.0;
  return Math.round(weightKg * multiplier);
}

/**
 * Extract confirmed vs informational medical food restrictions
 * from the stored healthProfile.wellnessConcerns and foodProfile.
 *
 * Confirmed restrictions (HIGH confidence findings) → activeFoodRestrictions
 * Low/medium confidence → informationalRestrictions
 *
 * @param {Object|null} healthProfile
 * @returns {{ activeFoodRestrictions: string[], informationalRestrictions: string[], foodsToPrefer: string[] }}
 */
function extractMedicalRestrictions(healthProfile) {
  const result = {
    activeFoodRestrictions:   [],
    informationalRestrictions: [],
    foodsToPrefer:             [],
    preferredFoodTags:         [],
    wellnessSummary:           [],
    medicalProfile: {
      confirmedRestrictions: [],
      preferredFoodTags:     [],
      unverifiedConcerns:    []
    }
  };

  if (!healthProfile) return result;

  const foodProfile      = healthProfile.foodProfile      || {};
  const wellnessConcerns = healthProfile.wellnessConcerns || [];
  const findings         = healthProfile.findings         || [];
  const unverifiedFindings = healthProfile.unverifiedFindings || [];

  // Separate confirmed vs unverified food restrictions from foodProfile
  const toLimit = (foodProfile.foodsToLimit || []).map(f => String(f).toLowerCase().trim());
  const unverified = (foodProfile.unverifiedFoodRestrictions || []).map(f => {
    if (typeof f === 'string') return f.toLowerCase().trim();
    if (f && f.biomarker) return String(f.biomarker).toLowerCase().trim();
    return '';
  }).filter(Boolean);

  const preferFoods = (foodProfile.foodsToPrefer || []).map(f => String(f));
  const activeRestrictions = new Set(toLimit);
  const unverifiedRestrictions = new Set(unverified);
  const preferredTags = new Set();

  // Extract structured medical food rules from findings / biomarkerRules
  const allFindings = [
    ...findings.map(f => ({ ...f, confidence: f.confidence || 'high' })),
    ...unverifiedFindings.map(f => ({ ...f, confidence: f.confidence || 'low' }))
  ];

  for (const f of allFindings) {
    if (!f || f.status === 'Normal' || f.status === 'Unknown') continue;
    const isLowConfidence = String(f.confidence).toLowerCase() === 'low';

    const bioDef = biomarkerRules.biomarkers?.[f.key];
    if (bioDef && bioDef.foodRules) {
      for (const [, rule] of Object.entries(bioDef.foodRules)) {
        if (rule.prefer && Array.isArray(rule.prefer)) {
          if (!isLowConfidence) {
            rule.prefer.forEach(p => preferredTags.add(p));
          }
        }
        if (rule.limit && Array.isArray(rule.limit)) {
          if (!isLowConfidence) {
            rule.limit.forEach(l => activeRestrictions.add(l));
          } else {
            rule.limit.forEach(l => unverifiedRestrictions.add(l));
          }
        }
      }
    }
  }

  // Extract preferred tags from foodsToPrefer text
  for (const p of preferFoods) {
    const lp = p.toLowerCase();
    if (lp.includes('sodium')) preferredTags.add('low-sodium');
    if (lp.includes('fiber') || lp.includes('oat') || lp.includes('whole grain')) preferredTags.add('high-fiber');
    if (lp.includes('sugar') || lp.includes('low-gi')) preferredTags.add('low-gi');
    if (lp.includes('omega') || lp.includes('salmon') || lp.includes('walnut')) preferredTags.add('omega-3-rich');
  }

  // Build a compact wellness summary for AI context (no raw OCR text)
  const confirmedConcerns = wellnessConcerns.filter(c => String(c.confidence).toUpperCase() === 'HIGH');
  const wellnessSummary = confirmedConcerns.map(c => `${c.concern || c.tag} (${c.severity || 'moderate'})`);

  result.activeFoodRestrictions   = [...activeRestrictions];
  result.informationalRestrictions = [...unverifiedRestrictions];
  result.foodsToPrefer             = preferFoods;
  result.preferredFoodTags         = [...preferredTags];
  result.wellnessSummary           = wellnessSummary;

  result.medicalProfile = {
    confirmedRestrictions: result.activeFoodRestrictions,
    preferredFoodTags:     result.preferredFoodTags,
    unverifiedConcerns:    result.informationalRestrictions
  };

  return result;
}

/**
 * Normalize a diet-type string into the canonical form used by
 * dietarySafetyService.
 * @param {string} raw
 * @returns {string}
 */
function normalizeDietType(raw) {
  if (!raw) return 'non-vegetarian';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('non') || lower.includes('non-veg')) return 'non-vegetarian';
  if (lower.includes('vegan'))         return 'vegan';
  if (lower.includes('eggetarian'))    return 'eggetarian';
  if (lower.includes('vegetarian'))    return 'vegetarian';
  if (lower.includes('keto'))          return 'keto';
  if (lower.includes('diabetic'))      return 'diabetic';
  return lower;
}

/**
 * Build the canonical UserFoodProfile from the raw Firestore user document.
 *
 * @param {Object} userData - Raw Firestore user document (or {} for anonymous)
 * @returns {UserFoodProfile}
 *
 * @typedef {Object} UserFoodProfile
 * @property {string|null}   userId
 * @property {string|null}   name
 * @property {number|null}   age
 * @property {string|null}   gender
 * @property {number|null}   weightKg
 * @property {number|null}   heightCm
 * @property {string}        activityLevel
 * @property {string}        dietType              - normalized
 * @property {string}        spiceLevel
 * @property {string[]}      cuisines
 * @property {string[]}      healthGoals
 * @property {string[]}      allergies
 * @property {number|null}   bmi
 * @property {number|null}   bmr
 * @property {number|null}   dailyCalorieTarget
 * @property {number|null}   dailyProteinTarget
 * @property {string[]}      activeFoodRestrictions   - confirmed medical, hard exclusions
 * @property {string[]}      informationalRestrictions - low-confidence, UI only
 * @property {string[]}      foodsToPrefer
 * @property {string[]}      wellnessSummary
 * @property {Object|null}   healthProfile            - raw healthProfile for engines that need it
 * @property {string|null}   maxCaloriesOverride       - user-set max calories preference
 * @property {string|null}   minProteinOverride        - user-set min protein preference
 */
function buildUserFoodProfile(userData) {
  if (!userData || typeof userData !== 'object') userData = {};

  const prefs = userData.preferences || {};

  // ── Demographics ─────────────────────────────────────────────
  const userId   = userData.id   || userData.uid  || null;
  const name     = userData.name || userData.displayName || null;

  const age    = userData.age    ? Number(userData.age)    : null;
  const gender = userData.gender ? String(userData.gender) : null;

  // Physical metrics — stored at top level or inside preferences
  const weightKg = (userData.weight    || prefs.weight    || null) ? Number(userData.weight || prefs.weight) : null;
  const heightCm = (userData.height    || prefs.height    || null) ? Number(userData.height || prefs.height) : null;
  const activityLevel = userData.activityLevel || prefs.activityLevel || 'sedentary';

  // ── Dietary preferences ───────────────────────────────────────
  const rawDiet    = prefs.dietType || userData.dietType || 'non-vegetarian';
  const dietType   = normalizeDietType(rawDiet);
  const spiceLevel = prefs.spiceLevel || 'Medium';
  const cuisines   = Array.isArray(prefs.cuisines)     ? prefs.cuisines     : [];
  const healthGoals = Array.isArray(prefs.healthGoals) ? prefs.healthGoals  : ['healthy_eating'];
  const allergies  = Array.isArray(prefs.allergies)    ? prefs.allergies    : [];

  // Explicit user-set nutrition overrides
  const maxCaloriesOverride = prefs.maxCalories != null ? prefs.maxCalories : null;
  const minProteinOverride  = prefs.minProtein  != null ? prefs.minProtein  : null;

  // ── Computed nutritional targets ──────────────────────────────
  const bmi              = computeBMI(weightKg, heightCm);
  const bmr              = computeBMR(weightKg, heightCm, age, gender);
  const dailyCalorieTarget = computeCalorieTarget(bmr, activityLevel);
  const dailyProteinTarget = computeProteinTarget(weightKg, healthGoals);

  // ── Medical data ──────────────────────────────────────────────
  const healthProfile = userData.healthProfile || null;
  const {
    activeFoodRestrictions,
    informationalRestrictions,
    foodsToPrefer,
    preferredFoodTags,
    wellnessSummary,
    medicalProfile,
  } = extractMedicalRestrictions(healthProfile);

  // ── Fasting preferences (explicit, never inferred) ────────────
  const rawFasting = prefs.fasting || userData.fasting || null;
  const fasting    = normalizeFastingConfig(rawFasting);

  return {
    userId,
    name,
    age,
    gender,
    weightKg,
    heightCm,
    activityLevel,
    dietType,
    spiceLevel,
    cuisines,
    healthGoals,
    allergies,
    fasting,
    bmi,
    bmr,
    dailyCalorieTarget,
    dailyProteinTarget,
    activeFoodRestrictions,
    informationalRestrictions,
    foodsToPrefer,
    preferredFoodTags,
    wellnessSummary,
    medicalProfile,
    healthProfile,
    maxCaloriesOverride,
    minProteinOverride,
  };
}

module.exports = { buildUserFoodProfile };
