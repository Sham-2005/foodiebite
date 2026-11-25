const fs = require('fs');
const content = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');
const lines = content.split('\n');

for (let i = 2445; i < 2485; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
