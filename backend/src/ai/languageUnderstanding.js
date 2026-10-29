// ─────────────────────────────────────────────────────────────
//  backend/src/ai/languageUnderstanding.js
//  Local Natural Language Understanding (NLU) Pipeline for FoodieBite AI Engine
// ─────────────────────────────────────────────────────────────

const { searchFood } = require('./foodKnowledge');
const { classifyIntent } = require('./intentClassifier');
const { parsePreferenceDeclaration } = require('./userPreferenceStore');

const NEGATION_PATTERNS = [
  /(?:don'?t\s+want|do\s+not\s+want|avoid|exclude|no|without|allergic\s+to|don'?t\s+eat|not|free\s+from)\s+([a-z0-9\s]+)/gi,
  /(?:no|without)\s+(dairy|milk|peanuts|peanut|groundnut|gluten|sugar|eggs|meat|chicken)/gi
];

function parseNegationsAndExclusions(text) {
  const exclusions = new Set();
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();

  // Affirmative exceptions ("I can eat eggs", "I don't mind dairy")
  const isEggAffirmative = lower.includes('can eat eggs') || lower.includes('don\'t mind eggs') || lower.includes('eggs are okay');
  const isDairyAffirmative = lower.includes('don\'t mind dairy') || lower.includes('can eat dairy');
  const isSpicyAffirmative = lower.includes('don\'t mind spicy') || lower.includes('can eat spicy');

  // Explicit negation patterns
  for (const pattern of NEGATION_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(lower)) !== null) {
      if (match[1]) {
        const item = match[1].trim().split(/\s+/)[0].replace(/[^a-z0-9]/gi, '');
        if (item.length > 2) {
          exclusions.add(item);
        }
      }
    }
  }

  // Keywords check
  if (lower.includes('no peanuts') || lower.includes('without peanuts') || lower.includes('avoid peanuts') || lower.includes('don\'t want peanuts')) exclusions.add('peanuts');
  if (!isDairyAffirmative && (lower.includes('no dairy') || lower.includes('without dairy') || lower.includes('avoid milk') || lower.includes('don\'t eat dairy') || lower.includes('don\'t eat milk'))) exclusions.add('dairy');
  if (lower.includes('no chicken') || lower.includes('don\'t eat chicken') || lower.includes('without meat') || lower.includes('don\'t want chicken') || lower.includes('no meat')) exclusions.add('chicken');
  if (lower.includes('gluten free') || lower.includes('without gluten')) exclusions.add('gluten');
  if (!isEggAffirmative && (lower.includes('without eggs') || lower.includes('no eggs') || lower.includes('don\'t eat eggs') || lower.includes('cannot have eggs'))) exclusions.add('eggs');
  if (!isSpicyAffirmative && (lower.includes('no spicy') || lower.includes('don\'t want spicy') || lower.includes('not spicy'))) exclusions.add('spicy');

  return Array.from(exclusions);
}

function normalizeHinglish(text) {
  if (!text || typeof text !== 'string') return text;
  let norm = text.toLowerCase();

  const HINGLISH_MAP = [
    { pattern: /\b(?:kya\s+khau|kya\s+khaun|aaj\s+kya\s+khau|aaj\s+kya\s+khaun)\b/g, replacement: 'what should I eat' },
    { pattern: /\b(?:bhook\s+lagi\s+hai|bhookh\s+lagi\s+hai|bhookh)\b/g, replacement: 'i am starving' },
    { pattern: /\b(?:mujhe\s+kuch\s+healthy\s+chahiye|healthy\s+kuch\s+batao)\b/g, replacement: 'give me something healthy' },
    { pattern: /\b(?:protein\s+wala\s+kuch\s+batao|high\ origin\ protein)\b/g, replacement: 'something high protein' },
    { pattern: /\b(?:calories\s+kitna\s+hai|kitni\s+calories)\b/g, replacement: 'how many calories' },
    { pattern: /\b(?:ye\s+healthy\s+hai|kya\s+ye\s+healthy\s+hai)\b/g, replacement: 'is this healthy' },
    { pattern: /\b(?:biryani\s+chalega)\b/g, replacement: 'tell me about biryani' },
    { pattern: /\b(?:raat\s+ko\s+kya\s+kha\s+sakta\s+hu|raat\s+ka\s+khana)\b/g, replacement: 'what can I eat for dinner' },
    { pattern: /\b(?:gym\s+ke\s+baad\s+kya\s+khana\s+chahiye)\b/g, replacement: 'what should I eat after workout' },
    { pattern: /\b(?:gym\s+se\s+aaya?\s+hu|gym\s+se\s+aya?\s+hu|gym\s+se\s+aa\s+gaya|gym\s+ke\s+baad)\b/g, replacement: 'just came from gym after workout' },
    { pattern: /\b(?:protein\s+wala|protein\s+wali)\b/g, replacement: 'high protein' },
    { pattern: /\b(?:halka\s+sa|halka\s+phulka|halka\s+phoolka|kuch\s+halka|kuch\s+light)\b/g, replacement: 'something light meal' },
    { pattern: /\b(?:pet\s+bharne\s+wala\s+kuch)\b/g, replacement: 'something filling' },
    { pattern: /\b(?:aaj\s+rice\s+nahi\s+khana|rice\s+nahi\s+chahiye)\b/g, replacement: 'don\'t want rice today' },
    { pattern: /\b(?:something\s+light\s+batao|kuch\s+halka\s+batao)\b/g, replacement: 'need something light' }
  ];

  for (const item of HINGLISH_MAP) {
    norm = norm.replace(item.pattern, item.replacement);
  }
  return norm;
}

