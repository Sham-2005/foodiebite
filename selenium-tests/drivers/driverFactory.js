/**
 * WebDriver Factory for Selenium Testing
 * Automatically configures Chrome / Chromium with optimal flags for React-Native-Web SPA testing
 */
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const config = require('../config/selenium.config');
const fs = require('fs');
const path = require('path');

class DriverFactory {
  static async createDriver(options = {}) {
    const isHeadless = options.headless !== undefined ? options.headless : config.headless;
    const viewport = options.viewport || config.windowSize.desktop;

    const chromeOptions = new chrome.Options();
    
    // Modern headless flag
    if (isHeadless) {
      chromeOptions.addArguments('--headless=new');
    }

    chromeOptions.addArguments(
      `--window-size=${viewport.width},${viewport.height}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-extensions',
      '--ignore-certificate-errors',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FoodieBite-E2E-Automator'
    );

    // Suppress console logs in browser driver
    chromeOptions.excludeSwitches('enable-logging');

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    await driver.manage().setTimeouts({
      implicit: config.implicitWait,
      pageLoad: config.pageLoadTimeout,
      script: config.defaultTimeout
    });

    return driver;
  }

  static async takeScreenshot(driver, testName) {
    try {
      if (!fs.existsSync(config.screenshotsDir)) {
        fs.mkdirSync(config.screenshotsDir, { recursive: true });
      }
      const sanitizedName = testName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${sanitizedName}_${Date.now()}.png`;
      const filepath = path.join(config.screenshotsDir, filename);
      
      const screenshotData = await driver.takeScreenshot();
      fs.writeFileSync(filepath, screenshotData, 'base64');
      return filepath;
    } catch (err) {
      console.warn('[DriverFactory] Could not take screenshot:', err.message);
      return null;
    }
  }
}

module.exports = DriverFactory;
