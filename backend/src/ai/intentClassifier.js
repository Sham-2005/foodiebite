// ─────────────────────────────────────────────────────────────
//  backend/src/ai/intentClassifier.js
//  Production Natural Language Intent Classifier for FoodieBite AI Engine
// ─────────────────────────────────────────────────────────────

const INTENTS = {
  GREETING: 'GREETING',
  FOOD_INFORMATION: 'FOOD_INFORMATION',
  FOOD_RECOMMENDATION: 'FOOD_RECOMMENDATION',
  RECIPE_REQUEST: 'RECIPE_REQUEST',
  NUTRITION_INFORMATION: 'NUTRITION_INFORMATION',
  CALORIE_QUERY: 'CALORIE_QUERY',
  PROTEIN_QUERY: 'PROTEIN_QUERY',
  MEAL_PLANNING: 'MEAL_PLANNING',
  BREAKFAST: 'BREAKFAST',
  LUNCH: 'LUNCH',
  DINNER: 'DINNER',
  SNACK: 'SNACK',
  INGREDIENT_QUERY: 'INGREDIENT_QUERY',
  FOOD_COMPARISON: 'FOOD_COMPARISON',
  FOOD_SUBSTITUTION: 'FOOD_SUBSTITUTION',
  DIET_QUERY: 'DIET_QUERY',
  ALLERGY_QUERY: 'ALLERGY_QUERY',
  GOAL_QUERY: 'GOAL_QUERY',
  SAFETY_TRIGGER: 'SAFETY_TRIGGER',
  NEARBY_FOOD: 'NEARBY_FOOD',
  UNKNOWN: 'UNKNOWN'
};

const PHRASING_PATTERNS = [
  // NEARBY_FOOD
  {
    intent: INTENTS.NEARBY_FOOD,
    patterns: [
      /near me/i, /nearby/i, /around me/i, /around here/i, /close by/i, /within \d+/i, /restaurants near/i, /places to eat near/i, /food near/i, /find.*nearby/i
    ],
    weight: 4.5
  },
  // MEAL_PLANNING
  {
    intent: INTENTS.MEAL_PLANNING,
    patterns: [
      /plan.*meal/i, /meal.*plan/i, /plan.*today/i, /daily.*plan/i, /what.*eat.*all.*day/i, /menu.*for.*today/i
    ],
    weight: 3.5
  },
  // FOOD_SUBSTITUTION
  {
    intent: INTENTS.FOOD_SUBSTITUTION,
    patterns: [
      /instead of/i, /replace/i, /alternative/i, /substitute/i, /swap/i, /replacement for/i, /other than/i
    ],
    weight: 3.5
  },
  // FOOD_COMPARISON
  {
    intent: INTENTS.FOOD_COMPARISON,
    patterns: [
      /\bvs\b/i, /\bversus\b/i, /compared to/i, /which is healthier/i, /which is better/i, /difference between/i
    ],
    weight: 3.5
  },
  // RECIPE_REQUEST
  {
    intent: INTENTS.RECIPE_REQUEST,
    patterns: [
      /recipe/i, /how.*make/i, /how.*cook/i, /how.*prepare/i, /ingredients.*for/i, /show me.*recipe/i, /recipe.*using/i, /dish.*prep/i
    ],
    weight: 3.2
  },
  // PROTEIN_QUERY
  {
    intent: INTENTS.PROTEIN_QUERY,
    patterns: [
      /protein/i, /how much protein/i, /grams of protein/i, /protein content/i
    ],
    weight: 3.0
  },
  // CALORIE_QUERY
  {
    intent: INTENTS.CALORIE_QUERY,
    patterns: [
      /calorie/i, /calories/i, /how many calories/i, /calorie count/i, /caloric value/i
    ],
    weight: 3.0
  },
  // NUTRITION_INFORMATION
  {
    intent: INTENTS.NUTRITION_INFORMATION,
    patterns: [
      /nutrition/i, /nutritional/i, /macros/i, /macronutrients/i, /carbs/i, /fiber/i, /fat count/i
    ],
    weight: 2.8
  },
  // FOOD_RECOMMENDATION
  {
    intent: INTENTS.FOOD_RECOMMENDATION,
    patterns: [
      /suggest/i, /recommend/i, /what.*eat/i, /what.*have/i, /give me something/i, /options for/i, /idea for/i, /something healthy/i, /don't know what to eat/i, /tonight/i
    ],
    weight: 2.6
  },
  // FOOD_INFORMATION
  {
    intent: INTENTS.FOOD_INFORMATION,
    patterns: [
      /tell me about/i, /tell me something about/i, /what is/i, /explain/i, /want to know about/i, /information on/i, /what exactly is/i, /details of/i
    ],
    weight: 2.5
  },
  // GREETING
  {
    intent: INTENTS.GREETING,
    patterns: [
      /^(hi|hello|hey|namaste|greetings|good morning|good evening)$/i, /who are you/i
    ],
    weight: 3.0
  }
];

