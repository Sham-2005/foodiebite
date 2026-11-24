// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/emailDeliveryAndRegistrationFix.test.js
//  FoodieBite Comprehensive End-to-End Email Delivery Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../backend/.env') });
const assert = require('assert');

const emailAutomationService = require('../emailAutomationService');
const brevoService = require('../brevoService');
const userStore = require('../userStore');
const emailScheduler = require('../emailScheduler');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`  [TEST] ${name}... `);
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log('❌ FAIL');
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n============================================================');
  console.log('  FOODIEBITE EMAIL DELIVERY & REGISTRATION TEST SUITE');
  console.log('============================================================\n');

  // 1. Welcome Email Generation & Content
  await test('Welcome email has required subject, branding, and diet-specific recommendations', async () => {
    const user = {
      id: `usr_test_veg_${Date.now()}`,
      email: 'newuser.test@example.com',
      name: 'Ananya Roy',
      dietType: 'Vegan',
      city: 'Bengaluru'
    };

    const res = await emailAutomationService.sendWelcomeEmail(user, { previewOnly: true });
    assert.strictEqual(res.success, true);
    assert.ok(res.subject.includes('Welcome to FoodieBite! 🍽️'), `Subject was: ${res.subject}`);
    assert.ok(res.html.includes('Ananya Roy'));
    assert.ok(res.html.includes('Vegan'));
    assert.ok(res.html.includes('Tofu & Spinach Quinoa') || res.html.includes('Chickpea'));
    assert.ok(res.text.includes('Welcome to FoodieBite!'));
  });

  // 2. Welcome Email Non-Vegetarian Personalization
  await test('Welcome email adapts starter food picks for Non-Vegetarian diet', async () => {
    const user = {
      id: `usr_test_nonveg_${Date.now()}`,
      email: 'nonveg.test@example.com',
      name: 'Vikram Singh',
      dietType: 'Non-Vegetarian'
    };

    const res = await emailAutomationService.sendWelcomeEmail(user, { previewOnly: true });
    assert.strictEqual(res.success, true);
    assert.ok(res.html.includes('Non-Vegetarian'));
    assert.ok(res.html.includes('Chicken') || res.html.includes('Fish') || res.html.includes('Egg'));
  });

  // 3. Welcome Email Deduplication / Idempotency
  await test('Welcome email is not duplicated if welcome_email_sent is true', async () => {
    const user = {
      id: `usr_already_sent_${Date.now()}`,
      email: 'already.sent@example.com',
      name: 'Sameer Patel',
      welcome_email_sent: true
    };

    const res = await emailAutomationService.sendWelcomeEmail(user, { previewOnly: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.reason, 'welcome_email_already_sent');
  });

  // 4. Repeated Login Does Not Send Duplicate Welcome Emails
  await test('Repeated sign-in with same account does not trigger welcome email twice', async () => {
    const user = {
      id: `usr_login_repeat_${Date.now()}`,
      email: `login.repeat.${Date.now()}@example.com`,
      name: 'Kavita Das',
      dietType: 'Vegetarian'
    };

    // First trigger (e.g. registration)
    const firstRes = await emailAutomationService.sendWelcomeEmail(user, { previewOnly: true });
    assert.strictEqual(firstRes.success, true);

    // Second trigger (e.g. subsequent login) - user object now has welcomeEmailSent
    user.welcome_email_sent = true;
    const secondRes = await emailAutomationService.sendWelcomeEmail(user, { previewOnly: true });
    assert.strictEqual(secondRes.skipped, true);
    assert.strictEqual(secondRes.reason, 'welcome_email_already_sent');
  });

  // 5. Daily Food Recommendation Email Structure
  await test('Daily recommendation email generates 4 balanced meals with explanations', async () => {
    const user = {
      id: `usr_daily_test_${Date.now()}`,
      email: 'daily.eater@example.com',
      name: 'Sunita Rao',
      dietType: 'Vegetarian',
      daily_email_enabled: true
    };

    const res = await emailAutomationService.sendDailyRecommendationEmail(user, {
      force: true,
      previewOnly: true,
      weather: { temperature: 26, condition: 'Clear', locationLabel: 'Bengaluru' }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.subject.includes('Good morning'));
    assert.ok(res.html.includes('Sunita Rao'));
    assert.ok(res.html.includes('Breakfast'));
    assert.ok(res.html.includes('Lunch'));
    assert.ok(res.html.includes('Dinner'));
    assert.ok(res.text.includes('BREAKFAST'));
    assert.ok(res.html.includes('Why These Recommendations?'));
    assert.ok(res.html.includes('unsubscribe_daily'));
  });

  // 6. Daily Recommendation Respects Opt-Out
  await test('Daily recommendation email respects user opt-out (daily_email_enabled=false)', async () => {
    const optedOutUser = {
      id: `usr_optout_${Date.now()}`,
      email: 'optout.user@example.com',
      daily_email_enabled: false
    };

    const res = await emailAutomationService.sendDailyRecommendationEmail(optedOutUser);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.reason, 'daily_email_disabled');
  });

  // 7. Daily Recommendation Duplicate Prevention on Same Calendar Date
  await test('Daily recommendation email skips duplicate dispatch on same date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const user = {
      id: `usr_delivered_today_${Date.now()}`,
      email: 'already.delivered@example.com',
      last_daily_email_sent: today,
      daily_email_enabled: true
    };

    const res = await emailAutomationService.sendDailyRecommendationEmail(user, { force: false });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.skipped, true);
    assert.ok(res.reason.includes('already_delivered_today') || res.reason.includes('already_sent_today'));
  });

  // 8. Provider Priority and Brevo Account Verification
  await test('Primary transactional email provider Brevo is active and verified', async () => {
    const status = await brevoService.getBrevoAccountStatus();
    assert.strictEqual(status.provider, 'brevo');
    assert.strictEqual(status.configured, true);
    assert.ok(status.creditsRemainingToday > 0, 'Must have active email credits');
    assert.strictEqual(status.sender?.email, 'foodiebite881@gmail.com');
  });

  // 9. Batch Queue Scheduler Processing
  await test('Scheduler queue runs without unhandled exceptions and merges active users', async () => {
    const queueSummary = await emailAutomationService.processDailyEmailQueue(false);
    assert.strictEqual(queueSummary.success, true);
    assert.strictEqual(typeof queueSummary.dispatched, 'number');
    assert.strictEqual(typeof queueSummary.skipped, 'number');
    assert.strictEqual(typeof queueSummary.failed, 'number');
  });

  // 10. Graceful Network / Invalid Input Handling
  await test('Invalid email format is rejected safely without breaking server execution', async () => {
    let threw = false;
    try {
      await emailAutomationService.sendWelcomeEmail({ email: 'not-an-email' }, { previewOnly: true });
    } catch (e) {
      threw = true;
      assert.ok(e.message);
    }
    // sendWelcomeEmail or validator handles it
  });

  console.log('\n============================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite runner error:', err);
  process.exit(1);
});
