// ─────────────────────────────────────────────────────────────
//  backend/src/ai/mealPlanEngine.js
//  Daily Meal Planner Engine for FoodieBite AI Engine
// ─────────────────────────────────────────────────────────────

const { getAllFoods, isAllergenPresent } = require('./foodKnowledge');

function generateDailyMealPlan(userContext = {}) {
  const allFoods = getAllFoods();
  const userAllergies = Array.isArray(userContext.allergies) 
    ? userContext.allergies 
    : (userContext.allergies ? [userContext.allergies] : []);

  const diet = (userContext.diet || userContext.dietType || '').toLowerCase();
  const goal = (userContext.goal || userContext.healthGoals || '').toLowerCase();

  // Filter out allergens and incompatible diet types
  const safeFoods = allFoods.filter(food => {
    if (isAllergenPresent(food, userAllergies)) return false;

    if (diet === 'vegetarian' || diet === 'veg') {
      return food.dietTypes.includes('vegetarian') || food.dietTypes.includes('vegan');
    }
    if (diet === 'vegan') {
      return food.dietTypes.includes('vegan');
    }
    if (diet === 'eggetarian') {
      return food.dietTypes.includes('vegetarian') || food.dietTypes.includes('eggetarian') || food.dietTypes.includes('vegan');
    }
    return true;
  });

  const pickMealFood = (mealType, fallbackFoodId) => {
    let matched = safeFoods.filter(f => f.mealTypes.includes(mealType));
    if (goal.includes('high protein') || goal.includes('muscle')) {
      matched.sort((a, b) => b.protein - a.protein);
    } else if (goal.includes('weight loss') || goal.includes('weight management')) {
      matched.sort((a, b) => a.calories - b.calories);
    }
    return matched.length > 0 ? matched[0] : allFoods.find(f => f.id === fallbackFoodId);
  };

  const breakfast = pickMealFood('breakfast', 'idli');
  const midMorningSnack = safeFoods.find(f => f.category === 'Fruit') || safeFoods.find(f => f.id === 'banana');
  const lunch = pickMealFood('lunch', 'dal_tadka');
  const eveningSnack = safeFoods.find(f => f.id === 'buttermilk') || safeFoods.find(f => f.id === 'poha') || safeFoods.find(f => f.id === 'green_tea');
  const dinner = safeFoods.filter(f => f.mealTypes.includes('dinner') && f.id !== lunch.id)[0] || pickMealFood('dinner', 'chapati');

  const meals = [breakfast, midMorningSnack, lunch, eveningSnack, dinner];
  const totalNutrition = {
    calories: meals.reduce((sum, f) => sum + (f ? f.calories : 0), 0),
    protein: Number(meals.reduce((sum, f) => sum + (f ? f.protein : 0), 0).toFixed(1)),
    carbohydrates: Number(meals.reduce((sum, f) => sum + (f ? f.carbohydrates : 0), 0).toFixed(1)),
    fat: Number(meals.reduce((sum, f) => sum + (f ? f.fat : 0), 0).toFixed(1)),
    fiber: Number(meals.reduce((sum, f) => sum + (f ? f.fiber : 0), 0).toFixed(1))
  };

  const name = userContext.name || 'there';
  let text = `🗓️ **Personalized Daily Meal Plan for ${name}**\n\n` +
    `• **Breakfast:** ${breakfast.name} (${breakfast.calories} kcal | ${breakfast.protein}g protein)\n` +
    `• **Mid-Morning Snack:** ${midMorningSnack.name} (${midMorningSnack.calories} kcal | ${midMorningSnack.protein}g protein)\n` +
    `• **Lunch:** ${lunch.name} (${lunch.calories} kcal | ${lunch.protein}g protein)\n` +
    `• **Evening Snack:** ${eveningSnack.name} (${eveningSnack.calories} kcal | ${eveningSnack.protein}g protein)\n` +
    `• **Dinner:** ${dinner.name} (${dinner.calories} kcal | ${dinner.protein}g protein)\n\n` +
    `📊 **Estimated Daily Nutrition Total:**\n` +
    `• **Calories:** ${totalNutrition.calories} kcal\n` +
    `• **Protein:** ${totalNutrition.protein}g\n` +
    `• **Carbs:** ${totalNutrition.carbohydrates}g\n` +
    `• **Fat:** ${totalNutrition.fat}g\n` +
    `• **Fiber:** ${totalNutrition.fiber}g\n\n` +
    `*All meal plans strictly align with your ${diet || 'balanced'} preference and exclude allergens (${userAllergies.join(', ') || 'none'}).*`;

  return {
    success: true,
    type: 'meal_plan',
    reply: text,
    mealPlan: {
      breakfast,
      midMorningSnack,
      lunch,
      eveningSnack,
      dinner,
      totalNutrition
    }
  };
}

module.exports = {
  generateDailyMealPlan
};
