const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '../data/legacy_archive/medical_reports_db.json');
if (fs.existsSync(dbFile)) {
  console.log('legacy_archive/medical_reports_db.json exists! Content:');
  console.log(fs.readFileSync(dbFile, 'utf8').slice(0, 1000));
} else {
  console.log('legacy_archive/medical_reports_db.json does not exist.');
}

const persistentReportDb = path.join(__dirname, '../src/services/persistentReportDb.js');
if (fs.existsSync(persistentReportDb)) {
  console.log('\n--- persistentReportDb.js ---');
  console.log(fs.readFileSync(persistentReportDb, 'utf8').slice(0, 1000));
}
