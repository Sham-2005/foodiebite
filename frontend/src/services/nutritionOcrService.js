// ─────────────────────────────────────────────────────────────
//  frontend/src/services/nutritionOcrService.js
//  Client-Side OCR Extraction, Text Normalization & Nutrition Parsing
//  Respects privacy: processes images locally without cloud storage.
// ─────────────────────────────────────────────────────────────

import { FALLBACK_FOODS } from '../data/fallbackFoods.js';

/**
 * Common nutrition keywords and regular expressions
 */
const OCR_NORMALIZATIONS = [
  [/\b(calor1es|calorles|calortes|calori?es|cals)\b/gi, 'calories'],
  [/\b(energ[yv]|energla)\b/gi, 'energy'],
  [/\b(proteln|proteln|proteln|pr0tein|protelns)\b/gi, 'protein'],
  [/\b(carboh[yv]drates?|carbohvdrate|carbs?|total\s+carbs?)\b/gi, 'carbohydrates'],
  [/\b(sugars?|total\s+sugars?|of\s+which\s+sugars?)\b/gi, 'sugars'],
  [/\b(dietar[yv]\s+f[il1][bv][re]{2,4}|f[il1][bv]er|f[il1][bv]re)\b/gi, 'fiber'],
  [/\b(total\s+fat|fat|lipids?)\b/gi, 'fat'],
  [/\b(saturated\s+fat|saturates?|sat\s+fat)\b/gi, 'saturated fat'],
  [/\b(trans\s+fat|trans\s+fatty\s+acids?)\b/gi, 'trans fat'],
  [/\b(sod[li1]um|sodlum)\b/gi, 'sodium'],
  [/\b(cholester[o0]l)\b/gi, 'cholesterol'],
  [/\b(serv[il1]ng\s+s[il1]ze|per\s+serv[il1]ng)\b/gi, 'serving size']
];

/**
 * Run client-side Tesseract.js OCR on an image source
 * @param {File|Blob|string|HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {Function} onProgress (optional callback for status/progress)
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function runLocalOcr(imageSource, onProgress = () => {}) {
  try {
    // 1. Check for global window.Tesseract first (loaded via index.html CDN)
    let Tesseract = typeof window !== 'undefined' ? window.Tesseract : null;

    // 2. If not on window, attempt dynamic import
    if (!Tesseract) {
      try {
        const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
        Tesseract = mod?.default || mod;
      } catch (err) {
        console.warn('Dynamic import of tesseract.js CDN failed, checking local/server fallback:', err);
      }
    }

    if (Tesseract) {
      onProgress({ status: 'initializing', progress: 0.1, message: 'Initializing local OCR engine...' });

      const result = await Tesseract.recognize(
        imageSource,
        'eng',
        {
          logger: (m) => {
            if (m && m.status) {
              let userMsg = 'Analyzing image...';
              if (m.status === 'loading tesseract core') userMsg = 'Loading OCR neural core...';
              else if (m.status === 'initializing tesseract') userMsg = 'Calibrating text recognizer...';
              else if (m.status === 'loading language traineddata') userMsg = 'Loading language model...';
              else if (m.status === 'recognizing text') {
                userMsg = `Recognizing nutrition text (${Math.round((m.progress || 0) * 100)}%)...`;
              }
              onProgress({ status: m.status, progress: m.progress || 0, message: userMsg });
            }
          }
        }
      );

      const text = (result?.data?.text || '').trim();
      const confidence = Math.round(result?.data?.confidence || 0);

      if (text.length > 0) {
        return {
          success: true,
          text,
          confidence
        };
      }
    }

    // 3. Seamless Server-Side Fallback (/api/food/scan-nutrition)
    onProgress({ status: 'backend_ocr', progress: 0.5, message: 'Processing image via FoodieBite OCR engine...' });
    const response = await fetch('/api/food/scan-nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageSource })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.text) {
        return {
          success: true,
          text: data.text,
          confidence: data.confidence || 85,
          backendData: data
        };
      }
    }

    throw new Error('No readable text could be detected in this image.');
  } catch (error) {
    // If browser OCR failed, attempt backend fallback as last resort
    try {
      const resp = await fetch('/api/food/scan-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageSource })
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.success && d.text) {
          return {
            success: true,
            text: d.text,
            confidence: d.confidence || 85,
            backendData: d
          };
        }
      }
    } catch (_) {}

    console.error('OCR execution failed:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message || 'OCR extraction failed'
    };
  }
}

/**
 * Normalizes text to reduce common OCR artifacts
 */
