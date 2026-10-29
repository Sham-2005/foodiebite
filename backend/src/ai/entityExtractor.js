// ─────────────────────────────────────────────────────────────
//  backend/src/ai/entityExtractor.js
//  Production Entity Extractor with Multi-Food Expression Support
// ─────────────────────────────────────────────────────────────

const { searchFood } = require('./foodKnowledge');
const { parseNegationsAndExclusions } = require('./languageUnderstanding');

function parseMultiFoodItems(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Split on '+', 'and', ','
  const parts = text.split(/\+|\band\b|,/i);
  const items = [];

  const WORD_NUMS = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'half': 0.5 };

  for (const part of parts) {
    let trimmed = part.trim();
    if (!trimmed) continue;

    // Convert word numbers at start
    for (const [w, n] of Object.entries(WORD_NUMS)) {
      if (trimmed.toLowerCase().startsWith(w + ' ')) {
        trimmed = trimmed.toLowerCase().replace(w + ' ', `${n} `);
        break;
      }
    }

    const qtyMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(g|grams|kg|pieces|pcs|eggs|roti|rotis|chapati|chapatis|cups|cup|tbsp|tsp|glass|bowl|plate|plates|servings|serving)?\s*([a-z\s]+)?/i);
    let food = null;
    let qty = 1;
    let unit = 'serving';

    if (qtyMatch) {
      qty = parseFloat(qtyMatch[1]);
      if (qtyMatch[2]) unit = qtyMatch[2].toLowerCase();
      const foodTerm = trimmed.replace(/^\d+(?:\.\d+)?\s*/, '').trim();
      food = searchFood(foodTerm);
      if (!food && qtyMatch[3]) {
        food = searchFood(qtyMatch[3].trim());
      }
    } else {
      food = searchFood(trimmed);
    }

    if (food) {
      items.push({ food, quantity: qty, unit });
    }
  }

  return items;
}

function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return {};
  }

  const norm = text.toLowerCase().trim();
  const exclusions = parseNegationsAndExclusions(text);
  const multiFoodItems = parseMultiFoodItems(text);

  const entities = {
    food: multiFoodItems.length > 0 ? multiFoodItems[0].food : null,
    comparisonTarget: null,
    substitutionTarget: null,
    quantity: multiFoodItems.length > 0 ? multiFoodItems[0].quantity : 1,
    unit: multiFoodItems.length > 0 ? multiFoodItems[0].unit : 'serving',
    mealType: null,
    dietType: null,
    allergy: null,
    goal: null,
    nutrient: null,
    exclusions,
    multiFoodItems,
    constraints: {
      maxCalories: null,
      isQuick: false,
      isHighProtein: false,
      ingredientConstraint: null
    },
    isRecipeRequest: false
  };

  // Recipe Trigger
  if (norm.includes('recipe') || norm.includes('how to make') || norm.includes('ingredients for') || norm.includes('how to cook') || norm.includes('how do i make')) {
    entities.isRecipeRequest = true;
  }

  // Constraints Extraction
  const calMatch = norm.match(/(?:under|less than|<)\s*(\d+)\s*(?:cal|calories)?/i);
  if (calMatch) {
    entities.constraints.maxCalories = parseInt(calMatch[1], 10);
  }

  if (norm.includes('quick') || norm.includes('fast') || norm.includes('easy')) {
    entities.constraints.isQuick = true;
  }

  if (norm.includes('high protein') || norm.includes('protein rich') || norm.includes('lots of protein')) {
    entities.constraints.isHighProtein = true;
  }

  if (norm.includes('with oats')) {
    entities.constraints.ingredientConstraint = 'oats';
  }

  // Meal Types
  if (norm.includes('breakfast')) entities.mealType = 'breakfast';
  else if (norm.includes('lunch')) entities.mealType = 'lunch';
  else if (norm.includes('dinner') || norm.includes('tonight')) entities.mealType = 'dinner';
  else if (norm.includes('snack') || norm.includes('snacks')) entities.mealType = 'snack';

  // Comparison Pairs ("Paneer vs Tofu", "Compare tofu and paneer", "between rice and roti")
  const cleanNorm = norm.replace(/^(?:compare|between|difference between)\s+/i, '').trim();
  const compMatch = cleanNorm.match(/([a-z0-9\s]+?)\s+(?:vs|versus|or|and)\s+([a-z0-9\s]+)/i);
  if (compMatch) {
    const food1 = searchFood(compMatch[1].trim());
    const food2 = searchFood(compMatch[2].trim());
    if (food1) entities.food = food1;
    if (food2) entities.comparisonTarget = food2;
  } else if (!entities.food) {
    entities.food = searchFood(norm);
  }

  return entities;
}

module.exports = {
  extractEntities,
  parseMultiFoodItems
};
