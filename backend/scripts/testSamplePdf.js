const path = require('path');
const { processDocument } = require('../src/services/documentProcessorService');

async function testPdf() {
  const pdfPath = path.resolve(__dirname, '../scratch/sample_medical_report.pdf');
  console.log('Processing PDF:', pdfPath);
  const result = await processDocument(pdfPath, 'application/pdf');
  console.log('OCR / Extraction result:');
  console.log('  Success:', result.success);
  console.log('  Confidence:', result.confidence);
  console.log('  Document type:', result.documentType);
  console.log('  Text length:', result.text?.length);
  console.log('  Text sample:\n', result.text?.substring(0, 500));
}

testPdf().catch(console.error);
