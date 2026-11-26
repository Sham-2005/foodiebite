// ─────────────────────────────────────────────────────────────
//  backend/src/services/checkinAiService.js
//  FoodieBite Health Check-in AI Engine (Local Ollama + Deterministic Fallback)
//  Generates dynamic follow-up questions and comprehensive wellness analysis
//  Zero Cloud AI & Zero External API Dependencies
// ─────────────────────────────────────────────────────────────

'use strict';

const ollamaService = require('./ollamaService');

const AI_SLA_TIMEOUT_MS = parseInt(process.env.CHECKIN_AI_TIMEOUT_MS, 10) || 4000;

function normalizeAnswersMap(input) {
  const map = {};
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item) continue;
      const k = item.question_id || item.id || item.category;
      if (k) map[k] = item.answer_value !== undefined ? item.answer_value : item.value;
      if (item.category && !map[item.category]) map[item.category] = map[k];
    }
  } else if (input && typeof input === 'object') {
    Object.assign(map, input);
  }
  return map;
}

/**
 * Deterministic fallback dynamic questions generator
 */
function buildDeterministicFollowUpQuestions(rawAnswers = {}) {
  const answers = normalizeAnswersMap(rawAnswers);
  const followUps = [];

  // Check Energy / Fatigue
  const energy = String(answers.energy_level !== undefined ? answers.energy_level : (answers.q_energy_level || '')).toLowerCase();
  const fatigue = String(answers.unusual_fatigue || answers.energy_crashes || '').toLowerCase();
  if (fatigue.includes('lunch') || fatigue === 'yes' || energy.includes('1') || energy.includes('2') || energy.includes('exhausted') || energy.includes('sluggish') || energy === 'low' || energy === 'very low') {
    followUps.push({
      id: 'dyn_energy_timing',
      question_text: 'How long have you been experiencing lower energy levels, and does it seem related to your meal timing or sleep?',
      category: 'energy_fatigue',
      parent_category: 'energy_fatigue',
      question_category: 'dynamic_followup',
      question_type: 'single_choice',
      options: [
        'Just past 1-2 days',
        'Most of the past week',
        'Ongoing for several weeks',
        'Mainly after heavy or skipped meals'
      ],
      is_dynamic: true,
      is_ai_generated: true,
      is_optional: true
    });
  }

  // Check Digestion Discomfort
  const digestion = String(answers.digestive_discomfort || answers.digestive_issues || '').toLowerCase();
  const bloating = String(answers.bloating || answers.bloating_frequency || '').toLowerCase();
  const acidity = String(answers.acidity || '').toLowerCase();
  if (digestion.includes('bloating') || digestion === 'yes' || bloating.includes('daily') || bloating.includes('frequently') || acidity === 'frequently') {
    followUps.push({
      id: 'dyn_digestion_timing',
      question_text: 'When do you usually notice digestive discomfort or bloating?',
      category: 'digestion_gut',
      parent_category: 'digestion_gut',
      question_category: 'dynamic_followup',
      question_type: 'single_choice',
      options: [
        'Immediately after lunch or dinner',
        'Late in the evening / before bed',
        'When consuming dairy or fried foods',
        'Irregular / unpredictable times'
      ],
      is_dynamic: true,
      is_ai_generated: true,
      is_optional: true
    });
  }

  // Check Sleep Difficulties
  const sleepStr = String(answers.sleep_hours || answers.q_sleep_hours || '').toLowerCase();
  const sleepHours = sleepStr.includes('under') || sleepStr.includes('<') ? 4.5 : (parseFloat(sleepStr) || 7);
  const sleepQuality = String(answers.sleep_quality || answers.sleep_quality_rating || '').toLowerCase();
  const sleepTrouble = String(answers.sleep_difficulty || '').toLowerCase();
  if (sleepHours < 6.5 || sleepTrouble === 'yes' || sleepQuality.includes('poor') || sleepQuality === '1' || sleepQuality === '2' || sleepQuality === '3') {
    followUps.push({
      id: 'dyn_sleep_factors',
      question_text: 'Do you feel rested when waking in the morning, and do you consume caffeine close to bedtime?',
      category: 'sleep_quality',
      parent_category: 'sleep_quality',
      question_category: 'dynamic_followup',
      question_type: 'single_choice',
      options: [
        'Wake up feeling groggy; no late caffeine',
        'Wake up tired; consume tea/coffee in late evening',
        'Sleep schedule fluctuates widely',
        'Wake up multiple times during the night'
      ],
      is_dynamic: true,
      is_ai_generated: true,
      is_optional: true
    });
  }

  // Check Hydration
  const waterStr = String(answers.daily_water_liters || answers.water_intake || '').toLowerCase();
  const waterLiters = waterStr.includes('under') || waterStr.includes('<') ? 0.8 : (parseFloat(waterStr) || 2);
  const dehydrated = String(answers.feel_dehydrated || '').toLowerCase();
  if (waterLiters < 1.5 || dehydrated === 'frequently' || dehydrated === 'always' || waterStr.includes('under_1')) {
    followUps.push({
      id: 'dyn_hydration_obstacles',
      question_text: 'What is the main obstacle to drinking enough water throughout your day?',
      category: 'hydration_fluid',
      parent_category: 'hydration_fluid',
      question_category: 'dynamic_followup',
      question_type: 'single_choice',
      options: [
        'Busy workday / simply forget',
        'Prefer tea, coffee, or juices instead',
        'Limited access to clean water while commuting',
        'Do not feel thirsty often'
      ],
      is_dynamic: true,
      is_ai_generated: true,
      is_optional: true
    });
  }

  // Limit to maximum 3 high-impact questions
  return followUps.slice(0, 3);
}

