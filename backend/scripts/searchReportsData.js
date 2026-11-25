const fs = require('fs');
const path = require('path');

function searchFiles(dir, filter) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(searchFiles(fullPath, filter));
      } else if (filter(file, fullPath)) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

const pdfFiles = searchFiles('s:\\files\\food_app', (name) => name.endsWith('.pdf'));
console.log('PDF files found:', pdfFiles);

const uploads = searchFiles('s:\\files\\food_app\\backend\\uploads', () => true);
console.log('Uploads found:', uploads);
