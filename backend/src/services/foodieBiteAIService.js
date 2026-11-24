// ─────────────────────────────────────────────────────────────
//  backend/src/services/foodieBiteAIService.js
//  FoodieBite Unified AI Service Layer (Ollama Local Intelligence + Fallback)
//  Connects to locally running Ollama with Food Database Grounding
//  Zero Cloud AI & Zero External API Dependencies
// ─────────────────────────────────────────────────────────────

'use strict';

const foodieBiteAI = require('../ai/foodieBiteAI');
const ollamaService = require('./ollamaService');
const {
  getGroundedFoodCandidates,
  buildGroundedSystemPrompt,
  validateGroundedResponse,
  buildDeterministicFallback
} = require('./groundedRecommendationService');

const FOODIEBITE_SYSTEM_PROMPT = `
You are FoodieBite AI — an intelligent, context-aware food and nutrition assistant.
`;

/**
 * Extracts query intent keywords for food candidate retrieval
 */
function extractQueryKeywords(message) {
  if (!message || typeof message !== 'string') return {};
  const lower = message.toLowerCase();

  const keywords = [];
  const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

  // Common food and nutrition cues
  const foodTerms = [
    'breakfast', 'lunch', 'dinner', 'snack', 'supper', 'morning', 'evening', 'night',
    'protein', 'carb', 'calorie', 'fiber', 'diet', 'weight', 'muscle',
    'vegan', 'veg', 'vegetarian', 'salad', 'paneer', 'chicken', 'egg', 'curry',
    'soup', 'fruit', 'nut', 'oats', 'rice', 'dosa', 'idli', 'roti', 'dal', 'healthy',
    'sweet', 'spicy', 'light', 'heavy', 'warm', 'cold', 'refreshing'
  ];

  for (const term of foodTerms) {
    if (lower.includes(term)) keywords.push(term);
  }

  let mealType = '';
  if (lower.includes('breakfast') || lower.includes('morning')) mealType = 'breakfast';
  else if (lower.includes('lunch') || lower.includes('afternoon')) mealType = 'lunch';
  else if (lower.includes('dinner') || lower.includes('night') || lower.includes('evening')) mealType = 'dinner';
  else if (lower.includes('snack')) mealType = 'snack';

  return {
    keywords,
    mealType,
    isHighProtein: lower.includes('protein') || lower.includes('muscle'),
    isLowCarb: lower.includes('low carb') || lower.includes('keto') || lower.includes('weight loss')
  };
}

/**
 * Primary response generator for FoodieBite AI Engine
 * 1. If AI_PROVIDER=ollama (or default in local dev) and Ollama is available:
 *    - Grounds response in verified FoodieBite food database
 *    - Executes local inference via Ollama (e.g. Qwen 2.5, Llama 3.2)
 *    - Validates output against actual food items (zero hallucination)
 * 2. If Ollama is offline or model is missing:
 *    - Falls back instantly and deterministically to local FoodieBite AI engine
 */
