// ─────────────────────────────────────────────────────────────
//  backend/src/ai/substitutionEngine.js
//  Food Substitution & Alternative Recommendation Engine
// ─────────────────────────────────────────────────────────────

const { getAllFoods, searchFood, isAllergenPresent } = require('./foodKnowledge');

const PRESET_SUBSTITUTES = {
  'paneer': [
    { name: 'Firm Tofu', reason: 'Provides high plant protein (14.5g) with lower fat and zero cholesterol, perfect for vegan/lactose-intolerant diets.' },
    { name: 'Soya Chunks', reason: 'Ultra high protein plant alternative (22g protein per bowl) that absorbs Indian curry gravies exceptionally well.' },
    { name: 'Boiled Eggs', reason: 'High quality complete protein source for eggetarians.' }
  ],
  'chicken': [
    { name: 'Soya Chunks Curry', reason: 'High protein plant alternative (22g protein) with a hearty, meaty texture in curries.' },
    { name: 'Paneer Butter Masala', reason: 'Rich vegetarian protein option providing 14g protein per serving.' },
    { name: 'Firm Tofu Stir-Fry', reason: 'Lean plant-based protein option ideal for low-fat diets.' }
  ],
  'mutton': [
    { name: 'Soya Chunks / Jackfruit Raw Curry', reason: 'Meaty plant-based texture that absorbs bold Indian spices while keeping fat low.' },
    { name: 'Rajma Masala', reason: 'Hearty kidney bean dish rich in protein, iron, and fiber.' }
  ],
  'egg': [
    { name: 'Moong Dal Chilla / Sprouts', reason: 'Excellent plant protein alternative rich in fiber and bioavailable nutrients.' },
    { name: 'Firm Tofu Scramble', reason: 'Great vegan replacement for scrambled eggs with high protein content.' }
  ],
  'milk': [
    { name: 'Unsweetened Almond Milk', reason: 'Low calorie, lactose-free plant milk rich in Vitamin E.' },
    { name: 'Soy Milk', reason: 'Provides comparable protein content to cow milk with zero cholesterol.' }
  ],
  'curd': [
    { name: 'Dairy-Free Soy Yogurt', reason: 'Lactose-free probiotic alternative with rich texture.' },
    { name: 'Masala Coconut Yogurt', reason: 'Refreshing plant-based digestive alternative.' }
  ],
  'white rice': [
    { name: 'Cooked Brown Rice', reason: 'Whole grain alternative with higher dietary fiber (1.8g) and a lower glycemic index for sustained energy.' },
    { name: 'Cooked Quinoa', reason: 'Gluten-free superfood grain packed with complete plant protein.' },
    { name: 'Whole Wheat Chapati', reason: 'High fiber staple offering complex carbohydrates.' }
  ],
  'peanuts': [
    { name: 'Roasted Almonds', reason: 'Nutrient-dense nut substitute rich in healthy monounsaturated fats and Vitamin E.' },
    { name: 'Walnuts', reason: 'Excellent plant source of Omega-3 fatty acids.' }
  ]
};

function getFoodSubstitutions(targetFoodTerm, userContext = {}) {
  const normTerm = (targetFoodTerm || '').toLowerCase().trim();
  const userAllergies = Array.isArray(userContext.allergies) 
    ? userContext.allergies 
    : (userContext.allergies ? [userContext.allergies] : []);

  let matches = null;
  for (const [key, list] of Object.entries(PRESET_SUBSTITUTES)) {
    if (normTerm.includes(key)) {
      matches = list;
      break;
    }
  }

  if (!matches) {
    // Dynamic fallbacks from local database
    const allFoods = getAllFoods();
    const safe = allFoods.filter(f => !isAllergenPresent(f, userAllergies));
    matches = safe.slice(0, 3).map(f => ({
      name: f.name,
      reason: `Compatible ${f.category} option (${f.calories} kcal, ${f.protein}g protein) matching your dietary preferences.`
    }));
  }

  let replyText = `🔄 **Healthy Substitutes for ${targetFoodTerm || 'your food'}**\n\n`;
  matches.forEach((item, idx) => {
    replyText += `${idx + 1}. **${item.name}**\n   • **Why:** ${item.reason}\n\n`;
  });

  return {
    success: true,
    type: 'text',
    reply: replyText.trim(),
    substitutions: matches
  };
}

module.exports = {
  getFoodSubstitutions
};
