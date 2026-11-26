'use strict';
const Logger = require('./logger');

class RetryManager {
  static async retry(fn, maxAttempts = 2, delayMs = 1500, label = 'Mobile Action') {
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        return await fn(i);
      } catch (err) {
        Logger.warn(`[${label}] Attempt ${i} failed: ${err.message}`);
        if (i === maxAttempts) throw err;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

module.exports = RetryManager;
