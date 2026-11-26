'use strict';
const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'appium-execution.log');

class Logger {
  static log(level, msg) {
    const ts = new Date().toISOString();
    const entry = `[${ts}] [${level.toUpperCase()}] ${msg}`;
    console.log(entry);
    fs.appendFileSync(logFile, entry + '\n');
  }

  static info(msg) { Logger.log('info', msg); }
  static warn(msg) { Logger.log('warn', msg); }
  static error(msg, err) { Logger.log('error', msg + (err ? ' | ' + (err.stack || err.message) : '')); }
}

module.exports = Logger;
