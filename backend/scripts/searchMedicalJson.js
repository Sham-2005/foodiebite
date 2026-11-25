const fs = require('fs');
const path = require('path');

function searchJsonFiles(dir) {
  let res = [];
  try {
    fs.readdirSync(dir).forEach(f => {
      if (f === 'node_modules' || f === '.git') return;
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        res = res.concat(searchJsonFiles(full));
      } else if (f.endsWith('.json')) {
        try {
          const c = fs.readFileSync(full, 'utf8');
          if (c.includes('sample_medical_report') || c.includes('medical_report') || c.includes('biomarker') || c.includes('ocr_confidence')) {
            res.push({ file: full, size: c.length });
          }
        } catch (_) {}
      }
    });
  } catch (_) {}
  return res;
}

console.log('JSON files with medical references:', searchJsonFiles('s:/files/food_app'));
