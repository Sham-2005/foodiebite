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

// Interactive timeout SLA for primary AI inference (configurable via env)
const COACH_PRIMARY_TIMEOUT_MS = parseInt(process.env.COACH_PRIMARY_TIMEOUT_MS, 10) || 4000;

/**
 * Detects whether an LLM output is a refusal or non-informative response.
 */
function isRefusalOrEmpty(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < 15) return true;
  const lower = trimmed.toLowerCase();
  const refusalPhrases = [
    "i'm sorry, but i can't assist",
    "i cannot assist with that",
    "i can't assist with that",
    "as an ai",
    "i am not able to assist",
    "i cannot help with that",
    "i am unable to provide",
    "not programmed to assist"
  ];
  return refusalPhrases.some(p => lower.includes(p));
}

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

        // 4. Request completion from Ollama with proactive SLA timeout race
        const primaryTimeoutMs = Math.min(
          parseInt(process.env.COACH_PRIMARY_TIMEOUT_MS, 10) || COACH_PRIMARY_TIMEOUT_MS,
          ollamaService.timeoutMs || 4000
        );

        let timeoutHandle = null;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            const err = new Error(`Primary Ollama inference exceeded interactive timeout threshold (${primaryTimeoutMs}ms)`);
            err.code = 'OLLAMA_TIMEOUT';
            reject(err);
          }, primaryTimeoutMs);
          if (timeoutHandle && timeoutHandle.unref) timeoutHandle.unref();
        });

        const chatPromise = ollamaService.chat({
          messages: ollamaMessages,
          system: systemPrompt,
          options: {
            temperature: 0.35,
            num_predict: 256
          },
          timeout: primaryTimeoutMs
        });
        // Prevent unhandled promise rejection if timeoutPromise wins the race
        chatPromise.catch(() => {});

        const ollamaResult = await Promise.race([chatPromise, timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        // Quality check: Guard against generic refusals or empty model output
        if (isRefusalOrEmpty(ollamaResult.content)) {
          const warnMsg = (ollamaResult.content || '').substring(0, 80).replace(/\n/g, ' ');
          throw new Error(`Primary AI model returned refusal or non-informative response: "${warnMsg}"`);
        }

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
      console.log(`ℹ️ [FoodieBiteAI] Primary inference unavailable or exceeded SLA (${ollamaErr.message}). Activating deterministic engine fallback...`);
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
      source: aiResult.source || 'foodiebite_deterministic_engine',
      provider: aiResult.provider || 'deterministic_engine',
      model: aiResult.model || 'foodiebite-rule-v2',
      reply: aiResult.reply,
      type: aiResult.type || (aiResult.options && aiResult.options.length > 0 ? 'choice' : 'text'),
      options: Array.isArray(aiResult.options) ? aiResult.options : [],
      recommendations: Array.isArray(aiResult.recommendations) ? aiResult.recommendations : [],
      confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : 0.92,
      timing: aiResult.timing || { totalMs: Date.now() - t0, fallbackMs: Date.now() - t0 },
      metadata: aiResult.metadata || {},
      clinicalDetails: aiResult.clinicalDetails,
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
      options: Array.isArray(safeFallback.options) ? safeFallback.options : [],
      recommendations: Array.isArray(safeFallback.recommendations) ? safeFallback.recommendations : [],
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
    deterministicEngineReady: true,
    coachPrimaryTimeoutMs: COACH_PRIMARY_TIMEOUT_MS
  };
}

module.exports = {
  generateResponse,
  getAIStatus,
  FOODIEBITE_SYSTEM_PROMPT
};
