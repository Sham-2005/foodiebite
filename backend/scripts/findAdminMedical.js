const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/src/controllers/adminController.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('MedicalReport') || l.includes('medical_reports') || l.includes('getUserMedicalReports') || l.includes('analyzeUserMedicalReport')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
