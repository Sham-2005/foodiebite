'use strict';
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

const screenshotsDir = path.resolve(__dirname, '../screenshots');

class ScreenshotManager {
  static init() {
    ['passed', 'failed', 'debugging'].forEach(sub => {
      const p = path.join(screenshotsDir, sub);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });
  }

  static async capture(driver, testId, category = 'debugging') {
    try {
      ScreenshotManager.init();
      if (!driver) return null;
      const sanitizedId = (testId || 'screenshot').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${sanitizedId}_${Date.now()}.png`;
      const targetPath = path.join(screenshotsDir, category, filename);
      const data = await driver.takeScreenshot();
      fs.writeFileSync(targetPath, data, 'base64');
      Logger.info(`Screenshot saved: ${targetPath}`);
      return targetPath;
    } catch (err) {
      Logger.warn(`Failed to capture screenshot: ${err.message}`);
      return null;
    }
  }
}

module.exports = ScreenshotManager;
