// ─────────────────────────────────────────────────────────────
//  backend/src/ai/recipeEngine.js
//  Production Recipe Generator & Conversational Modification Engine
// ─────────────────────────────────────────────────────────────

const { searchFood, isAllergenPresent, getAllFoods } = require('./foodKnowledge');

function generateRecipe({ foodName = 'Healthy Meal', constraints = {}, userContext = {} }) {
  const userAllergies = Array.isArray(userContext.allergies) 
    ? userContext.allergies 
    : (userContext.allergies ? [userContext.allergies] : []);

  let targetFood = searchFood(foodName);

  if (constraints.ingredientConstraint === 'oats') {
    targetFood = searchFood('oats');
  } else if (constraints.isHighProtein) {
    const safe = getAllFoods().filter(f => !isAllergenPresent(f, userAllergies) && f.protein >= 15);
    if (safe.length > 0) targetFood = safe[0];
  }

  if (targetFood && isAllergenPresent(targetFood, userAllergies)) {
    return {
      success: false,
      reply: `I cannot generate a recipe for ${targetFood.name} because it conflicts with your specified allergy (${userAllergies.join(', ')}).`
    };
  }

  const recipeName = targetFood ? targetFood.name : foodName;
  const ingredients = (targetFood && Array.isArray(targetFood.ingredients))
    ? [...targetFood.ingredients]
    : (targetFood ? [`${targetFood.name} base`, 'fresh herbs', 'aromatic spices', 'healthy cooking oil', 'salt to taste'] : ['primary food base', 'fresh herbs', 'spices', 'healthy cooking oil', 'salt to taste']);

  const prepTime = constraints.isQuick ? '5 mins' : (targetFood ? `${targetFood.preparationMinutes || 10} mins` : '10 mins');
  const cookTime = constraints.isQuick ? '10 mins' : '20 mins';

  const steps = [
    `Wash and prepare ingredients (${ingredients.slice(0, 3).join(', ')}).`,
    `Heat healthy oil or ghee in a pan over medium heat. Add spices and aromatics.`,
    `Add ${ingredients.slice(0, 2).join(' and ')} and sauté gently.`,
    `Cover and cook on low heat for ${cookTime} until tender.`,
    `Garnish with coriander or mint and serve warm.`
  ];

  const nutrition = {
    calories: targetFood ? targetFood.calories : 280,
    protein: targetFood ? targetFood.protein : 14.0,
    carbohydrates: targetFood ? targetFood.carbohydrates : 32.0,
    fat: targetFood ? targetFood.fat : 8.0
  };

  const recipeObj = {
    name: `${recipeName} Recipe`,
    servings: 2,
    prepTime,
    cookTime,
    ingredients,
    steps,
    nutrition
  };

  const textReply = `🍳 **${recipeObj.name}**\n\n` +
    `⏱️ **Prep Time:** ${prepTime} | **Cook Time:** ${cookTime} | **Servings:** ${recipeObj.servings}\n` +
    `📊 **Approximate Estimated Nutrition (per serving):** ${nutrition.calories} kcal | Protein: ${nutrition.protein}g | Carbs: ${nutrition.carbohydrates}g | Fat: ${nutrition.fat}g\n\n` +
    `**Ingredients:**\n` + ingredients.map(i => `• ${i}`).join('\n') + `\n\n` +
    `**Steps:**\n` + steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');

  return {
    success: true,
    type: 'recipe',
    reply: textReply,
    recipe: recipeObj
  };
}

function modifyRecipe(existingRecipe, modification) {
  if (!existingRecipe) {
    return generateRecipe({ foodName: modification.replacementFood || 'Paneer' });
  }

  const recipe = JSON.parse(JSON.stringify(existingRecipe));

  if (modification.type === 'LOWER_CALORIE_MODIFICATION') {
    recipe.name = `${recipe.name.replace(' Recipe', '')} (Low Calorie Version)`;
    recipe.ingredients = recipe.ingredients.map(i => i.includes('butter') || i.includes('ghee') ? 'minimal olive oil spray' : i);
    recipe.nutrition.calories = Math.round(recipe.nutrition.calories * 0.75);
    recipe.nutrition.fat = Number((recipe.nutrition.fat * 0.6).toFixed(1));
  } else if (modification.type === 'HIGH_PROTEIN_MODIFICATION') {
    recipe.name = `${recipe.name.replace(' Recipe', '')} (High Protein Version)`;
    recipe.ingredients.push('extra protein boost (whey/paneer/egg whites)');
    recipe.nutrition.protein = Number((recipe.nutrition.protein * 1.4).toFixed(1));
    recipe.nutrition.calories += 50;
  } else if (modification.type === 'SUBSTITUTE_INGREDIENT' && modification.replacementFood) {
    const newFood = searchFood(modification.replacementFood);
    if (newFood) {
      return generateRecipe({ foodName: newFood.name });
    }
  }

  const textReply = `🍳 **Modified Recipe: ${recipe.name}**\n\n` +
    `⏱️ **Prep Time:** ${recipe.prepTime} | **Cook Time:** ${recipe.cookTime} | **Servings:** ${recipe.servings}\n` +
    `📊 **Modified Nutrition (per serving):** ${recipe.nutrition.calories} kcal | Protein: ${recipe.nutrition.protein}g | Carbs: ${recipe.nutrition.carbohydrates}g | Fat: ${recipe.nutrition.fat}g\n\n` +
    `**Updated Ingredients:**\n` + recipe.ingredients.map(i => `• ${i}`).join('\n') + `\n\n` +
    `**Updated Steps:**\n` + recipe.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');

  return {
    success: true,
    type: 'recipe',
    reply: textReply,
    recipe
  };
}

module.exports = {
  generateRecipe,
  modifyRecipe
};
