const medicalReportStore = require('../src/services/medicalReportStore');

async function testStore() {
  console.log('Testing medicalReportStore...');
  const uid = 'c9662dab-f656-459d-9df7-71e9e1404160';
  const email = 'shams5076.sse@saveetha.com';

  const byUid = medicalReportStore.getReportsByUserId(uid);
  console.log(`Reports by UID (${uid}): count = ${byUid.length}`);

  const byEmail = medicalReportStore.getReportsByUserId(email);
  console.log(`Reports by Email (${email}): count = ${byEmail.length}`);

  const counts = medicalReportStore.getAllReportsCountByUser();
  console.log('Counts summary:', counts);

  const rep = byUid[0];
  console.log('Report details:');
  console.log('  ID:', rep?.id);
  console.log('  Name:', rep?.reportName);
  console.log('  File:', rep?.original_filename);
  console.log('  Biomarkers:', Object.keys(rep?.analysis?.biomarkers || {}));
  console.log('  File path:', medicalReportStore.getReportFilePath(rep?.id));
}

testStore().catch(console.error);
