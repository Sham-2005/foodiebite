const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/src/middleware/authMiddleware.js', 'utf8');
const lines = content.split('\n');
lines.slice(200, 260).forEach((l, i) => console.log((201+i) + ': ' + l));
