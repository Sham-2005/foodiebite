const fs = require('fs');
const content = fs.readFileSync('backend/src/controllers/adminController.js', 'utf8');
const lines = content.split('\n');

function extractMethod(startPattern, maxLines = 100) {
  let found = false;
  let count = 0;
  lines.forEach((l, i) => {
    if (!found && l.includes(startPattern)) {
      found = true;
      console.log(`\n--- Found ${startPattern} at line ${i + 1} ---`);
    }
    if (found && count < maxLines) {
      console.log(`${i + 1}: ${l}`);
      count++;
    }
  });
}

extractMethod('getUserMedicalReports');
extractMethod('getAllFoodsDatabase');
extractMethod('getFoodDatabaseStats');
