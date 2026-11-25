// ─────────────────────────────────────────────────────────────
//  backend/src/services/medicalReportAiService.js
//  FoodieBite Medical Report Intelligence & Ollama Local Analysis
//  Converts OCR Text & Lab Reports into Structured Clinical Tables
//  Generates Cautious, Educational AI Nutrition Analysis via Ollama
//  STRICT RULE: Zero Medical Diagnoses & Zero Hallucinated Foods
// ─────────────────────────────────────────────────────────────

'use strict';

const ollamaService = require('./ollamaService');
const { analyzeReport } = require('./medicalAnalysisService');
const { searchFood, getAllFoods } = require('../ai/foodKnowledge');
const { getGroundedFoodCandidates } = require('./groundedRecommendationService');

const MEDICAL_DISCLAIMER =
  'This analysis is informational only and is not a medical diagnosis or substitute for professional medical advice. Laboratory results should be interpreted by a qualified healthcare professional in the context of your medical history and symptoms.';

/**
 * Builds structured lab results table from extracted biomarkers and OCR text
 */
function buildStructuredTestResults(analysis, rawOcrText = '') {
  const table = [];
  const biomarkers = analysis.biomarkers || {};

  // 1. Process biomarkers detected by medicalAnalysisService
  for (const [key, b] of Object.entries(biomarkers)) {
    if (!b || b.value === null || b.value === undefined) continue;

    let statusLabel = 'Normal';
    const st = (b.status || '').toLowerCase();
    if (st === 'critical' || st === 'high') {
      statusLabel = 'High';
    } else if (st === 'low') {
      statusLabel = 'Low';
    } else if (st === 'unverified' || st === 'ambiguous') {
      statusLabel = 'Uncertain';
    }

    // Format reference range string
    let refRangeStr = 'N/A';
    if (b.referenceRange && Array.isArray(b.referenceRange.normal)) {
      const [min, max] = b.referenceRange.normal;
      if (min === -Infinity || min === 0) {
        refRangeStr = `< ${max} ${b.unit || ''}`.trim();
      } else if (max === Infinity) {
        refRangeStr = `> ${min} ${b.unit || ''}`.trim();
      } else {
        refRangeStr = `${min} - ${max} ${b.unit || ''}`.trim();
      }
    } else if (b.refRange) {
      refRangeStr = String(b.refRange);
    }

    table.push({
      key,
      test: b.label || key.replace(/([A-Z])/g, ' $1').trim(),
      result: typeof b.value === 'number' ? Number(b.value.toFixed(2)) : b.value,
      unit: b.unit || '',
      referenceRange: refRangeStr,
      status: statusLabel,
      confidence: b.confidence || 90,
      category: b.category || 'General'
    });
  }

  // 2. Scan OCR text for additional standard lab lines if table is sparse
  if (table.length === 0 && rawOcrText) {
    const lines = rawOcrText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/([a-zA-Z\s]{3,30})[:\s]+(\d+(?:\.\d+)?)\s*([a-zA-Z%µ/³]+)?(?:\s*\(?([0-9.\s\-–]+)\)?)?/i);
      if (match && match[1] && match[2]) {
        const testName = match[1].trim();
        const val = parseFloat(match[2]);
        const unit = (match[3] || '').trim();
        const range = (match[4] || 'Standard Lab Range').trim();
        if (testName.length > 2 && !table.some(t => t.test.toLowerCase() === testName.toLowerCase())) {
          table.push({
            key: testName.toLowerCase().replace(/\s+/g, '_'),
            test: testName,
            result: val,
            unit,
            referenceRange: range,
            status: 'Normal',
            confidence: 75,
            category: 'General'
          });
        }
      }
    }
  }

  return table;
}

/**
 * Calculates summary cards statistics from structured test table
 */
function calculateSummaryCards(testResults = []) {
  let withinRangeCount = 0;
  let outsideRangeCount = 0;
  let reviewCount = 0;

  for (const t of testResults) {
    const s = (t.status || '').toLowerCase();
    if (s === 'high' || s === 'low') {
      outsideRangeCount++;
      reviewCount++;
    } else if (s === 'uncertain' || s === 'review') {
      reviewCount++;
    } else {
      withinRangeCount++;
    }
  }

  return {
    totalTests: testResults.length,
    withinRangeCount,
    outsideRangeCount,
    reviewCount
  };
}

/**
 * Generates clinical system prompt for Local Ollama Model
 */
