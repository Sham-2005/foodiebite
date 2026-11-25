const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/src/controllers/authController.js', 'utf8');
const lines = content.split('\n');
lines.slice(100).forEach((l, i) => console.log((101+i) + ': ' + l));
