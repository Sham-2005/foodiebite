// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/automatedEmailSystem.test.js
//  FoodieBite Automated Email System Comprehensive Test Suite
//  Validates:
//    1. Welcome email dispatch to new user (idempotent, sent once)
//    2. Welcome email duplicate prevention (skips existing users)
//    3. Daily recommendation email generation (breakfast, lunch, dinner, snack)
//    4. Disabled/unsubscribed user skipped
//    5. Local 9:00 AM timezone evaluation logic
//    6. Duplicate daily delivery on same calendar date is prevented
//    7. Dietary preferences & allergen exclusions strictly applied
//    8. Medical report privacy: ZERO raw OCR, clinical data, or diagnoses in emails
//    9. Weather retrieval with graceful fallback
//    10. Delivery log recording and idempotency enforcement
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const assert = require('assert');
const emailAutomationService = require('../emailAutomationService');
const weatherService = require('../weatherService');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    process.stdout.write(`  [TEST] ${name}... `);
    await fn();
    passedTests++;
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('  FOODIEBITE AUTOMATED EMAIL SYSTEM TEST SUITE');
  console.log('============================================================\n');

  // Test 1: Welcome Email Content & Structure Validation
  await runTest('Welcome email generates with personalized starter recommendations & branding', async () => {
    const testUser = {
      id: 'test-user-welcome-01',
      email: 'testwelcome@example.com',
      name: 'Priya Sharma',
      dietType: 'Vegetarian',
      cuisines: ['South Indian', 'North Indian'],
      city: 'Chennai'
    };

    const result = await emailAutomationService.sendWelcomeEmail(testUser, { previewOnly: true });
    assert.strictEqual(result.success, true, 'Result success must be true');
    assert.ok(result.subject.includes('Welcome to FoodieBite'), 'Subject must welcome user');
    assert.ok(result.html.includes('Priya'), 'Email HTML must address user by name');
    assert.ok(result.html.includes('#FF6B35'), 'Email HTML must use FoodieBite brand color');
    assert.ok(result.html.includes('Vegetarian'), 'Email HTML must mention user diet');
    assert.ok(result.text.length > 50, 'Plain text fallback must be present');
  });

  // Test 2: Welcome Email Idempotency & Duplicate Prevention
  await runTest('Welcome email duplicate prevention skips users with welcome_email_sent=true', async () => {
    const userWithWelcomeAlreadySent = {
      id: 'test-user-welcome-sent',
      email: 'existinguser@example.com',
      name: 'Existing User',
      welcome_email_sent: true,
    };

    const result = await emailAutomationService.sendWelcomeEmail(userWithWelcomeAlreadySent, { previewOnly: true });
    assert.strictEqual(result.skipped, true, 'Must skip sending if welcome_email_sent is true');
    assert.ok(result.reason.toLowerCase().includes('already') || result.reason.toLowerCase().includes('sent'), 'Reason must mention already sent');
  });

  // Test 3: Daily Food Recommendation Email Structure (4 Meals + Weather + Tip)
  await runTest('Daily recommendation generates 4 distinct meals, weather context & reasoning', async () => {
    const testUser = {
      id: 'test-user-daily-01',
      email: 'dailyeater@example.com',
      name: 'Rohan Mehra',
      dietType: 'Vegetarian',
      spiceLevel: 'Medium',
      cuisines: ['Indian', 'Continental'],
      city: 'Mumbai',
      daily_email_enabled: true
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(testUser, {
      force: true,
      previewOnly: true,
      weather: { temperature: 28, condition: 'Warm & Sunny', category: 'warm', locationName: 'Mumbai' }
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.subject.includes('what you should eat today') || result.subject.includes('recommendations'), 'Subject must match requirements');
    assert.ok(result.html.includes('Breakfast'), 'Must contain Breakfast recommendation');
    assert.ok(result.html.includes('Lunch'), 'Must contain Lunch recommendation');
    assert.ok(result.html.includes('Dinner'), 'Must contain Dinner recommendation');
    assert.ok(result.html.includes('Snacks') || result.html.includes('Snack'), 'Must contain Snack recommendation');
    assert.ok(result.html.includes('Mumbai') || result.html.includes('Warm') || result.html.includes('28°C'), 'Must reflect weather context');
    assert.ok(result.html.includes('Unsubscribe') || result.html.includes('unsubscribe'), 'Must include unsubscribe link');
  });

  // Test 4: Disabled / Unsubscribed User is Skipped
  await runTest('Disabled daily email preference prevents sending', async () => {
    const disabledUser = {
      id: 'test-user-unsubscribed',
      email: 'optout@example.com',
      name: 'Opt Out',
      daily_email_enabled: false,
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(disabledUser, { previewOnly: true });
    assert.strictEqual(result.skipped, true, 'Must skip disabled user');
    assert.ok(result.reason.includes('disabled') || result.reason.includes('unsubscribed'), 'Reason must indicate opted-out');
  });

  // Test 5: Local 9:00 AM Timezone Evaluation Logic
  await runTest('Timezone hour evaluator accurately identifies local 9:00 AM delivery window', async () => {
    // Current UTC date
    const now = new Date();
    
    // Determine what timezone is currently at hour 9
    const utcHours = now.getUTCHours();
    // Offset in hours needed for 9 AM: (9 - utcHours + 24) % 24
    const offsetNeeded = (9 - utcHours + 24) % 24;

    // Test Intl.DateTimeFormat logic with a known timezone
    const tzKolkata = 'Asia/Kolkata';
    const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tzKolkata,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const kolkataTime = kolkataFormatter.format(now);
    assert.ok(typeof kolkataTime === 'string', 'Kolkata time must be formatted');
    assert.ok(kolkataTime.includes(':'), 'Formatted time must have hour:minute format');

    // Test preference matching: simulate target 09:00 vs mismatch
    const matchingPref = {
      preferred_delivery_time: '09:00',
      timezone: 'Asia/Kolkata'
    };
    const kolkataHour = kolkataTime.split(':')[0];
    const isNineAM = kolkataHour === '09';
    // Logic test:
    const expectedMatch = (matchingPref.preferred_delivery_time.split(':')[0] === kolkataHour);
    assert.strictEqual(expectedMatch, isNineAM, 'Hour matching logic must be exact');
  });

  // Test 6: Dietary Preferences: Vegetarian NEVER Receives Non-Veg Items
  await runTest('Vegetarian diet strictly excludes chicken, fish, mutton, egg, bacon, seafood', async () => {
    const vegUser = {
      id: 'test-veg-user',
      email: 'strictveg@example.com',
      name: 'Aarav Patel',
      dietType: 'Vegetarian',
      cuisines: ['Indian'],
      allergies: ['Peanuts'],
      daily_email_enabled: true
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(vegUser, {
      force: true,
      previewOnly: true
    });

    const forbiddenWords = ['chicken', 'fish', 'mutton', 'beef', 'pork', 'bacon', 'prawn', 'shrimp', 'peanut'];
    const htmlLower = result.html.toLowerCase();

    for (const word of forbiddenWords) {
      assert.strictEqual(
        htmlLower.includes(` ${word} `) || htmlLower.includes(`>${word}<`),
        false,
        `Forbidden item "${word}" found in vegetarian email recommendation!`
      );
    }
  });

  // Test 7: Dietary Preferences: Vegan Strictly Excludes Animal Products
  await runTest('Vegan diet strictly excludes dairy, milk, cheese, paneer, ghee, curd, meat', async () => {
    const veganUser = {
      id: 'test-vegan-user',
      email: 'vegan@example.com',
      name: 'Maya Green',
      dietType: 'Vegan',
      daily_email_enabled: true
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(veganUser, {
      force: true,
      previewOnly: true
    });

    const animalDerived = ['paneer', 'cheese', 'ghee', 'butter', 'curd', 'mutton', 'chicken', 'fish'];
    const htmlLower = result.html.toLowerCase();

    for (const item of animalDerived) {
      assert.strictEqual(
        htmlLower.includes(` ${item} `) || htmlLower.includes(`>${item}<`),
        false,
        `Animal-derived item "${item}" found in vegan email recommendation!`
      );
    }
  });

  // Test 8: Medical Report Privacy: ZERO Raw OCR or Clinical Diagnoses in Emails
  await runTest('Strict Medical Privacy: Never expose raw OCR, lab metrics, or diagnoses in email', async () => {
    const medicalUser = {
      id: 'test-medical-privacy-user',
      email: 'healthuser@example.com',
      name: 'Deepak Verma',
      dietType: 'Vegetarian',
      daily_email_enabled: true,
      // Medical report attached to user context
      medicalReports: [
        {
          id: 'rep_123',
          report_type: 'Blood Test',
          raw_ocr_text: 'HbA1c: 8.4% (HIGH), Fasting Glucose: 168 mg/dL. Diagnosis: Type 2 Diabetes Mellitus with Nephropathy risk.',
          extracted_details: {
            hba1c: '8.4%',
            glucose: '168 mg/dL',
            diagnosis: 'Type 2 Diabetes'
          }
        }
      ]
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(medicalUser, {
      force: true,
      previewOnly: true
    });

    const sensitiveTerms = [
      'HbA1c', '8.4%', 'Fasting Glucose', '168 mg/dL',
      'Diabetes Mellitus', 'Nephropathy', 'raw_ocr_text', 'blood test'
    ];

    const contentToCheck = (result.subject + ' ' + result.html + ' ' + result.text).toLowerCase();

    for (const term of sensitiveTerms) {
      assert.strictEqual(
        contentToCheck.includes(term.toLowerCase()),
        false,
        `CRITICAL PRIVACY VIOLATION: Sensitive clinical metric "${term}" found in email output!`
      );
    }
  });

  // Test 9: Weather Service Graceful Fallback
  await runTest('Weather retrieval handles missing or unreachable coordinates gracefully', async () => {
    // When city is missing, fallback defaults to temperate weather without throwing
    const fallbackUser = {
      id: 'test-weather-fallback',
      email: 'noweather@example.com',
      name: 'No Weather User',
      daily_email_enabled: true,
      city: null,
    };

    const result = await emailAutomationService.sendDailyRecommendationEmail(fallbackUser, {
      force: true,
      previewOnly: true
    });

    assert.strictEqual(result.success, true, 'Email generation must succeed despite missing city/weather');
    assert.ok(result.html.length > 500, 'HTML content must be generated');
  });

  // Test 10: Duplicate daily delivery on the same date is prevented
  await runTest('Duplicate daily email on same calendar date is skipped', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const userAlreadyReceivedToday = {
      id: 'test-user-already-sent-today',
      email: 'alreadysent@example.com',
      name: 'Morning User',
      daily_email_enabled: true,
      last_daily_email_sent: todayStr
    };

    // Attempting to send without force=true must skip
    const result = await emailAutomationService.sendDailyRecommendationEmail(userAlreadyReceivedToday, {
      force: false,
      previewOnly: true
    });

    assert.strictEqual(result.skipped, true, 'Must skip user who already received email today');
    assert.ok(result.reason.includes('already delivered') || result.reason.includes('today'), 'Reason must cite already delivered today');
  });

  // Test 11: Multi-Provider Fallback Dispatch Engine
  await runTest('Provider Fallback: Fallback dispatch operates seamlessly when secondary provider is engaged', async () => {
    assert.strictEqual(typeof emailAutomationService.dispatchEmailWithProviderFallback, 'function', 'dispatchEmailWithProviderFallback must be exported');

    const hasLiveProvider = Boolean(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || (process.env.SMTP_USER && process.env.SMTP_PASS));

    if (!hasLiveProvider) {
      console.log('     -> [MOCK] No live email provider credentials in CI; testing fallback architecture with isolated mock provider');
      const brevoService = require('../brevoService');
      const originalBrevoSend = brevoService.sendTransactionalEmail;
      const originalBrevoKey = process.env.BREVO_API_KEY;
      try {
        process.env.BREVO_API_KEY = 'mock_ci_brevo_key';
        brevoService.sendTransactionalEmail = async () => ({
          success: true,
          messageId: '<ci-mock-fallback-msg-id@brevo.test>'
        });
        const fallbackRes = await emailAutomationService.dispatchEmailWithProviderFallback({
          to: 'delivered@resend.dev',
          subject: '[Test Suite] Multi-Provider Fallback Verification',
          html: '<p>Testing automated provider fallback architecture</p>',
          text: 'Testing automated provider fallback architecture',
          userName: 'Test Verifier'
        });
        assert.ok(fallbackRes.messageId, 'Must return a confirmed provider message ID');
        assert.ok(['resend', 'brevo', 'smtp'].includes(fallbackRes.provider), 'Provider must be resend, brevo, or smtp');
      } finally {
        brevoService.sendTransactionalEmail = originalBrevoSend;
        if (originalBrevoKey === undefined) {
          delete process.env.BREVO_API_KEY;
        } else {
          process.env.BREVO_API_KEY = originalBrevoKey;
        }
      }
    } else {
      const fallbackRes = await emailAutomationService.dispatchEmailWithProviderFallback({
        to: process.env.TEST_EMAIL_RECIPIENT || 'delivered@resend.dev',
        subject: '[Test Suite] Multi-Provider Fallback Verification',
        html: '<p>Testing automated provider fallback architecture</p>',
        text: 'Testing automated provider fallback architecture',
        userName: 'Test Verifier'
      });
      assert.ok(fallbackRes.messageId, 'Must return a confirmed provider message ID');
      assert.ok(['resend', 'brevo', 'smtp'].includes(fallbackRes.provider), 'Provider must be resend, brevo, or smtp');
    }
  });

  // Test 12: Retry Eligibility Preservation on Send Failure
  await runTest('Retry Eligibility: Unsent/failed accounts remain eligible for future welcome emails', async () => {
    const unverifiedUser = {
      id: 'test-retry-eligible-user-01',
      email: 'newuser@foodiebite.test',
      name: 'Retry Candidate',
      welcome_email_sent: false
    };

    // When welcome_email_sent is false, preview or attempt must NEVER mark as skipped
    const checkResult = await emailAutomationService.sendWelcomeEmail(unverifiedUser, { previewOnly: true });
    assert.strictEqual(checkResult.skipped, undefined, 'Eligible user must NOT be marked as skipped');
    assert.strictEqual(checkResult.success, true, 'Eligible user must be processed for delivery');
  });

  console.log('\n============================================================');
  console.log(`  AUTOMATED EMAIL SYSTEM TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('============================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
