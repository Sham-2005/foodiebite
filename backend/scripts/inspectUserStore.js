const fs = require('fs');
const content = fs.readFileSync('backend/src/services/userStore.js', 'utf8');
console.log(content.slice(0, 1500));
