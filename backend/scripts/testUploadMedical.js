const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = 'foodiebite_super_secret_key_change_in_production_2024';
const token = jwt.sign(
  { uid: 'c9662dab-f656-459d-9df7-71e9e1404160', email: 'shams5076.sse@saveetha.com', role: 'user' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

async function testUpload() {
  const pdfPath = path.resolve(__dirname, '../scratch/sample_medical_report.pdf');
  const fileData = fs.readFileSync(pdfPath);
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

  const bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="report"; filename="sample_medical_report.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    fileData,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\nQuarterly diabetes and lipid bloodwork\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reportName"\r\n\r\nComprehensive Metabolic & Lipid Panel\r\n`),
    Buffer.from(`--${boundary}--\r\n`)
  ]);

  const res = await fetch('http://localhost:5000/api/medical/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  const json = await res.json();
  console.log('Upload response status:', res.status);
  console.log('Response body:', JSON.stringify(json, null, 2));
}

testUpload().catch(console.error);
