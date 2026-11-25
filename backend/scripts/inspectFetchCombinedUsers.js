const fs = require('fs');
const content = fs.readFileSync('backend/src/controllers/adminController.js', 'utf8');
const lines = content.split('\n');

for (let i = 64; i < 115; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