/**
 * Generates dynamic follow-up questions using local Ollama (with SLA timeout fallback)
 */
async function generateDynamicFollowUpQuestions(answers = {}, userContext = {}) {
  const fallback = buildDeterministicFollowUpQuestions(answers);

  try {
    const status = await ollamaService.checkConnection(1500);
    if (!status.connected || !status.modelAvailable) {
      return fallback;
    }

    const systemPrompt = `You are FoodieBite AI, a friendly wellness questionnaire assistant.
Your goal is to inspect user answers from a health survey and generate 1 to 2 helpful, optional follow-up questions.

CRITICAL RULES:
1. NEVER diagnose medical conditions or give clinical treatment advice.
2. Focus strictly on lifestyle, eating habits, hydration, sleep hygiene, or energy patterns.
3. Return ONLY a valid JSON array of question objects adhering to this schema:
[
  {
    "question_text": "string",
    "question_category": "dynamic_followup",
    "question_type": "single_choice",
    "options": ["string", "string", "string"],
    "is_optional": true
  }
]
Do not wrap in extra prose. Output strictly valid JSON.`;

    const userPrompt = `User survey responses summary:
${JSON.stringify(answers, null, 2)}
Generate 1-2 relevant follow-up questions for clarification if fatigue, digestive discomfort, sleep difficulties, or irregular eating were noted. Otherwise return an empty array [].`;

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Ollama dynamic questions SLA exceeded (${AI_SLA_TIMEOUT_MS}ms)`));
      }, AI_SLA_TIMEOUT_MS);
      if (timeoutHandle && timeoutHandle.unref) timeoutHandle.unref();
    });

    const chatPromise = ollamaService.chat({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      options: { temperature: 0.3, num_predict: 250 },
      timeout: AI_SLA_TIMEOUT_MS
    });
    chatPromise.catch(() => {});

    const result = await Promise.race([chatPromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    let content = (result.content || '').trim();
    if (content.includes('```json')) {
      content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      content = content.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed.slice(0, 2).map((q, idx) => ({
        id: q.id || `dyn_ai_${Date.now()}_${idx}`,
        question_text: String(q.question_text || q.question || '').trim(),
        category: q.category || q.question_category || 'energy_fatigue',
        parent_category: q.parent_category || q.category || 'energy_fatigue',
        question_category: 'dynamic_followup',
        question_type: 'single_choice',
        options: Array.isArray(q.options) && q.options.length > 0 ? q.options.slice(0, 4) : ['Often', 'Occasionally', 'Rarely', 'Not sure'],
        is_dynamic: true,
        is_ai_generated: true,
        is_optional: true,
        sequence_order: 100 + idx
      })).filter(q => q.question_text.length > 10);

      if (sanitized.length > 0) return sanitized;
    }
    return fallback;
  } catch (err) {
    return fallback;
  }
}

