const { FALLBACK_FOODS } = require('../src/ai/foodiebiteFallbackFoods');

const item = FALLBACK_FOODS.find(f => f.name.toLowerCase().includes('oats with almond'));
console.log('Sample fallback food:', JSON.stringify(item, null, 2));
