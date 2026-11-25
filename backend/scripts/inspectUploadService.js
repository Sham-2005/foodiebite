const fs = require('fs');
const content = fs.readFileSync('frontend/src/services/medicalReportsService.js', 'utf8');
const lines = content.split('\n');

for (let i = 295; i < 360; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
