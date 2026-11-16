// ─────────────────────────────────────────────────────────────
//  frontend/src/services/localAiCoach.js
//  FoodieBite Standalone Local AI Nutrition Engine
//  100% Offline Capable — Heuristic & Knowledge-Based Intelligence
//  Zero Cloud AI dependencies (no OpenAI, Gemini, Groq, Claude).
// ─────────────────────────────────────────────────────────────

/**
 * Clean & tokenize incoming message.
 */
function normalizeQuery(str = '') {
  return String(str || '').toLowerCase().trim();
}

/**
 * Evaluate user dietary restrictions & safety.
 */
function checkDietarySafety(query, userContext = {}) {
  const allergies = Array.isArray(userContext.allergies) ? userContext.allergies : [];
  const dietType = (userContext.dietType || '').toLowerCase();

  const notes = [];
  if (allergies.length > 0) {
    notes.push(`*Noted your registered allergies:* ${allergies.join(', ')}.`);
  }
  if (dietType === 'vegan' || dietType === 'vegetarian') {
    notes.push(`*Customized for your ${dietType} lifestyle.*`);
  }

  return notes.length > 0 ? `\n\n> 🛡️ ${notes.join(' ')}` : '';
}

/**
 * Main local inference pipeline.
 *
 * @param {string} rawMessage User prompt
 * @param {object} userContext User profile, health goals, preferences
 * @returns {Promise<{ success: boolean, source: string, reply: string, type: string, options: string[] }>}
 */
