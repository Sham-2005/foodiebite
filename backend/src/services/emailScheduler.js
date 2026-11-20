// ─────────────────────────────────────────────────────────────
//  backend/src/services/emailScheduler.js
//  FoodieBite Daily Recommendation Cron Scheduler
//  Evaluates local user timezones every hour at minute 0
//  Dispatches daily meal recommendations for users in their 9:00 AM window
// ─────────────────────────────────────────────────────────────

'use strict';

const cron = require('node-cron');
const { processDailyEmailQueue } = require('./emailAutomationService');

let scheduledTask = null;
let isStarted = false;

/**
 * Start the hourly scheduler
 * Runs at minute 0 of every hour: '0 * * * *'
 */
function start() {
  if (isStarted) {
    console.log('ℹ️ [EmailScheduler] Scheduler is already active.');
    return;
  }

  // Schedule to run at the start of every hour
  scheduledTask = cron.schedule('0 * * * *', async () => {
    console.log(`⏰ [EmailScheduler] Hourly trigger fired at ${new Date().toISOString()}`);
    try {
      await processDailyEmailQueue(false);
    } catch (err) {
      console.error('❌ [EmailScheduler] Scheduled batch execution failed:', err.message);
    }
  });

  isStarted = true;
  console.log('✅ [EmailScheduler] FoodieBite 9:00 AM Daily Recommendation Scheduler started (0 * * * *).');
}

/**
 * Stop the scheduler (e.g. during graceful shutdown or tests)
 */
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  isStarted = false;
  console.log('🛑 [EmailScheduler] Scheduler stopped.');
}

/**
 * Trigger an immediate test run
 */
async function runNow(forceAll = false) {
  console.log(`⚡ [EmailScheduler] Manual execution triggered (forceAll=${forceAll})`);
  return await processDailyEmailQueue(forceAll);
}

module.exports = {
  start,
  stop,
  runNow,
  isStarted: () => isStarted
};
