/**
 * Test Execution Listener
 * Monitors lifecycle hooks and aggregates test results for multi-format report builders.
 */
const logger = require('../utils/logger');
const screenshotUtil = require('../utils/screenshotUtil');

class TestListener {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  onTestStart(testCase) {
    logger.debug(`[START] [${testCase.id}] ${testCase.testName}`);
  }

  async onTestSuccess(testCase, durationMs, driver = null) {
    const filename = await screenshotUtil.capture(driver, testCase.id, 'pass');
    this.results.push({
      ...testCase,
      status: 'PASS',
      passFail: 'PASS',
      duration: durationMs,
      timestamp: new Date().toISOString(),
      screenshot: filename,
      failureReason: 'N/A',
      stackTrace: 'N/A'
    });
    logger.info(`[PASS] [${testCase.id}] ${testCase.testName} (${durationMs}ms)`);
  }

  async onTestFailure(testCase, durationMs, error, driver = null) {
    const filename = await screenshotUtil.capture(driver, testCase.id, 'fail');
    const reason = error?.message || 'Assertion Error or Timeout';
    const stack = error?.stack || 'No stack trace available';

    this.results.push({
      ...testCase,
      status: 'FAIL',
      passFail: 'FAIL',
      duration: durationMs,
      timestamp: new Date().toISOString(),
      screenshot: filename,
      failureReason: reason,
      stackTrace: stack
    });
    logger.error(`[FAIL] [${testCase.id}] ${testCase.testName} - Reason: ${reason}`);
  }

  onTestSkipped(testCase, reason = 'Feature flag disabled / Precondition unmet') {
    this.results.push({
      ...testCase,
      status: 'SKIPPED',
      passFail: 'SKIPPED',
      duration: 0,
      timestamp: new Date().toISOString(),
      screenshot: 'N/A',
      failureReason: reason,
      stackTrace: 'N/A'
    });
    logger.warn(`[SKIP] [${testCase.id}] ${testCase.testName} - Reason: ${reason}`);
  }

  onTestBlocked(testCase, reason = 'Upstream dependency or infrastructure blocked') {
    this.results.push({
      ...testCase,
      status: 'BLOCKED',
      passFail: 'BLOCKED',
      duration: 0,
      timestamp: new Date().toISOString(),
      screenshot: 'N/A',
      failureReason: reason,
      stackTrace: 'N/A'
    });
    logger.warn(`[BLOCKED] [${testCase.id}] ${testCase.testName} - Reason: ${reason}`);
  }

  getMetrics() {
    this.endTime = Date.now();
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;
    const blocked = this.results.filter(r => r.status === 'BLOCKED').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';
    const failRate = total > 0 ? ((failed / total) * 100).toFixed(2) : '0.00';
    const durationSeconds = ((this.endTime - this.startTime) / 1000).toFixed(2);

    return {
      total,
      executed: passed + failed,
      passed,
      failed,
      skipped,
      blocked,
      passRate,
      failRate,
      durationSeconds,
      durationMs: this.endTime - this.startTime,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(this.endTime).toISOString()
    };
  }
}

module.exports = TestListener;