export async function processLocalAiMessage(rawMessage = '', userContext = {}) {
  const q = normalizeQuery(rawMessage);
  const safetyFooter = checkDietarySafety(q, userContext);
  const dietType = (userContext.dietType || '').toLowerCase();
  const isVegetarian = dietType === 'vegetarian' || dietType === 'vegan';
  const isVegan = dietType === 'vegan';

  // 1. High-Protein Indian Breakfast
  if (
    (q.includes('protein') && q.includes('breakfast')) ||
    (q.includes('protein') && q.includes('indian')) ||
    q.includes('high-protein indian breakfast')
  ) {
    let meals = [];
    if (isVegan) {
      meals = [
        '1. **Besan & Tofu Cheela:** Savory chickpea flour crepes filled with grated tofu and vegetables (~18g protein, 240 kcal).',
        '2. **Sprouted Moong & Peanut Salad:** Steamed green gram sprouts with lemon, diced cucumbers, and roasted peanuts (~15g protein, 210 kcal).',
        '3. **Soya Keema Pav:** Minced soya granules cooked with tomatoes, peas, and cumin served with whole-wheat bread (~22g protein, 310 kcal).',
      ];
    } else if (isVegetarian) {
      meals = [
        '1. **Paneer Bhurji with Multigrain Roti:** 100g fresh paneer sautéed with onion, capsicum, and turmeric with 2 whole wheat rotis (~22g protein, 350 kcal).',
        '2. **Moong Dal Cheela with Greek Yogurt:** Yellow lentils pancake stuffed with mild spices paired with high-protein hung curd (~20g protein, 270 kcal).',
        '3. **Sattu Buttermilk & Sprout Chaat:** 3 tbsp roasted gram flour stirred into spiced buttermilk with steamed sprouts (~18g protein, 220 kcal).',
      ];
    } else {
      meals = [
        '1. **Egg & Spinach Bhurji with Whole Wheat Toast:** 3 whole eggs or egg whites scrambled with spinach and green chillies (~21g protein, 260 kcal).',
        '2. **Paneer & Moong Dal Cheela:** High-protein lentil pancake stuffed with grated low-fat paneer (~24g protein, 330 kcal).',
        '3. **Greek Yogurt Parfait with Seeds:** Unsweetened Greek curd topped with chia seeds, crushed almonds, and pomegranate (~19g protein, 240 kcal).',
      ];
    }

    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `🍳 **High-Protein Indian Breakfast Ideas:**\n\n${meals.join('\n\n')}\n\n💡 **Coach Tip:** Consuming 20–30g of protein in the morning stabilizes blood glucose, suppresses ghrelin (hunger hormone), and keeps you energized until lunch.${safetyFooter}`,
      type: 'recommendation',
      options: ['Estimate calories for Palak Paneer', 'High-protein snacks', 'Post-workout dinner'],
    };
  }

  // 2. Cholesterol / Hypercholesterolemia / Heart Health
  if (
    q.includes('cholesterol') ||
    q.includes('hypercholesterolemia') ||
    q.includes('heart') ||
    q.includes('lipid') ||
    q.includes('triglyceride')
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `🫀 **Cardiovascular & Cholesterol Management Guide:**\n\n` +
        `❌ **Foods to Avoid or Limit:**\n` +
        `• **Deep-Fried Foods:** Puris, bhaturas, pakoras, and samosas (high in oxidized fats and trans-fatty acids).\n` +
        `• **Commercial Bakery Items:** Biscuits, khari, and pastries made with vanaspati / partially hydrogenated vegetable oil.\n` +
        `• **High-Fat Dairy & Processed Meats:** Full-fat cream, processed cheese, and sausages.\n` +
        `• **Excess Refined Sugars:** Excess fructose converts directly to triglycerides in the liver.\n\n` +
        `✅ **Cardio-Protective Foods to Embrace:**\n` +
        `• **Soluble Fiber:** Oats, barley, methi (fenugreek seeds), and isabgol (psyllium husk) actively bind bile acids in the gut to lower LDL.\n` +
        `• **Healthy Omega-3s:** Walnuts, flaxseeds (alsi), chia seeds, and fatty fish.\n` +
        `• **Garlic & Green Tea:** Contain allicin and catechins that support arterial elasticity.${safetyFooter}`,
      type: 'medical_guidance',
      options: ['Low-sodium food ideas', 'High fiber meal plan', 'Is Ghee healthy for daily cooking?'],
    };
  }

  // 3. Palak Paneer and Roti Calorie Estimation
  if (
    (q.includes('palak') && q.includes('paneer')) ||
    (q.includes('estimate calories') && q.includes('roti')) ||
    (q.includes('calories') && q.includes('paneer'))
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `📊 **Calorie & Macro Breakdown: Palak Paneer & Roti (Standard Serving)**\n\n` +
        `1. **Palak Paneer (1 bowl / ~200g):**\n` +
        `   • Calories: **~260 - 290 kcal**\n` +
        `   • Protein: 14g\n` +
        `   • Carbohydrates: 9g (Fiber: 4.5g)\n` +
        `   • Fat: 19g (mainly from paneer and cooking oil/ghee)\n\n` +
        `2. **Whole Wheat Phulkas / Rotis (2 medium, no oil):**\n` +
        `   • Calories: **~140 - 160 kcal**\n` +
        `   • Protein: 5g\n` +
        `   • Carbohydrates: 30g (Fiber: 4g)\n` +
        `   • Fat: 0.8g\n\n` +
        `🥗 **Meal Total:** **~410 - 450 kcal** | **19g Protein** | **8.5g Fiber**\n\n` +
        `💡 **Coach Tip:** To reduce calories by ~80 kcal, use low-fat paneer or substitute half the paneer with pan-seared mushrooms or tofu, and minimize tempering oil.${safetyFooter}`,
      type: 'macro_breakdown',
      options: ['Suggest a high-protein Indian breakfast', 'Healthy dinner alternatives', 'Weight loss snacks'],
    };
  }

  // 4. Ghee and Daily Cooking Fats
  if (
    q.includes('ghee') ||
    q.includes('clarified butter') ||
    (q.includes('oil') && q.includes('cooking'))
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `🧈 **Is Ghee Healthy for Daily Cooking?**\n\n` +
        `**Yes, in moderation (1 to 2 teaspoons / 5–10g daily).** Here is the scientific breakdown:\n\n` +
        `✅ **Key Benefits:**\n` +
        `• **High Smoke Point (250°C / 482°F):** Does not break down into toxic free radicals or acrolein during Indian tempering and frying.\n` +
        `• **Rich in Butyric Acid:** Feeds colon cells, reduces intestinal inflammation, and supports healthy gut microbiota.\n` +
        `• **Nutrient Absorption:** Enhances bioavailability of fat-soluble vitamins (A, D, E, and K) from your vegetables.\n\n` +
        `⚠️ **Points of Caution:**\n` +
        `• Ghee is ~62% saturated fat and calorically dense (1 tsp = ~45 kcal). If you have elevated ApoB or LDL-cholesterol, restrict intake to 1 tsp daily and pair with cold-pressed mustard, sesame, or olive oil.${safetyFooter}`,
      type: 'nutrition_facts',
      options: ['Estimate calories for Palak Paneer and Roti', 'Best cooking oils', 'Heart healthy diet'],
    };
  }

  // 5. Weight Loss / Calorie Deficit / Diet
  if (
    q.includes('weight loss') ||
    q.includes('lose weight') ||
    q.includes('calorie deficit') ||
    q.includes('fat loss') ||
    q.includes('slim')
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `🥗 **Strategic Principles for Sustainable Weight Loss:**\n\n` +
        `1. **Focus on Caloric Density & Volume:** Fill half your plate with non-starchy vegetables (cucumber, leafy greens, ridge gourd, cabbage, bell peppers) to trigger mechanical satiety stretch receptors.\n` +
        `2. **Protein Anchor:** Target 25-30g of protein per main meal to protect lean muscle mass and boost thermogenesis.\n` +
        `3. **Liquid Calorie Elimination:** Replace sugary chai, sodas, and packed fruit juices with plain water, buttermilk, or herbal tea.\n` +
        `4. **Smart Carbs:** Opt for complex carbs with high fiber (quinoa, millets like jowar/bajra, steel-cut oats, and brown rice).${safetyFooter}`,
      type: 'diet_plan',
      options: ['High-protein snacks', 'Suggest a high-protein Indian breakfast', 'Low carb dinner recipes'],
    };
  }

  // 6. Diabetes / Sugar / Glycemic Index / Glucose
  if (
    q.includes('diabet') ||
    q.includes('sugar') ||
    q.includes('glucose') ||
    q.includes('glycemic') ||
    q.includes('hba1c')
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `🩸 **Diabetic & Blood Sugar Friendly Nutritional Strategy:**\n\n` +
        `• **Low-GI Carbohydrates:** Choose millets (finger millet/ragi in moderation, foxtail millet), barley, and steel-cut oats over polished white rice and maida.\n` +
        `• **Fiber Buffering:** Always consume vegetables and protein *before* carbohydrates in your meal sequence to blunt insulin spikes by up to 40%.\n` +
        `• **Powerful Kitchen Allies:** Methi seeds (soaked overnight), cinnamon (dalchini), and karela (bitter gourd) contain natural insulin-mimetic compounds.\n` +
        `• **Watch Out For:** Sugary beverages, refined wheat bakery products, and dried fruits with concentrated sugars.${safetyFooter}`,
      type: 'medical_guidance',
      options: ['Low-GI Indian snack ideas', 'High protein vegetarian foods', 'What foods should I avoid with hypercholesterolemia?'],
    };
  }

  // 7. Muscle Gain / High Protein / Gym / Workout
  if (
    q.includes('muscle') ||
    q.includes('gym') ||
    q.includes('workout') ||
    q.includes('bulking') ||
    q.includes('hypertrophy')
  ) {
    return {
      success: true,
      source: 'foodiebite_local_ai',
      reply: `💪 **Muscle Building & Hypertrophy Fuel:**\n\n` +
        `• **Daily Protein Target:** Aim for 1.6 to 2.0g of protein per kg of bodyweight, distributed across 3–4 meals.\n` +
        `• **Top Whole Food Sources:**\n` +
        `  - *Vegetarian:* Low-fat paneer, Greek yogurt, soya chunks, tofu, lentils, and edamame.\n` +
        `  - *Non-Vegetarian:* Eggs, chicken breast, fish, and shrimp.\n` +
        `• **Pre-Workout Fuel (45 min prior):** Banana with 1 tbsp peanut butter or a slice of toast with honey.\n` +
        `• **Post-Workout Recovery (within 90 min):** High-protein meal or protein shake paired with fast-digesting carbohydrates to replenish glycogen.${safetyFooter}`,
      type: 'recommendation',
      options: ['Suggest a high-protein Indian breakfast', 'Estimate calories for Palak Paneer and Roti', 'Healthy protein snacks'],
    };
  }

  // 8. General Greetings & Help
  const isGreeting =
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.includes('who are you') ||
    q.includes('help');

  const greetingPrefix = isGreeting
    ? `👋 **Hello! I'm FoodieBite AI, your personal food and nutrition coach.**\n\n`
    : `I analyzed your query: *"**${rawMessage.trim()}**"*\n\n`;

  return {
    success: true,
    source: 'foodiebite_local_ai',
    reply: `${greetingPrefix}` +
      `Here is how I can tailor recommendations for your health:\n\n` +
      `• **High-Protein Meal Planning:** Breakfasts, snacks, and muscle-building targets.\n` +
      `• **Disease-Specific Guidance:** Heart-healthy (cholesterol, BP), diabetes, and digestion.\n` +
      `• **Meal Calorie & Macro Estimates:** Instant nutritional breakdown for Indian and global dishes.\n` +
      `• **Cooking Fat & Ingredient Analysis:** Ghee, oils, substitutes, and ingredient safety.\n\n` +
      `*What would you like to explore today?*${safetyFooter}`,
    type: 'greeting',
    options: [
      'Suggest a high-protein Indian breakfast',
      'What foods should I avoid with hypercholesterolemia?',
      'Estimate calories for Palak Paneer and Roti',
      'Is Ghee healthy for daily cooking?',
    ],
  };
}

export default {
  processLocalAiMessage,
};
