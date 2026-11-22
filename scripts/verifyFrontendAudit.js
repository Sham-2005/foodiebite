const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const srcDir = path.join(ROOT_DIR, 'frontend', 'src');

const suspicious = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // Check for hardcoded localhost backend or ports
    if (
      (/localhost:5000/i.test(line) ||
       /127\.0\.0\.1:5000/i.test(line) ||
       /10\.0\.2\.2:5000/i.test(line) ||
       /http:\/\//i.test(line)) &&
      !line.includes('//') && // ignore pure comment lines if not in code
      !line.includes('fonts.googleapis.com') &&
      !line.includes('w3.org')
    ) {
      suspicious.push({
        file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        line: idx + 1,
        text: line.trim()
      });
    }
  });
}

function traverse(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') {
        traverse(full);
      }
    } else if (e.isFile() && /\.(js|jsx|ts|tsx)$/.test(e.name)) {
      checkFile(full);
    }
  }
}

traverse(srcDir);

console.log(`Scan complete. Found ${suspicious.length} occurrences in frontend/src/ (excluding tests).`);
suspicious.forEach(s => console.log(`${s.file}:${s.line} -> ${s.text}`));
