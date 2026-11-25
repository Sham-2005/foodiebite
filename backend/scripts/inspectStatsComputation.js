const fs = require('fs');
const content = fs.readFileSync('backend/src/services/foodDatabaseService.js', 'utf8');
const lines = content.split('\n');

let start = false;
let count = 0;
lines.forEach((l, i) => {
  if (l.includes('function getFoodDatabaseStats') || l.includes('const getFoodDatabaseStats')) {
    start = true;
  }
  if (start && count < 60) {
    console.log(`${i + 1}: ${l}`);
    count++;
  }
});
