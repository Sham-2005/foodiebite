const fs = require('fs');
const content = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');
const lines = content.split('\n');

function extractMethod(startPattern, maxLines = 80) {
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

extractMethod('apiAdminGetFoodDatabase');
extractMethod('loadFoodsData');
extractMethod('loadUserMedicalReports');
