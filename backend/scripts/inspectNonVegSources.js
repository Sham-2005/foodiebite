const { getAllFoods } = require('../src/ai/foodKnowledge');
const { FALLBACK_FOODS } = require('../src/services/foodiebiteFallbackFoods');

const primary = getAllFoods();
const primaryNonVeg = primary.filter(f => !f.vegetarian && !f.eggetarian);
console.log('Primary foods total:', primary.length);
console.log('Primary non-veg (!vegetarian && !eggetarian):', primaryNonVeg.length);
console.log('Primary veg (f.vegetarian):', primary.filter(f => f.vegetarian).length);
console.log('Primary eggetarian (f.eggetarian):', primary.filter(f => f.eggetarian).length);

console.log('Fallback foods total:', FALLBACK_FOODS.length);
console.log('Fallback foods with "non-vegetarian" in dietTags:', FALLBACK_FOODS.filter(f => (f.dietTags || []).includes('non-vegetarian')).length);
