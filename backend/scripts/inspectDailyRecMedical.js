const fs = require('fs');
const content = fs.readFileSync('s:/files/food_app/backend/src/services/dailyRecommendationService.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('persistentReportDb') || l.includes('medical') || l.includes('health_profiles')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
