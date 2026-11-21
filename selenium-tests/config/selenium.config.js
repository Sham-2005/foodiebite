/**
 * FoodieBite Selenium Automation Configuration
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  baseUrl: process.env.SELENIUM_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.SELENIUM_API_URL || 'http://localhost:5000',
  defaultTimeout: 15000,
  pageLoadTimeout: 30000,
  implicitWait: 3000,
  browser: process.env.SELENIUM_BROWSER || 'chrome',
  headless: process.env.HEADLESS !== 'false', // default to headless unless specified
  windowSize: {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 }
  },
  reportsDir: path.resolve(__dirname, '../reports'),
  screenshotsDir: path.resolve(__dirname, '../reports/screenshots'),
  testUser: {
    email: 'qa_selenium_tester@foodiebite.com',
    password: 'Password123!',
    name: 'Selenium QA Bot',
    age: '26',
    gender: 'Other',
    dietary: 'Vegetarian'
  },
  adminUser: {
    email: 'sham111205s@gmail.com',
    password: 'AdminPassword123!'
  }
};