function buildOllamaMedicalPrompt({ testResults = [], userProfile = {}, candidateFoods = [] }) {
  const abnormalTests = testResults.filter(t => t.status === 'High' || t.status === 'Low' || t.status === 'Uncertain');
  const normalTests = testResults.filter(t => t.status === 'Normal');

  const abnormalList = abnormalTests.map(t =>
    `- ${t.test}: ${t.result} ${t.unit} (Status: ${t.status}, Reference Range: ${t.referenceRange})`
  ).join('\n') || 'None detected outside standard range.';

  const normalList = normalTests.map(t =>
    `- ${t.test}: ${t.result} ${t.unit} (Normal, Range: ${t.referenceRange})`
  ).join('\n') || 'None recorded.';

  const foodCandidatesSummary = candidateFoods.slice(0, 8).map((f, i) =>
    `${i + 1}. [ID: "${f.id}"] "${f.name}" - ${f.category} (${f.calories} kcal, ${f.protein}g protein). Benefits: ${(f.healthBenefits || []).join(', ')}`
  ).join('\n');

  const diet = userProfile.dietType || userProfile.diet || 'Vegetarian';
  const allergies = (userProfile.allergies && userProfile.allergies.length > 0) ? userProfile.allergies.join(', ') : 'None';

  return `You are FoodieBite's Clinical Nutrition & Medical Report Assistant.
Your task is to provide an objective, educational analysis of laboratory results and recommend supportive wholesome foods.

STRICT MEDICAL GUARDRAILS (DO NOT VIOLATE):
1. DO NOT DIAGNOSE DISEASES: Never state or imply that the user has a disease, syndrome, or medical condition based solely on laboratory values.
2. NO MEDICATIONS OR PRESCRIBING: Never recommend starting, altering, or stopping medications or clinical dosages.
3. CLEARLY DISTINGUISH SOURCES: Keep laboratory measurements distinct from educational nutritional insights.
4. ZERO HALLUCINATION POLICY FOR FOODS: You MUST choose recommended foods ONLY from the provided VERIFIED CANDIDATE FOODS list below. Do NOT invent new foods.
5. RESPECT DIETARY SAFETY: User diet is ${diet}. Allergies: ${allergies}.
6. PROFESSIONAL HEALTHCARE REFERRAL: Always advise discussing abnormal findings with a licensed physician or healthcare specialist.

LABORATORY FINDINGS TO ANALYZE:
[Values Outside Reference Range]:
${abnormalList}

[Values Within Normal Range]:
${normalList}

VERIFIED FOODIEBITE CANDIDATE FOODS:
${foodCandidatesSummary}

JSON OUTPUT SCHEMA:
Respond in valid JSON format with these exact keys:
{
  "summary": "Concise 2-3 sentence overview of the test results.",
  "observations": ["Bullet observation 1 identifying specific high/low measurements", "Bullet observation 2"],
  "generalInterpretation": "Educational explanation of what these physiological markers generally reflect, without diagnosing.",
  "nutritionConsiderations": "General dietary guidance relevant to balancing these nutritional or metabolic markers.",
  "foodSuggestions": [
    {
      "foodId": "actual_food_id_from_candidates",
      "foodName": "Exact Food Name",
      "reason": "Why this specific food supports the observed nutritional need",
      "benefits": "Key nutrients"
    }
  ],
  "healthcareGuidance": "Clear advice recommending discussion of out-of-range results with a qualified healthcare professional."
}`;
}

/**
 * Fallback generator when Ollama is unavailable
 */