function parseMultiConstraints(text) {
  const norm = normalizeHinglish((text || '').toLowerCase());
  const constraints = {
    highProtein: false,
    minProtein: null,
    lightMeal: false,
    maxCalories: null,
    isQuick: false,
    prepTime: null,
    filling: false,
    healthy: false,
    cuisine: null,
    dietType: null,
    mealType: null,
    context: null,
    isComparative: false,
    comparisonType: null
  };

  // Double Negation / Affirmative Exception Check
  if (norm.includes('not non-veg') || norm.includes('not non vegetarian')) {
    constraints.dietType = 'vegetarian';
  } else if (norm.includes("don't eat chicken but eggs are fine") || norm.includes("eggs are fine")) {
    constraints.dietType = 'eggetarian';
  } else if (norm.includes("don't mind dairy") || norm.includes("can eat dairy")) {
    // Explicitly allow dairy
  }

  // Comparative Queries
  if (norm.includes('which is better') || norm.includes('which has more') || norm.includes('which is lighter') || norm.includes('which keeps me full') || norm.includes('which is cheaper')) {
    constraints.isComparative = true;
    if (norm.includes('more protein') || norm.includes('higher protein')) constraints.comparisonType = 'protein';
    else if (norm.includes('lighter') || norm.includes('lower calorie') || norm.includes('weight loss')) constraints.comparisonType = 'calories';
    else if (norm.includes('full longer') || norm.includes('filling')) constraints.comparisonType = 'satiety';
    else if (norm.includes('cheaper') || norm.includes('budget')) constraints.comparisonType = 'budget';
  }

  // Workout / Context extraction
  if (norm.includes('after workout') || norm.includes('post workout') || norm.includes('after gym') || norm.includes('back from the gym')) {
    constraints.context = 'post-workout';
    constraints.highProtein = true;
  } else if (norm.includes('before gym') || norm.includes('pre workout') || norm.includes('before workout')) {
    constraints.context = 'pre-workout';
    constraints.isQuick = true;
  }

  // Ambiguous & Indirect Language Triggers
  if (norm.includes('exhausted') || norm.includes('tired') || norm.includes('light') || norm.includes('don\'t want anything too heavy') || norm.includes('not too heavy') || norm.includes('nothing too heavy') || norm.includes('something light please')) {
    constraints.lightMeal = true;
  }
  if (norm.includes('starving') || norm.includes('hungry') || norm.includes('kinda hungry') || norm.includes('filling') || norm.includes('haven\'t eaten much') || norm.includes('proper south indian')) {
    constraints.filling = true;
  }

  if (norm.includes('high protein') || norm.includes('protein rich') || norm.includes('lots of protein') || norm.includes('higher in protein') || norm.includes('more protein')) {
    constraints.highProtein = true;
  }

  // Minimum protein requirement (e.g. "at least 25g protein", "20g protein")
  const protMatch = norm.match(/(?:at least|min|minimum|>=)?\s*(\d+)\s*g?\s*(?:g\s*)?protein/i);
  if (protMatch) {
    constraints.minProtein = parseInt(protMatch[1], 10);
    constraints.highProtein = true;
  }

  if (norm.includes('quick') || norm.includes('fast') || norm.includes('easy') || norm.includes('don\'t have much time') || norm.includes('don\'t feel like cooking')) {
    constraints.isQuick = true;
    constraints.prepTime = 'quick';
  }
  if (norm.includes('healthy') || norm.includes('nutritious')) {
    constraints.healthy = true;
  }

  // Calorie limits
  const calMatch = norm.match(/(?:under|less than|below|<)\s*(\d+)\s*(?:cal|calories)?/i);
  if (calMatch) {
    constraints.maxCalories = parseInt(calMatch[1], 10);
  }

  // Cuisines
  if (norm.includes('south indian')) constraints.cuisine = 'South Indian';
  else if (norm.includes('north indian')) constraints.cuisine = 'North Indian';
  else if (norm.includes('asian')) constraints.cuisine = 'Asian';
  else if (norm.includes('continental')) constraints.cuisine = 'Continental';
  else if (norm.includes('mediterranean')) constraints.cuisine = 'Mediterranean';

  // Diets
  if (!constraints.dietType) {
    if (norm.includes('vegetarian') || (norm.includes('veg') && !norm.includes('non veg') && !norm.includes('non-veg'))) constraints.dietType = 'vegetarian';
    else if (norm.includes('vegan')) constraints.dietType = 'vegan';
    else if (norm.includes('eggetarian')) constraints.dietType = 'eggetarian';
    else if (norm.includes('non vegetarian') || norm.includes('non-veg') || norm.includes('non veg')) constraints.dietType = 'non-vegetarian';
  }

  // Meals
  if (norm.includes('breakfast') || norm.includes('morning')) constraints.mealType = 'breakfast';
  else if (norm.includes('lunch') || norm.includes('afternoon')) constraints.mealType = 'lunch';
  else if (norm.includes('dinner') || norm.includes('tonight') || norm.includes('late')) constraints.mealType = 'dinner';
  else if (norm.includes('snack') || norm.includes('before bed')) constraints.mealType = 'snack';

  return constraints;
}

