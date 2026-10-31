/**
 * ─────────────────────────────────────────────────────────────
 *  appium-tests/wdio.conf.js
 *  WebdriverIO + Appium Test Runner Configuration
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const path = require('path');
const { androidCapabilities, mobileWebCapabilities } = require('./config/capabilities');

exports.config = {
  // Runner Configuration
  runner: 'local',
  port: 4723,
  path: '/',

  // Specs
  specs: [
    './specs/**/*.e2e.js'
  ],
  exclude: [],

  // Capabilities
  maxInstances: 1,
  capabilities: [
    process.env.TEST_PLATFORM === 'web' ? mobileWebCapabilities : androidCapabilities
  ],

  // Test Configurations
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:3000',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Services
  services: [
    ['appium', {
      args: {
        relaxedSecurity: true,
        address: '127.0.0.1',
        port: 4723
      },
      logPath: './reports/appium.log'
    }]
  ],

  // Framework
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 90000
  },

  // Hooks
  beforeSession: function () {
    console.log('🚀 Initializing FoodieBite Appium E2E Automation Session...');
  },

  before: async function () {
    const chai = require('chai');
    global.expect = chai.expect;
    global.assert = chai.assert;
  },

  afterTest: async function (test, context, { error, result, duration, passed }) {
    if (!passed) {
      const screenshotDir = path.resolve(__dirname, 'reports/screenshots');
      const fs = require('fs');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filename = `${test.title.replace(/\s+/g, '_')}_${Date.now()}.png`;
      try {
        await browser.saveScreenshot(path.join(screenshotDir, filename));
        console.log(`📸 Failure screenshot captured: ${filename}`);
      } catch (err) {
        console.error('Failed to capture failure screenshot:', err.message);
      }
    }
  },

  afterSuite: function (suite) {
    console.log(`✅ Suite completed: ${suite.title} (${suite.duration}ms)`);
  },

  onComplete: function () {
    console.log('\n📊 Generating Consolidated FoodieBite Appium Test Excel Report...');
    try {
      require('./scripts/generateAppiumExcelReport').generateReport();
    } catch (e) {
      console.log('Note: Report generation trigger completed.');
    }
  }
};
