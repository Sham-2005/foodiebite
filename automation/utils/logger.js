/**
 * Enterprise Mobile Test Logger
 * Outputs formatted logs to console and persists to Test Results/Logs/
 */
const fs = require('fs');
const path = require('path');
const config = require('../config/appium.config');

class Logger {
  constructor() {
    this.logFile = path.join(config.paths.logsDir, 'appium-execution.log');
    this.deviceLogFile = path.join(config.paths.logsDir, 'android-logcat.log');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(config.paths.logsDir)) {
      fs.mkdirSync(config.paths.logsDir, { recursive: true });
    }
  }

  format(level, msg) {
    const ts = new Date().toISOString();
    return `[${ts}] [${level.toUpperCase()}] ${msg}`;
  }

  write(level, msg) {
    const formatted = this.format(level, msg);
    console.log(formatted);
    try {
      fs.appendFileSync(this.logFile, formatted + '\n');
    } catch (e) {}
  }

  info(msg) { this.write('info', msg); }
  warn(msg) { this.write('warn', msg); }
  error(msg) { this.write('error', msg); }
  debug(msg) { this.write('debug', msg); }
  step(testId, stepDesc) { this.write('step', `[${testId}] ${stepDesc}`); }

  logDeviceEvent(tag, message) {
    const line = `[${new Date().toISOString()}] [LOGCAT:${tag}] ${message}\n`;
    try {
      fs.appendFileSync(this.deviceLogFile, line);
    } catch (e) {}
  }
}

module.exports = new Logger();
