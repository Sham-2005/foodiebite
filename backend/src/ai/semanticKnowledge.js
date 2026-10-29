// ─────────────────────────────────────────────────────────────
//  backend/src/ai/semanticKnowledge.js
//  Phase 12 Local Semantic Concept Graph Engine
// ─────────────────────────────────────────────────────────────

const CONCEPT_GRAPH = {
  'high-protein': {
    foods: ['chicken_breast', 'boiled_egg', 'egg_white_omelette', 'protein_shake', 'paneer_curry', 'tofu_stir_fry', 'soy_chunks_curry', 'dal_tadka', 'greek_yogurt', 'mutton_curry', 'sprouts_salad'],
    related: ['muscle-gain', 'post-workout', 'protein-rich'],
    opposite: 'low-protein',
    macroFocus: { minProtein: 15 }
  },
  'light-meal': {
    foods: ['idli', 'upma', 'poha', 'khichdi', 'rasam', 'sprouts_salad', 'cucumber_salad', 'curd_rice', 'green_tea'],
    related: ['low-calorie', 'easy-digestion', 'weight-loss'],
    opposite: 'heavy-meal',
    macroFocus: { maxCalories: 250 }
  },
  'heavy-meal': {
    foods: ['veg_biryani', 'chicken_biryani', 'dal_makhani', 'alooparatha', 'butter_naan', 'mutton_curry'],
    related: ['filling', 'comfort-food', 'indulgent'],
    opposite: 'light-meal',
    macroFocus: { minCalories: 400 }
  },
  'post-workout': {
    foods: ['protein_shake', 'boiled_egg', 'egg_white_omelette', 'chicken_breast', 'tofu_stir_fry', 'greek_yogurt', 'sprouts_salad'],
    related: ['high-protein', 'muscle-gain', 'recovery'],
    opposite: null,
    macroFocus: { minProtein: 20 }
  },
  'pre-workout': {
    foods: ['banana', 'apple', 'oats', 'peanut_butter_toast', 'black_coffee', 'coconut_water'],
    related: ['energy-boosting', 'quick-carbs'],
    opposite: null,
    macroFocus: { minCarbs: 20 }
  },
  'weight-loss': {
    foods: ['sprouts_salad', 'oats', 'quinoa', 'egg_white_omelette', 'clear_soup', 'green_tea', 'tofu_stir_fry', 'rasam'],
    related: ['light-meal', 'low-calorie', 'high-fiber'],
    opposite: 'weight-gain',
    macroFocus: { maxCalories: 350, minFiber: 3 }
  },
  'muscle-gain': {
    foods: ['protein_shake', 'chicken_breast', 'boiled_egg', 'paneer_curry', 'soy_chunks_curry', 'mutton_curry', 'greek_yogurt'],
    related: ['high-protein', 'post-workout'],
    opposite: null,
    macroFocus: { minProtein: 25 }
  },
  'spicy': {
    foods: ['chicken_chettinad', 'misal_pav', 'kadai_paneer', 'pork_vindaloo', 'kolhapuri_mutton', 'chicken_65', 'chole'],
    related: ['bold-flavor', 'south-indian-spicy'],
    opposite: 'non-spicy',
    macroFocus: {}
  },
  'non-spicy': {
    foods: ['idli', 'curd_rice', 'khichdi', 'dal_tadka', 'steamed_veggies', 'oats', 'cow_milk', 'banana'],
    related: ['mild', 'soothing', 'easy-digestion'],
    opposite: 'spicy',
    macroFocus: {}
  }
};

function getRelatedConcepts(conceptKey) {
  const norm = (conceptKey || '').toLowerCase().trim();
  const entry = CONCEPT_GRAPH[norm];
  return entry ? entry.related : [];
}

function getFoodsForConcept(conceptKey) {
  const norm = (conceptKey || '').toLowerCase().trim();
  const entry = CONCEPT_GRAPH[norm];
  return entry ? entry.foods : [];
}

function getOppositeConcept(conceptKey) {
  const norm = (conceptKey || '').toLowerCase().trim();
  const entry = CONCEPT_GRAPH[norm];
  return entry ? entry.opposite : null;
}

function inferImpliedConcepts(text) {
  const norm = (text || '').toLowerCase();
  const implied = [];

  if (norm.includes('gym') || norm.includes('workout')) implied.push('post-workout', 'high-protein');
  if (norm.includes('starving') || norm.includes('pet bharna')) implied.push('heavy-meal');
  if (norm.includes('halka') || norm.includes('light')) implied.push('light-meal');
  if (norm.includes('cutting') || norm.includes('fat loss')) implied.push('weight-loss');
  if (norm.includes('bulking') || norm.includes('muscle')) implied.push('muscle-gain');

  return implied;
}

module.exports = {
  CONCEPT_GRAPH,
  getRelatedConcepts,
  getFoodsForConcept,
  getOppositeConcept,
  inferImpliedConcepts
};
