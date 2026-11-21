/**
 * Screenshot Capture Utility
 * Captures mobile viewports, failure screens, and saves to Test Results/Screenshots/
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/appium.config');
const logger = require('./logger');

class ScreenshotUtil {
  constructor() {
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(config.paths.screenshotsDir)) {
      fs.mkdirSync(config.paths.screenshotsDir, { recursive: true });
    }
  }

  async capture(driver, testId, label = 'execution') {
    this.ensureDirs();
    const cleanId = String(testId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanId}_${label}_${Date.now()}.png`;
    const filepath = path.join(config.paths.screenshotsDir, filename);

    try {
      if (driver && typeof driver.takeScreenshot === 'function') {
        const data = await driver.takeScreenshot();
        fs.writeFileSync(filepath, data, 'base64');
        logger.debug(`[Screenshot] Saved capture for ${testId} at ${filepath}`);
        return filename;
      }
    } catch (err) {
      logger.warn(`[Screenshot] Could not capture live driver: ${err.message}`);
    }

    // Generate reliable placeholder PNG image buffer if driver detached
    try {
      const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      fs.writeFileSync(filepath, Buffer.from(minimalPngBase64, 'base64'));
      return filename;
    } catch (e) {
      return `${cleanId}.png`;
    }
  }
}

module.exports = new ScreenshotUtil();
