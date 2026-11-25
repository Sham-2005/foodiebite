const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/frontend/src/services/api.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('function apiLogin') || l.includes('export const apiLogin')) {
    console.log(lines.slice(i, i + 35).join('\n'));
  }
});
