const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/frontend/src/screens/MedicalReportsScreen.js', 'utf8');
console.log('File size:', content.length);
// Print lines that mention load, fetch, api, supabase, or storage
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('apiGet') || l.includes('loadReports') || l.includes('fetchReports') || l.includes('medicalReportsService') || l.includes('localStorage') || l.includes('reports') && l.includes('=')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