function detectContradictions(text, userContext = {}) {
  const norm = (text || '').toLowerCase();
  const userAllergies = Array.isArray(userContext.allergies) ? userContext.allergies : (userContext.allergies ? [userContext.allergies] : []);

  if (norm.includes('vegetarian chicken') || (norm.includes('vegetarian') && norm.includes('chicken') && !norm.includes('don\'t eat chicken') && !norm.includes('without chicken'))) {
    return {
      hasConflict: true,
      conflictType: 'VEG_CHICKEN',
      explanation: "Chicken is non-vegetarian. I have recommended vegetarian protein options (such as Paneer or Soya Chunks) instead."
    };
  }

  if (norm.includes('vegan paneer')) {
    return {
      hasConflict: true,
      conflictType: 'VEGAN_PANEER',
      explanation: "Paneer is a dairy product and not vegan. Firm Tofu is the best plant-based alternative."
    };
  }

  if (norm.includes('vegan egg') || (norm.includes('vegan') && norm.includes('egg') && !norm.includes('without egg') && !norm.includes('no egg'))) {
    return {
      hasConflict: true,
      conflictType: 'VEGAN_EGG',
      explanation: "Eggs are an animal product and not vegan. Tofu Scramble or Moong Dal Chilla are great plant-based alternatives."
    };
  }

  if ((norm.includes('no dairy') || norm.includes('without dairy') || norm.includes('dairy allergy')) && (norm.includes('milk') || norm.includes('paneer') || norm.includes('curd'))) {
    return {
      hasConflict: true,
      conflictType: 'DAIRY_CONFLICT',
      explanation: "Milk, paneer, and curd contain dairy. Plant-based alternatives like Soy Milk, Almond Milk, or Tofu are recommended."
    };
  }

  if ((norm.includes('peanut allergy') || userAllergies.some(a => a.toLowerCase().includes('peanut'))) && (norm.includes('peanut') || norm.includes('groundnut'))) {
    return {
      hasConflict: true,
      conflictType: 'PEANUT_ALLERGY_CONFLICT',
      explanation: "Your request contains peanuts, which conflicts with peanut allergy safety rules. Roasted Almonds or Sunflower seeds are safe alternatives."
    };
  }

  for (const allergy of userAllergies) {
    if (allergy && norm.includes(allergy.toLowerCase()) && !norm.includes('allergic') && !norm.includes('without')) {
      return {
        hasConflict: true,
        conflictType: 'ALLERGY_CONFLICT',
        explanation: `Your profile indicates an allergy to ${allergy}. Strictly excluding ${allergy} from recommendations for safety.`
      };
    }
  }

  return { hasConflict: false };
}

