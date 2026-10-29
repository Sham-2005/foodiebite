/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/contextService.js
 *  FoodieBite — Unified Context Service (Phase 4)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Provides a single, authoritative contextual representation for both
 *  Catalog and AI Recommendation Engines as well as the AI Coach.
 *
 *  CONTEXT DIMENSIONS:
 *  1. Time & Meal Period (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner, Late-night)
 *  2. Weather Intelligence (Temperature categories vs Conditions: hot, warm, mild, cool, cold, rainy, humid, dry)
 *  3. Seasonality Engine (Spring, Summer, Monsoon, Autumn, Winter) with regional calibration (e.g. India)
 *  4. Religious Fasting / Fasting Constraints (Constraint layer: Navratri, Ekadashi, User-defined)
 *  5. Verified Food Availability (available, unavailable, unknown)
 *  6. Repetition & Recency Tracking (bounded history window for diversity)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Configurable default time windows for meal periods (24-hour clock).
 */
const DEFAULT_MEAL_WINDOWS = Object.freeze([
  { period: 'breakfast',     startH: 6,  startM: 0,  endH: 10, endM: 59 },
  { period: 'morning_snack', startH: 11, startM: 0,  endH: 12, endM: 29 },
  { period: 'lunch',         startH: 12, startM: 30, endH: 15, endM: 29 },
  { period: 'evening_snack', startH: 15, startM: 30, endH: 18, endM: 59 },
  { period: 'dinner',        startH: 19, startM: 0,  endH: 22, endM: 29 },
  { period: 'late_night',    startH: 22, startM: 30, endH: 5,  endM: 59 }
]);

/**
 * Fasting Presets (strict constraint definitions).
 * Fasting is an explicit user-controlled constraint layer, never inferred.
 */
const FASTING_PRESETS = Object.freeze({
  navratri: {
    name: 'Navratri / Vrat',
    restrictedCategories: [
      'meat', 'poultry', 'chicken', 'mutton', 'beef', 'pork', 'fish', 'seafood',
      'eggs', 'egg', 'grains', 'wheat', 'rice', 'barley', 'oats', 'rye',
      'lentils', 'pulses', 'dal', 'beans', 'lentil',
      'onion', 'garlic', 'onion_garlic', 'processed_food'
    ],
    allowedCategories: [
      'fruit', 'fruits', 'dairy', 'milk', 'curd', 'yogurt', 'paneer', 'ghee',
      'nuts', 'seeds', 'almonds', 'walnuts', 'peanuts',
      'potato', 'sweet_potato', 'sabudana', 'makhana', 'tapioca', 'vrat_grains',
      'kuttu', 'singhara', 'rajgira', 'samak'
    ]
  },
  ekadashi: {
    name: 'Ekadashi',
    restrictedCategories: [
      'meat', 'poultry', 'chicken', 'mutton', 'fish', 'seafood', 'eggs', 'egg',
      'grains', 'wheat', 'rice', 'barley', 'oats', 'beans', 'lentils', 'dal', 'pulses'
    ],
    allowedCategories: [
      'fruit', 'fruits', 'dairy', 'milk', 'curd', 'yogurt', 'paneer',
      'nuts', 'seeds', 'vegetables', 'potato'
    ]
  },
  intermittent: {
    name: 'Intermittent Fasting',
    restrictedCategories: [],
    allowedCategories: []
  },
  user_defined: {
    name: 'User Defined Fast',
    restrictedCategories: [],
    allowedCategories: []
  }
});

/**
 * Detects meal period based on current time or provided time/override.
 *
 * @param {Date|string|number} time - Date or time string
 * @param {Array} customWindows - Optional custom meal time windows
 * @returns {string} One of 'breakfast'|'morning_snack'|'lunch'|'evening_snack'|'dinner'|'late_night'
 */
function detectMealPeriod(time = new Date(), customWindows = DEFAULT_MEAL_WINDOWS) {
  const d = time instanceof Date ? time : new Date(time);
  if (isNaN(d.getTime())) return 'lunch';

  const hours = d.getHours();
  const minutes = d.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  for (const w of customWindows) {
    const start = w.startH * 60 + w.startM;
    const end = w.endH * 60 + w.endM;

    if (start <= end) {
      if (currentMinutes >= start && currentMinutes <= end) {
        return w.period;
      }
    } else {
      // Window crosses midnight (e.g. 22:30 to 05:59)
      if (currentMinutes >= start || currentMinutes <= end) {
        return w.period;
      }
    }
  }

  return 'lunch';
}

