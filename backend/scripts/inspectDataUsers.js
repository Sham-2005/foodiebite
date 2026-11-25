const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../data/users_directory.json');
if (fs.existsSync(usersFile)) {
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  console.log(`users_directory.json has ${users.length} users:`);
  users.forEach(u => {
    console.log(`- ID: ${u.id || u.uid}, Email: ${u.email}, Name: ${u.name}, Role: ${u.role}`);
  });
} else {
  console.log('users_directory.json does not exist.');
}