function parseConversationalModifications(text) {
  const norm = (text || '').toLowerCase().trim();
  
  if (norm.includes('make it vegetarian') || norm.includes('can i make it vegetarian') || norm.includes('make it veg')) {
    return { type: 'DIET_MODIFICATION', targetDiet: 'vegetarian' };
  }
  if (norm.includes('make it higher in protein') || norm.includes('make it high protein') || norm.includes('more protein') || norm.includes('higher in protein')) {
    return { type: 'HIGH_PROTEIN_MODIFICATION' };
  }
  if (norm.includes('make it lower calorie') || norm.includes('less calories') || norm.includes('lower calorie') || norm.includes('healthier')) {
    return { type: 'LOWER_CALORIE_MODIFICATION' };
  }
  
  const subMatch = norm.match(/(?:use|replace|replace with|substitute)\s+([a-z0-9\s]+)\s*(?:instead|instead of paneer|instead of chicken)?/i);
  if (subMatch) {
    return { type: 'SUBSTITUTE_INGREDIENT', replacementFood: subMatch[1].trim() };
  }

  return null;
}

function parseNearbyParameters(text) {
  const norm = (text || '').toLowerCase().trim();
  const params = {
    query: null,
    cuisine: null,
    category: null,
    radius: null,
    budget: null,
    openNow: false
  };

  // 1. Radius Extraction
  const radiusMatch = norm.match(/(?:within|under|around)?\s*(\d+(?:\.\d+)?)\s*(km|kilometers|m|meters)\b/i);
  if (radiusMatch) {
    const val = parseFloat(radiusMatch[1]);
    const unit = radiusMatch[2].toLowerCase();
    if (unit.startsWith('km')) {
      params.radius = val * 1000;
    } else {
      params.radius = val;
    }
  }

  // 2. Budget Extraction
  if (norm.includes('₹₹₹') || norm.includes('$$$')) {
    params.budget = '₹₹₹';
  } else if (norm.includes('₹₹') || norm.includes('$$')) {
    params.budget = '₹₹';
  } else if (norm.includes('₹') || norm.includes('$')) {
    params.budget = '₹';
  } else if (norm.includes('cheap') || norm.includes('affordable') || norm.includes('low cost') || norm.includes('inexpensive')) {
    params.budget = '₹';
  } else if (norm.includes('expensive') || norm.includes('fine dining') || norm.includes('fancy') || norm.includes('high end')) {
    params.budget = '₹₹₹';
  } else if (norm.includes('moderate') || norm.includes('mid range') || norm.includes('medium price') || norm.includes('budget')) {
    params.budget = '₹₹';
  }


  // 3. Open Now Extraction
  if (norm.includes('open now') || norm.includes('currently open') || norm.includes('is open') || norm.includes('active now')) {
    params.openNow = true;
  }

  // 4. Cuisine Extraction
  const cuisines = ['south indian', 'north indian', 'indian', 'chinese', 'italian', 'mexican', 'bakery', 'fast food', 'thai', 'continental', 'mediterranean'];
  for (const c of cuisines) {
    if (norm.includes(c)) {
      params.cuisine = c;
      break;
    }
  }

  // 5. Category Extraction
  if (norm.includes('cafe') || norm.includes('cafes') || norm.includes('coffee shop')) {
    params.category = 'cafe';
  } else if (norm.includes('bakery') || norm.includes('cake') || norm.includes('sweet')) {
    params.category = 'bakery';
  } else if (norm.includes('fast food') || norm.includes('burger') || norm.includes('pizza')) {
    params.category = 'fast_food';
  } else if (norm.includes('restaurant') || norm.includes('diner') || norm.includes('hotel') || norm.includes('bistro')) {
    params.category = 'restaurant';
  }

  // 6. Query extraction
  let cleanQuery = norm
    .replace(/(?:find|show|suggest|recommend|search|want|get|buy)\b/gi, '')
    .replace(/(?:restaurants|places to eat|food|somewhere|something|options|eateries|hotels|cafes|cafe|diner)\b/gi, '')
    .replace(/(?:near me|nearby|around here|around me|close by)\b/gi, '')
    .replace(/(?:within|under|around)?\s*(\d+(?:\.\d+)?)\s*(km|kilometers|m|meters)\b/gi, '')
    .replace(/(?:open now|currently open|is open)\b/gi, '')
    .replace(/(?:cheap|affordable|budget|low cost|inexpensive|expensive|fine dining|fancy|high end|moderate|mid range|medium price)\b/gi, '')
    .replace(/(?:without|no|exclude)\s+[a-z0-9\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanQuery) {
    params.query = cleanQuery;
  }

  return params;
}

function parseNLU(text, historyContext = {}) {
  if (!text || typeof text !== 'string') {
    return {
      intent: 'UNKNOWN',
      confidence: 0.0,
      constraints: {},
      exclusions: [],
      entities: [],
      conflict: { hasConflict: false },
      temporalContext: null,
      comparisons: null,
      preferences: {},
      ambiguity: true,
      reasoningHints: []
    };
  }

  const exclusions = parseNegationsAndExclusions(text);
  const constraints = parseMultiConstraints(text);
  const conflict = detectContradictions(text);
  const modification = parseConversationalModifications(text);

  // Temporal Context Extraction
  const norm = text.toLowerCase();
  let temporalContext = null;
  if (norm.includes('today') || norm.includes('aaj')) temporalContext = 'today';
  else if (norm.includes('tonight') || norm.includes('raat')) temporalContext = 'tonight';
  else if (norm.includes('tomorrow') || norm.includes('kal')) temporalContext = 'tomorrow';
  else if (norm.includes('after workout') || norm.includes('post workout') || norm.includes('gym ke baad')) temporalContext = 'post-workout';

  // Ambiguous phrasing intent resolution
  let rawIntent = null;
  if (norm.includes('starving') || norm.includes('hungry') || norm.includes('surprise me') || norm.includes('need food') || norm.includes('anything good') || norm.includes('something light') || norm.includes('exhausted after work')) {
    rawIntent = 'FOOD_RECOMMENDATION';
  }

  // Extract positive food entities
  const positiveEntities = [];
  const fullMatch = searchFood(text);
  if (fullMatch) {
    positiveEntities.push(fullMatch);
  } else {
    const FILLERS = new Set(['about', 'tell', 'give', 'show', 'what', 'where', 'how', 'want', 'need', 'like', 'some', 'food', 'meal', 'diet', 'good', 'best', 'have', 'with', 'from', 'also']);
    const tokens = text.toLowerCase().split(/\s+/);
    
    for (const token of tokens) {
      if (token.length < 3 || FILLERS.has(token)) continue;
      if (exclusions.some(e => token.includes(e))) continue;

      const matchedFood = searchFood(token);
      if (matchedFood && !positiveEntities.some(f => f.id === matchedFood.id)) {
        positiveEntities.push(matchedFood);
      }
    }
  }

  const classified = classifyIntent(text, {
    food: positiveEntities[0] || null,
    constraints,
    isRecipeRequest: text.toLowerCase().includes('recipe') || text.toLowerCase().includes('cook')
  });

  const finalIntent = rawIntent || classified.intent;
  const isAmbiguous = (classified.confidence < 0.50 && positiveEntities.length === 0 && !constraints.mealType);

  const parsedPreference = parsePreferenceDeclaration(text);

  const nearbyParams = finalIntent === 'NEARBY_FOOD' ? parseNearbyParameters(text) : null;
  if (nearbyParams) {
    nearbyParams.dietaryPreferences = [];
    if (constraints.dietType) nearbyParams.dietaryPreferences.push(constraints.dietType);
    if (constraints.highProtein) nearbyParams.dietaryPreferences.push('high-protein');
    if (constraints.healthy) nearbyParams.dietaryPreferences.push('healthy');
    nearbyParams.exclusions = exclusions;
  }

  return {
    rawMessage: text,
    intent: finalIntent,
    confidence: classified.confidence,
    constraints,
    exclusions,
    conflict,
    positiveEntities,
    entities: positiveEntities,
    conversationalModification: modification,
    temporalContext,
    parsedPreference,
    comparisons: constraints.isComparative ? { type: constraints.comparisonType } : null,
    preferences: { diet: constraints.dietType, cuisine: constraints.cuisine },
    ambiguity: isAmbiguous,
    reasoningHints: [
      constraints.highProtein ? 'prioritize-protein' : null,
      constraints.lightMeal ? 'prioritize-low-calorie' : null,
      temporalContext ? `temporal-${temporalContext}` : null
    ].filter(Boolean),
    nearbyParams
  };
}

module.exports = {
  parseNegationsAndExclusions,
  parseMultiConstraints,
  detectContradictions,
  parseConversationalModifications,
  parseNLU
};
