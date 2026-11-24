// ─────────────────────────────────────────────────────────────
//  backend/src/services/__tests__/ollamaIntegration.test.js
//  FoodieBite Comprehensive Local Ollama Integration Test Suite
// ─────────────────────────────────────────────────────────────

'use strict';

const assert = require('assert');
const ollamaService = require('../ollamaService');
const {
  getGroundedFoodCandidates,
  buildGroundedSystemPrompt,
  validateGroundedResponse,
  buildDeterministicFallback
} = require('../groundedRecommendationService');
const { generateResponse, getAIStatus } = require('../foodieBiteAIService');
const { searchFood, getAllFoods } = require('../../ai/foodKnowledge');

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('  FOODIEBITE LOCAL OLLAMA INTEGRATION TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`  [TEST] ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL\n         Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Ollama Connection & Status
  await test('Ollama service connects and identifies installed model correctly', async () => {
    const status = await ollamaService.checkConnection();
    assert.strictEqual(status.connected, true, 'Ollama must be connected on localhost');
    assert.ok(Array.isArray(status.installedModels), 'Installed models must be an array');
    assert.ok(['Model Available', 'Ollama Connected'].includes(status.status), 'Status must indicate connected/available');
  });

  // 2. Model Discovery & Selection
  await test('Model selection and switching works properly without code modification', async () => {
    const original = ollamaService.getSelectedModel();
    ollamaService.setSelectedModel('llama3.2:1b');
    assert.strictEqual(ollamaService.getSelectedModel(), 'llama3.2:1b');
    
    // Switch back to installed model
    ollamaService.setSelectedModel(original);
    assert.strictEqual(ollamaService.getSelectedModel(), original);
  });

  // 3. Model Availability Checking
  await test('Model availability check identifies present vs missing models', async () => {
    const original = ollamaService.getSelectedModel();
    ollamaService.setSelectedModel('non_existent_model_xyz:99b');
    const statusMissing = await ollamaService.checkConnection();
    assert.strictEqual(statusMissing.modelAvailable, false, 'Non-existent model must report modelAvailable=false');
    assert.strictEqual(statusMissing.status, 'Model Not Installed');

    ollamaService.setSelectedModel(original);
    const statusPresent = await ollamaService.checkConnection();
    assert.strictEqual(statusPresent.modelAvailable, true, 'Original model must report modelAvailable=true');
  });

  // 4. Food Dataset Grounding: Dietary Preference Filtering
  await test('Food grounding strictly filters non-vegan items for Vegan user', () => {
    const veganUser = {
      name: 'Priya',
      dietType: 'vegan',
      allergies: []
    };
    const candidates = getGroundedFoodCandidates(veganUser, { mealType: 'breakfast' });
    assert.ok(candidates.length > 0, 'Must return candidates for vegan breakfast');
    
    // Verify none of the candidates are non-vegan (e.g. dairy, egg, meat)
    for (const item of candidates) {
      const food = searchFood(item.name);
      if (food) {
        assert.strictEqual(food.vegan, true, `${item.name} must be vegan`);
      }
    }
  });

  // 5. Food Dataset Grounding: Allergy Exclusion
  await test('Food grounding strictly excludes items with user allergies (Peanuts)', () => {
    const allergicUser = {
      name: 'Rahul',
      dietType: 'vegetarian',
      allergies: ['peanut', 'peanuts']
    };
    const candidates = getGroundedFoodCandidates(allergicUser, { keywords: ['snack', 'nuts'] });
    assert.ok(candidates.length > 0, 'Must return safe snacks');

    for (const item of candidates) {
      const food = searchFood(item.name);
      if (food) {
        const hasPeanut = (food.allergens || []).some(a => a.toLowerCase().includes('peanut')) ||
                          food.name.toLowerCase().includes('peanut');
        assert.strictEqual(hasPeanut, false, `${item.name} must not contain peanut allergen`);
      }
    }
  });

  // 6. Grounded System Prompt Assembly
  await test('System prompt incorporates user context, zero-hallucination rules, and candidate IDs', () => {
    const sampleCandidates = [
      { id: 'idli_sambar', name: 'Steamed Idli with Sambar', category: 'Breakfast', calories: 240, protein: 7, carbs: 46, mealTypes: ['breakfast'] }
    ];
    const prompt = buildGroundedSystemPrompt({
      userProfile: { name: 'Ananya', dietType: 'Vegetarian', allergies: ['mushrooms'] },
      candidates: sampleCandidates,
      contextProfile: { season: 'Winter', weather: { temperature: 22, condition: 'Mild' } }
    });

    assert.ok(prompt.includes('FoodieBite AI'), 'Prompt must define FoodieBite identity');
    assert.ok(prompt.includes('ZERO HALLUCINATION POLICY'), 'Prompt must enforce zero-hallucination');
    assert.ok(prompt.includes('Steamed Idli with Sambar'), 'Prompt must list grounded candidate food name');
    assert.ok(prompt.includes('idli_sambar'), 'Prompt must list grounded candidate food ID');
    assert.ok(prompt.includes('mushrooms'), 'Prompt must reflect user allergy context');
  });

  // 7. Hallucination Defense & Output Validation
  await test('Output validator removes hallucinated food items and preserves verified database foods', () => {
    const sampleCandidates = [
      { id: 'paneer_tikka', name: 'Paneer Tikka', category: 'High Protein', calories: 300, protein: 20 },
      { id: 'dal_tadka', name: 'Dal Tadka', category: 'Nutrient Dense', calories: 220, protein: 11 }
    ];

    // Mock AI output containing 1 valid food and 1 fake hallucinated food
    const mockAiJson = JSON.stringify({
      message: 'Here are great options for you!',
      recommendations: [
        { foodId: 'paneer_tikka', foodName: 'Paneer Tikka', reason: 'High in vegetarian protein' },
        { foodId: 'super_fake_food_999', foodName: 'Extraterrestrial Magic Berry', reason: 'Made up by AI' }
      ]
    });

    const validated = validateGroundedResponse(mockAiJson, sampleCandidates);
    assert.strictEqual(validated.success, true);
    assert.strictEqual(validated.recommendations.length, 1, 'Hallucinated food must be stripped');
    assert.strictEqual(validated.recommendations[0].foodId, 'paneer_tikka');
  });

  // 8. Resilient Recovery on Malformed JSON
  await test('Output validator handles malformed JSON gracefully and extracts grounded foods', () => {
    const sampleCandidates = [
      { id: 'khichdi', name: 'Dal Khichdi', category: 'Comfort Food', calories: 290, protein: 10 }
    ];
    const malformedOutput = '```json { "message": "Here is khichdi", recommendations: [ INVALID SYNTAX } ```';
    const validated = validateGroundedResponse(malformedOutput, sampleCandidates);
    assert.strictEqual(validated.success, true);
    assert.ok(validated.reply.length > 0, 'Reply must not be empty');
    assert.ok(validated.recommendations.length > 0, 'Must fall back to candidate recommendation');
  });

  // 9. Live Ollama Chat Completion with Qwen 2.5
  await test('Live Ollama chat generates grounded nutritional answer', async () => {
    const chatRes = await ollamaService.chat({
      messages: [
        { role: 'user', content: 'In one sentence, why is moong dal khichdi easy to digest?' }
      ],
      options: { num_predict: 80 }
    });
    assert.strictEqual(chatRes.success, true);
    assert.strictEqual(chatRes.source, 'ollama');
    assert.ok(chatRes.reply.length > 10, 'Ollama reply must be substantial');
    assert.ok(chatRes.latencyMs > 0, 'Latency must be recorded');
  });

  // 10. End-to-End AI Coach Generation (Ollama + Grounding Pipeline)
  await test('Full AI Coach pipeline executes grounded recommendation with Ollama', async () => {
    const userContext = {
      id: 'test_user_01',
      name: 'Vikram',
      dietType: 'vegetarian',
      allergies: ['shellfish'],
      healthGoals: ['muscle_gain']
    };

    const result = await generateResponse({
      message: 'What should I eat for high-protein vegetarian lunch?',
      userContext,
      conversationHistory: []
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.reply.length > 15, 'Reply must be populated');
    assert.ok(['ollama', 'foodiebite_deterministic_engine'].includes(result.source), 'Source must be ollama or deterministic engine');
    assert.ok(Array.isArray(result.options), 'Options must be an array');
  });

  // 11. Deterministic Fallback on Ollama Offline or Timeout
  await test('Fallback engine seamlessly triggers if Ollama is unreachable', async () => {
    const originalUrl = ollamaService.getBaseUrl();
    try {
      // Point to an invalid unreachable port to simulate offline Ollama
      ollamaService.setBaseUrl('http://localhost:59999');

      const fallbackResult = await generateResponse({
        message: 'Suggest a light dinner for acidity',
        userContext: { dietType: 'vegetarian', allergies: [] }
      });

      assert.strictEqual(fallbackResult.success, true);
      assert.strictEqual(fallbackResult.source, 'foodiebite_deterministic_engine');
      assert.ok(fallbackResult.reply.length > 0, 'Fallback reply must be returned seamlessly');
    } finally {
      ollamaService.setBaseUrl(originalUrl);
    }
  });

  // 12. AI Status Diagnostic Endpoint Functionality
  await test('getAIStatus provides transparent model details and readiness', async () => {
    const status = await getAIStatus();
    assert.ok(status.configuredProvider);
    assert.ok(status.ollama);
    assert.strictEqual(status.deterministicEngineReady, true);
  });

  console.log('\n============================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
