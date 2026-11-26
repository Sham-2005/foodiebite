/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/aiCoachFallback.test.js
 *  Unit Test Suite for AI Coach Timeout Guard, Provider Failover &
 *  Clinical Dietary Consultation Reasoning
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { generateResponse, getAIStatus } = require('../foodieBiteAIService');
const ollamaService = require('../ollamaService');
const foodieBiteAI = require('../../ai/foodieBiteAI');
const {
  isClinicalQuery,
  extractClinicalMarkers,
  handleClinicalConsultation
} = require('../../ai/clinicalConsultationEngine');

async function runAICoachFallbackTests() {
  console.log('='.repeat(70));
  console.log(' [UNIT TEST SUITE] AI Coach Resilient Fallback & Clinical Guidance');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function testAssert(condition, name, details = '') {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${name}${details ? ` (${details})` : ''}`);
    } else {
      failed++;
      console.error(`  ✗ [FAIL] ${name}${details ? ` (${details})` : ''}`);
    }
  }

  // ── TEST 1: Clinical Query Detection & Marker Extraction ─────────────
  console.log('\n--- 1. Clinical Query Detection & Biomarker Parsing ---');
  {
    const query = 'What foods should I avoid with an LDL of 165 and borderline glucose?';
    const isClinical = isClinicalQuery(query);
    testAssert(isClinical === true, 'isClinicalQuery detects LDL and glucose avoidance inquiry');

    const markers = extractClinicalMarkers(query);
    testAssert(markers.length >= 2, 'extractClinicalMarkers identifies at least 2 biomarkers', `found ${markers.length}`);
    
    const ldlMarker = markers.find(m => m.biomarker === 'LDL Cholesterol');
    testAssert(Boolean(ldlMarker && ldlMarker.value.includes('165')), 'LDL biomarker extracted with value 165 mg/dL');

    const glucoseMarker = markers.find(m => m.biomarker.includes('Glucose'));
    testAssert(Boolean(glucoseMarker), 'Glucose biomarker extracted from borderline glucose mention');
  }

  // ── TEST 2: Deterministic Clinical Consultation Execution ───────────
  console.log('\n--- 2. Deterministic Clinical Consultation Engine Execution ---');
  {
    const t0 = Date.now();
    const result = handleClinicalConsultation({
      message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
      userContext: { id: 'demo-user', dietType: 'Vegetarian' }
    });
    const duration = Date.now() - t0;

    testAssert(result.success === true, 'Clinical consultation returns success=true');
    testAssert(duration < 500, 'Clinical consultation executes within SLA', `${duration}ms`);
    testAssert(typeof result.reply === 'string' && result.reply.length > 200, 'Reply contains structured advisory text');
    testAssert(result.reply.includes('Butter Naan') && result.reply.includes('Strictly Avoid'), 'Advisory explicitly contraindicates Butter Naan / Saturated fats');
    testAssert(result.reply.includes('Yellow Dal Tadka') || result.reply.includes('Oats'), 'Advisory recommends soluble fiber foods (Dal / Oats)');
    testAssert(result.reply.includes('Clinical Safety Disclaimer'), 'Advisory includes mandatory medical safety disclaimer');
    testAssert(Array.isArray(result.recommendations) && result.recommendations.length > 0, 'Returns structured recommendations array');
    
    // Safety check: Butter Naan must NOT be in the recommendations array!
    const hasButterNaan = result.recommendations.some(r => (r.foodName || '').toLowerCase().includes('butter naan'));
    testAssert(!hasButterNaan, 'Butter Naan is strictly excluded from clinical food recommendations');

    // Recommendations must have required properties
    const firstRec = result.recommendations[0];
    testAssert(Boolean(firstRec.foodId && firstRec.foodName && firstRec.calories && firstRec.reason),
      'Recommendation items contain foodId, foodName, calories, and clinical reason');

    testAssert(Array.isArray(result.options) && result.options.length >= 2,
      'Returns structured options for follow-up navigation');
  }

  // ── TEST 3: AI Service Offline / Unavailable Fallback ─────────────────
  console.log('\n--- 3. Primary AI Unavailable / Offline Fallback ---');
  {
    // Save original checkConnection
    const origCheckConnection = ollamaService.checkConnection;
    try {
      // Mock Ollama as offline
      ollamaService.checkConnection = async () => ({
        status: 'Ollama Offline',
        connected: false,
        modelAvailable: false,
        installedModels: []
      });

      const t0 = Date.now();
      const res = await generateResponse({
        message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
        userContext: { id: 'test-offline-user', dietType: 'Vegetarian' }
      });
      const duration = Date.now() - t0;

      testAssert(res.success === true, 'Offline primary activates fallback and returns success=true');
      testAssert(duration < 1000, 'Offline failover completes within 1000ms', `${duration}ms`);
      testAssert(res.source === 'foodiebite_clinical_engine' || res.source === 'foodiebite_deterministic_engine',
        'Response source correctly identifies deterministic fallback engine', res.source);
      testAssert(Array.isArray(res.recommendations) && res.recommendations.length > 0,
        'Fallback returns structured food recommendations');
      testAssert(Array.isArray(res.options) && res.options.length > 0,
        'Fallback returns options for user choice');
    } finally {
      ollamaService.checkConnection = origCheckConnection;
    }
  }

  // ── TEST 4: Primary AI Timeout Fallback Behavior ──────────────────────
  console.log('\n--- 4. Primary AI Interactive Timeout Fallback ---');
  {
    const origCheckConnection = ollamaService.checkConnection;
    const origChat = ollamaService.chat;
    const origEnvTimeout = process.env.COACH_PRIMARY_TIMEOUT_MS;

    try {
      // Mock Ollama connected but chat hangs longer than the SLA timeout
      process.env.COACH_PRIMARY_TIMEOUT_MS = '250'; // 250ms test SLA
      ollamaService.checkConnection = async () => ({
        status: 'Model Available',
        connected: true,
        modelAvailable: true,
        installedModels: [{ name: 'qwen2.5:0.5b' }]
      });

      ollamaService.chat = async () => {
        // Simulate slow LLM generation that takes 3000ms
        await new Promise(r => setTimeout(r, 3000));
        return { success: true, content: 'Slow response' };
      };

      const t0 = Date.now();
      const res = await generateResponse({
        message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
        userContext: { id: 'test-timeout-user' }
      });
      const duration = Date.now() - t0;

      testAssert(res.success === true, 'Timeout triggers immediate fallback with success=true');
      testAssert(duration < 1500, 'Fails over within SLA timeout headroom without hanging', `${duration}ms`);
      testAssert(Boolean(res.reply && res.reply.length > 50), 'Fallback returns complete advisory text');
      testAssert(Array.isArray(res.recommendations), 'Fallback contains recommendations array');
    } finally {
      ollamaService.checkConnection = origCheckConnection;
      ollamaService.chat = origChat;
      if (origEnvTimeout !== undefined) {
        process.env.COACH_PRIMARY_TIMEOUT_MS = origEnvTimeout;
      } else {
        delete process.env.COACH_PRIMARY_TIMEOUT_MS;
      }
    }
  }

  // ── TEST 5: Refusal Output Detection Fallback ─────────────────────────
  console.log('\n--- 5. Primary AI Refusal Output Detection & Failover ---');
  {
    const origCheckConnection = ollamaService.checkConnection;
    const origChat = ollamaService.chat;

    try {
      ollamaService.checkConnection = async () => ({
        status: 'Model Available',
        connected: true,
        modelAvailable: true,
        installedModels: [{ name: 'qwen2.5:0.5b' }]
      });

      // Simulate model returning a generic refusal string
      ollamaService.chat = async () => ({
        success: true,
        content: "I'm sorry, but I can't assist with that.",
        model: 'qwen2.5:0.5b',
        latencyMs: 150
      });

      const res = await generateResponse({
        message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
        userContext: { id: 'test-refusal-user' }
      });

      testAssert(res.success === true, 'Refusal detection redirects to fallback with success=true');
      testAssert(!res.reply.includes("I'm sorry, but I can't assist"),
        'Refusal string was NOT returned to client; clinical guidance returned instead');
      testAssert(res.reply.includes('Clinical Dietary Guidance') || res.reply.includes('LDL'),
        'Clinical dietary guidance successfully provided despite model refusal');
    } finally {
      ollamaService.checkConnection = origCheckConnection;
      ollamaService.chat = origChat;
    }
  }

  // ── TEST 6: Response Contract Verification ───────────────────────────
  console.log('\n--- 6. Fallback Response Schema Contract Verification ---');
  {
    const res = await generateResponse({
      message: 'What foods should I avoid with an LDL of 165 and borderline glucose?',
      userContext: { id: 'contract-test-user' }
    });

    const expectedKeys = ['success', 'source', 'provider', 'model', 'reply', 'type', 'options', 'recommendations', 'confidence', 'timing'];
    for (const key of expectedKeys) {
      testAssert(key in res, `Contract field "${key}" is present in response`);
    }

    testAssert(typeof res.success === 'boolean' && res.success === true, 'res.success is boolean true');
    testAssert(typeof res.reply === 'string' && res.reply.trim().length > 0, 'res.reply is non-empty string');
    testAssert(['text', 'choice', 'alert', 'meal_suggestion'].includes(res.type), `res.type is valid message type (${res.type})`);
    testAssert(Array.isArray(res.options), 'res.options is an Array');
    testAssert(Array.isArray(res.recommendations), 'res.recommendations is an Array');
    testAssert(typeof res.confidence === 'number' && res.confidence >= 0.80, `res.confidence is valid number (${res.confidence})`);
    testAssert(typeof res.timing === 'object' && typeof res.timing.totalMs === 'number', 'res.timing contains totalMs');
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log(` AI Coach Fallback Tests Finished: ${passed}/${passed + failed} Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('='.repeat(70));

  if (failed > 0) {
    throw new Error(`${failed} AI Coach Fallback tests failed.`);
  }
  return { passed, failed, total: passed + failed };
}

if (require.main === module) {
  runAICoachFallbackTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Test Suite Error:', err.message);
      process.exit(1);
    });
}

module.exports = runAICoachFallbackTests;
