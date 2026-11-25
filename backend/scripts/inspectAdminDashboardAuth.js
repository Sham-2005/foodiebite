const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/frontend/src/screens/AdminDashboardScreen.js', 'utf8');
const lines = content.split('\n');
lines.slice(0, 80).forEach((l, i) => {
  if (l.includes('login') || l.includes('token') || l.includes('auth') || l.includes('session')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