async function generateResponse({ message, userContext = {}, conversationHistory = [] }) {
  const t0 = Date.now();
  const safeUserContext = (userContext && typeof userContext === 'object' && !Array.isArray(userContext)) ? userContext : {};
  const safeHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
  const configuredProvider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();

  // ── ATTEMPT OLLAMA PROVIDER ────────────────────────────────
  if (configuredProvider === 'ollama' || configuredProvider === 'local_ollama') {
    try {
      // Check Ollama status
      const status = await ollamaService.checkConnection(2000);

      if (status.connected && status.modelAvailable) {
        // 1. Ground candidates from database
        const queryContext = extractQueryKeywords(message);
        const candidates = getGroundedFoodCandidates(
          safeUserContext,
          queryContext,
          safeUserContext.contextProfile
        );

        // 2. Build grounded system prompt
        const systemPrompt = buildGroundedSystemPrompt({
          userProfile: safeUserContext,
          candidates,
          contextProfile: safeUserContext.contextProfile
        });

        // 3. Prepare messages for Ollama chat
        const ollamaMessages = [];
        // Add recent conversation history for memory
        const recentHistory = safeHistory.slice(-4);
        for (const h of recentHistory) {
          if (h && h.text) {
            ollamaMessages.push({
              role: (h.sender === 'user' || h.role === 'user') ? 'user' : 'assistant',
              content: h.text
            });
          }
        }
        // Current user message
        ollamaMessages.push({
          role: 'user',
          content: message
        });

        // 4. Request completion from Ollama
        const ollamaResult = await ollamaService.chat({
          messages: ollamaMessages,
          system: systemPrompt,
          options: {
            temperature: 0.35,
            num_predict: 800
          },
          timeout: ollamaService.timeoutMs || 30000
        });

        // 5. Validate output against grounded food candidates
        const validated = validateGroundedResponse(ollamaResult.content, candidates);

        return {
          success: true,
          source: 'ollama',
          provider: 'ollama',
          model: ollamaResult.model || ollamaService.getSelectedModel(),
          reply: validated.reply,
          recommendations: validated.recommendations || [],
          type: (validated.options && validated.options.length > 0) ? 'choice' : 'text',
          options: validated.options || [],
          confidence: 0.95,
          timing: {
            ollamaMs: ollamaResult.latencyMs || (Date.now() - t0),
            totalMs: Date.now() - t0
          },
          metadata: {
            groundedCandidatesCount: candidates.length,
            model: ollamaResult.model,
            provider: 'ollama'
          }
        };
      } else {
        console.log(`ℹ️ [FoodieBiteAI] Ollama status is "${status.status}". Activating deterministic engine fallback...`);
      }
    } catch (ollamaErr) {
      console.warn(`⚠️ [FoodieBiteAI] Ollama execution failed (${ollamaErr.message}). Activating deterministic engine fallback...`);
    }
  }

  // ── DETERMINISTIC LOCAL ENGINE FALLBACK ─────────────────────
  try {
    const aiResult = await foodieBiteAI.processMessage({
      message,
      userContext: safeUserContext,
      conversationHistory: safeHistory
    });

    return {
      success: true,
      source: 'foodiebite_deterministic_engine',
      provider: 'deterministic_engine',
      model: 'foodiebite-rule-v2',
      reply: aiResult.reply,
      type: aiResult.type || 'text',
      options: Array.isArray(aiResult.options) ? aiResult.options : [],
      confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : 0.90,
      timing: aiResult.timing || { totalMs: Date.now() - t0 },
      metadata: aiResult.metadata || {},
      nearbyIntent: aiResult.nearbyIntent
    };
  } catch (err) {
    console.error('Local FoodieBite AI Engine execution error:', err.message);

    // Guaranteed safe fallback
    const queryContext = extractQueryKeywords(message);
    const candidates = getGroundedFoodCandidates(safeUserContext, queryContext, safeUserContext.contextProfile);
    const safeFallback = buildDeterministicFallback(candidates);

    return {
      success: true,
      source: 'foodiebite_safe_fallback',
      provider: 'safe_fallback',
      model: 'deterministic-static',
      reply: safeFallback.reply,
      type: 'choice',
      options: safeFallback.options,
      confidence: 0.85,
      timing: { totalMs: Date.now() - t0 },
      metadata: {}
    };
  }
}

/**
 * Checks system-wide AI provider status
 */
async function getAIStatus() {
  const ollamaStatus = await ollamaService.checkConnection(2000);
  return {
    configuredProvider: process.env.AI_PROVIDER || 'ollama',
    ollama: ollamaStatus,
    activeProvider: (ollamaStatus.connected && ollamaStatus.modelAvailable) ? 'ollama' : 'foodiebite_deterministic_engine',
    model: ollamaStatus.selectedModel || 'qwen2.5:0.5b',
    deterministicEngineReady: true
  };
}

module.exports = {
  generateResponse,
  getAIStatus,
  FOODIEBITE_SYSTEM_PROMPT
};
