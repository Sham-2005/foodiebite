const fs = require('fs');
const content = fs.readFileSync('frontend/src/services/api.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('function getToken') || line.includes('const getToken')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
