// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/brevoIntegration.test.js
//  FoodieBite Brevo Integration & Campaign Engine Test Suite
//  Covers validation, idempotency, batching, unsubscribes, webhooks & mocks
// ─────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();
const assert = require('assert');
const brevoService = require('../brevoService');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('--- Brevo Email Service & Campaign Integration Suite ---');
  console.log('======================================================\n');

  // ── GROUP 1: Email Validation & Security Sanitization ──────
  console.log('[1. VALIDATION & SECURITY SANITIZATION]');

  await runTest('Validates correct and incorrect email addresses', () => {
    assert.strictEqual(brevoService.isValidEmail('user@foodiebite.com'), true);
    assert.strictEqual(brevoService.isValidEmail('john.doe+tag@example.org'), true);
    assert.strictEqual(brevoService.isValidEmail('invalid-email'), false);
    assert.strictEqual(brevoService.isValidEmail('missing@domain'), false);
    assert.strictEqual(brevoService.isValidEmail(''), false);
    assert.strictEqual(brevoService.isValidEmail(null), false);
  });

  await runTest('Sanitizes headers against CRLF injection', () => {
    const maliciousSubject = 'Test Subject\r\nBcc: victim@example.com\nInjected-Header: evil';
    const sanitized = brevoService.sanitizeHeader(maliciousSubject);
    assert.strictEqual(sanitized.includes('\r'), false, 'Should not contain CR');
    assert.strictEqual(sanitized.includes('\n'), false, 'Should not contain LF');
    assert.strictEqual(sanitized, 'Test Subject Bcc: victim@example.com Injected-Header: evil');
  });

  await runTest('Sanitizes HTML content removing dangerous script tags', () => {
    const unsafeHtml = '<p>Hello User</p><script>alert("xss")</script><img src="x" onerror="stealCookies()">';
    const clean = brevoService.sanitizeEmailHtml(unsafeHtml);
    assert.strictEqual(clean.includes('<script'), false, 'Should remove script tag');
    assert.strictEqual(clean.includes('onerror='), false, 'Should remove inline event handler');
    assert.strictEqual(clean.includes('<p>Hello User</p>'), true, 'Should keep safe HTML');
  });

  // ── GROUP 2: Unsubscribe Tokens & Cryptographic Verification ──
  console.log('\n[2. CONSENT & UNSUBSCRIBE SECURITY]');

  await runTest('Generates and verifies cryptographic HMAC unsubscribe tokens', () => {
    const testEmail = 'subscriber@example.com';
    const token = brevoService.generateUnsubscribeToken(testEmail);
    assert.ok(token && token.length === 64, 'Token should be a 64-char sha256 hex string');

    const isValid = brevoService.verifyUnsubscribeToken(testEmail, token);
    assert.strictEqual(isValid, true, 'Valid token must verify true');

    const isTamperedValid = brevoService.verifyUnsubscribeToken(testEmail, 'deadbeef1234');
    assert.strictEqual(isTamperedValid, false, 'Tampered token must verify false');

    const isWrongEmailValid = brevoService.verifyUnsubscribeToken('other@example.com', token);
    assert.strictEqual(isWrongEmailValid, false, 'Token for another email must verify false');
  });

  await runTest('Unsubscribes user and records opt-out reason', async () => {
    const email = 'optout_test@foodiebite.com';
    const token = brevoService.generateUnsubscribeToken(email);
    const result = await brevoService.unsubscribeUser({ email, token, reason: 'user_click' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.email, email);

    // Verify user is excluded from marketing
    const isUnsub = await brevoService.isUserUnsubscribed(email);
    assert.strictEqual(isUnsub, true, 'User should now be marked as unsubscribed');
  });

  // ── GROUP 3: Recipient Eligibility & Segmentation ──────────
  console.log('\n[3. RECIPIENT ELIGIBILITY & FILTERING]');

  await runTest('Filters eligible recipients by Diet Type', async () => {
    const evalRes = await brevoService.getEligibleRecipients({
      recipientType: 'dietType',
      filterCriteria: { dietType: 'Vegetarian' }
    });

    assert.ok(evalRes.totalEvaluated > 0, 'Should evaluate existing registered directory users');
    assert.ok(evalRes.eligibleCount >= 0, 'Should return eligible count');
    assert.ok(Array.isArray(evalRes.eligibleRecipients), 'Eligible recipients should be an array');
    
    // Ensure all returned recipients match Vegetarian
    for (const r of evalRes.eligibleRecipients) {
      assert.ok(r.dietType.toLowerCase().includes('veg'), 'Targeted recipient must match diet filter');
    }
  });

  await runTest('Filters recipients by specific selected emails list', async () => {
    const targetEmail = 'shams5076.sse@saveetha.com';
    const evalRes = await brevoService.getEligibleRecipients({
      recipientType: 'selected',
      selectedEmails: [targetEmail]
    });

    assert.ok(evalRes.eligibleRecipients.some(r => r.email === targetEmail), 'Selected email must be included');
  });

  // ── GROUP 4: Campaign Creation & Idempotency ───────────────
  console.log('\n[4. CAMPAIGN LIFECYCLE & IDEMPOTENCY]');

  await runTest('Rejects campaign creation with missing required fields', async () => {
    let errorThrown = false;
    try {
      await brevoService.createCampaign({
        campaignName: '',
        subject: '',
        htmlContent: ''
      });
    } catch (e) {
      errorThrown = true;
      assert.strictEqual(e.statusCode, 400);
    }
    assert.strictEqual(errorThrown, true, 'Should reject empty campaign data');
  });

  let createdCampaignId = null;
  await runTest('Creates campaign draft with real recipient evaluation', async () => {
    const campaign = await brevoService.createCampaign({
      campaignName: 'Automated Test Campaign',
      subject: '🍏 Test Subject',
      htmlContent: '<p>Test Campaign Content</p>',
      recipientType: 'all',
      createdBy: 'admin_test'
    });

    assert.ok(campaign.campaignId, 'Should generate a unique campaign ID');
    assert.strictEqual(campaign.status, 'draft', 'Initial status should be draft');
    assert.ok(campaign.recipientCount >= 0, 'Should store evaluated recipient count');
    createdCampaignId = campaign.campaignId;
  });

  await runTest('Prevents duplicate campaign launch on completed campaigns', async () => {
    // If campaign is marked completed, startCampaign should reject
    const { getFirestoreDb } = require('../../config/firebase');
    const db = getFirestoreDb();
    if (db && createdCampaignId) {
      try {
        await db.collection('emailCampaigns').doc(createdCampaignId).set({ status: 'completed' }, { merge: true });
      } catch (_) {}
    }
    if (brevoService.memoryCampaigns && createdCampaignId && brevoService.memoryCampaigns.has(createdCampaignId)) {
      brevoService.memoryCampaigns.get(createdCampaignId).status = 'completed';
    }

    let dupError = false;
    try {
      await brevoService.startCampaign(createdCampaignId);
    } catch (err) {
      dupError = true;
      assert.strictEqual(err.code, 'CAMPAIGN_ALREADY_COMPLETED');
    }
    assert.strictEqual(dupError, true, 'Should reject launch for already-completed campaign');
  });

  // ── GROUP 5: Automated Welcome Email & Duplicate Prevention ─
  console.log('\n[5. AUTOMATED WELCOME EMAIL]');

  await runTest('Prevents duplicate welcome email if user.welcomeEmailSent is true', async () => {
    const userWithWelcomeSent = {
      id: 'usr_already_welcomed',
      email: 'welcomed@foodiebite.com',
      name: 'Welcomed Explorer',
      welcomeEmailSent: true
    };

    const res = await brevoService.sendWelcomeEmail(userWithWelcomeSent);
    assert.strictEqual(res.skipped, true, 'Should skip duplicate welcome email');
    assert.strictEqual(res.reason, 'already_sent');
  });

  // ── GROUP 6: Webhook Delivery Tracking & Deduplication ─────
  console.log('\n[6. WEBHOOK DELIVERY TRACKING & DEDUPLICATION]');

  await runTest('Rejects webhook with invalid secret key', async () => {
    let unauthThrown = false;
    try {
      await brevoService.processDeliveryWebhook(
        { event: 'delivered', email: 'test@example.com' },
        'wrong_secret_key'
      );
    } catch (err) {
      unauthThrown = true;
      assert.strictEqual(err.statusCode, 401);
    }
    assert.strictEqual(unauthThrown, true, 'Should reject invalid secret');
  });

  await runTest('Processes valid Brevo delivery webhook and prevents duplicate events', async () => {
    const eventId = `test_evt_${Date.now()}`;
    const payload = {
      id: eventId,
      event: 'delivered',
      email: 'delivery_test@foodiebite.com',
      'message-id': '<test_msg_123@smtp-relay.mailin.fr>',
      ts_event: Math.floor(Date.now() / 1000)
    };

    const secret = process.env.BREVO_WEBHOOK_SECRET || 'foodiebite_brevo_webhook_secret_2026';
    
    // First processing
    const firstRes = await brevoService.processDeliveryWebhook(payload, secret);
    assert.strictEqual(firstRes.success, true);
    assert.strictEqual(firstRes.processed, true);

    // Second processing (duplicate event)
    const secondRes = await brevoService.processDeliveryWebhook(payload, secret);
    assert.strictEqual(secondRes.success, true);
    assert.strictEqual(secondRes.skipped, true, 'Second submission of same event ID must be skipped');
    assert.strictEqual(secondRes.reason, 'duplicate_event');
  });

  // ── GROUP 7: Account Status & Quota Retrieval ──────────────
  console.log('\n[7. ACCOUNT STATUS & LIVE QUOTA]');

  await runTest('Fetches Brevo account status and returns positive credits quota', async () => {
    const status = await brevoService.getBrevoAccountStatus();
    assert.strictEqual(status.provider, 'brevo');
    assert.strictEqual(status.configured, true);
    assert.ok(typeof status.creditsRemainingToday === 'number', 'Credits should be a valid number');
    assert.ok(status.creditsRemainingToday <= 300, 'Credits should not exceed daily limit');
    assert.ok(status.sender && status.sender.email, 'Sender email must be present');
    console.log(`     -> Live Plan: ${status.planType} | Credits Remaining: ${status.creditsRemainingToday} / ${status.dailyQuotaLimit}`);
  });

  console.log('\n======================================================');
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log('======================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
