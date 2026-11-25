const { getFoodDatabaseStats, buildUnifiedFoodDatabase } = require('../src/services/foodDatabaseService');

const stats = getFoodDatabaseStats();
console.log('REAL STATS FROM foodDatabaseService:');
console.log(JSON.stringify(stats, null, 2));

const catalog = buildUnifiedFoodDatabase();
console.log('\nCATALOG LENGTH:', catalog.length);
let countVeg = 0, countNonVeg = 0, countVegan = 0, countEgg = 0;
catalog.forEach(f => {
  if (f.isVegetarian) countVeg++;
  if (f.isNonVegetarian) countNonVeg++;
  if (f.isVegan) countVegan++;
  if (f.isEggetarian) countEgg++;
});
console.log(`Counts -> Veg: ${countVeg}, NonVeg: ${countNonVeg}, Vegan: ${countVegan}, Eggetarian: ${countEgg}`);
console.log(`Veg + NonVeg = ${countVeg + countNonVeg} (Catalog length: ${catalog.length})`);