function normalizeInput(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyIntent(text, extractedEntities = {}) {
  const norm = normalizeInput(text);
  if (!norm) return { intent: INTENTS.UNKNOWN, confidence: 0.0 };

  // Direct pattern matching score matrix
  const scores = {};
  Object.keys(INTENTS).forEach(i => (scores[i] = 0));

  for (const group of PHRASING_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(norm) || pattern.test(text)) {
        scores[group.intent] += group.weight;
      }
    }
  }

  // Boost based on extracted entities & explicit terms
  if (norm.includes('nearby') || norm.includes('near me') || norm.includes('close by') || norm.includes('around here') || norm.includes('around me')) {
    scores[INTENTS.NEARBY_FOOD] += 5.0;
  }

  if (extractedEntities.comparisonTarget || norm.includes(' vs ') || norm.includes(' versus ') || norm.includes('compare') || norm.includes('comparison')) {
    scores[INTENTS.FOOD_COMPARISON] += 4.0;
  }

  if (norm.includes('suggest') || norm.includes('recommend') || norm.includes('options for') || norm.includes('what should i eat') || norm.includes('what can i eat')) {
    scores[INTENTS.FOOD_RECOMMENDATION] += 3.5;
  }

  if (norm.includes('meal plan') || norm.includes('plan my meals') || norm.includes('plan meals')) {
    scores[INTENTS.MEAL_PLANNING] += 4.0;
  }

  if (norm.includes('instead of') || norm.includes('replace') || norm.includes('alternative')) {
    scores[INTENTS.FOOD_SUBSTITUTION] += 4.0;
  }

  if (extractedEntities.isRecipeRequest) {
    scores[INTENTS.RECIPE_REQUEST] += 3.0;
  }

  // Meal types specificity
  if (norm.includes('breakfast') && scores[INTENTS.MEAL_PLANNING] === 0) scores[INTENTS.BREAKFAST] += 1.5;
  if (norm.includes('dinner') && scores[INTENTS.MEAL_PLANNING] === 0) scores[INTENTS.DINNER] += 1.5;
  if (norm.includes('lunch') && scores[INTENTS.MEAL_PLANNING] === 0) scores[INTENTS.LUNCH] += 1.5;
  if (norm.includes('snack') && scores[INTENTS.MEAL_PLANNING] === 0) scores[INTENTS.SNACK] += 1.5;

  let topIntent = INTENTS.UNKNOWN;
  let maxScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topIntent = intent;
    }
  }

  // Fallback heuristics
  if (extractedEntities.food) {
    if (topIntent === INTENTS.UNKNOWN || topIntent === INTENTS.FOOD_INFORMATION) {
      topIntent = INTENTS.FOOD_INFORMATION;
      maxScore = Math.max(maxScore, 2.8);
    }
  } else if (
    topIntent === INTENTS.UNKNOWN &&
    (norm.includes('eat') ||
      norm.includes('food') ||
      norm.includes('tonight') ||
      norm.includes('make it') ||
      norm.includes('actually') ||
      norm.includes('something') ||
      norm.includes('south indian') ||
      norm.includes('north indian') ||
      norm.includes('chinese') ||
      norm.includes('italian') ||
      norm.includes('mexican') ||
      norm.includes('different') ||
      norm.includes('another') ||
      norm.includes('cheaper') ||
      norm.includes('dinner') ||
      norm.includes('lunch') ||
      norm.includes('breakfast') ||
      norm.includes('snack'))
  ) {
    topIntent = INTENTS.FOOD_RECOMMENDATION;
    maxScore = 2.5;
  }

  let confidence = Math.min(0.95, maxScore / 3.2);
  if (confidence < 0.35) {
    topIntent = INTENTS.UNKNOWN;
    confidence = 0.30;
  }

  return {
    intent: topIntent,
    confidence: Number(confidence.toFixed(2))
  };
}

module.exports = {
  INTENTS,
  classifyIntent
};
