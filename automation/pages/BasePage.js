/**
 * BasePage - Core Mobile Page Object
 * Encapsulates UiAutomator2 locators, gesture actions, back button keys, and resilient execution.
 */
const config = require('../config/appium.config');
const logger = require('../utils/logger');

class BasePage {
  constructor(driver) {
    this.driver = driver;
    this.timeout = config.execution.explicitTimeoutMs;
  }

  async tap(selector, desc = '') {
    logger.debug(`[Action] Tap: ${desc || selector}`);
    if (this.driver && typeof this.driver.$ === 'function') {
      const el = await this.driver.$(selector);
      await el.waitForDisplayed({ timeout: this.timeout });
      await el.click();
    }
    await this.sleep(100);
    return true;
  }

  async type(selector, text, desc = '') {
    logger.debug(`[Action] Type "${text}" into: ${desc || selector}`);
    if (this.driver && typeof this.driver.$ === 'function') {
      const el = await this.driver.$(selector);
      await el.waitForDisplayed({ timeout: this.timeout });
      await el.setValue(text);
      try { await this.driver.hideKeyboard(); } catch (e) {}
    }
    await this.sleep(100);
    return true;
  }

  async getText(selector) {
    if (this.driver && typeof this.driver.$ === 'function') {
      const el = await this.driver.$(selector);
      return await el.getText();
    }
    return '';
  }

  async isDisplayed(selector) {
    if (this.driver && typeof this.driver.$ === 'function') {
      try {
        const el = await this.driver.$(selector);
        return await el.isDisplayed();
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async pressBack() {
    logger.debug('[Action] Send Android KEYCODE_BACK (Keycode 4)');
    if (this.driver && typeof this.driver.pressKeyCode === 'function') {
      await this.driver.pressKeyCode(4);
    }
    await this.sleep(200);
  }

  async swipeUp() {
    logger.debug('[Action] Gesture: Swipe Up');
    if (this.driver && typeof this.driver.touchAction === 'function') {
      await this.driver.touchAction([
        { action: 'press', x: 200, y: 800 },
        { action: 'wait', ms: 400 },
        { action: 'moveTo', x: 200, y: 250 },
        'release'
      ]);
    }
    await this.sleep(300);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BasePage;
