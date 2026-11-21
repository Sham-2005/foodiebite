/**
 * BasePage - Common Page Object Base Class for FoodieBite Selenium Tests
 */
const { By, until } = require('selenium-webdriver');
const config = require('../config/selenium.config');
const DriverFactory = require('../drivers/driverFactory');

class BasePage {
  constructor(driver) {
    this.driver = driver;
    this.timeout = config.defaultTimeout;
  }

  async navigateTo(path = '') {
    const fullUrl = `${config.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    await this.driver.get(fullUrl);
    await this.waitForPageReady();
  }

  async waitForPageReady() {
    await this.driver.wait(async () => {
      const readyState = await this.driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, this.timeout);
  }

  async waitForElement(locator, timeout = this.timeout) {
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async waitForVisible(locator, timeout = this.timeout) {
    const el = await this.waitForElement(locator, timeout);
    return await this.driver.wait(until.elementIsVisible(el), timeout);
  }

  async safeClick(locator, timeout = this.timeout) {
    try {
      const element = await this.waitForVisible(locator, timeout);
      await this.driver.wait(until.elementIsEnabled(element), timeout);
      await element.click();
    } catch (err) {
      // Fallback to JS click if element overlay or synthetic React Native touch interception occurs
      try {
        const el = await this.driver.findElement(locator);
        await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"}); arguments[0].click();', el);
      } catch (innerErr) {
        throw new Error(`Failed to click element ${locator}: ${err.message}`);
      }
    }
  }

  async safeType(locator, text, clear = true, timeout = this.timeout) {
    const element = await this.waitForVisible(locator, timeout);
    if (clear) {
      await element.clear();
    }
    await element.sendKeys(text);
  }

  async getElementText(locator, timeout = this.timeout) {
    const element = await this.waitForVisible(locator, timeout);
    return await element.getText();
  }

  async isElementPresent(locator, timeout = 3000) {
    try {
      await this.driver.wait(until.elementLocated(locator), timeout);
      return true;
    } catch (e) {
      return false;
    }
  }

  async isTextPresent(text, timeout = 5000) {
    try {
      const xpath = By.xpath(`//*[contains(text(), '${text}')]`);
      await this.driver.wait(until.elementLocated(xpath), timeout);
      return true;
    } catch (e) {
      return false;
    }
  }

  async captureScreenshot(testName) {
    return await DriverFactory.takeScreenshot(this.driver, testName);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BasePage;
