'use strict';
require('dotenv').config();

module.exports = {
  baseUrl: process.env.SELENIUM_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.SELENIUM_API_URL || 'http://localhost:5000',
  browser: process.env.SELENIUM_BROWSER || 'chrome',
  isHeadless: process.env.SELENIUM_HEADLESS !== 'false',
  implicitWaitMs: 5000,
  pageLoadTimeoutMs: 30000,
  explicitWaitTimeoutMs: 10000,
  viewport: { width: 1920, height: 1080 }
};
