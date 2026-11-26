'use strict';
const Logger = require('./logger');

class BaseScreen {
  constructor(driver, screenName = 'BaseScreen') {
    this.driver = driver;
    this.screenName = screenName;
  }

  async findElement(selector, timeout = 10000) {
    Logger.info(`[${this.screenName}] Finding element: ${selector}`);
    if (this.driver && this.driver.$) {
      const el = await this.driver.$(selector);
      await el.waitForDisplayed({ timeout });
      return el;
    }
    return null;
  }

  async tap(selector, timeout = 10000) {
    const el = await this.findElement(selector, timeout);
    if (el) await el.click();
  }

  async enterText(selector, text, timeout = 10000) {
    const el = await this.findElement(selector, timeout);
    if (el) {
      await el.setValue(text);
    }
  }

  async isVisible(selector, timeout = 3000) {
    try {
      const el = await this.findElement(selector, timeout);
      return el ? await el.isDisplayed() : false;
    } catch (_) {
      return false;
    }
  }
}

module.exports = BaseScreen;
