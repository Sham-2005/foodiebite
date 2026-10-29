// ─────────────────────────────────────────────────────────────
//  backend/src/ai/responseFormatter.js
//  Natural Language Synthesis & Dynamic Option Formatter
// ─────────────────────────────────────────────────────────────

function formatFoodInformation(food, userContext = {}) {
  if (!food) {
    return {
      success: true,
      source: 'foodiebite_ai',
      reply: `I don't have reliable nutrition information for that specific food item in my local database yet. Would you like to explore other popular Indian or global dishes?`,
      type: 'text',
      options: []
    };
  }

  const diet = (userContext.diet || '').toLowerCase();
  let personaNote = '';

  const dietTypes = [];
  if (food.vegan) dietTypes.push('Vegan');
  else if (food.vegetarian) dietTypes.push('Vegetarian');
  else if (food.eggetarian) dietTypes.push('Eggetarian');
  else dietTypes.push('Non-Vegetarian');

  if (diet === 'vegetarian' && food.vegetarian) {
    personaNote = `It fits your vegetarian preference well.`;
  } else if (diet === 'vegan' && food.vegan) {
    personaNote = `It is 100% plant-based and suitable for your vegan diet.`;
  }

  const ingredientsList = Array.isArray(food.ingredients)
    ? food.ingredients.join(', ')
    : `${food.name} base, fresh spices & herbs`;

  const replyText = `🍲 **${food.name}** (${food.servingSize || '1 serving'})\n\n` +
    `• **Cuisine & Category:** ${food.cuisine || 'Global'} | ${food.category || 'Main Dish'}\n` +
    `• **Diet Compatibility:** ${dietTypes.join(', ')}\n` +
    `• **Estimated Nutrition:** ${food.calories} kcal | Protein: ${food.protein}g | Carbs: ${food.carbohydrates}g | Fat: ${food.fat}g | Fiber: ${food.fiber || 0}g\n` +
    `• **Key Ingredients:** ${ingredientsList}\n\n` +
    `${personaNote ? '💡 ' + personaNote : ''}`;

  return {
    success: true,
    source: 'foodiebite_ai',
    reply: replyText.trim(),
    type: 'text',
    data: food,
    options: []
  };
}

function buildClarificationChoice(type = 'general') {
  if (type === 'recipe') {
    return {
      success: true,
      source: 'foodiebite_ai',
      reply: `What would you like a recipe for? Choose a meal category below:`,
      type: 'choice',
      options: [
        { label: 'Paneer Recipe', value: 'give me a paneer recipe' },
        { label: 'Chicken Recipe', value: 'give me a chicken recipe' },
        { label: 'Oats Recipe', value: 'give me a recipe with oats' },
        { label: 'Quick Breakfast Recipe', value: 'give me a quick breakfast recipe' }
      ]
    };
  }

  if (type === 'calories') {
    return {
      success: true,
      source: 'foodiebite_ai',
      reply: `Which food's nutrition would you like to calculate?`,
      type: 'choice',
      options: [
        { label: '2 Boiled Eggs', value: 'calories in 2 eggs' },
        { label: '150g Chicken Breast', value: 'protein in 150g chicken' },
        { label: '1 Bowl Rice', value: 'calories in 1 bowl rice' },
        { label: 'Whole Wheat Roti', value: 'calories in 1 roti' }
      ]
    };
  }

  return {
    success: true,
    source: 'foodiebite_ai',
    reply: `I want to make sure I give you the exact information you need. What would you like to explore?`,
    type: 'choice',
    options: [
      { label: 'Daily Meal Plan', value: 'plan my meals for today' },
      { label: 'Healthy Dinner Recommendation', value: 'recommend a healthy dinner' },
      { label: 'Calculate Nutrition', value: 'calories in 2 eggs' },
      { label: 'Food Substitution', value: 'what can I use instead of paneer?' }
    ]
  };
}

module.exports = {
  formatFoodInformation,
  buildClarificationChoice
};
