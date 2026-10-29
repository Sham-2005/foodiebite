// ─────────────────────────────────────────────────────────────
//  backend/src/ai/reasoningEngine.js
//  Phase 12 Multi-Step Deterministic Local Reasoning Engine
// ─────────────────────────────────────────────────────────────

const { inferImpliedConcepts, getFoodsForConcept } = require('./semanticKnowledge');
const { searchFood, getAllFoods, isAllergenPresent } = require('./foodKnowledge');
const { scoreFoodWithPriority, recommendFoods } = require('./recommendationEngine');

function performMultiStepReasoning({ rawMessage, userContext = {}, requestConstraints = {}, conversationHistory = [] }) {
  const steps = [];

  // Step 1: Detect implicit semantic concepts
  const impliedConcepts = inferImpliedConcepts(rawMessage);
  steps.push({ step: 1, action: 'Inferred semantic concepts', value: impliedConcepts });

  // Step 2: Combine constraints
  const combinedConstraints = { ...requestConstraints };
  if (impliedConcepts.includes('post-workout') || impliedConcepts.includes('high-protein')) {
    combinedConstraints.highProtein = true;
  }
  if (impliedConcepts.includes('light-meal')) {
    combinedConstraints.lightMeal = true;
  }
  steps.push({ step: 2, action: 'Synthesized constraints', value: combinedConstraints });

  // Step 3: Candidate recommendation execution
  const recResult = recommendFoods({
    userContext,
    requestConstraints: combinedConstraints,
    exclusions: requestConstraints.exclusions || [],
    mealType: combinedConstraints.mealType,
    limit: 3
  });
  steps.push({ step: 3, action: 'Recommendation pool filtered', success: recResult.success });

  // Step 4: Synthesize user-facing concise explanation
  const name = userContext.name || 'there';
  let explanation = '';

  if (recResult.success && recResult.recommendations && recResult.recommendations.length > 0) {
    const top = recResult.recommendations[0];
    explanation = `${top.name} fits your goal best because it is high in protein (${top.protein}g) and stays within your target (${top.calories} kcal).`;
  } else {
    explanation = "I evaluated your combination of goals and restrictions. Try relaxing calorie or dietary limits to see more options!";
  }

  return {
    success: recResult.success,
    reply: recResult.reply,
    recommendations: recResult.recommendations || [],
    explanation,
    confidence: recResult.success ? 0.92 : 0.40,
    internalSteps: steps
  };
}

module.exports = {
  performMultiStepReasoning
};
