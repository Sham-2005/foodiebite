/**
 * tests/shared/configuration/environment.js
 * Central environment configuration for FoodieBite Testing Framework
 */
const path = require('path');
// Resilient dotenv resolution
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e1) {
  try {
    dotenv = require(path.resolve(__dirname, '../../../backend/node_modules/dotenv'));
  } catch (e2) {
    dotenv = { config: () => {} };
  }
}

// Load root and backend .env files if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

module.exports = {
  env: process.env.NODE_ENV || 'test',
  web: {
    baseUrl: process.env.BASE_URL || process.env.CLIENT_URL || 'http://localhost:3000',
    headless: process.env.HEADLESS !== 'false',
    timeout: parseInt(process.env.WEB_TIMEOUT_MS, 10) || 15000,
    browser: process.env.BROWSER || 'chrome'
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:5000',
    timeout: parseInt(process.env.API_TIMEOUT_MS, 10) || 10000
  },
  mobile: {
    appiumHost: process.env.APPIUM_HOST || '127.0.0.1',
    appiumPort: parseInt(process.env.APPIUM_PORT, 10) || 4723,
    appPackage: process.env.ANDROID_APP_PACKAGE || 'com.foodiebite.app',
    appActivity: process.env.ANDROID_APP_ACTIVITY || '.MainActivity',
    apkPath: process.env.ANDROID_APK_PATH || path.resolve(__dirname, '../../../frontend/android/app/build/outputs/apk/release/app-release-unsigned.apk'),
    deviceName: process.env.ANDROID_DEVICE_NAME || 'Android Emulator',
    platformVersion: process.env.ANDROID_PLATFORM_VERSION || '13.0',
    commandTimeout: 60000
  },
  credentials: {
    testUser: {
      email: process.env.TEST_USERNAME || 'testuser@foodiebite.dev',
      password: process.env.TEST_PASSWORD || 'FoodieBite#2026Test'
    },
    adminUser: {
      email: process.env.ADMIN_TEST_USERNAME || 'admin@foodiebite.dev',
      password: process.env.ADMIN_TEST_PASSWORD || 'Admin#2026Secure!',
      adminKey: process.env.ADMIN_KEY || 'foodiebite_admin_secret_key_2026'
    }
  },
  performance: {
    concurrency: parseInt(process.env.LOAD_CONCURRENCY, 10) || 100,
    durationSec: parseInt(process.env.LOAD_DURATION_SEC, 10) || 60,
    maxErrorRatePercent: 1.0,
    maxAvgLatencyMs: 500,
    maxP95LatencyMs: 1000
  }
};
