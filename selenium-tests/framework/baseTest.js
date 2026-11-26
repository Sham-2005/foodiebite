'use strict';
const DriverFactory = require('../drivers/driverFactory');
const ScreenshotManager = require('./screenshotManager');
const Logger = require('./logger');

class BaseTest {
  constructor(name) {
    this.name = name;
    this.driver = null;
  }

  async setup(options = {}) {
    Logger.info(`--- SETUP: ${this.name} ---`);
    this.driver = await DriverFactory.createDriver(options);
    return this.driver;
  }

  async teardown(isFailed = false, testId = null) {
    Logger.info(`--- TEARDOWN: ${this.name} ---`);
    if (this.driver) {
      if (isFailed && testId) {
        await ScreenshotManager.capture(this.driver, testId, 'failed');
      }
      try {
        await this.driver.quit();
      } catch (_) {}
      this.driver = null;
    }
  }
}

module.exports = BaseTest;
