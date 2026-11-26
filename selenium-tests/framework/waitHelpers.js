'use strict';
const { until, By } = require('selenium-webdriver');

class WaitHelpers {
  static async waitForElement(driver, locator, timeoutMs = 10000) {
    const el = await driver.wait(until.elementLocated(locator), timeoutMs);
    await driver.wait(until.elementIsVisible(el), timeoutMs);
    return el;
  }

  static async waitForUrlContains(driver, substr, timeoutMs = 10000) {
    return await driver.wait(until.urlContains(substr), timeoutMs);
  }

  static async waitForTitleContains(driver, substr, timeoutMs = 10000) {
    return await driver.wait(until.titleContains(substr), timeoutMs);
  }
}

module.exports = WaitHelpers;
