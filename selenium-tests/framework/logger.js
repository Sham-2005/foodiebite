'use strict';
const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'execution.log');

class Logger {
  static formatMessage(level, msg) {
    const ts = new Date().toISOString();
    return `[${ts}] [${level.toUpperCase()}] ${msg}`;
  }

  static info(msg) {
    const formatted = Logger.formatMessage('info', msg);
    console.log(formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  }

  static warn(msg) {
    const formatted = Logger.formatMessage('warn', msg);
    console.warn(formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  }

  static error(msg, err) {
    const formatted = Logger.formatMessage('error', msg + (err ? ' | ' + err.stack || err.message : ''));
    console.error(formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  }
}

module.exports = Logger;
