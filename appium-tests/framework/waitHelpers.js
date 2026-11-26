'use strict';
class WaitHelpers {
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async waitForCondition(fn, timeoutMs = 10000, intervalMs = 500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return true;
      await WaitHelpers.sleep(intervalMs);
    }
    return false;
  }
}

module.exports = WaitHelpers;
