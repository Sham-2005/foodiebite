// ─────────────────────────────────────────────────────────────
//  src/services/documentProcessorService.js
//  Document Processing Pipeline for Medical Reports
//
//  Pipeline Order:
//    1. Determine file type (Digital PDF, Scanned PDF, Image)
//    2. Extract text (pdf-parse for digital PDFs, Tesseract for images)
//    3. Evaluate OCR confidence
//    4. Detect handwritten prescriptions
//    5. Return classified result with extracted text
//
//  Gemini AI is NOT used here. OCR is done locally.
// ─────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

// ── Clinical report structural tokens ─────────────────────────
// If a document contains several of these, it is a printed lab report.
const CLINICAL_TOKENS = [
  'hemoglobin', 'hb', 'hba1c', 'glucose', 'fasting', 'cholesterol',
  'ldl', 'hdl', 'triglyceride', 'creatinine', 'urea', 'uric acid',
  'platelet', 'leucocyte', 'lymphocyte', 'bilirubin', 'sgot', 'sgpt',
  'tsh', 'thyroid', 'vitamin d', 'vitamin b12', 'ferritin',
  'reference', 'range', 'unit', 'mg/dl', 'g/dl', 'pg/ml', 'iu/l',
  'result', 'test', 'lab', 'laboratory', 'report', 'patient',
  'specimen', 'method', 'normal range', 'abnormal', 'low', 'high'
];

// ── Minimum token hit count to classify as a printed lab report ─
const MIN_TOKEN_HITS = 3;

/**
 * Classify OCR/extracted text into document types.
 *
 * @param {string} text  Extracted text
 * @param {number} confidence  0-100 confidence from OCR (100 = digital PDF)
 * @returns {{ type: string, confidence: number }}
 *   type: 'digital_pdf' | 'printed_scanned' | 'handwritten' | 'low_quality'
 */
function classifyDocument(text, confidence) {
  const lower = (text || '').toLowerCase();
  const tokenHits = CLINICAL_TOKENS.filter(t => lower.includes(t)).length;

  if (confidence < 50) {
    return { type: 'low_quality', confidence };
  }

  if (confidence < 80) {
    // Could be handwritten or very poor scan
    if (tokenHits >= MIN_TOKEN_HITS) {
      return { type: 'low_quality', confidence };
    }
    return { type: 'handwritten', confidence };
  }

  // confidence >= 80
  if (tokenHits >= MIN_TOKEN_HITS) {
    return { type: confidence === 100 ? 'digital_pdf' : 'printed_scanned', confidence };
  }

  // High confidence but no clinical tokens — likely not a medical report
  return { type: 'non_medical', confidence };
}

/**
 * Extract text from a digital PDF using pdf-parse (supporting both v1 and v2 APIs).
 * Returns { text, confidence: 100, source: 'pdf-parse', isScanned: boolean, images: Array }
 */
async function extractFromDigitalPdf(filePath) {
  try {
    const pdfParsePkg = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    let text = '';
    let embeddedImages = [];

    if (pdfParsePkg && typeof pdfParsePkg.PDFParse === 'function') {
      // pdf-parse v2+
      const parser = new pdfParsePkg.PDFParse({ data: dataBuffer });
      await parser.load();
      const result = await parser.getText();
      text = (result?.text || '').trim();

      // If text is minimal, check if there are embedded images
      if (text.length < 30 && typeof parser.getImage === 'function') {
        try {
          const imgResult = await parser.getImage();
          if (imgResult && imgResult.pages) {
            for (const page of imgResult.pages) {
              if (page.images && page.images.length > 0) {
                embeddedImages.push(...page.images);
              }
            }
          }
        } catch (imgErr) {
          console.warn('documentProcessorService: getImage warning:', imgErr.message);
        }
      }
      await parser.destroy();
    } else if (typeof pdfParsePkg === 'function') {
      // pdf-parse v1
      const parsed = await pdfParsePkg(dataBuffer);
      text = (parsed?.text || '').trim();
    }

    if (text.length < 30) {
      return { text: text || '', confidence: text.length > 0 ? 60 : 0, source: 'pdf-parse', isScanned: true, images: embeddedImages };
    }

    return { text, confidence: 100, source: 'pdf-parse', isScanned: false, images: [] };
  } catch (err) {
    console.warn('documentProcessorService: pdf-parse failed:', err.message);
    return { text: '', confidence: 0, source: 'pdf-parse', isScanned: true, images: [] };
  }
}

