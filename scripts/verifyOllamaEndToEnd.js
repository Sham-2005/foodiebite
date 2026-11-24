// ─────────────────────────────────────────────────────────────
//  scripts/verifyOllamaEndToEnd.js
//  FoodieBite Local Ollama AI End-to-End Verification Script
// ─────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
const http = require('http');

// Load modules from backend/node_modules
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));
require(path.join(__dirname, '..', 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const { getAllFoods, searchFood } = require('../backend/src/ai/foodKnowledge');
const ollamaService = require('../backend/src/services/ollamaService');
const { generateResponse, getAIStatus } = require('../backend/src/services/foodieBiteAIService');

const JWT_SECRET = process.env.JWT_SECRET || 'foodiebite_super_secret_key_change_in_production_2024';
const TEST_TOKEN = jwt.sign(
  { id: 'usr_verify_e2e_001', uid: 'usr_verify_e2e_001', email: 'verify@foodiebite.com', role: 'user' },
  JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '1h' }
);

function makeHttpRequest({ hostname = 'localhost', port = 5000, path = '/', method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({ hostname, port, path, method, headers: reqHeaders, timeout: 25000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP Request timed out to ${path}`));
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runEndToEndVerification() {
  console.log('\n================================================================');
  console.log('  FOODIEBITE END-TO-END OLLAMA AI VERIFICATION SUITE');
  console.log('================================================================\n');

  const results = {
    step1_ollamaRunning: false,
    step2_modelInstalled: false,
    step3_backendCommunication: false,
    step4_coachStatusEndpoint: false,
    step5_realMessageSent: false,
    step6_fromOllama: false,
    step7_groundedDatabase: false,
    step8_dietaryFiltering: false,
    step9_offlineFallback: false,
    step10_frontendApiCommunication: false,
    allFoodsCount: getAllFoods().length,
    responseSnippet: '',
    recommendations: [],
    modelName: '',
    latencyMs: 0
  };

  // ── 1. Verify Ollama is running ────────────────────────────
  process.stdout.write('1. Checking if Ollama is running locally on port 11434... ');
  try {
    const ollamaTags = await makeHttpRequest({ hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' });
    if (ollamaTags.status === 200 && Array.isArray(ollamaTags.data.models)) {
      results.step1_ollamaRunning = true;
      console.log('✅ PASS (Ollama responding on http://localhost:11434)');
    } else {
      console.log('❌ FAIL (Unexpected response from Ollama)');
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 2. Verify qwen2.5:0.5b is installed ─────────────────────
  process.stdout.write('2. Checking if qwen2.5:0.5b is installed in Ollama... ');
  try {
    const ollamaTags = await makeHttpRequest({ hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' });
    const models = ollamaTags.data?.models || [];
    const hasQwen = models.some(m => (m.name || '').includes('qwen2.5:0.5b'));
    if (hasQwen) {
      results.step2_modelInstalled = true;
      results.modelName = 'qwen2.5:0.5b';
      console.log(`✅ PASS (Found installed model: ${models.map(m => m.name).join(', ')})`);
    } else {
      console.log(`❌ FAIL (Model qwen2.5:0.5b not found in: ${models.map(m => m.name).join(', ')})`);
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 3. Verify backend can communicate with Ollama ───────────
  process.stdout.write('3. Verifying backend OllamaService connection probe... ');
  try {
    const status = await ollamaService.checkConnection();
    if (status.connected && status.modelAvailable) {
      results.step3_backendCommunication = true;
      console.log(`✅ PASS (Status: "${status.status}", Host: ${status.host})`);
    } else {
      console.log(`❌ FAIL (Status: ${status.status}, Error: ${status.error})`);
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 4. Check /api/coach/status endpoint ─────────────────────
  process.stdout.write('4. Querying backend GET /api/coach/status HTTP endpoint... ');
  try {
    const coachStatus = await makeHttpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/coach/status',
      method: 'GET'
    });
    if (coachStatus.status === 200 && coachStatus.data?.success && coachStatus.data?.activeProvider === 'ollama') {
      results.step4_coachStatusEndpoint = true;
      console.log(`✅ PASS (activeProvider: ${coachStatus.data.activeProvider}, model: ${coachStatus.data.model})`);
    } else {
      console.log(`❌ FAIL (HTTP ${coachStatus.status}, Response: ${JSON.stringify(coachStatus.data)})`);
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 5. Send real test message through /api/coach ───────────
  process.stdout.write('5. Sending real test message to POST /api/coach... ');
  let coachResponse = null;
  try {
    const testPayload = {
      message: 'Suggest a high-protein vegetarian breakfast under 400 calories',
      userContext: {
        id: 'usr_verify_e2e_001',
        name: 'Aarav',
        dietType: 'vegetarian',
        allergies: [],
        healthGoals: ['high_protein']
      }
    };
    coachResponse = await makeHttpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/coach',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: testPayload
    });

    if (coachResponse.status === 200 && coachResponse.data?.success) {
      results.step5_realMessageSent = true;
      results.responseSnippet = (coachResponse.data.reply || '').substring(0, 160).replace(/\n/g, ' ') + '...';
      results.recommendations = coachResponse.data.recommendations || [];
      console.log('✅ PASS (HTTP 200 OK received)');
    } else {
      console.log(`❌ FAIL (HTTP ${coachResponse.status}, Error: ${coachResponse.data?.message || coachResponse.raw})`);
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 6. Verify response actually comes from Ollama ───────────
  process.stdout.write('6. Verifying response provenance is Ollama... ');
  const respData = coachResponse?.data || {};
  if (respData.source === 'ollama' && respData.provider === 'ollama' && (respData.model || '').includes('qwen2.5')) {
    results.step6_fromOllama = true;
    results.latencyMs = respData._timing?.totalMs || 0;
    console.log(`✅ PASS (source: "${respData.source}", model: "${respData.model}", latency: ${results.latencyMs}ms)`);
  } else {
    console.log(`❌ FAIL (Unexpected source: "${respData.source}", provider: "${respData.provider}")`);
  }

  // ── 7. Verify recommendations use real FoodieBite database ──
  process.stdout.write('7. Verifying food recommendations exist in verified FoodieBite database... ');
  const allFoods = getAllFoods();
  const allFoodIds = new Set(allFoods.map(f => f.id));
  const allFoodNames = new Set(allFoods.map(f => f.name.toLowerCase()));

  const recs = results.recommendations;
  let allRecsValid = recs.length > 0;
  for (const rec of recs) {
    const idValid = rec.foodId && allFoodIds.has(rec.foodId);
    const nameValid = rec.foodName && allFoodNames.has(rec.foodName.toLowerCase());
    if (!idValid && !nameValid) {
      allRecsValid = false;
      console.log(`\n   ⚠️ Invalid or hallucinated recommendation: ${JSON.stringify(rec)}`);
    }
  }
  if (allRecsValid) {
    results.step7_groundedDatabase = true;
    console.log(`✅ PASS (${recs.length} recommendation(s) matched real database entries: ${recs.map(r => r.foodName).join(', ')})`);
  } else {
    console.log(`❌ FAIL (Some recommendations did not match foodKnowledge database)`);
  }

  // ── 8. Test dietary preference filtering ───────────────────
  process.stdout.write('8. Testing strict dietary filtering (Vegan profile vs dairy/meat)... ');
  try {
    const veganPayload = {
      message: 'What should I eat for dinner tonight?',
      userContext: {
        id: 'usr_verify_vegan_002',
        name: 'Meera',
        dietType: 'vegan',
        allergies: ['dairy', 'milk']
      }
    };
    const veganRes = await makeHttpRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/coach',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
      body: veganPayload
    });

    const veganRecs = veganRes.data?.recommendations || [];
    let is100PercentVegan = veganRecs.length > 0;
    for (const r of veganRecs) {
      const food = searchFood(r.foodName);
      if (food && !food.vegan) {
        is100PercentVegan = false;
        console.log(`\n   ⚠️ Non-vegan food suggested to vegan user: ${r.foodName}`);
      }
    }
    if (is100PercentVegan) {
      results.step8_dietaryFiltering = true;
      console.log(`✅ PASS (All ${veganRecs.length} recommendations are verified 100% vegan: ${veganRecs.map(r => r.foodName).join(', ')})`);
    } else {
      console.log('❌ FAIL (Dietary violation detected)');
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  // ── 9. Test fallback when Ollama is unavailable ────────────
  process.stdout.write('9. Testing deterministic fallback when Ollama is unavailable... ');
  const originalBaseUrl = ollamaService.getBaseUrl();
  try {
    // Point to offline port to simulate network failure
    ollamaService.setBaseUrl('http://localhost:59999');

    const fallbackRes = await generateResponse({
      message: 'Suggest a light snack for acidity',
      userContext: { dietType: 'vegetarian', allergies: [] }
    });

    if (fallbackRes.success && fallbackRes.source === 'foodiebite_deterministic_engine' && fallbackRes.reply.length > 0) {
      results.step9_offlineFallback = true;
      console.log(`✅ PASS (Seamlessly activated: "${fallbackRes.source}", 0 user-facing errors)`);
    } else {
      console.log(`❌ FAIL (Unexpected fallback outcome: ${JSON.stringify(fallbackRes)})`);
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  } finally {
    ollamaService.setBaseUrl(originalBaseUrl);
  }

  // ── 10. Check frontend AI Coach communication ──────────────
  process.stdout.write('10. Verifying frontend API integration routes to backend... ');
  try {
    // Check that api.js exports apiSendChatMessage and routes to /coach
    const apiFile = require('fs').readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'services', 'api.js'), 'utf8');
    const hasCoachFetch = apiFile.includes('fetch(`${API_BASE_URL}/coach`') || apiFile.includes('fetch(\n        `${API_BASE_URL}/coach`');
    const hasStatusApi = apiFile.includes('apiGetCoachAIStatus');
    const hasNoLocalhostBypass = !apiFile.includes('if (isMobile || isLocalhost) {\n      return await processLocalAiMessage');

    if (hasCoachFetch && hasStatusApi && hasNoLocalhostBypass) {
      results.step10_frontendApiCommunication = true;
      console.log('✅ PASS (frontend api.js routes directly to backend /coach without bypassing localhost)');
    } else {
      console.log('❌ FAIL (frontend api.js still bypassing backend or missing status helper)');
    }
  } catch (err) {
    console.log(`❌ FAIL (${err.message})`);
  }

  console.log('\n================================================================');
  console.log('  VERIFICATION SUMMARY');
  console.log('================================================================');
  console.log(`  1. Ollama Running:            ${results.step1_ollamaRunning ? 'PASS' : 'FAIL'}`);
  console.log(`  2. Model Installed:           ${results.step2_modelInstalled ? 'PASS' : 'FAIL'} (${results.modelName})`);
  console.log(`  3. Backend Communication:     ${results.step3_backendCommunication ? 'PASS' : 'FAIL'}`);
  console.log(`  4. /api/coach/status:         ${results.step4_coachStatusEndpoint ? 'PASS' : 'FAIL'}`);
  console.log(`  5. Real Test Message:         ${results.step5_realMessageSent ? 'PASS' : 'FAIL'}`);
  console.log(`  6. Response from Ollama:      ${results.step6_fromOllama ? 'PASS' : 'FAIL'}`);
  console.log(`  7. Grounded in Food DB:       ${results.step7_groundedDatabase ? 'PASS' : 'FAIL'}`);
  console.log(`  8. Dietary Filtering:         ${results.step8_dietaryFiltering ? 'PASS' : 'FAIL'}`);
  console.log(`  9. Offline Fallback:          ${results.step9_offlineFallback ? 'PASS' : 'FAIL'}`);
  console.log(` 10. Frontend API Wiring:       ${results.step10_frontendApiCommunication ? 'PASS' : 'FAIL'}`);
  console.log('----------------------------------------------------------------');
  console.log(`  Response Snippet: "${results.responseSnippet}"`);
  console.log(`  Latency: ${results.latencyMs}ms`);
  console.log('================================================================\n');

  const allPassed = Object.keys(results)
    .filter(k => k.startsWith('step'))
    .every(k => results[k] === true);

  console.log(`FINAL STATUS: ${allPassed ? 'WORKING' : 'NOT WORKING'}\n`);
  process.exit(allPassed ? 0 : 1);
}

runEndToEndVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
