// ─────────────────────────────────────────────────────────────
//  backend/src/ai/nutritionEngine.js
//  Multi-Food Nutrition Aggregator & Goal Comparison Engine
// ─────────────────────────────────────────────────────────────

function calculateScaledNutrition(food, quantity = 1, unit = 'serving') {
  if (!food) return null;

  let multiplier = quantity;
  if (unit === 'g' || unit === 'grams') {
    multiplier = food.servingSize.includes('100g') ? quantity / 100 : quantity / 150;
  }

  const calories = Math.round(food.calories * multiplier);
  const protein = Number((food.protein * multiplier).toFixed(1));
  const carbohydrates = Number((food.carbohydrates * multiplier).toFixed(1));
  const fat = Number((food.fat * multiplier).toFixed(1));
  const fiber = Number((food.fiber * multiplier).toFixed(1));

  const textReply = `📊 **Nutritional Info for ${food.name} (${quantity} ${unit})**\n\n` +
    `• **Calories:** ${calories} kcal\n` +
    `• **Protein:** ${protein}g\n` +
    `• **Carbohydrates:** ${carbohydrates}g\n` +
    `• **Fat:** ${fat}g\n` +
    `• **Fiber:** ${fiber}g\n\n` +
    `*Note: Nutritional values are estimated averages based on standard preparations.*`;

  return {
    success: true,
    type: 'nutrition',
    reply: textReply,
    nutrition: {
      foodName: food.name,
      quantity,
      unit,
      calories,
      protein,
      carbohydrates,
      fat,
      fiber
    }
  };
}

function calculateCombinedNutrition(foodItems = []) {
  if (!Array.isArray(foodItems) || foodItems.length === 0) return null;

  const names = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const item of foodItems) {
    const single = calculateScaledNutrition(item.food, item.quantity, item.unit);
    if (single && single.nutrition) {
      const n = single.nutrition;
      names.push(`${item.quantity} ${item.unit !== 'serving' ? item.unit : ''} ${item.food.name}`);
      totalCalories += n.calories;
      totalProtein += n.protein;
      totalCarbs += n.carbohydrates;
      totalFat += n.fat;
      totalFiber += n.fiber;
    }
  }

  totalProtein = Number(totalProtein.toFixed(1));
  totalCarbs = Number(totalCarbs.toFixed(1));
  totalFat = Number(totalFat.toFixed(1));
  totalFiber = Number(totalFiber.toFixed(1));

  const textReply = `📊 **Combined Meal Nutrition Total**\n\n` +
    `**Items Included:**\n` + names.map(n => `• ${n}`).join('\n') + `\n\n` +
    `**Combined Totals:**\n` +
    `• **Calories:** ${totalCalories} kcal\n` +
    `• **Protein:** ${totalProtein}g\n` +
    `• **Carbohydrates:** ${totalCarbs}g\n` +
    `• **Fat:** ${totalFat}g\n` +
    `• **Fiber:** ${totalFiber}g\n\n` +
    `*Note: Values are approximate estimated totals based on standard preparations.*`;

  return {
    success: true,
    type: 'nutrition',
    reply: textReply,
    nutrition: {
      foods: names,
      calories: totalCalories,
      protein: totalProtein,
      carbohydrates: totalCarbs,
      fat: totalFat,
      fiber: totalFiber
    }
  };
}

function compareFoods(food1, food2, userGoal = 'healthy eating') {
  if (!food1 || !food2) {
    return {
      success: false,
      reply: 'Please specify two valid foods to compare (e.g., "Paneer vs Tofu" or "Rice vs Roti").'
    };
  }

  const n1 = calculateScaledNutrition(food1, 1, 'serving').nutrition;
  const n2 = calculateScaledNutrition(food2, 1, 'serving').nutrition;

  const protDiff = Math.abs(n1.protein - n2.protein).toFixed(1);
  const calDiff = Math.abs(n1.calories - n2.calories);
  const fibDiff = Math.abs(n1.fiber - n2.fiber).toFixed(1);

  const protWinner = n1.protein > n2.protein ? food1.name : food2.name;
  const calWinner = n1.calories < n2.calories ? food1.name : food2.name;
  const fibWinner = n1.fiber > n2.fiber ? food1.name : food2.name;

  let goalRec = '';
  const goalNorm = (userGoal || '').toLowerCase();

  if (goalNorm.includes('weight loss') || goalNorm.includes('low-calorie')) {
    goalRec = `For your weight loss goal, **${calWinner}** is preferable due to lower calorie density (${Math.min(n1.calories, n2.calories)} kcal vs ${Math.max(n1.calories, n2.calories)} kcal).`;
  } else if (goalNorm.includes('muscle') || goalNorm.includes('high protein')) {
    goalRec = `For muscle building, **${protWinner}** is superior providing +${protDiff}g more protein per serving.`;
  } else {
    goalRec = `Both foods serve distinct roles: **${calWinner}** is lower in calories while **${protWinner}** delivers higher protein density.`;
  }

  const comparisonText = `⚖️ **Nutrition Trade-Off Comparison: ${food1.name} vs ${food2.name}**\n\n` +
    `• **${food1.name}:** ${n1.calories} kcal | Protein: ${n1.protein}g | Carbs: ${n1.carbohydrates}g | Fat: ${n1.fat}g | Fiber: ${n1.fiber}g\n` +
    `• **${food2.name}:** ${n2.calories} kcal | Protein: ${n2.protein}g | Carbs: ${n2.carbohydrates}g | Fat: ${n2.fat}g | Fiber: ${n2.fiber}g\n\n` +
    `🔍 **Trade-Off Breakdown:**\n` +
    `• **For Protein:** ${protWinner} leads by +${protDiff}g protein.\n` +
    `• **For Calories:** ${calWinner} is lower by -${calDiff} kcal.\n` +
    `• **For Dietary Fiber:** ${fibWinner} offers +${fibDiff}g more fiber for digestion.\n\n` +
    `💡 **Personalized Goal Recommendation:**\n${goalRec}`;

  return {
    success: true,
    type: 'comparison',
    reply: comparisonText,
    comparison: {
      food1: n1,
      food2: n2,
      protWinner,
      calWinner,
      fibWinner,
      goalRec
    }
  };
}

module.exports = {
  calculateScaledNutrition,
  calculateCombinedNutrition,
  compareFoods
};
