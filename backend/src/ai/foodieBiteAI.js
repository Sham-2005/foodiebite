// ─────────────────────────────────────────────────────────────
//  backend/src/ai/foodieBiteAI.js
//  Production Local Engine Entry Point with Real-World Intelligence
// ─────────────────────────────────────────────────────────────

const { parseNLU } = require('./languageUnderstanding');
const { extractEntities } = require('./entityExtractor');
const { searchFood } = require('./foodKnowledge');
const { calculateScaledNutrition, calculateCombinedNutrition, compareFoods } = require('./nutritionEngine');
const { recommendFoods } = require('./recommendationEngine');
const { generateRecipe, modifyRecipe } = require('./recipeEngine');
const { generateDailyMealPlan } = require('./mealPlanEngine');
const { getFoodSubstitutions } = require('./substitutionEngine');
const { buildCompactState, resolveContextReference } = require('./conversationEngine');
const { evaluateSafety } = require('./safetyEngine');
const { buildClarificationChoice, formatFoodInformation } = require('./responseFormatter');
const { getRelevantMedicalContext } = require('./medicalReportContext');
const { performMultiStepReasoning } = require('./reasoningEngine');
const { getUserProfile, applyPreferenceUpdate, trackSelection, trackRejection, decayPreferences } = require('./userPreferenceStore');