/**
 * Deterministic rule-based fallback wellness analysis engine
 */
function buildDeterministicWellnessAnalysis(currentAnswers = {}, previousCheckins = [], userProfile = {}) {
  const energyRating = parseInt(currentAnswers.energy_level || currentAnswers.overall_health || 3, 10);
  const sleepHours = parseFloat(currentAnswers.sleep_hours) || 7;
  const sleepQuality = String(currentAnswers.sleep_quality || 'moderate').toLowerCase();
  const waterLiters = parseFloat(currentAnswers.daily_water_liters) || 2;
  const dietBalance = String(currentAnswers.diet_balance || 'balanced').toLowerCase();
  const skippedMeals = String(currentAnswers.skipped_meals || 'no').toLowerCase();
  const digestiveIssue = String(currentAnswers.digestive_discomfort || 'no').toLowerCase();
  const stressLevel = String(currentAnswers.stress_level || 'moderate').toLowerCase();

  const currentObservations = [];
  const positiveTrends = [];
  const decliningTrends = [];
  const areasToMonitor = [];
  const dietarySuggestions = [];
  const recommendedFoodCategories = [];

  // Sleep observations
  const sleepObservations = [];
  if (sleepHours >= 7 && (sleepQuality.includes('good') || sleepQuality.includes('excellent'))) {
    positiveTrends.push('Healthy sleep duration maintaining restfulness.');
    sleepObservations.push(`Averaging ${sleepHours} hours with positive self-reported quality.`);
  } else if (sleepHours < 6.5 || sleepQuality.includes('poor')) {
    decliningTrends.push('Reduced sleep duration may be impacting recovery.');
    areasToMonitor.push('Sleep hygiene and wind-down consistency.');
    sleepObservations.push(`Averaging ${sleepHours} hours; self-reported sleep quality is suboptimal.`);
    dietarySuggestions.push('Incorporate magnesium-rich evening meals like warm dal, roasted pumpkin seeds, or chamomile infusion.');
  }

  // Energy observations
  const energyObservations = [];
  if (energyRating >= 4) {
    positiveTrends.push('Consistent, high self-reported daytime energy levels.');
    energyObservations.push('Sustained energy throughout the active hours.');
  } else if (energyRating <= 2 || String(currentAnswers.unusual_fatigue || '').toLowerCase() === 'yes') {
    decliningTrends.push('Mild afternoon fatigue or low overall vitality noted.');
    areasToMonitor.push('Mid-day energy crashes and complex carbohydrate distribution.');
    energyObservations.push('Self-reported lower energy levels and noticeable fatigue.');
    dietarySuggestions.push('Pair lean proteins with low-GI complex carbs (e.g. whole wheat chapati with yellow dal) for steady glycemic release.');
  }

  // Hydration observations
  const hydrationObservations = [];
  if (waterLiters >= 2.5) {
    positiveTrends.push('Meeting recommended baseline daily water intake.');
    hydrationObservations.push(`Hydration is robust at ~${waterLiters}L daily.`);
  } else {
    areasToMonitor.push('Daily fluid intake below 2.5 liters.');
    hydrationObservations.push(`Current intake of ~${waterLiters}L indicates room for hydration improvement.`);
    dietarySuggestions.push('Add water-dense foods to lunch and snacks (cucumber salad, watermelon, tender coconut water, clear soups).');
    recommendedFoodCategories.push('Hydration-Rich Salads');
  }

  // Diet & Digestion observations
  const dietObservations = [];
  if (skippedMeals === 'yes' || skippedMeals === 'often') {
    areasToMonitor.push('Irregular meal timing and skipped meals.');
    dietObservations.push('Skipping meals can cause post-meal fatigue and late evening cravings.');
    dietarySuggestions.push('Prioritize meal regularity over restrictive dieting; prepare quick balanced snacks (nuts, roasted chana).');
  }

  if (digestiveIssue === 'yes' || String(currentAnswers.bloating || '').toLowerCase() === 'frequently') {
    areasToMonitor.push('Recurrent bloating or digestive sensitivity.');
    dietObservations.push('Mild digestive sensitivity reported.');
    dietarySuggestions.push('Opt for light, gut-friendly meals like probiotic curd/yogurt, moong dal khichdi, and avoid deep-fried foods.');
    recommendedFoodCategories.push('Probiotic & Soothing Foods');
  } else {
    dietObservations.push('Digestive comfort is stable with no acute sensitivities reported.');
  }

  // Activity observations
  const activityObservations = [];
  const activityMinutes = parseInt(currentAnswers.activity_minutes || 30, 10);
  if (activityMinutes >= 30) {
    positiveTrends.push(`Achieving ~${activityMinutes} mins of daily physical activity.`);
    activityObservations.push('Consistent moderate activity supports cardiovascular and digestive motility.');
  } else {
    areasToMonitor.push('Daily physical activity below 30 minutes.');
    activityObservations.push('Sedentary intervals can be balanced with light brisk walks post-meals.');
  }

  // Overall trend assessment compared to previous check-ins
  let trendAssessment = 'Stable';
  if (previousCheckins.length === 0) {
    trendAssessment = 'Baseline';
  } else if (positiveTrends.length > decliningTrends.length && positiveTrends.length >= 2) {
    trendAssessment = 'Improving';
  } else if (decliningTrends.length > positiveTrends.length && decliningTrends.length >= 2) {
    trendAssessment = 'Declining';
  }

  if (recommendedFoodCategories.length === 0) {
    recommendedFoodCategories.push('Whole Grains & Pulses', 'Fresh Leafy Vegetables', 'Lean Plant Proteins');
  }

  const wellnessSummary = `Your self-reported check-in indicates an overall ${trendAssessment.toLowerCase()} wellness pattern. ` +
    (positiveTrends.length > 0 ? `Key strengths include: ${positiveTrends[0].toLowerCase()} ` : '') +
    (areasToMonitor.length > 0 ? `Areas to focus on include: ${areasToMonitor[0].toLowerCase()}` : 'Keep up your consistent daily habits.');

  let score = 70;
  if (energyRating >= 4) score += 10;
  else if (energyRating <= 2) score -= 15;
  if (sleepHours >= 7 && (sleepQuality.includes('good') || sleepQuality.includes('excellent') || sleepQuality.includes('4') || sleepQuality.includes('5'))) score += 10;
  else if (sleepHours < 6 || sleepQuality.includes('poor') || sleepQuality.includes('1') || sleepQuality.includes('2')) score -= 12;
  if (waterLiters >= 2.0) score += 6;
  else score -= 8;
  if (positiveTrends.length >= 2) score += 5;
  if (areasToMonitor.length >= 3) score -= 8;

  score = Math.max(25, Math.min(96, Math.round(score)));

  let wellnessCategory = 'Good';
  if (score >= 80) wellnessCategory = 'Optimal';
  else if (score >= 65) wellnessCategory = 'Good';
  else if (score >= 45) wellnessCategory = 'Needs Attention';
  else wellnessCategory = 'High Risk';

  return {
    wellnessSummary,
    overall_wellness_score: score,
    overallWellnessScore: score,
    wellness_category: wellnessCategory,
    wellnessCategory,
    executive_summary: wellnessSummary,
    key_strengths: positiveTrends.length > 0 ? positiveTrends : ['Consistent participation in wellness tracking.'],
    primary_concerns: areasToMonitor.length > 0 ? areasToMonitor : ['Maintain balanced macronutrients and adequate hydration.'],
    category_evaluations: {
      energy: energyObservations.join(' ') || 'Energy reported at standard baseline.',
      sleep: sleepObservations.join(' ') || 'Sleep hygiene within expected parameters.',
      digestion: dietObservations.join(' ') || 'Digestive function regular.',
      hydration: hydrationObservations.join(' ') || 'Adequate fluid consumption.',
      activity: activityObservations.join(' ') || 'Moderate activity maintained.'
    },
    dietary_recommendations: {
      focus_nutrients: ['Complex Carbohydrates', 'Soluble Fiber', 'Hydrating Minerals (Potassium, Magnesium)'],
      foods_to_increase: recommendedFoodCategories,
      foods_to_limit: ['Refined sugars', 'Excessive caffeinated beverages', 'Heavy deep-fried snacks'],
      hydration_guidance: waterLiters < 2 ? 'Target 2.5 to 3.0 Liters daily with electrolyte-rich broths or coconut water.' : 'Maintain current fluid intake of 2.5-3.0 Liters.'
    },
    lifestyle_recommendations: {
      sleep: sleepHours < 7 ? 'Establish a 30-minute digital sunset and dim lighting before sleep.' : 'Maintain regular sleep-wake timing.',
      activity: 'Incorporate 20-30 minutes of brisk movement or light post-meal walking.',
      stress_management: 'Practice 5 minutes of focused diaphragmatic breathing during afternoon transition.'
    },
    red_flags: decliningTrends,
    disclaimer: 'This analysis provides general wellness insights and lifestyle suggestions based on self-reported data. FoodieBite is not a medical diagnosis or clinical prescription.',
    currentObservations: [
      `Overall self-rated health score: ${energyRating}/5.`,
      `Sleep duration: ${sleepHours} hours (${sleepQuality}).`,
      `Hydration: ${waterLiters} liters daily.`
    ],
    positiveTrends: positiveTrends.length > 0 ? positiveTrends : ['Consistent participation in wellness tracking.'],
    decliningTrends: decliningTrends.length > 0 ? decliningTrends : ['No acute declining wellness indicators reported.'],
    areasToMonitor: areasToMonitor.length > 0 ? areasToMonitor : ['Maintain balanced macronutrients and adequate hydration.'],
    sleepObservations,
    energyObservations,
    dietObservations,
    hydrationObservations,
    activityObservations,
    dietarySuggestions: dietarySuggestions.length > 0 ? dietarySuggestions : [
      'Maintain balanced portions of whole grains, vegetables, and lean proteins.',
      'Stay consistently hydrated with 2.5–3 liters of water daily.'
    ],
    recommendedFoodCategories,
    trendAssessment,
    limitations: 'Based strictly on user self-reported survey information without clinical lab verification.',
    medicalDisclaimer: 'This analysis provides general wellness insights and lifestyle suggestions based on self-reported data. FoodieBite is not a medical diagnosis or clinical prescription.'
  };
}

