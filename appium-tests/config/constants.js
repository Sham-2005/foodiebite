/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/config/constants.js
 *  FoodieBite Appium Test Constants & Environment Configurations
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

module.exports = {
  APP_PACKAGE: 'com.foodiebite.app',
  APP_ACTIVITY: 'com.foodiebite.app.MainActivity',
  DEFAULT_TIMEOUT: 15000,
  LONG_TIMEOUT: 30000,
  POLL_INTERVAL: 500,
  PLATFORM: {
    ANDROID: 'Android',
    IOS: 'iOS',
    WEB: 'Web'
  },
  DEFAULT_PORT: 4723,
  DEFAULT_HOST: '127.0.0.1',
  SEVERITY: {
    CRITICAL: 'P1 - Critical',
    HIGH: 'P2 - High',
    MEDIUM: 'P3 - Medium',
    LOW: 'P4 - Low'
  },
  STATUS: {
    PASS: 'PASS',
    FAIL: 'FAIL',
    BLOCKED: 'BLOCKED',
    SKIPPED: 'SKIPPED'
  }
};
