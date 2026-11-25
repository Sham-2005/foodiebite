const { buildUnifiedFoodDatabase } = require('../src/services/foodDatabaseService');

const catalog = buildUnifiedFoodDatabase();
const overlap = catalog.filter(f => f.isVegetarian && f.isNonVegetarian);
console.log(`Foods where isVegetarian=true AND isNonVegetarian=true: ${overlap.length}`);
if (overlap.length > 0) {
  console.log('Sample overlapping items:');
  overlap.slice(0, 10).forEach(f => {
    console.log(`- ${f.name} (ID: ${f.id}, Source: ${f.sourceDataset}, dietType: ${f.dietType})`);
  });
}

const neither = catalog.filter(f => !f.isVegetarian && !f.isNonVegetarian);
console.log(`Foods where NEITHER is true: ${neither.length}`);
if (neither.length > 0) {
  neither.slice(0, 10).forEach(f => {
    console.log(`- ${f.name} (ID: ${f.id}, Source: ${f.sourceDataset}, dietType: ${f.dietType})`);
  });
}
