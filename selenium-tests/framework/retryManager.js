'use strict';
const Logger = require('./logger');

class RetryManager {
  static async executeWithRetry(fn, maxAttempts = 2, delayMs = 1000, context = 'Test') {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastErr = err;
        Logger.warn(`[${context}] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastErr;
  }
}

module.exports = RetryManager;
