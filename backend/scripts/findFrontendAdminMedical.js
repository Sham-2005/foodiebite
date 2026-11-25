const fs = require('fs');
const path = require('path');
['frontend/src/services/api.js', 'frontend/src/services/adminService.js', 'frontend/src/screens/AdminDashboardScreen.js'].forEach(file => {
  const full = path.join('s:/files/food_app', file);
  if (!fs.existsSync(full)) return;
  const content = fs.readFileSync(full, 'utf8');
  content.split('\n').forEach((l, i) => {
    if (l.includes('medical-reports') || l.includes('MedicalReport') || l.includes('getAdminUserMedicalReports')) {
      console.log(`${file}:${i+1}: ${l.trim()}`);
    }
  });
});
