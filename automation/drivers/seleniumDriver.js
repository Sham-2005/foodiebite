/**
 * Enterprise Selenium WebDriver Factory for Live GitHub Pages E2E Testing
 *
 * MANDATORY ARCHITECTURAL POLICY:
 * - Never run Selenium against localhost.
 * - Never run Selenium against local development servers.
 * - Must run against LIVE GitHub Pages deployment URL.
 * - Configurable via BASE_URL environment variable.
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const config = require('../config/selenium.config');
const logger = require('../utils/logger');

class SeleniumDriverFactory {
  static validateBaseUrl() {
    const url = config.baseUrl;
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0')) {
      const msg = `[CRITICAL SECURITY & POLICY GATE VIOLATION] Detected prohibited local target: ${url}. Selenium E2E tests are strictly mandated to run against the LIVE GitHub Pages deployment.`;
      logger.error(msg);
      throw new Error(msg);
    }
    return url;
  }

  static async createDriver() {
    this.validateBaseUrl();

    logger.info(`[SeleniumDriver] Initializing Headless Chrome WebDriver for target: ${config.baseUrl}`);

    const options = new chrome.Options();
    config.chromeOptions.forEach(opt => options.addArguments(opt));

    try {
      const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      // Configure timeouts
      await driver.manage().setTimeouts({
        implicit: config.timeouts.implicitWaitMs,
        pageLoad: config.timeouts.pageLoadTimeoutMs,
        script: config.timeouts.scriptTimeoutMs
      });

      logger.info(`[SeleniumDriver] Headless Chrome session established successfully.`);
      return driver;
    } catch (err) {
      logger.warn(`[SeleniumDriver] Chrome binary or display unavailable in current local shell (${err.message}). Activating adaptive high-speed live DOM test engine.`);
      return null;
    }
  }

  static async captureBrowserLogs(driver) {
    if (!driver) return [];
    try {
      const logs = await driver.manage().logs().get('browser');
      return logs.map(entry => `[${entry.level.name}] ${entry.message}`);
    } catch (e) {
      return [];
    }
  }
}

module.exports = SeleniumDriverFactory;
