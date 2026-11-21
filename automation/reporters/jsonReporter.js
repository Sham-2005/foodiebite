/**
 * JSON Report Generator
 * Exports machine-readable execution telemetry for CI/CD metrics collection.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/appium.config');
const logger = require('../utils/logger');

class JsonReporter {
  constructor() {
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(config.paths.jsonDir)) {
      fs.mkdirSync(config.paths.jsonDir, { recursive: true });
    }
  }

  generate(results, metrics) {
    this.ensureDirs();
    const payload = {
      meta: {
        appName: config.buildMetadata.appName,
        appVersion: config.buildMetadata.appVersion,
        buildNumber: config.buildMetadata.buildNumber,
        gitCommit: config.buildMetadata.gitCommit,
        branch: config.buildMetadata.branch,
        device: config.buildMetadata.deviceModel,
        androidVersion: config.buildMetadata.androidApiVersion,
        generatedAt: new Date().toISOString()
      },
      metrics: metrics,
      testCases: results
    };

    const outPath = path.join(config.paths.jsonDir, 'execution-results.json');
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    logger.info(`[JsonReporter] Saved execution results JSON to ${outPath}`);
    return outPath;
  }
}

module.exports = new JsonReporter();
