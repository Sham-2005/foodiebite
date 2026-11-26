'use strict';
const Logger = require('./logger');
const ScreenshotManager = require('./screenshotManager');

class BaseTest {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.driver = null;
  }

  async setup() {
    Logger.info(`=== SETUP MOBILE SUITE: ${this.suiteName} ===`);
  }

  async teardown(failed = false, testId = null) {
    Logger.info(`=== TEARDOWN MOBILE SUITE: ${this.suiteName} ===`);
    if (this.driver && failed && testId) {
      await ScreenshotManager.capture(this.driver, testId, 'failed');
    }
  }
}

module.exports = BaseTest;