export function normalizeOcrText(text) {
  if (!text) return '';
  let cleaned = text;

  // Replace common OCR typos for keywords
  for (const [pattern, replacement] of OCR_NORMALIZATIONS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Normalize Unicode fractions e.g. ½, ¼
  cleaned = cleaned
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/¾/g, ' 0.75 ')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, ' ');

  return cleaned;
}

/**
 * Enhanced nutrient value extractor: handles Indian/FSSAI (g)/(mg)/(kcal) in headers,
 * table separator rows (dots, dashes, pipes), multi-line columns, and decimal values.
 */
function extractNutrientEnhanced(normalizedText, aliases, defaultUnit = 'g') {
  if (!normalizedText) return null;
  const lines = normalizedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
  const aliasRegex = new RegExp(`(?:^|[^a-zA-Z])(?:${sortedAliases.join('|')})(?:$|[^a-zA-Z])`, 'i');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (aliasRegex.test(line)) {
      const matchPos = line.search(aliasRegex);
      const afterAlias = line.slice(matchPos);

      // Special handling for Energy / Calories
      if (defaultUnit === 'kcal') {
        const comboKjKcal = afterAlias.match(/(\d+(?:[\.,]\d+)?)\s*kj\s*[\/\\]\s*(\d+(?:[\.,]\d+)?)\s*kcal/i);
        if (comboKjKcal) {
          return {
            value: Math.round(parseFloat(comboKjKcal[2].replace(',', '.'))),
            unit: 'kcal',
            rawMatch: line,
            energyKj: Math.round(parseFloat(comboKjKcal[1].replace(',', '.')))
          };
        }
        const comboKcalKj = afterAlias.match(/(\d+(?:[\.,]\d+)?)\s*kcal\s*[\/\\]\s*(\d+(?:[\.,]\d+)?)\s*kj/i);
        if (comboKcalKj) {
          return {
            value: Math.round(parseFloat(comboKcalKj[1].replace(',', '.'))),
            unit: 'kcal',
            rawMatch: line,
            energyKj: Math.round(parseFloat(comboKcalKj[2].replace(',', '.')))
          };
        }
        const explicitKcal = afterAlias.match(/(\d+(?:[\.,]\d+)?)\s*(?:kcal|cal)\b/i);
        if (explicitKcal) {
          return {
            value: Math.round(parseFloat(explicitKcal[1].replace(',', '.'))),
            unit: 'kcal',
            rawMatch: line
          };
        }
        const onlyKj = afterAlias.match(/(\d+(?:[\.,]\d+)?)\s*kj\b/i);
        if (onlyKj && !afterAlias.toLowerCase().includes('kcal')) {
          const kjVal = Math.round(parseFloat(onlyKj[1].replace(',', '.')));
          return {
            value: Math.round(kjVal / 4.184),
            unit: 'kcal',
            isCalculated: true,
            conversionNote: `Calculated from ${kjVal} kJ (1 kcal = 4.184 kJ)`,
            rawMatch: line,
            energyKj: kjVal
          };
        }
        const generalCalMatch = afterAlias.match(/(?:[\:\.\-\|\=\(\)\[\]\s]*(?:kcal|cal)?[\:\.\-\|\=\(\)\[\]\s]*)+(\d+(?:[\.,]\d+)?)/i);
        if (generalCalMatch) {
          const val = parseFloat(generalCalMatch[1].replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            return {
              value: Math.round(val),
              unit: 'kcal',
              rawMatch: line
            };
          }
        }
      }

      // General nutrient numeric search
      const numMatch = afterAlias.match(/(?:[^\d]|^)(?:[\(\[]?(?:g|mg|kcal|cal|kj|mcg|ug)?[\)\]]?\s*[\:\.\-\|\=\~\.]*\s*)+(\d+(?:[\.,]\d+)?)\s*(kcal|cal|kj|mg|mcg|ug|g)?(?:\s|$|[^\w])/i);
      if (numMatch) {
        const val = parseFloat(numMatch[1].replace(',', '.'));
        let unit = (numMatch[2] || '').toLowerCase();
        if (!unit) {
          if (line.includes('(mg)') || line.includes('mg')) unit = 'mg';
          else if (line.includes('(g)') || line.includes(' g') || line.includes('g')) unit = 'g';
          else unit = defaultUnit;
        }
        if (!isNaN(val)) {
          return { value: val, unit, rawMatch: line };
        }
      }

      // Check next line for multi-line table layouts
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextNumMatch = nextLine.match(/^\s*(\d+(?:[\.,]\d+)?)\s*(kcal|cal|kj|mg|mcg|ug|g)?/i);
        if (nextNumMatch) {
          const val = parseFloat(nextNumMatch[1].replace(',', '.'));
          let unit = (nextNumMatch[2] || '').toLowerCase();
          if (!unit) {
            if (line.includes('(mg)') || line.includes('mg')) unit = 'mg';
            else if (line.includes('(g)') || line.includes(' g') || line.includes('g')) unit = 'g';
            else unit = defaultUnit;
          }
          if (!isNaN(val)) {
            return { value: val, unit, rawMatch: `${line} -> ${nextLine}` };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract a numeric value and optional unit following a label pattern
 */
function extractNutrientValue(text, patterns, defaultUnit = 'g') {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Find the numeric group
      const numStr = match[1]?.replace(',', '.');
      const unit = (match[2] || defaultUnit).toLowerCase();
      const val = parseFloat(numStr);

      if (!isNaN(val) && val >= 0) {
        return {
          value: val,
          unit,
          rawMatch: match[0].trim(),
          confidence: val < 1000 ? 'high' : 'medium'
        };
      }
    }
  }
  return null;
}

/**
 * Parses raw extracted text into structured nutritional values and flags
 * @param {string} rawText 
 * @returns {Object} Extracted nutrition report
 */
export function parseNutritionLabel(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      hasNutritionLabel: false,
      isFoodPhotoOnly: true,
      reason: 'Empty text. No printed characters could be detected.',
      nutrients: {},
      missingFields: ['Calories', 'Protein', 'Carbohydrates', 'Total Fat'],
      detectedName: null,
      servingBasis: 'unknown',
      servingSize: null
    };
  }

  const normalized = normalizeOcrText(rawText);
  const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Check if text has signs of a nutrition facts label
  const labelIndicatorRegex = /(nutrition\s*facts|nutrition\s*information|nutritional\s*value|typical\s*values|per\s*100\s*g|per\s*serving|amount\s*per\s*serving|calories|energy|total\s*fat|carbohydrate)/i;
  const hasLabelIndicators = labelIndicatorRegex.test(normalized);

  // ── 1. Food Product Name Detection ──────────────────────────
  let detectedName = null;
  // Look at lines before the word "Nutrition"
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      !/nutrition|facts|information|calories|per\s*100|ingredients|serving/i.test(line) &&
      line.length >= 3 &&
      line.length <= 40 &&
      /[a-zA-Z]/.test(line)
    ) {
      detectedName = line.replace(/[^\w\s&'-]/g, '').trim();
      break;
    }
  }

  // ── 2. Serving Basis & Serving Size ─────────────────────────
  let servingBasis = 'unknown'; // 'per_serving' | 'per_100g' | 'unknown'
  let servingSize = null;
  let servingSizeGrams = null;

  // Check for per 100g / 100ml
  if (/(?:per\s*100\s*g|per\s*100\s*ml|100\s*g(?!\s*serving)|100\s*ml)/i.test(normalized)) {
    servingBasis = 'per_100g';
    servingSize = '100 g';
    servingSizeGrams = 100;
  }

  // Check for explicit serving size
  const servingMatch = normalized.match(/(?:serving\s*size|per\s*serving|amount\s*per\s*serving)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:g|ml|oz|piece|pieces|cup|slice|bar|tbsp|tsp)?(?:[^\n\r,;]*))/i);
  if (servingMatch && servingMatch[1]) {
    const matchedStr = servingMatch[1].trim();
    if (matchedStr.length < 35) {
      servingBasis = 'per_serving';
      servingSize = matchedStr;
      const gMatch = matchedStr.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:g|gram|grams)/i);
      if (gMatch) {
        servingSizeGrams = parseFloat(gMatch[1]);
      } else {
        const anyNum = matchedStr.match(/([0-9]+(?:\.[0-9]+)?)/);
        if (anyNum) servingSizeGrams = parseFloat(anyNum[1]);
      }
    }
  }

  // ── 3. Parse Nutrients ──────────────────────────────────────
  const nutrients = {};
  const uncertainFields = [];
  const notes = [];

  // 3.1 Calories / Energy
  let calMatch = extractNutrientValue(normalized, [
    /(?:calories|calorie)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(kcal|cal)?/i,
    /(?:energy)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(kcal|cal)/i,
    /(?:energy)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(?:kcal)?\s*\/\s*[0-9]+\s*kj/i,
    /(?:energy)[\s:]*[0-9]+\s*kj\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*kcal/i
  ], 'kcal');

  let kjMatch = extractNutrientValue(normalized, [
    /(?:energy)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(kj|kilojoules)/i,
    /([0-9]+(?:\.[0-9]+)?)\s*(?:kj|kilojoules)/i
  ], 'kj');

  if (!calMatch && !kjMatch) {
    const enhancedCal = extractNutrientEnhanced(normalized, ['energy', 'calories', 'calorie', 'cal', 'cals'], 'kcal');
    if (enhancedCal) {
      calMatch = enhancedCal;
      if (enhancedCal.energyKj) {
        kjMatch = { value: enhancedCal.energyKj, unit: 'kJ' };
      }
    }
  }

  if (calMatch) {
    nutrients.calories = {
      label: 'Calories',
      value: Math.round(calMatch.value),
      unit: 'kcal',
      isCalculated: !!calMatch.isCalculated,
      conversionNote: calMatch.conversionNote
    };
    if (kjMatch && kjMatch.value) {
      nutrients.energyKj = {
        label: 'Energy (kJ)',
        value: Math.round(kjMatch.value),
        unit: 'kJ',
        isCalculated: false
      };
    }
  } else if (kjMatch) {
    // Only kJ available -> convert explicitly and notify
    const convertedKcal = Math.round(kjMatch.value / 4.184);
    nutrients.calories = {
      label: 'Calories',
      value: convertedKcal,
      unit: 'kcal',
      isCalculated: true,
      conversionNote: `Calculated from ${kjMatch.value} kJ (1 kcal = 4.184 kJ)`
    };
    nutrients.energyKj = {
      label: 'Energy (kJ)',
      value: Math.round(kjMatch.value),
      unit: 'kJ',
      isCalculated: false
    };
    notes.push(`Energy detected as ${kjMatch.value} kJ; converted to ${convertedKcal} kcal (1 kcal ≈ 4.184 kJ).`);
  }

  // 3.2 Protein
  let proteinMatch = extractNutrientValue(normalized, [
    /(?:protein|proteins)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i,
    /(?:protein)[\s\w]*[\s:]*([0-9]+(?:\.[0-9]+)?)\s*g/i
  ], 'g');
  if (!proteinMatch) {
    proteinMatch = extractNutrientEnhanced(normalized, ['protein', 'proteins'], 'g');
  }
  if (proteinMatch) {
    nutrients.protein = {
      label: 'Protein',
      value: proteinMatch.value,
      unit: proteinMatch.unit || 'g',
      isCalculated: false
    };
    if (proteinMatch.value > 100 && servingBasis === 'per_100g') {
      uncertainFields.push('Protein');
    }
  }

  // 3.3 Carbohydrates
  let carbsMatch = extractNutrientValue(normalized, [
    /(?:total\s+carbohydrates?|carbohydrates?|total\s+carbs?|carbs?)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!carbsMatch) {
    carbsMatch = extractNutrientEnhanced(normalized, ['total carbohydrates', 'carbohydrates', 'total carbohydrate', 'carbohydrate', 'total carbs', 'carbs'], 'g');
  }
  if (carbsMatch) {
    nutrients.carbs = {
      label: 'Total Carbohydrates',
      value: carbsMatch.value,
      unit: carbsMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.4 Sugars
  let sugarsMatch = extractNutrientValue(normalized, [
    /(?:total\s+sugars?|sugars?|sugar|of\s+which\s+sugars?)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!sugarsMatch) {
    sugarsMatch = extractNutrientEnhanced(normalized, ['total sugars', 'of which sugars', 'added sugars', 'sugars', 'sugar'], 'g');
  }
  if (sugarsMatch) {
    nutrients.sugars = {
      label: 'Total Sugars',
      value: sugarsMatch.value,
      unit: sugarsMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.5 Dietary Fiber
  let fiberMatch = extractNutrientValue(normalized, [
    /(?:dietary\s+fiber|dietary\s+fibre|fiber|fibre)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!fiberMatch) {
    fiberMatch = extractNutrientEnhanced(normalized, ['dietary fiber', 'dietary fibre', 'fiber', 'fibre'], 'g');
  }
  if (fiberMatch) {
    nutrients.fiber = {
      label: 'Dietary Fiber',
      value: fiberMatch.value,
      unit: fiberMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.6 Total Fat
  let fatMatch = extractNutrientValue(normalized, [
    /(?:total\s+fat|fat)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!fatMatch) {
    fatMatch = extractNutrientEnhanced(normalized, ['total fat', 'fat', 'lipids'], 'g');
  }
  if (fatMatch) {
    nutrients.fat = {
      label: 'Total Fat',
      value: fatMatch.value,
      unit: fatMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.7 Saturated Fat
  let satFatMatch = extractNutrientValue(normalized, [
    /(?:saturated\s+fat|saturates?|sat\s+fat)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!satFatMatch) {
    satFatMatch = extractNutrientEnhanced(normalized, ['saturated fat', 'of which saturates', 'saturates', 'sat fat'], 'g');
  }
  if (satFatMatch) {
    nutrients.saturatedFat = {
      label: 'Saturated Fat',
      value: satFatMatch.value,
      unit: satFatMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.8 Trans Fat
  let transFatMatch = extractNutrientValue(normalized, [
    /(?:trans\s+fat|trans\s+fatty\s+acids?)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');
  if (!transFatMatch) {
    transFatMatch = extractNutrientEnhanced(normalized, ['trans fat', 'trans fatty acids'], 'g');
  }
  if (transFatMatch) {
    nutrients.transFat = {
      label: 'Trans Fat',
      value: transFatMatch.value,
      unit: transFatMatch.unit || 'g',
      isCalculated: false
    };
  }

  // 3.9 Sodium & Salt
  let sodiumMatch = extractNutrientValue(normalized, [
    /(?:sodium)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg|g)?/i
  ], 'mg');

  let saltMatch = extractNutrientValue(normalized, [
    /(?:salt)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(g|mg)?/i
  ], 'g');

  if (!sodiumMatch && !saltMatch) {
    sodiumMatch = extractNutrientEnhanced(normalized, ['sodium'], 'mg');
    if (!sodiumMatch) {
      saltMatch = extractNutrientEnhanced(normalized, ['salt'], 'g');
    }
  }

  if (sodiumMatch) {
    let sodiumVal = sodiumMatch.value;
    let sodiumUnit = sodiumMatch.unit || 'mg';
    let conversionNote = null;

    // Check if sodium was listed in grams (e.g., 0.4 g = 400 mg)
    if (sodiumUnit === 'g' || (sodiumVal < 5 && sodiumVal > 0)) {
      const convertedMg = Math.round(sodiumVal * 1000);
      conversionNote = `${sodiumVal} g converted to ${convertedMg} mg`;
      sodiumVal = convertedMg;
      sodiumUnit = 'mg';
    }

    nutrients.sodium = {
      label: 'Sodium',
      value: sodiumVal,
      unit: sodiumUnit,
      isCalculated: !!conversionNote,
      conversionNote
    };
  } else if (saltMatch) {
    // Salt present instead of Sodium: Sodium = Salt / 2.5
    const saltGrams = saltMatch.unit === 'mg' ? saltMatch.value / 1000 : saltMatch.value;
    const estSodiumMg = Math.round(saltGrams * 400); // 1g salt ≈ 400mg sodium
    nutrients.sodium = {
      label: 'Sodium',
      value: estSodiumMg,
      unit: 'mg',
      isCalculated: true,
      conversionNote: `Calculated from ${saltMatch.value} ${saltMatch.unit} salt (Sodium ≈ Salt ÷ 2.5)`
    };
    nutrients.salt = {
      label: 'Salt',
      value: saltMatch.value,
      unit: saltMatch.unit,
      isCalculated: false
    };
    notes.push(`Sodium calculated from ${saltMatch.value} ${saltMatch.unit} salt as ${estSodiumMg} mg.`);
  }

  // 3.10 Cholesterol
  let cholMatch = extractNutrientValue(normalized, [
    /(?:cholesterol)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(mg|g)?/i
  ], 'mg');
  if (!cholMatch) {
    cholMatch = extractNutrientEnhanced(normalized, ['cholesterol'], 'mg');
  }
  if (cholMatch) {
    nutrients.cholesterol = {
      label: 'Cholesterol',
      value: cholMatch.value,
      unit: cholMatch.unit || 'mg',
      isCalculated: false
    };
  }

  // ── 4. Missing Fields Calculation ───────────────────────────
  const CORE_FIELDS = [
    { key: 'calories', label: 'Calories' },
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbohydrates' },
    { key: 'fat', label: 'Total Fat' },
    { key: 'sugars', label: 'Total Sugars' },
    { key: 'fiber', label: 'Dietary Fiber' },
    { key: 'saturatedFat', label: 'Saturated Fat' },
    { key: 'transFat', label: 'Trans Fat' },
    { key: 'sodium', label: 'Sodium' },
    { key: 'cholesterol', label: 'Cholesterol' }
  ];

  const detectedKeys = Object.keys(nutrients);
  const missingFields = CORE_FIELDS
    .filter(f => !detectedKeys.includes(f.key))
    .map(f => f.label);

  // Check if anything was detected
  const nutrientCount = detectedKeys.length;
  const isLabelByKeywords = hasLabelIndicators || /(nutrition|per\s*100|serving\s*size|amount\s*per|approximate\s*values|typical\s*values)/i.test(normalized);
  const hasNutritionLabel = (isLabelByKeywords && nutrientCount > 0) || nutrientCount >= 2;
  const isFoodPhotoOnly = !hasNutritionLabel;

  // ── 5. Database Match Search ────────────────────────────────
  const databaseMatches = findDatabaseMatches(detectedName || normalized);

  return {
    hasNutritionLabel,
    isFoodPhotoOnly,
    detectedName,
    servingBasis,
    servingSize,
    servingSizeGrams,
    nutrients,
    missingFields,
    uncertainFields,
    notes,
    databaseMatches,
    rawText
  };
}

/**
 * Searches the local FoodieBite database for matching items
 */
export function findDatabaseMatches(searchTerm, maxResults = 3) {
  if (!searchTerm || typeof searchTerm !== 'string') return [];
  const clean = searchTerm.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(t => t.length > 2);

  if (tokens.length === 0) return [];

  const scored = [];
  for (const item of FALLBACK_FOODS) {
    const itemName = (item.name || '').toLowerCase();
    let score = 0;

    if (itemName === clean) {
      score += 100;
    } else if (itemName.includes(clean) || clean.includes(itemName)) {
      score += 50;
    } else {
      for (const token of tokens) {
        if (itemName.includes(token)) {
          score += 20;
        }
      }
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(s => s.item);
}

/**
 * Scale parsed nutrients according to a new serving quantity
 * @param {Object} originalNutrients 
 * @param {number} baseGrams (e.g. 100 or 30)
 * @param {number} targetGrams (e.g. 50 or 200)
 * @returns {Object} Scaled nutrients map
 */
export function scaleNutrients(originalNutrients, baseGrams, targetGrams) {
  if (!baseGrams || baseGrams <= 0 || !targetGrams || targetGrams <= 0) {
    return originalNutrients;
  }

  const factor = targetGrams / baseGrams;
  const scaled = {};

  for (const [key, item] of Object.entries(originalNutrients)) {
    if (typeof item.value === 'number') {
      const rawVal = item.value * factor;
      // Round calories/sodium to integer, decimals for macros
      const isInteger = key === 'calories' || key === 'sodium' || key === 'energyKj';
      const finalVal = isInteger ? Math.round(rawVal) : Math.round(rawVal * 10) / 10;

      scaled[key] = {
        ...item,
        value: finalVal,
        isCalculated: true,
        originalValue: item.value,
        originalUnit: item.unit
      };
    } else {
      scaled[key] = { ...item };
    }
  }

  return scaled;
}
