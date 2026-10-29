// ─────────────────────────────────────────────────────────────
//  backend/src/services/weatherService.js
//  FoodieBite — Contextual Weather Service for Personalization
//  Fetches live weather from Open-Meteo with caching & offline safety.
//  Strictly adheres to: Never fabricate weather. Omit if unavailable.
// ─────────────────────────────────────────────────────────────

'use strict';

const { getCachedWeather, setCachedWeather } = require('./cacheService');
const { normalizeTemperatureCategory, normalizeWeatherCondition } = require('./contextService');

// Known city coordinates in India and global hubs for resolved location lookups
const KNOWN_COORDINATES = Object.freeze({
  'chennai':    { latitude: 13.0827, longitude: 80.2707, label: 'Chennai, India' },
  'mumbai':     { latitude: 19.0760, longitude: 72.8777, label: 'Mumbai, India' },
  'delhi':      { latitude: 28.6139, longitude: 77.2090, label: 'Delhi, India' },
  'new delhi':  { latitude: 28.6139, longitude: 77.2090, label: 'New Delhi, India' },
  'bengaluru':  { latitude: 12.9716, longitude: 77.5946, label: 'Bengaluru, India' },
  'bangalore':  { latitude: 12.9716, longitude: 77.5946, label: 'Bengaluru, India' },
  'hyderabad':  { latitude: 17.3850, longitude: 78.4867, label: 'Hyderabad, India' },
  'kolkata':    { latitude: 22.5726, longitude: 88.3639, label: 'Kolkata, India' },
  'pune':       { latitude: 18.5204, longitude: 73.8567, label: 'Pune, India' },
  'ahmedabad':  { latitude: 23.0225, longitude: 72.5714, label: 'Ahmedabad, India' },
  'jaipur':     { latitude: 26.9124, longitude: 75.7873, label: 'Jaipur, India' },
  'kochi':      { latitude: 9.9312,  longitude: 76.2673, label: 'Kochi, India' },
  'chandigarh': { latitude: 30.7333, longitude: 76.7794, label: 'Chandigarh, India' },
  'lucknow':    { latitude: 26.8467, longitude: 80.9462, label: 'Lucknow, India' },
  'avadi':      { latitude: 13.1067, longitude: 80.0970, label: 'Avadi, Chennai' }
});

// WMO Weather Interpretation Codes (Open-Meteo standard)
function mapWmoCodeToCondition(code) {
  if (code === 0) return { condition: 'Clear', conditionCategory: 'clear' };
  if (code === 1) return { condition: 'Mainly Clear', conditionCategory: 'clear' };
  if (code === 2) return { condition: 'Partly Cloudy', conditionCategory: 'cloudy' };
  if (code === 3) return { condition: 'Overcast', conditionCategory: 'cloudy' };
  if (code === 45 || code === 48) return { condition: 'Foggy', conditionCategory: 'cloudy' };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', conditionCategory: 'rainy' };
  if (code >= 61 && code <= 65) return { condition: 'Rain', conditionCategory: 'rainy' };
  if (code >= 66 && code <= 67) return { condition: 'Freezing Rain', conditionCategory: 'rainy' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', conditionCategory: 'cold' };
  if (code >= 80 && code <= 82) return { condition: 'Rain Showers', conditionCategory: 'rainy' };
  if (code >= 85 && code <= 86) return { condition: 'Snow Showers', conditionCategory: 'cold' };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', conditionCategory: 'rainy' };
  return { condition: 'Mild', conditionCategory: 'mild' };
}

/**
 * Practical food and hydration suggestions based on current weather condition
 */
function getWeatherFoodTip(category, isRainy, temperature) {
  if (isRainy) {
    return 'Rainy weather calls for freshly prepared, warm, and easily digestible foods. Enjoy comforting vegetable soups, hot dal, or herbal infusions.';
  }
  if (category === 'hot') {
    return `With temperatures around ${Math.round(temperature)}°C, prioritize natural hydration: stay refreshed with cucumber, curd, buttermilk, or tender coconut water.`;
  }
  if (category === 'warm') {
    return `Warm day ahead (${Math.round(temperature)}°C). Light, fiber-rich meals with hydrating ingredients keep your energy balanced through the afternoon.`;
  }
  if (category === 'cold' || category === 'cool') {
    return `Cooler climate (${Math.round(temperature)}°C). Warm, nourishing meals with ginger, turmeric, and warm broths provide steady vitality.`;
  }
  return 'Stay balanced today with mindful portion sizes, fresh seasonal produce, and adequate hydration throughout your day.';
}

/**
 * Resolve coordinates for a given user based on their consented profile location
 */
function resolveUserCoordinates(user = {}) {
  if (!user) return null;

  const prefs = user.preferences || {};
  const loc = user.location || prefs.location || {};

  // 1. Direct numeric coordinates
  const lat = loc.latitude ?? user.latitude ?? prefs.latitude;
  const lon = loc.longitude ?? user.longitude ?? prefs.longitude;

  if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
    return {
      latitude: lat,
      longitude: lon,
      label: loc.city || loc.label || user.city || 'Your Location'
    };
  }

  // 2. City name resolution
  const city = (loc.city || user.city || prefs.city || user.locationString || '').trim().toLowerCase();
  if (city && KNOWN_COORDINATES[city]) {
    return KNOWN_COORDINATES[city];
  }

  // No verified coordinates available
  return null;
}

/**
 * Retrieve current weather for a user.
 * Returns null if location is unavailable or if weather service fails.
 * Never throws and never invents weather observations.
 *
 * @param {Object} user - User record with optional location / preferences
 * @param {Object} [options] - Options (e.g. timeoutMs, forceRefresh)
 * @returns {Promise<Object|null>} Weather context or null
 */
async function getWeatherForUser(user, options = {}) {
  const coords = resolveUserCoordinates(user);
  if (!coords) {
    return null; // Omit cleanly when location is not available
  }

  const cacheKey = `weather_${coords.latitude.toFixed(2)}_${coords.longitude.toFixed(2)}`;
  if (!options.forceRefresh) {
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const timeoutMs = options.timeoutMs || 3500;

    let response;
    if (typeof fetch === 'function') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } else {
      const nodeFetch = require('node-fetch');
      response = await nodeFetch(url, { timeout: timeoutMs });
    }

    if (!response || !response.ok) {
      return null;
    }

    const data = await response.json();
    const current = data.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      return null;
    }

    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const weatherCode = current.weather_code ?? 0;

    const { condition, conditionCategory } = mapWmoCodeToCondition(weatherCode);
    const tempCategory = normalizeTemperatureCategory(temp) || 'mild';
    const { isRainy, isHumid, isDry } = normalizeWeatherCondition(condition, humidity);

    const weatherContext = {
      temperature: Math.round(temp * 10) / 10,
      condition,
      conditionCategory,
      category: tempCategory, // 'hot'|'warm'|'mild'|'cool'|'cold'
      humidity: humidity !== undefined ? Math.round(humidity) : null,
      isRainy,
      isHumid,
      isDry,
      locationName: coords.label || 'Your Area',
      hydrationTip: getWeatherFoodTip(tempCategory, isRainy, temp),
      source: 'open-meteo'
    };

    setCachedWeather(cacheKey, weatherContext, 20 * 60 * 1000); // 20-min TTL
    return weatherContext;

  } catch (err) {
    // Graceful fallback: Never break recommendation pipeline on weather API error
    return null;
  }
}

module.exports = {
  KNOWN_COORDINATES,
  resolveUserCoordinates,
  mapWmoCodeToCondition,
  getWeatherFoodTip,
  getWeatherForUser
};
