const fs = require('fs');
const content = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');
const lines = content.split('\n');

for (let i = 750; i < 865; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
