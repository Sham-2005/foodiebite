'use strict';
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

const screenshotsDir = path.resolve(__dirname, '../screenshots');

class ScreenshotManager {
  static async capture(driver, testId, category = 'debugging') {
    try {
      const targetDir = path.join(screenshotsDir, category);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      if (!driver) return null;
      const filename = `${testId || 'appium'}_${Date.now()}.png`;
      const fullPath = path.join(targetDir, filename);
      const b64 = await driver.takeScreenshot();
      fs.writeFileSync(fullPath, b64, 'base64');
      Logger.info(`Mobile screenshot saved: ${fullPath}`);
      return fullPath;
    } catch (err) {
      Logger.warn(`Failed to capture mobile screenshot: ${err.message}`);
      return null;
    }
  }
}

module.exports = ScreenshotManager;
