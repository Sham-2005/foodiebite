// ─────────────────────────────────────────────────────────────
//  backend/src/services/scheduler.js
//  FoodieBite — Production Daily Email Scheduler (Asia/Kolkata)
// ─────────────────────────────────────────────────────────────

'use strict';

const cron = require('node-cron');
const dailyRecommendationService = require('./dailyRecommendationService');

// Configurable state
let activeCronTask = null;
let currentCronPattern = process.env.DAILY_RECOMMENDATION_CRON || process.env.DAILY_EMAIL_CRON || '0 9 * * *';
let currentTimezone = process.env.DAILY_RECOMMENDATION_TIMEZONE || 'Asia/Kolkata';
let isSchedulerEnabled = process.env.DAILY_RECOMMENDATION_ENABLED !== 'false';
let lastExecutionResult = null;
let lastExecutionTime = null;

/**
 * Calculates next execution ISO timestamp from cron pattern and timezone
 */
function getNextScheduledExecution(cronPattern = currentCronPattern, tz = currentTimezone) {
  if (!isSchedulerEnabled) return null;
  try {
    // Basic calculation for standard daily cron (e.g., '0 9 * * *')
    const parts = cronPattern.trim().split(/\s+/);
    if (parts.length >= 5) {
      const minute = parseInt(parts[0], 10) || 0;
      const hour = parseInt(parts[1], 10) || 9;
      
      const now = new Date();
      // Calculate target time in given timezone today
      const nowTzString = now.toLocaleString('en-US', { timeZone: tz });
      const nowTz = new Date(nowTzString);

      const targetToday = new Date(nowTz);
      targetToday.setHours(hour, minute, 0, 0);

      let nextRun = targetToday;
      if (nowTz.getTime() >= targetToday.getTime()) {
        nextRun = new Date(targetToday.getTime() + 24 * 60 * 60 * 1000);
      }

      return nextRun.toISOString();
    }
  } catch (_) {}
  return null;
}

/**
 * Executes the scheduled daily recommendation email task
 */
async function runDailyJob(triggerType = 'scheduled') {
  if (!isSchedulerEnabled && triggerType === 'scheduled') {
    console.log('🗓️  [Scheduler] Daily recommendation emails are currently disabled. Skipping scheduled execution.');
    return { success: false, reason: 'scheduler_disabled' };
  }

  console.log(`\n🗓️  [Scheduler] Firing daily recommendations job (${triggerType}) at ${new Date().toISOString()} [${currentTimezone}]...`);
  lastExecutionTime = new Date().toISOString();

  try {
    const result = await dailyRecommendationService.executeDailyRecommendationRun({ triggerType });
    lastExecutionResult = result;
    return result;
  } catch (err) {
    console.error('❌ [Scheduler] Error during daily recommendations job:', err);
    lastExecutionResult = { success: false, error: err.message };
    return lastExecutionResult;
  }
}

/**
 * Initializes the background scheduler (does NOT fire immediately on boot)
 */
function initScheduler() {
  console.log(`🗓️  Initializing FoodieBite Daily Email Scheduler...`);
  console.log(`   Schedule: "${currentCronPattern}" | Timezone: ${currentTimezone} | Enabled: ${isSchedulerEnabled}`);

  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
  }

  if (!cron.validate(currentCronPattern)) {
    console.warn(`⚠️ [Scheduler] Invalid cron pattern "${currentCronPattern}". Defaulting to "0 9 * * *"`);
    currentCronPattern = '0 9 * * *';
  }

  activeCronTask = cron.schedule(
    currentCronPattern,
    async () => {
      await runDailyJob('scheduled');
    },
    {
      scheduled: isSchedulerEnabled,
      timezone: currentTimezone
    }
  );

  if (isSchedulerEnabled) {
    activeCronTask.start();
    console.log(`✅ [Scheduler] Daily recommendation job scheduled active for ${currentCronPattern} (${currentTimezone}).`);
  } else {
    console.log(`ℹ️ [Scheduler] Daily recommendation job loaded in PAUSED state.`);
  }

  return activeCronTask;
}

/**
 * Stop active scheduler task
 */
function stopScheduler() {
  if (activeCronTask) {
    activeCronTask.stop();
  }
  isSchedulerEnabled = false;
  console.log(`⏸️  [Scheduler] Stopped daily recommendation scheduler.`);
}

/**
 * Update schedule configuration at runtime
 */
async function updateSchedule({ cron: newCron, enabled, timezone: newTz }) {
  if (newCron !== undefined) {
    if (!cron.validate(newCron)) {
      throw new Error(`Invalid cron expression: "${newCron}". Format should be 5 space-separated parts (e.g. "0 9 * * *").`);
    }
    currentCronPattern = newCron;
  }

  if (newTz !== undefined) {
    currentTimezone = newTz || 'Asia/Kolkata';
  }

  if (enabled !== undefined) {
    isSchedulerEnabled = Boolean(enabled);
  }

  initScheduler();

  return await getStatus();
}

/**
 * Get comprehensive scheduler status and metrics
 */
async function getStatus() {
  const eligibleData = await dailyRecommendationService.getEligibleDailyRecipients().catch(() => ({ eligible: [], skipped: [] }));
  const history = await dailyRecommendationService.getDailyRunsHistory(5).catch(() => []);
  const lastRun = history[0] || lastExecutionResult?.runDoc || null;

  return {
    enabled: isSchedulerEnabled,
    cron: currentCronPattern,
    timezone: currentTimezone,
    nextExecution: getNextScheduledExecution(),
    lastExecutionTime,
    lastRun,
    isJobRunning: dailyRecommendationService.isJobRunning(),
    eligibleRecipientsCount: eligibleData.eligible.length,
    personalizationStats: lastRun?.personalizationStats || null,
    recentRuns: history
  };
}

module.exports = {
  initScheduler,
  stopScheduler,
  updateSchedule,
  getStatus,
  isJobRunning: () => dailyRecommendationService.isJobRunning(),
  triggerManualRun: (force = false) => runDailyJob(force ? 'manual_force' : 'manual'),
  retryFailed: (runId) => dailyRecommendationService.retryDailyRunFailures(runId)
};