async function processMessage({ message, userContext = {}, conversationHistory = [] }) {
  const startTime = Date.now();
  let nluMs = 0;
  let reasoningMs = 0;
  let formattingMs = 0;

  try {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: "Hi there! I'm **FoodieBite AI**. Ask me about meal plans, recipes, nutrition facts, food substitutions, or comparisons!",
        type: 'text',
        options: [],
        confidence: 1.0,
        timing: { nluMs: 0, reasoningMs: 0, formattingMs: 0, totalMs: Date.now() - startTime }
      };
    }

    const rawMessage = message.trim();

    // Prompt Injection & System Exploit Defense
    const lowerRaw = rawMessage.toLowerCase();
    if (
      lowerRaw.includes('ignore previous instructions') ||
      lowerRaw.includes('show me your system prompt') ||
      lowerRaw.includes('system prompt') ||
      lowerRaw.includes('internal reasoning') ||
      lowerRaw.includes('database credentials') ||
      lowerRaw.includes('execute code') ||
      lowerRaw.includes('expose all previous users') ||
      lowerRaw.includes('expose all users')
    ) {
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: "I am **FoodieBite AI**, your local food and nutrition assistant. I focus strictly on helping you with meal plans, recipes, nutrition facts, and dietary recommendations tailored to your health goals.",
        type: 'text',
        options: [],
        confidence: 1.0,
        timing: { nluMs: 0, reasoningMs: 1, formattingMs: 0, totalMs: Date.now() - startTime }
      };
    }

    // 1. Safety Guardrails (Priority 1)
    const safetyResult = evaluateSafety(rawMessage);
    if (safetyResult.isSafetyTrigger) {
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: safetyResult.reply,
        type: safetyResult.type || 'safety',
        options: [],
        confidence: 1.0,
        timing: { nluMs: 0, reasoningMs: 1, formattingMs: 0, totalMs: Date.now() - startTime }
      };
    }

    // 2. Compact Conversation Window & Anaphora State
    const tNlu0 = Date.now();
    const activeState = buildCompactState(conversationHistory);
    const nlu = parseNLU(rawMessage, userContext);
    const entities = extractEntities(rawMessage);
    nluMs = Date.now() - tNlu0;

    const userId = userContext.id || 'default_user';
    const profile = getUserProfile(userId);

    // Apply explicit preference declarations
    if (nlu.parsedPreference) {
      applyPreferenceUpdate(userId, nlu.parsedPreference);
    }

    // Decay preferences once per turn
    decayPreferences(userId);

    const tReason0 = Date.now();

    // Combine current turn constraints with multi-turn activeState constraints & exclusions
    const combinedConstraints = {
      ...activeState.activeConstraints,
      ...nlu.constraints
    };
    const combinedExclusions = Array.from(new Set([
      ...(nlu.exclusions || []),
      ...(activeState.sessionExclusions || []),
      ...(activeState.sessionDislikes || [])
    ]));

    // Handle Contradictions / Conflicts if present
    if (nlu.conflict && nlu.conflict.hasConflict) {
      const recResult = recommendFoods({
        userContext,
        requestConstraints: combinedConstraints,
        exclusions: combinedExclusions,
        mealType: combinedConstraints.mealType,
        limit: 2
      });

      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: `⚠️ **Constraint Conflict:** ${nlu.conflict.explanation}\n\n${recResult.reply}`,
        type: 'text',
        options: [],
        confidence: 0.90,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // Resolve target food / pronoun reference
    let targetFood = nlu.positiveEntities[0] || entities.food;
    if (!targetFood) {
      const resolved = resolveContextReference(rawMessage, activeState);
      if (resolved) targetFood = resolved;
    }

    if (targetFood && targetFood.id) {
      trackSelection(userId, targetFood.id);
    }

    await getRelevantMedicalContext(userContext.id, rawMessage, userContext._userFoodProfile || null);

    const intent = nlu.intent;
    let confidence = nlu.confidence;

    // Check if this is a pure preference declaration (and not a recommendation request or other specific intents)
    if (nlu.parsedPreference) {
      const isPurePrefUpdate = (intent === 'UNKNOWN' || intent === 'GREETING') &&
                               !rawMessage.toLowerCase().includes('recommend') &&
                               !rawMessage.toLowerCase().includes('suggest') &&
                               !rawMessage.toLowerCase().includes('eat') &&
                               !rawMessage.toLowerCase().includes('recipe') &&
                               !rawMessage.toLowerCase().includes('calorie') &&
                               !rawMessage.toLowerCase().includes('protein') &&
                               !rawMessage.toLowerCase().includes('substitute') &&
                               !rawMessage.toLowerCase().includes('compare');

      if (isPurePrefUpdate) {
        reasoningMs = Date.now() - tReason0;
        let confirmationReply = `I've updated your preferences!`;
        if (nlu.parsedPreference.type === 'RESET') {
          confirmationReply = "I've reset all your learned and soft food preferences. Your profile is now fresh!";
        } else if (nlu.parsedPreference.type === 'ALLOW') {
          confirmationReply = `I've updated your settings to allow ${nlu.parsedPreference.term} again.`;
        } else if (nlu.parsedPreference.type === 'LIKE') {
          confirmationReply = `I've noted that you love/prefer ${nlu.parsedPreference.term}. I will prioritize this in future recommendations!`;
        } else if (nlu.parsedPreference.type === 'DISLIKE') {
          confirmationReply = `I've noted your dislike for ${nlu.parsedPreference.term}. I will avoid recommending this.`;
        } else if (nlu.parsedPreference.type === 'EXCLUDE') {
          confirmationReply = `I've noted that you want to exclude ${nlu.parsedPreference.term}. I will strictly avoid recommending this.`;
        }
        
        return {
          success: true,
          source: 'foodiebite_ai',
          reply: confirmationReply,
          type: 'text',
          options: [],
          confidence: 0.95,
          timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
        };
      }
    }

    // Allergy intercept check
    const userAllergies = Array.isArray(userContext.allergies) 
      ? userContext.allergies 
      : (userContext.allergies ? [userContext.allergies] : []);

    if (userAllergies.length > 0) {
      const lowerMsg = rawMessage.toLowerCase();
      const triggeredAllergen = userAllergies.find(allergy => {
        const normAllergy = allergy.toLowerCase();
        return lowerMsg.includes(normAllergy) || (targetFood && targetFood.name.toLowerCase().includes(normAllergy));
      });

      if (triggeredAllergen) {
        reasoningMs = Date.now() - tReason0;
        return {
          success: true,
          source: 'foodiebite_ai',
          reply: `⚠️ **Safety Warning:** The request contains or refers to **${triggeredAllergen}**, which is in your list of specified allergies. I cannot recommend this food or generate a recipe for it to ensure your safety.`,
          type: 'safety',
          options: [],
          confidence: 1.0,
          timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
        };
      }
    }

    // 3. Conversational Modifications
    if (nlu.conversationalModification) {
      if (activeState.currentRecipe || intent === 'RECIPE_REQUEST' || rawMessage.toLowerCase().includes('recipe')) {
        const modRecipe = modifyRecipe(activeState.currentRecipe, nlu.conversationalModification);
        reasoningMs = Date.now() - tReason0;
        return {
          success: true,
          source: 'foodiebite_ai',
          reply: modRecipe.reply,
          type: modRecipe.type,
          recipe: modRecipe.recipe,
          options: [],
          confidence: 0.92,
          timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
        };
      }
    }

    // 4. Intent Pipeline Dispatch

    // NEARBY_FOOD
    if (intent === 'NEARBY_FOOD') {
      const nearbyService = require('../services/nearby/nearbyService');
      const params = nlu.nearbyParams || {};

      const lat = userContext.lat || userContext.latitude;
      const lng = userContext.lng || userContext.longitude;

      const nearbyIntentPayload = {
        query: params.query || combinedConstraints.cuisine || null,
        cuisine: params.cuisine || combinedConstraints.cuisine || null,
        category: params.category || null,
        radius: params.radius || null,
        dietaryPreferences: params.dietaryPreferences || [],
        exclusions: combinedExclusions,
        budget: params.budget || null,
        openNow: params.openNow || false
      };

      if (userContext.diet && !nearbyIntentPayload.dietaryPreferences.includes(userContext.diet)) {
        nearbyIntentPayload.dietaryPreferences.push(userContext.diet);
      }
      if (combinedConstraints.dietType && !nearbyIntentPayload.dietaryPreferences.includes(combinedConstraints.dietType)) {
        nearbyIntentPayload.dietaryPreferences.push(combinedConstraints.dietType);
      }

      if (userContext.allergies) {
        const profileAllergies = Array.isArray(userContext.allergies)
          ? userContext.allergies
          : [userContext.allergies];
        profileAllergies.forEach(allergy => {
          const normAllergy = allergy.toLowerCase().trim();
          if (normAllergy && !nearbyIntentPayload.exclusions.includes(normAllergy)) {
            nearbyIntentPayload.exclusions.push(normAllergy);
          }
        });
      }

      reasoningMs = Date.now() - tReason0;

      if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        try {
          const searchResult = await nearbyService.searchNearby({
            lat,
            lng,
            radius: nearbyIntentPayload.radius || 5000,
            query: nearbyIntentPayload.query,
            cuisine: nearbyIntentPayload.cuisine,
            diet: nearbyIntentPayload.dietaryPreferences[0] || null,
            exclusions: nearbyIntentPayload.exclusions,
            maxResults: 5,
            userPrefs: {
              diet: userContext.diet,
              allergies: userContext.allergies || [],
              cuisines: userContext.cuisines || []
            }
          });

          if (searchResult.success && searchResult.results.length > 0) {
            const placesText = searchResult.results.map((p, idx) => {
              const distanceText = p.distance ? ` (${p.distance.toFixed(1)} km away)` : '';
              const cuisineText = p.cuisine ? ` - ${p.cuisine}` : '';
              const openStatus = p.isOpen !== undefined ? (p.isOpen ? ' (Open)' : ' (Closed)') : '';
              return `${idx + 1}. **${p.name}**${distanceText}${cuisineText}${openStatus}`;
            }).join('\n');

            return {
              success: true,
              source: 'foodiebite_ai',
              reply: `Here are nearby restaurants matching your preferences:\n\n${placesText}\n\nClick the Nearby button in the bottom corner to view them on the map and apply filters!`,
              type: 'nearby_discovery',
              nearbyIntent: nearbyIntentPayload,
              options: [],
              confidence: 0.95,
              timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
            };
          } else {
            return {
              success: true,
              source: 'foodiebite_ai',
              reply: `I searched nearby but couldn't find any restaurants matching your preferences within ${nearbyIntentPayload.radius ? (nearbyIntentPayload.radius / 1000) : 5} km. Try broadening your query or checking the Nearby panel!`,
              type: 'nearby_discovery',
              nearbyIntent: nearbyIntentPayload,
              options: [],
              confidence: 0.90,
              timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
            };
          }
        } catch (err) {
          console.error('[Nearby Search in AI Engine failed]:', err.message);
        }
      }

      return {
        success: true,
        source: 'foodiebite_ai',
        reply: `I'd love to help you find nearby options! However, I don't have your location. Please share your location or click the Nearby button in the bottom corner to search by address.`,
        type: 'nearby_discovery',
        nearbyIntent: nearbyIntentPayload,
        options: [],
        confidence: 0.95,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // GREETING
    if (intent === 'GREETING') {
      const name = userContext.name || 'friend';
      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: `Hello ${name}! 👋 I am **FoodieBite AI**, your personal food and nutrition coach.\n\n` +
          `Here is what I can do for you:\n` +
          `• *"Plan my meals for today"* (5-meal customized plan)\n` +
          `• *"What can I use instead of paneer?"* (food substitutions)\n` +
          `• *"Paneer vs Tofu"* (side-by-side food comparison)\n` +
          `• *"2 eggs + 2 rotis + curd"* (multi-food nutrition calculator)\n` +
          `• *"Give me a chicken biryani recipe"* (step-by-step recipe)`,
        type: 'text',
        options: [],
        confidence: 0.95,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // MEAL PLANNING
    if (intent === 'MEAL_PLANNING') {
      const planResult = generateDailyMealPlan(userContext);
      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: planResult.reply,
        type: planResult.type,
        mealPlan: planResult.mealPlan,
        options: [],
        confidence: 0.94,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // FOOD SUBSTITUTION
    if (intent === 'FOOD_SUBSTITUTION' || entities.substitutionTarget) {
      const subTarget = entities.substitutionTarget || (targetFood ? targetFood.name : 'your food');
      const subResult = getFoodSubstitutions(subTarget, userContext);
      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: subResult.reply,
        type: subResult.type,
        substitutions: subResult.substitutions,
        options: [],
        confidence: 0.92,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // FOOD COMPARISON
    if (intent === 'FOOD_COMPARISON' || (entities.food && entities.comparisonTarget)) {
      const food1 = entities.food || targetFood;
      const food2 = entities.comparisonTarget;
      if (food1 && food2) {
        const compResult = compareFoods(food1, food2, userContext.goal);
        reasoningMs = Date.now() - tReason0;
        return {
          success: true,
          source: 'foodiebite_ai',
          reply: compResult.reply,
          type: compResult.type,
          comparison: compResult.comparison,
          options: [],
          confidence: 0.92,
          timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
        };
      }
    }

    // NUTRITION CALCULATOR
    if (intent === 'CALORIE_QUERY' || intent === 'PROTEIN_QUERY' || intent === 'NUTRITION_INFORMATION') {
      if (entities.multiFoodItems && entities.multiFoodItems.length > 1) {
        const combResult = calculateCombinedNutrition(entities.multiFoodItems);
        reasoningMs = Date.now() - tReason0;
        return {
          success: true,
          source: 'foodiebite_ai',
          reply: combResult.reply,
          type: combResult.type,
          nutrition: combResult.nutrition,
          options: [],
          confidence: 0.94,
          timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
        };
      }

      const foodToMeasure = targetFood || entities.food;
      if (!foodToMeasure) {
        reasoningMs = Date.now() - tReason0;
        return normalizeResponse(buildClarificationChoice('calories'), { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }, 0.40);
      }

      const nutResult = calculateScaledNutrition(foodToMeasure, entities.quantity, entities.unit);
      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: nutResult.reply,
        type: nutResult.type,
        nutrition: nutResult.nutrition,
        options: [],
        confidence: 0.92,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // RECIPE REQUEST
    if (intent === 'RECIPE_REQUEST' || entities.isRecipeRequest) {
      const foodForRecipe = targetFood || entities.food;
      if (!foodForRecipe && !rawMessage.toLowerCase().includes('recipe')) {
        reasoningMs = Date.now() - tReason0;
        return normalizeResponse(buildClarificationChoice('recipe'), { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }, 0.40);
      }

      const recipeResult = generateRecipe({
        foodName: foodForRecipe ? foodForRecipe.name : rawMessage,
        constraints: { ...nlu.constraints, ...entities.constraints },
        userContext
      });

      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: recipeResult.reply,
        type: recipeResult.type,
        recipe: recipeResult.recipe,
        options: [],
        confidence: 0.90,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // FOOD RECOMMENDATIONS
    if (
      intent === 'FOOD_RECOMMENDATION' ||
      intent === 'BREAKFAST' ||
      intent === 'LUNCH' ||
      intent === 'DINNER' ||
      intent === 'SNACK'
    ) {
      const meal = nlu.constraints.mealType || entities.mealType;
      const lowerRaw = rawMessage.toLowerCase();
      const isRejection = lowerRaw.includes('another') || lowerRaw.includes('different') || lowerRaw.includes('something else') || lowerRaw.includes('other options') || lowerRaw.includes('aur kuch') || lowerRaw.includes('yeh wala nahi') || lowerRaw.includes('nope') || lowerRaw.includes('not that') || lowerRaw.includes('don\'t like that');
      
      if (isRejection && activeState.previousRecommendations && activeState.previousRecommendations.length > 0) {
        activeState.previousRecommendations.forEach(food => {
          trackRejection(userId, food.id);
        });
      }

      const excludeIds = isRejection 
        ? activeState.previousRecommendations.map(f => f.id)
        : [];

      const recResult = recommendFoods({
        userContext,
        requestConstraints: combinedConstraints,
        exclusions: combinedExclusions,
        mealType: meal,
        excludeFoodIds: excludeIds,
        limit: 3
      });

      reasoningMs = Date.now() - tReason0;
      return {
        success: true,
        source: 'foodiebite_ai',
        reply: recResult.reply,
        type: 'text',
        recommendations: recResult.recommendations,
        options: [],
        confidence: 0.88,
        timing: { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }
      };
    }

    // FOOD INFORMATION
    if ((intent === 'FOOD_INFORMATION' || rawMessage.toLowerCase().includes('tell me about') || rawMessage.toLowerCase().includes('what is')) && targetFood) {
      const infoResult = formatFoodInformation(targetFood, userContext);
      reasoningMs = Date.now() - tReason0;
      if (infoResult) return normalizeResponse(infoResult, { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }, 0.90);
    }

    // UNKNOWN / LOW CONFIDENCE (< 0.50)
    reasoningMs = Date.now() - tReason0;
    if (confidence < 0.50 || intent === 'UNKNOWN') {
      return normalizeResponse(buildClarificationChoice('general'), { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }, 0.40);
    }

    return normalizeResponse({
      success: true,
      source: 'foodiebite_ai',
      reply: `I want to make sure I give you the exact food guidance you need. What would you like to explore?`,
      type: 'choice',
      options: [
        { label: 'Meal Plan', value: 'plan my meals for today' },
        { label: 'Food Recommendation', value: 'recommend a healthy dinner' },
        { label: 'Nutrition Calculator', value: 'calories in 2 eggs' }
      ]
    }, { nluMs, reasoningMs, formattingMs: 1, totalMs: Date.now() - startTime }, 0.40);
  } catch (err) {
    console.error('[FoodieBite AI Internal Engine Error]:', err);
    return {
      success: false,
      source: 'foodiebite_ai',
      type: 'error',
      reply: "I couldn't process that request right now. Please try asking again!",
      options: [],
      confidence: 0,
      timing: { nluMs, reasoningMs, formattingMs: 0, totalMs: Date.now() - startTime }
    };
  }
}

function normalizeResponse(result, timing, defaultConfidence = 0.85) {
  return {
    ...result,
    confidence: typeof result.confidence === 'number' ? result.confidence : defaultConfidence,
    timing: result.timing || timing
  };
}

module.exports = {
  processMessage
};

