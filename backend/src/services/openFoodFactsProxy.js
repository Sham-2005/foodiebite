// ─────────────────────────────────────────────────────────────
//  src/services/openFoodFactsProxy.js
//  Open Food Facts API Proxy with Retries, Timeouts, and Health Logs
// ─────────────────────────────────────────────────────────────

const fetch = require('node-fetch');
const admin = require('firebase-admin');
const dns = require('dns');

// ── Connection helper to check if internet is available ──
async function isInternetConnected() {
  return new Promise((resolve) => {
    // Attempt resolving world.openfoodfacts.org with a 1000ms timeout
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, 1000);

    dns.lookup('world.openfoodfacts.org', (err) => {
      clearTimeout(timeoutId);
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// ── Lazy Firestore getter — never crashes on module load ──────
function getDb() {
  try {
    return admin.firestore();
  } catch (err) {
    console.warn('⚠️ openFoodFactsProxy: Firestore unavailable:', err.message);
    return null;
  }
}

const OFF_BASE = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 5000;

// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Log API Health metrics to Firestore apiHealth collection.
 * Silently skipped (with a warning) when Firestore is unavailable.
 */
async function logApiHealth(endpoint, sourceUsed, success, responseTime) {
  const db = getDb();
  if (!db) {
    console.warn('⚠️ API health logging skipped — Firestore unavailable');
    return;
  }
  try {
    await db.collection('apiHealth').add({
      endpoint,
      sourceUsed,
      success,
      responseTime,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('⚠️ API health logging failed (non-critical):', err.message);
  }
}

/**
 * Generic fetch client with 5-second timeout and 3-attempt retry logic
 */
async function fetchWithRetry(url, options = {}) {
  const online = await isInternetConnected();
  if (!online) {
    throw new Error('Device/Server has no internet connection (Offline)');
  }

  let attempt = 1;
  const maxAttempts = 3;
  const delays = [500, 1000]; // Delay before attempt 2, attempt 3

  while (attempt <= maxAttempts) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        // Success
        await logApiHealth(url, 'off', true, responseTime);
        return await response.json();
      } else {
        throw new Error(`OFF responded with status ${response.status}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout ? 'Request timed out after 5s' : err.message;
      
      console.warn(`[Proxy Attempt ${attempt}/${maxAttempts} Fail] URL: ${url}. Error: ${errorMessage}`);
      
      // Log failure event for this specific attempt
      await logApiHealth(url, 'off', false, responseTime);

      if (attempt < maxAttempts) {
        const delay = delays[attempt - 1] || 1000;
        await sleep(delay);
        attempt++;
      } else {
        // All attempts exhausted
        throw new Error(`Failed to query OFF after ${maxAttempts} attempts. Last error: ${errorMessage}`);
      }
    }
  }
}

/**
 * Search foods proxy call
 */
async function searchFoodsProxy(term, pageSize = 20) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=${pageSize}&fields=id,product_name,image_url,nutriments,labels_tags,allergens_tags,nutrition_grades,categories_tags,quantity`;
  try {
    const data = await fetchWithRetry(url);
    return data.products || [];
  } catch (err) {
    console.error(`Proxy Search Exception for term "${term}":`, err.message);
    return null; // Return null so caller identifies a failure instead of an empty search result
  }
}

/**
 * Barcode lookup proxy call
 */
async function getProductByBarcodeProxy(barcode) {
  const url = `${OFF_BASE}/api/v0/product/${barcode}.json`;
  try {
    const data = await fetchWithRetry(url);
    return data.product || null;
  } catch (err) {
    console.error(`Proxy Barcode Lookup Exception for barcode "${barcode}":`, err.message);
    return null;
  }
}

module.exports = {
  searchFoodsProxy,
  getProductByBarcodeProxy,
  logApiHealth,
  isInternetConnected
};
