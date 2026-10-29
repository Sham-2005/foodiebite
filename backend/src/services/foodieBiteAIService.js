// ─────────────────────────────────────────────────────────────
//  src/services/foodieBiteAIService.js
//  FoodieBite AI Engine — Local AI Service Layer (Zero External API)
// ─────────────────────────────────────────────────────────────

const foodieBiteAI = require('../ai/foodieBiteAI');

const FOODIEBITE_SYSTEM_PROMPT = `
You are FoodieBite AI — an AI food and nutrition assistant.
`;

/**
 * Primary response generator for FoodieBite AI Engine
 * Operates 100% locally via self-contained Node.js AI Engine
 */
async function generateResponse({ message, userContext = {}, conversationHistory = [] }) {
  try {
    // Guard invalid types
    const safeUserContext = (userContext && typeof userContext === 'object' && !Array.isArray(userContext)) ? userContext : {};
    const safeHistory = Array.isArray(conversationHistory) ? conversationHistory : [];

    const aiResult = await foodieBiteAI.processMessage({
      message,
      userContext: safeUserContext,
      conversationHistory: safeHistory
    });

    return {
      success: true,
      source: 'foodiebite_ai',
      reply: aiResult.reply,
      type: aiResult.type || 'text',
      options: Array.isArray(aiResult.options) ? aiResult.options : [],
      confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : 0.90,
      timing: aiResult.timing || {},
      metadata: aiResult.metadata || {},
      nearbyIntent: aiResult.nearbyIntent
    };
  } catch (err) {
    console.error('Local FoodieBite AI Engine execution error:', err.message);
    return {
      success: false,
      source: 'foodiebite_ai_error',
      reply: 'FoodieBite AI is temporarily unavailable. Please try again.',
      type: 'error',
      options: [],
      confidence: 0,
      timing: {},
      metadata: {}
    };
  }
}

module.exports = {
  generateResponse,
  FOODIEBITE_SYSTEM_PROMPT
};
