/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/config/confidenceLevels.js
 *  FoodieBite — Extraction Confidence Levels & Reason Registry (Phase 2)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Defines standardized confidence levels and machine-readable reason codes
 *  for biomarker extraction from clinical medical reports.
 * ─────────────────────────────────────────────────────────────
 */

const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: 'high',      // Digital PDF, exact adjacent label match, recognized unit
  MEDIUM: 'medium',  // Digital PDF with inferred unit or fuzzy proximity match, or clean printed OCR
  LOW: 'low'         // Scanned/handwritten OCR, low quality image, or unrecognized unit
});

const CONFIDENCE_REASONS = Object.freeze({
  EXACT_LABEL_MATCH: 'exact_label_match',       // Exact label adjacent match in digital PDF
  FUZZY_PROXIMITY_MATCH: 'fuzzy_proximity_match',// Matching label within surrounding text paragraph
  OCR_EXTRACTION: 'ocr_extraction',             // Extracted via Tesseract OCR from image/scanned PDF
  UNIT_INFERRED: 'unit_inferred',               // Unit missing in text; canonical unit assumed
  UNIT_UNRECOGNIZED: 'unit_unrecognized',       // Unit variant not recognized by unitConversionService
  LOW_QUALITY_SOURCE: 'low_quality_source'      // Document classified as handwritten or low_quality
});

module.exports = {
  CONFIDENCE_LEVELS,
  CONFIDENCE_REASONS
};
