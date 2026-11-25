const fs = require('fs');
const content = fs.readFileSync('backend/src/services/foodDatabaseService.js', 'utf8');
const lines = content.split('\n');

for (let i = 60; i < 120; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
