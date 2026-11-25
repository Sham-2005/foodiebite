const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/src/controllers/adminController.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('getUserDetails =') || l.includes('exports.getUserDetails')) {
    console.log(lines.slice(i, i + 60).join('\n'));
  }
});
