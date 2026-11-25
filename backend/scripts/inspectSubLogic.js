const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/frontend/src/services/medicalReportsService.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('subscribeToUserMedicalReports') || l.includes('getUserMedicalReports')) {
    console.log((i+1) + ': ' + l);
  }
});