/**
 * Executes comprehensive Ollama AI wellness analysis (with fallback race)
 */
async function analyzeCheckinWellness({ currentAnswers = {}, previousCheckins = [], userProfile = {} }) {
  const fallback = buildDeterministicWellnessAnalysis(currentAnswers, previousCheckins, userProfile);

  try {
    const status = await ollamaService.checkConnection(1500);
    if (!status.connected || !status.modelAvailable) {
      return { ...fallback, _modelUsed: 'foodiebite-deterministic-wellness-v2' };
    }

    const systemPrompt = `You are FoodieBite AI — an intelligent, empathetic wellness analysis coach.
Analyze the user's latest self-reported health survey responses and past check-in history.

CRITICAL RULES:
1. NEVER diagnose diseases or make unlicensed clinical claims.
2. Clearly distinguish observations, trends, dietary suggestions, and limitations.
3. Output strictly valid JSON matching this schema:
{
  "wellnessSummary": "string",
  "currentObservations": ["string"],
  "positiveTrends": ["string"],
  "decliningTrends": ["string"],
  "areasToMonitor": ["string"],
  "sleepObservations": ["string"],
  "energyObservations": ["string"],
  "dietObservations": ["string"],
  "hydrationObservations": ["string"],
  "activityObservations": ["string"],
  "dietarySuggestions": ["string"],
  "recommendedFoodCategories": ["string"],
  "trendAssessment": "Improving" | "Stable" | "Declining" | "Fluctuating" | "Baseline",
  "limitations": "Based strictly on self-reported survey data.",
  "medicalDisclaimer": "This is general wellness and nutritional guidance, not a medical diagnosis."
}
Do NOT include markdown backticks around JSON. Output only valid JSON.`;

    const userPrompt = `USER PROFILE:
- Diet: ${userProfile.dietType || userProfile.diet || 'Vegetarian'}
- Goals: ${userProfile.healthGoals ? userProfile.healthGoals.join(', ') : 'General Wellness'}

CURRENT CHECK-IN RESPONSES:
${JSON.stringify(currentAnswers, null, 2)}

PREVIOUS CHECK-INS HISTORY (count: ${previousCheckins.length}):
${JSON.stringify(previousCheckins.slice(0, 3).map(c => ({
  date: c.completed_at || c.created_at,
  status: c.status,
  summary: c.wellness_summary || c.summary
})), null, 2)}

Provide your structured wellness analysis.`;

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Ollama wellness analysis SLA exceeded (${AI_SLA_TIMEOUT_MS}ms)`));
      }, AI_SLA_TIMEOUT_MS);
      if (timeoutHandle && timeoutHandle.unref) timeoutHandle.unref();
    });

    const chatPromise = ollamaService.chat({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      options: { temperature: 0.35, num_predict: 400 },
      timeout: AI_SLA_TIMEOUT_MS
    });
    chatPromise.catch(() => {});

    const result = await Promise.race([chatPromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    let content = (result.content || '').trim();
    if (content.includes('```json')) {
      content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      content = content.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(content);
    if (parsed && parsed.wellnessSummary) {
      return {
        wellnessSummary: parsed.wellnessSummary,
        currentObservations: Array.isArray(parsed.currentObservations) ? parsed.currentObservations : fallback.currentObservations,
        positiveTrends: Array.isArray(parsed.positiveTrends) ? parsed.positiveTrends : fallback.positiveTrends,
        decliningTrends: Array.isArray(parsed.decliningTrends) ? parsed.decliningTrends : fallback.decliningTrends,
        areasToMonitor: Array.isArray(parsed.areasToMonitor) ? parsed.areasToMonitor : fallback.areasToMonitor,
        sleepObservations: Array.isArray(parsed.sleepObservations) ? parsed.sleepObservations : fallback.sleepObservations,
        energyObservations: Array.isArray(parsed.energyObservations) ? parsed.energyObservations : fallback.energyObservations,
        dietObservations: Array.isArray(parsed.dietObservations) ? parsed.dietObservations : fallback.dietObservations,
        hydrationObservations: Array.isArray(parsed.hydrationObservations) ? parsed.hydrationObservations : fallback.hydrationObservations,
        activityObservations: Array.isArray(parsed.activityObservations) ? parsed.activityObservations : fallback.activityObservations,
        dietarySuggestions: Array.isArray(parsed.dietarySuggestions) ? parsed.dietarySuggestions : fallback.dietarySuggestions,
        recommendedFoodCategories: Array.isArray(parsed.recommendedFoodCategories) ? parsed.recommendedFoodCategories : fallback.recommendedFoodCategories,
        trendAssessment: ['Improving', 'Stable', 'Declining', 'Fluctuating', 'Baseline'].includes(parsed.trendAssessment) ? parsed.trendAssessment : 'Stable',
        limitations: parsed.limitations || fallback.limitations,
        medicalDisclaimer: parsed.medicalDisclaimer || fallback.medicalDisclaimer,
        _modelUsed: result.model || 'ollama:qwen2.5:0.5b'
      };
    }
    return { ...fallback, _modelUsed: 'foodiebite-deterministic-wellness-v2' };
  } catch (err) {
    return { ...fallback, _modelUsed: 'foodiebite-deterministic-wellness-v2' };
  }
}

module.exports = {
  generateDynamicFollowUpQuestions,
  generateDynamicFollowUps: generateDynamicFollowUpQuestions,
  analyzeCheckinWellness,
  buildDeterministicFollowUpQuestions,
  buildDeterministicWellnessAnalysis
};