/**
 * Normalizes temperature into standardized clinical/environmental categories.
 *
 * @param {number|string|null} temp - Temperature in Celsius
 * @returns {'hot'|'warm'|'mild'|'cool'|'cold'|null}
 */
function normalizeTemperatureCategory(temp) {
  if (temp === null || temp === undefined || temp === '') return null;
  const num = typeof temp === 'number' ? temp : parseFloat(String(temp).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return null;

  if (num >= 32) return 'hot';
  if (num >= 25) return 'warm';
  if (num >= 18) return 'mild';
  if (num >= 12) return 'cool';
  return 'cold';
}

/**
 * Normalizes weather condition string and humidity into standardized categories.
 * Separates weather condition from temperature.
 *
 * @param {string|null} condition - Condition description (e.g. 'rain', 'thunderstorm', 'clear')
 * @param {number|string|null} humidity - Relative humidity percentage
 * @returns {{ conditionCategory: string|null, isRainy: boolean, isHumid: boolean, isDry: boolean }}
 */
function normalizeWeatherCondition(condition, humidity) {
  const condLower = (condition ? String(condition).toLowerCase() : '');
  const parsedHum = (humidity !== null && humidity !== undefined && humidity !== '')
    ? (typeof humidity === 'number' ? humidity : parseFloat(String(humidity)))
    : null;

  const isRainy = condLower.includes('rain') || condLower.includes('drizzle') ||
                  condLower.includes('thunder') || condLower.includes('storm') ||
                  condLower.includes('monsoon') || condLower.includes('shower');

  const isHumid = parsedHum !== null && !isNaN(parsedHum) && parsedHum >= 70;
  const isDry = parsedHum !== null && !isNaN(parsedHum) && parsedHum <= 30;

  let conditionCategory = null;
  if (isRainy) {
    conditionCategory = 'rainy';
  } else if (isHumid) {
    conditionCategory = 'humid';
  } else if (isDry) {
    conditionCategory = 'dry';
  } else if (condLower.includes('cloud')) {
    conditionCategory = 'cloudy';
  } else if (condLower.includes('clear') || condLower.includes('sun')) {
    conditionCategory = 'clear';
  } else if (condLower) {
    conditionCategory = condLower;
  }

  return {
    conditionCategory,
    isRainy,
    isHumid,
    isDry
  };
}

/**
 * Detects current season based on date and regional configuration.
 *
 * @param {Date|string} date - Date object or ISO string
 * @param {string} region - Region string (e.g. 'India', 'default', 'US')
 * @returns {{ name: string, region: string }}
 */
function detectSeason(date = new Date(), region = 'India') {
  const d = date instanceof Date ? date : new Date(date);
  const month = !isNaN(d.getTime()) ? (d.getMonth() + 1) : 4; // 1-12 (default April)
  const normRegion = region ? String(region).toLowerCase().trim() : 'india';

  let seasonName = 'summer';

  if (normRegion === 'india' || normRegion === 'in' || normRegion === 'south_asia') {
    // Indian Meteorological Seasonality:
    // Summer (Pre-monsoon): March (3) - May (5)
    // Monsoon (Southwest): June (6) - September (9)
    // Autumn (Post-monsoon): October (10) - November (11)
    // Winter: December (12), January (1), February (2)
    if (month >= 3 && month <= 5) {
      seasonName = 'summer';
    } else if (month >= 6 && month <= 9) {
      seasonName = 'monsoon';
    } else if (month >= 10 && month <= 11) {
      seasonName = 'autumn';
    } else {
      seasonName = 'winter';
    }
  } else {
    // Northern Hemisphere standard 4 seasons:
    // Spring: March (3) - May (5)
    // Summer: June (6) - August (8)
    // Autumn: September (9) - November (11)
    // Winter: December (12), January (1), February (2)
    if (month >= 3 && month <= 5) {
      seasonName = 'spring';
    } else if (month >= 6 && month <= 8) {
      seasonName = 'summer';
    } else if (month >= 9 && month <= 11) {
      seasonName = 'autumn';
    } else {
      seasonName = 'winter';
    }
  }

  return {
    name: seasonName,
    region: region || 'India'
  };
}

/**
 * Normalizes fasting configuration.
 * Ensures fasting is explicit, controlled, and never inferred from demographic data.
 *
 * @param {Object} rawFasting - User or request fasting settings
 * @returns {{ active: boolean, type: string|null, allowedCategories: string[], restrictedCategories: string[] }}
 */
function normalizeFastingConfig(rawFasting = {}) {
  if (!rawFasting || typeof rawFasting !== 'object') {
    return {
      active: false,
      type: null,
      allowedCategories: [],
      restrictedCategories: []
    };
  }

  const active = Boolean(rawFasting.active);
  if (!active) {
    return {
      active: false,
      type: null,
      allowedCategories: [],
      restrictedCategories: []
    };
  }

  const type = rawFasting.type ? String(rawFasting.type).toLowerCase().trim() : 'user_defined';
  const preset = FASTING_PRESETS[type] || {};

  const allowedCategories = Array.from(new Set([
    ...(preset.allowedCategories || []),
    ...(Array.isArray(rawFasting.allowedCategories) ? rawFasting.allowedCategories : [])
  ].map(c => String(c).toLowerCase().trim()).filter(Boolean)));

  const restrictedCategories = Array.from(new Set([
    ...(preset.restrictedCategories || []),
    ...(Array.isArray(rawFasting.restrictedCategories) ? rawFasting.restrictedCategories : [])
  ].map(c => String(c).toLowerCase().trim()).filter(Boolean)));

  return {
    active: true,
    type,
    allowedCategories,
    restrictedCategories
  };
}

/**
 * Evaluates whether a candidate food item is compatible with an active fasting constraint.
 * Fasting is a CONSTRAINT gate, not merely a recommendation score.
 *
 * @param {Object} food - Candidate food item
 * @param {Object} fastingContext - Normalized fasting context object
 * @returns {{ compatible: boolean, reason?: string }}
 */
function isFastingCompatible(food, fastingContext) {
  if (!fastingContext || !fastingContext.active) {
    return { compatible: true };
  }

  if (!food || typeof food !== 'object') {
    return { compatible: false, reason: 'Invalid food item' };
  }

  const restricted = fastingContext.restrictedCategories || [];
  if (restricted.length === 0) {
    return { compatible: true };
  }

  const nameLower = (food.name || '').toLowerCase();
  const categoryLower = (food.category || '').toLowerCase();
  const categoriesLower = (food.categories || []).map(c => String(c).toLowerCase());
  const tagsLower = (food.tags || []).map(t => String(t).toLowerCase());
  const dietTagsLower = (food.dietTags || []).map(t => String(t).toLowerCase());
  const fastingTagsLower = (food.fastingTags || []).map(t => String(t).toLowerCase());
  const allergensLower = (food.allergens || []).map(a => String(a).toLowerCase());

  // 1. Check for Restricted Categories Match
  for (const r of restricted) {
    const rNorm = r.toLowerCase().trim();
    if (!rNorm) continue;

    // Check food name tokens (word boundary)
    const wordRegex = new RegExp(`\\b${rNorm}\\b`, 'i');
    if (wordRegex.test(nameLower)) {
      return { compatible: false, reason: `Contains fasting-restricted item: ${rNorm}` };
    }

    // Check category / categories
    if (categoryLower.includes(rNorm) || categoriesLower.some(c => c.includes(rNorm))) {
      return { compatible: false, reason: `Matches fasting-restricted category: ${rNorm}` };
    }

    // Check tags / dietTags
    if (tagsLower.includes(rNorm) || dietTagsLower.includes(rNorm)) {
      return { compatible: false, reason: `Tagged with fasting-restricted token: ${rNorm}` };
    }

    // Check special category mappings
    if (rNorm === 'grains' || rNorm === 'wheat' || rNorm === 'rice') {
      if (allergensLower.includes('gluten') ||
          categoryLower.includes('grain') ||
          categoryLower.includes('bread') ||
          categoryLower.includes('cereal') ||
          categoriesLower.some(c => c.includes('grain') || c.includes('cereal') || c.includes('bread'))) {
        // Exception: vrat pseudo-grains (sabudana, kuttu, singhara, rajgira) are allowed
        const isVratGrain = fastingTagsLower.includes('vrat_grain') ||
                            nameLower.includes('sabudana') ||
                            nameLower.includes('makhana') ||
                            nameLower.includes('kuttu') ||
                            nameLower.includes('singhara');
        if (!isVratGrain) {
          return { compatible: false, reason: `Grain/cereal restricted during ${fastingContext.type || 'fasting'}` };
        }
      }
    }

    if (rNorm === 'onion_garlic' || rNorm === 'onion' || rNorm === 'garlic') {
      if (nameLower.includes('onion') || nameLower.includes('garlic') ||
          tagsLower.includes('onion') || tagsLower.includes('garlic')) {
        return { compatible: false, reason: 'Contains onion/garlic restricted during fasting' };
      }
    }

    if (rNorm === 'meat' || rNorm === 'poultry' || rNorm === 'fish' || rNorm === 'seafood') {
      if (food.vegetarian === false || allergensLower.includes('fish') || allergensLower.includes('crustacean')) {
        return { compatible: false, reason: 'Non-vegetarian food restricted during fasting' };
      }
    }

    if (rNorm === 'eggs' || rNorm === 'egg') {
      if (food.vegan === false && food.vegetarian === false && allergensLower.includes('egg')) {
        return { compatible: false, reason: 'Eggs restricted during fasting' };
      }
    }

    if (rNorm === 'beans' || rNorm === 'lentils' || rNorm === 'dal' || rNorm === 'pulses') {
      if (categoryLower.includes('lentil') || categoryLower.includes('dal') ||
          nameLower.includes('dal') || nameLower.includes('lentil') || nameLower.includes('chole') || nameLower.includes('rajma')) {
        return { compatible: false, reason: 'Lentils/pulses restricted during Ekadashi fasting' };
      }
    }
  }

  // 2. If allowedCategories is strictly defined (e.g. Navratri only allows fruits, dairy, nuts, vrat grains)
  const allowed = fastingContext.allowedCategories || [];
  if (allowed.length > 0 && (fastingTagsLower.length > 0 || food.category)) {
    // If the food has explicit fastingTags or category, verify at least one allowed category matches
    const matchesAllowed = allowed.some(a => {
      const aNorm = a.toLowerCase().trim();
      return fastingTagsLower.includes(aNorm) ||
             categoryLower.includes(aNorm) ||
             categoriesLower.some(c => c.includes(aNorm)) ||
             (aNorm === 'dairy' && (food.dairy || allergensLower.includes('dairy') || allergensLower.includes('milk'))) ||
             (aNorm === 'fruit' && (categoryLower.includes('fruit') || tagsLower.includes('fruit'))) ||
             (aNorm === 'nuts' && (allergensLower.includes('nuts') || allergensLower.includes('peanuts') || categoryLower.includes('nut')));
    });

    // If candidate has fasting tags or is a structured catalog item, evaluate allowed match
    if (food.fastingTags && food.fastingTags.length > 0 && !matchesAllowed) {
      return { compatible: false, reason: `Food does not match permitted fasting categories: ${allowed.slice(0, 3).join(', ')}` };
    }
  }

  return { compatible: true };
}

/**
 * Builds the canonical Centralized Context Profile.
 *
 * @param {Object} options - Configuration and input signals:
 *   - currentTime {Date|string}
 *   - mealPeriod {string} (optional manual override)
 *   - weather {Object|string} ({ temp, condition, humidity, source, category })
 *   - season {Object|string} ({ name, region })
 *   - fasting {Object} ({ active, type, allowedCategories, restrictedCategories })
 *   - userProfile {Object} (Unified UserFoodProfile or raw user doc)
 *   - availability {Object} ({ available, source })
 *   - recentRecommendations {string[]}
 * @returns {ContextProfile} Authoritative ContextProfile used across engines
 */
function buildContextProfile(options = {}) {
  const opts = options || {};

  // 1. Current Time & Meal Period
  const dateObj = opts.currentTime ? new Date(opts.currentTime) : new Date();
  const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date();
  const currentTime = validDate.toISOString();
  const currentHour = validDate.getHours();

  const detectedMeal = detectMealPeriod(validDate);
  const rawMealOverride = opts.mealPeriod || opts.mealType || null;
  const validMealPeriods = ['breakfast', 'morning_snack', 'lunch', 'evening_snack', 'dinner', 'late_night'];
  const mealPeriod = (rawMealOverride && validMealPeriods.includes(String(rawMealOverride).toLowerCase()))
    ? String(rawMealOverride).toLowerCase()
    : detectedMeal;

  // 2. Weather Intelligence
  let rawWeather = opts.weather;
  if (typeof rawWeather === 'string') {
    rawWeather = { condition: rawWeather };
  } else if (!rawWeather || typeof rawWeather !== 'object') {
    rawWeather = {};
  }

  const rawTemp = rawWeather.temperature ?? rawWeather.temp ?? null;
  const tempCategory = rawWeather.category || normalizeTemperatureCategory(rawTemp);
  const rawCondition = rawWeather.condition || rawWeather.weatherCond || null;
  const rawHumidity = rawWeather.humidity ?? null;
  const { conditionCategory, isRainy, isHumid, isDry } = normalizeWeatherCondition(rawCondition, rawHumidity);

  const weather = {
    temperature: (rawTemp !== null && rawTemp !== undefined && !isNaN(Number(rawTemp))) ? Number(rawTemp) : null,
    condition: rawCondition ? String(rawCondition).toLowerCase() : null,
    humidity: (rawHumidity !== null && !isNaN(Number(rawHumidity))) ? Number(rawHumidity) : null,
    source: rawWeather.source || (rawTemp !== null || rawCondition !== null ? 'client' : null),
    category: tempCategory, // 'hot'|'warm'|'mild'|'cool'|'cold'|null
    conditionCategory,      // 'rainy'|'humid'|'dry'|'clear'|'cloudy'|null
    isRainy,
    isHumid,
    isDry
  };

  // 3. Seasonality Engine
  let rawSeason = opts.season;
  if (typeof rawSeason === 'string') {
    rawSeason = { name: rawSeason };
  } else if (!rawSeason || typeof rawSeason !== 'object') {
    rawSeason = {};
  }

  const region = rawSeason.region || opts.userProfile?.preferences?.country || opts.region || 'India';
  const detected = detectSeason(validDate, region);
  const seasonName = rawSeason.name
    ? String(rawSeason.name).toLowerCase().trim()
    : detected.name;

  const season = {
    name: seasonName, // 'spring'|'summer'|'monsoon'|'autumn'|'winter'
    region: detected.region
  };

  // 4. Religious Fasting / Fasting Constraints
  // Fasting must come from explicit user settings or explicit request override.
  const rawFasting = opts.fasting ||
                     opts.userProfile?.fasting ||
                     opts.userProfile?.preferences?.fasting ||
                     {};
  const fasting = normalizeFastingConfig(rawFasting);

  // 5. Food Availability
  // Differentiate available, unavailable, unknown.
  // Unknown availability is NOT treated as unavailable.
  let availabilityStatus = 'unknown';
  let availabilitySource = null;

  if (opts.availability && typeof opts.availability === 'object') {
    if (opts.availability.available === true || opts.availability.status === 'available') {
      availabilityStatus = 'available';
    } else if (opts.availability.available === false || opts.availability.status === 'unavailable') {
      availabilityStatus = 'unavailable';
    }
    availabilitySource = opts.availability.source || null;
  } else if (typeof opts.availability === 'string') {
    const s = opts.availability.toLowerCase().trim();
    if (s === 'available' || s === 'unavailable') {
      availabilityStatus = s;
    }
  }

  const availability = {
    available: availabilityStatus, // 'available'|'unavailable'|'unknown'
    source: availabilitySource
  };

  // 6. Diversity and Repetition Control (Bounded History Window)
  const recentRecs = Array.isArray(opts.recentRecommendations)
    ? opts.recentRecommendations.map(id => String(id).trim()).filter(Boolean)
    : (Array.isArray(opts.userProfile?.recentRecommendations)
        ? opts.userProfile.recentRecommendations.map(id => String(id).trim()).filter(Boolean)
        : []);

  return {
    currentTime,
    currentHour,
    mealPeriod,
    weather,
    season,
    fasting,
    availability,
    recentRecommendations: recentRecs.slice(-20) // Keep bounded window of last 20
  };
}

module.exports = {
  DEFAULT_MEAL_WINDOWS,
  FASTING_PRESETS,
  detectMealPeriod,
  normalizeTemperatureCategory,
  normalizeWeatherCondition,
  detectSeason,
  normalizeFastingConfig,
  isFastingCompatible,
  buildContextProfile
};
