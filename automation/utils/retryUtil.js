/**
 * Automated Test Retry Mechanism
 * Retries flaky mobile operations with exponential backoff before recording failure.
 */
const logger = require('./logger');

class RetryUtil {
  static async executeWithRetry(actionFn, testId, maxRetries = 2, delayMs = 1000) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await actionFn(attempt);
        if (attempt > 1) {
          logger.info(`[Retry Engine] Test ${testId} recovered and passed on attempt ${attempt}`);
        }
        return { success: true, attempts: attempt, result };
      } catch (err) {
        lastError = err;
        if (attempt <= maxRetries) {
          logger.warn(`[Retry Engine] Test ${testId} attempt ${attempt} encountered error: ${err.message}. Retrying in ${delayMs}ms...`);
          await new Promise(res => setTimeout(res, delayMs));
          delayMs *= 1.5; // Exponential backoff
        }
      }
    }
    return { success: false, attempts: maxRetries + 1, error: lastError };
  }
}

module.exports = RetryUtil;