function buildDeterministicMedicalAnalysis({ testResults = [], analysis = {}, userProfile = {}, candidateFoods = [] }) {
  const abnormalTests = testResults.filter(t => t.status === 'High' || t.status === 'Low');
  const normalTests = testResults.filter(t => t.status === 'Normal');

  const observations = [];
  for (const t of abnormalTests) {
    observations.push(`${t.test} measured at ${t.result} ${t.unit} (${t.status} relative to reference range ${t.referenceRange}).`);
  }
  if (observations.length === 0) {
    observations.push('All measured biomarkers are within the provided reference ranges.');
  }

  const foodProfile = analysis.foodProfile || {};
  const foodsToPrefer = foodProfile.foodsToPrefer || [];
  const foodsToLimit = foodProfile.foodsToLimit || [];

  const foodSuggestions = candidateFoods.slice(0, 4).map(c => ({
    foodId: c.id,
    foodName: c.name,
    reason: `Wholesome ${c.category} rich in balanced micronutrients and dietary fiber.`,
    benefits: (c.healthBenefits || ['Nutrient dense', 'Supports daily vitality']).slice(0, 2).join(', ')
  }));

  const abnormalCount = abnormalTests.length;
  const summary = abnormalCount > 0
    ? `The report includes ${testResults.length} extracted biomarker(s). ${abnormalCount} parameter(s) deviate from the provided reference ranges and warrant review.`
    : `The report includes ${testResults.length} extracted biomarker(s). All evaluated markers fall within the laboratory reference boundaries.`;

  const generalInterpretation = abnormalCount > 0
    ? 'Out-of-range laboratory values reflect metabolic, nutritional, or physiological variations. These variations can be influenced by diet, hydration, sleep, stress, and medications.'
    : 'All evaluated biomarkers appear balanced within the standard laboratory reference boundaries.';

  const nutritionConsiderations = foodsToPrefer.length > 0
    ? `Nutritional focus should prioritize foods rich in ${foodsToPrefer.slice(0, 4).join(', ')}. Minimize excessive intake of ${foodsToLimit.slice(0, 3).join(', ') || 'processed sugars and saturated fats'}.`
    : 'Maintain a balanced dietary pattern emphasizing whole grains, colorful vegetables, healthy fats, and adequate hydration.';

  const healthcareGuidance = abnormalCount > 0
    ? 'Please share these laboratory results with your doctor or healthcare provider for clinical correlation and personalized guidance.'
    : 'Continue regular preventive health screenings and consult your healthcare provider for routine health monitoring.';

  return {
    source: 'deterministic_engine',
    summary,
    observations,
    generalInterpretation,
    nutritionConsiderations,
    foodSuggestions,
    healthcareGuidance,
    disclaimer: MEDICAL_DISCLAIMER
  };
}

/**
 * Main Analysis Orchestrator
 * Performs full medical report intelligence using Local Ollama when online,
 * with graceful deterministic fallback when offline.
 */
