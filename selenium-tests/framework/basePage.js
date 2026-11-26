'use strict';
const { By, until } = require('selenium-webdriver');
const WaitHelpers = require('./waitHelpers');
const Logger = require('./logger');

class BasePage {
  constructor(driver, urlPath = '/') {
    this.driver = driver;
    this.urlPath = urlPath;
  }

  async navigate(baseUrl = 'http://localhost:3000') {
    const fullUrl = new URL(this.urlPath, baseUrl).toString();
    Logger.info(`Navigating to: ${fullUrl}`);
    await this.driver.get(fullUrl);
  }

  async find(locator, timeout = 10000) {
    return await WaitHelpers.waitForElement(this.driver, locator, timeout);
  }

  async click(locator, timeout = 10000) {
    const el = await this.find(locator, timeout);
    await el.click();
  }

  async type(locator, text, timeout = 10000) {
    const el = await this.find(locator, timeout);
    await el.clear();
    await el.sendKeys(text);
  }

  async getText(locator, timeout = 10000) {
    const el = await this.find(locator, timeout);
    return await el.getText();
  }

  async isDisplayed(locator, timeout = 3000) {
    try {
      const el = await this.find(locator, timeout);
      return await el.isDisplayed();
    } catch (_) {
      return false;
    }
  }

  async getCurrentUrl() {
    return await this.driver.getCurrentUrl();
  }

  async getTitle() {
    return await this.driver.getTitle();
  }
}

module.exports = BasePage;