/**
 * Run Tesseract OCR on an image file (PNG/JPG/JPEG) or an image buffer.
 * Returns { text, confidence, source: 'tesseract' }
 */
async function runTesseractOCR(input) {
  try {
    const Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(input, 'eng', {
      logger: () => {} // Suppress verbose progress logs
    });

    const text = (data.text || '').trim();

    // Calculate average word confidence
    const words = (data.words || []);
    let avgConfidence = 0;
    if (words.length > 0) {
      const totalConf = words.reduce((sum, w) => sum + (w.confidence || 0), 0);
      avgConfidence = Math.round(totalConf / words.length);
    } else if (text.length > 0) {
      avgConfidence = 75;
    }

    return { text, confidence: avgConfidence, source: 'tesseract' };
  } catch (err) {
    console.error('documentProcessorService: Tesseract OCR failed:', err.message);
    return { text: '', confidence: 0, source: 'tesseract' };
  }
}

/**
 * Main entry point.
 *
 * @param {string} filePath  Absolute path to the uploaded file
 * @param {string} mimeType  MIME type string (e.g. 'application/pdf', 'image/jpeg')
 * @returns {Promise<{
 *   success: boolean,
 *   text: string,
 *   confidence: number,
 *   documentType: string,
 *   source: string,
 *   rejectionReason?: string,
 *   userMessage?: string
 * }>}
 */
async function processDocument(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  const isPdf = mimeType === 'application/pdf' || ext === '.pdf';

  let extractionResult = { text: '', confidence: 0, source: 'none', isScanned: false };

  // ── Step 1: Extract text ─────────────────────────────────────
  if (isPdf) {
    extractionResult = await extractFromDigitalPdf(filePath);

    // If digital text was scarce, check for embedded images to OCR with Tesseract
    if (extractionResult.isScanned && extractionResult.images && extractionResult.images.length > 0) {
      console.log(`documentProcessorService: Found ${extractionResult.images.length} embedded images in PDF, running Tesseract OCR...`);
      let combinedOcrText = extractionResult.text || '';
      let totalConf = 0;
      let imgCount = 0;

      for (const img of extractionResult.images.slice(0, 5)) { // process up to 5 images
        if (img.data) {
          const ocr = await runTesseractOCR(img.data);
          if (ocr.text) {
            combinedOcrText += '\n' + ocr.text;
            totalConf += ocr.confidence;
            imgCount++;
          }
        }
      }

      if (combinedOcrText.trim().length > 0) {
        extractionResult = {
          text: combinedOcrText.trim(),
          confidence: imgCount > 0 ? Math.round(totalConf / imgCount) : 80,
          source: 'tesseract',
          isScanned: true
        };
      }
    }
  } else {
    // Image file — always OCR
    extractionResult = await runTesseractOCR(filePath);
  }

  const { text, confidence, source } = extractionResult;

  // ── Step 2: Validate readable text presence ──────────────────
  if (!text || text.trim().length < 5) {
    return {
      success: false,
      text: '',
      confidence: 0,
      documentType: 'unreadable',
      source,
      rejectionReason: 'unreadable_pdf',
      userMessage: 'Could not extract readable text from this PDF. Please ensure the document is clear, printed, and not password protected.'
    };
  }

  // ── Step 3: Classify document (flexible) ──────────────────────
  const classification = classifyDocument(text, confidence);

  if (classification.type === 'handwritten') {
    return {
      success: false,
      text,
      confidence,
      documentType: 'handwritten',
      source,
      rejectionReason: 'handwritten',
      userMessage: 'Handwritten prescriptions cannot be analyzed reliably with OCR. Please upload a printed laboratory or diagnostic report.'
    };
  }

  if (classification.type === 'low_quality' && confidence < 30) {
    return {
      success: false,
      text,
      confidence,
      documentType: 'low_quality',
      source,
      rejectionReason: 'low_confidence',
      userMessage: `This report could not be read clearly (OCR confidence: ${confidence}%). Please upload a clearer printed PDF.`
    };
  }

  // Accept digital_pdf, printed_scanned, and non_standard medical reports flexibly
  return {
    success: true,
    text,
    confidence: confidence || (classification.type === 'digital_pdf' ? 100 : 85),
    documentType: classification.type === 'non_medical' ? 'printed_scanned' : classification.type,
    source
  };
}

module.exports = { processDocument };