async function generateMedicalReportIntelligence(report, userProfile = {}) {
  const rawOcrText = report.raw_ocr_text || report.rawOcrText || '';
  const notes = report.notes || '';

  // 1. Run deterministic biomarker extraction first
  let deterministicAnalysis = report.analysis;
  if (!deterministicAnalysis || !deterministicAnalysis.biomarkers || Object.keys(deterministicAnalysis.biomarkers).length === 0) {
    try {
      deterministicAnalysis = analyzeReport(rawOcrText, notes, {
        documentType: report.document_type || report.documentType || 'digital_pdf',
        ocrConfidence: report.ocr_confidence || report.ocrConfidence || 95
      });
    } catch (_) {
      deterministicAnalysis = { biomarkers: {}, findings: [], wellnessConcerns: [], foodProfile: {} };
    }
  }

  // 2. Build structured test table & summary cards
  const testResults = buildStructuredTestResults(deterministicAnalysis, rawOcrText);
  const summaryCards = calculateSummaryCards(testResults);

  // 3. Ground eligible candidate foods from FoodieBite database
  const queryContext = {
    keywords: testResults.map(t => t.key).concat(testResults.map(t => t.category)),
    isHighProtein: testResults.some(t => t.key.includes('hemoglobin') && t.status === 'Low')
  };
  const candidateFoods = getGroundedFoodCandidates(userProfile, queryContext);

  // 4. Check Ollama availability
  let aiAnalysis = null;
  let providerUsed = 'deterministic_engine';

  try {
    const status = await ollamaService.checkConnection(2000);
    if (status.connected && status.modelAvailable) {
      const prompt = buildOllamaMedicalPrompt({ testResults, userProfile, candidateFoods });

      const chatRes = await ollamaService.chat({
        messages: [{ role: 'user', content: prompt }],
        jsonMode: true,
        options: { temperature: 0.2, num_predict: 900 },
        timeout: 25000
      });

      if (chatRes && chatRes.content) {
        let parsed = null;
        try {
          const raw = chatRes.content.trim();
          const clean = raw.includes('```json')
            ? raw.split('```json')[1].split('```')[0].trim()
            : (raw.startsWith('{') ? raw : null);
          if (clean) parsed = JSON.parse(clean);
        } catch (_) {}

        if (parsed && (parsed.summary || parsed.observations)) {
          // Validate food suggestions against candidate foods
          const validFoods = [];
          const candidateMap = new Map(candidateFoods.map(c => [c.id, c]));
          const candidateNameMap = new Map(candidateFoods.map(c => [c.name.toLowerCase(), c]));

          if (Array.isArray(parsed.foodSuggestions)) {
            for (const fs of parsed.foodSuggestions) {
              let matched = candidateMap.get(fs.foodId) || candidateNameMap.get((fs.foodName || '').toLowerCase());
              if (matched) {
                validFoods.push({
                  foodId: matched.id,
                  foodName: matched.name,
                  reason: fs.reason || 'Supports daily nutritional requirements.',
                  benefits: fs.benefits || (matched.healthBenefits || []).join(', ')
                });
              }
            }
          }

          if (validFoods.length === 0 && candidateFoods.length > 0) {
            validFoods.push({
              foodId: candidateFoods[0].id,
              foodName: candidateFoods[0].name,
              reason: 'Selected for nutritional balance matching your dietary profile.',
              benefits: (candidateFoods[0].healthBenefits || []).join(', ')
            });
          }

          aiAnalysis = {
            source: 'ollama',
            model: chatRes.model || ollamaService.getSelectedModel(),
            summary: parsed.summary || 'Medical laboratory analysis completed.',
            observations: Array.isArray(parsed.observations) ? parsed.observations : [parsed.observations || 'Review completed.'],
            generalInterpretation: parsed.generalInterpretation || 'Results provide educational insights into physiological balance.',
            nutritionConsiderations: parsed.nutritionConsiderations || 'Emphasize whole foods aligned with your nutritional targets.',
            foodSuggestions: validFoods,
            healthcareGuidance: parsed.healthcareGuidance || 'Please consult your physician to interpret these findings clinically.',
            disclaimer: MEDICAL_DISCLAIMER
          };
          providerUsed = 'ollama';
        }
      }
    }
  } catch (ollamaErr) {
    console.warn('⚠️ [MedicalReportAi] Ollama analysis fallback triggered:', ollamaErr.message);
  }

  // 5. Fallback to deterministic medical analysis if Ollama did not produce output
  if (!aiAnalysis) {
    aiAnalysis = buildDeterministicMedicalAnalysis({
      testResults,
      analysis: deterministicAnalysis,
      userProfile,
      candidateFoods
    });
  }

  // 6. Build structured Health Summary with exact clinical sections
  const abnormalLaboratoryValues = testResults.filter(t => t.status === 'High' || t.status === 'Low');
  const normalLaboratoryValues = testResults.filter(t => t.status === 'Normal');
  const reportedConditions = deterministicAnalysis.findings || (deterministicAnalysis.wellnessConcerns && deterministicAnalysis.wellnessConcerns.map(c => c.concern)) || [];

  const healthSummary = {
    overallHealthSummary: aiAnalysis.summary,
    reportedMedicalConditions: reportedConditions.length > 0 ? reportedConditions : ['No explicit chronic diagnoses recorded on lab panel.'],
    abnormalLaboratoryValues,
    normalLaboratoryValues,
    importantHealthIndicators: testResults.slice(0, 8),
    potentialNutritionalConsiderations: aiAnalysis.nutritionConsiderations,
    dietaryRecommendationsRelevantToFoodieBite: aiAnalysis.foodSuggestions,
    itemsRequiringMedicalFollowUp: abnormalLaboratoryValues.length > 0
      ? abnormalLaboratoryValues.map(a => `${a.test} measured at ${a.result} ${a.unit} (${a.status} relative to ${a.referenceRange}) warrants clinical correlation.`)
      : ['All measured biomarkers within reference ranges; continue standard preventative screenings.'],
    healthcareGuidance: aiAnalysis.healthcareGuidance,
    reportDate: report.created_at || report.uploadDate || new Date().toISOString(),
    summaryGenerationDate: new Date().toISOString(),
    analysisStatus: 'Analysis Completed',
    disclaimer: MEDICAL_DISCLAIMER
  };

  return {
    success: true,
    provider: providerUsed,
    reportId: report.id,
    reportName: report.report_name || report.reportName || report.original_filename || 'Medical Report',
    uploadDate: report.created_at || report.uploadDate,
    processingStatus: report.processing_status || report.processingStatus || 'completed',
    documentType: report.document_type || report.documentType || 'digital_pdf',
    summaryCards,
    testResults,
    aiAnalysis,
    healthSummary,
    disclaimer: MEDICAL_DISCLAIMER
  };
}

module.exports = {
  buildStructuredTestResults,
  calculateSummaryCards,
  generateMedicalReportIntelligence,
  MEDICAL_DISCLAIMER
};
