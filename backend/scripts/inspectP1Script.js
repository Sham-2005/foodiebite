const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/scripts/runLiveP1Verification.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Medical Report Upload') || l.includes('f690d0aa') || l.includes('medical/upload') || l.includes('medical_reports')) {
    console.log(lines.slice(Math.max(0, i - 5), i + 20).join('\n'));
    console.log('---');
  }
});
