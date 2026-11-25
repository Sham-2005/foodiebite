const fs = require('fs');

function showMethod(file, pattern) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log(`=== ${file} ===`);
  lines.forEach((l, i) => {
    if (l.includes(pattern)) {
      console.log(`${i+1}: ${l}`);
    }
  });
}

showMethod('backend/src/controllers/medicalController.js', 'upload');
showMethod('frontend/src/services/medicalReportsService.js', 'upload');
