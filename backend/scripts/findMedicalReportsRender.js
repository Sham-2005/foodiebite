const fs = require('fs');
const content = fs.readFileSync('frontend/src/screens/AdminDashboardScreen.js', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('No Medical Reports Uploaded') || l.includes('userMedicalReports.length === 0')) {
    console.log(`${i+1}: ${l}`);
  }
});
