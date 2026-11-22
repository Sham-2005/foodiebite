const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../frontend/src/services/api.js');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('REACT_APP_API_URL') || line.includes('localhost:5000')) {
    matches.push({ lineNum: idx + 1, line: line.trim() });
  }
});

console.log(`Found ${matches.length} occurrences in api.js:`);
matches.forEach(m => console.log(`L${m.lineNum}: ${m.line}`));
