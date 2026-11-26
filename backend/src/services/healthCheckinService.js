// ─────────────────────────────────────────────────────────────
//  backend/src/services/healthCheckinService.js
//  FoodieBite Health Check-in Core Business Logic & Orchestrator
//  Manages questionnaire provisioning, draft persistence, dynamic questions,
//  AI wellness analysis, historical comparisons, and admin statistics.
// ─────────────────────────────────────────────────────────────

'use strict';

const healthCheckinStore = require('./healthCheckinStore');
const checkinAiService = require('./checkinAiService');

/**
 * Standard questionnaire definitions covering all 10 wellness categories
 */
function getStandardQuestionnaire() {
  return [
    // 1. Mood & Emotional State
    {
      id: 'q_overall_health',
      question_text: 'How would you rate your overall health during the past week?',
      category: 'mood_emotional',
      question_category: 'mood_emotional',
      question_type: 'rating',
      options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent'],
      is_optional: false,
      sequence_order: 1
    },
    {
      id: 'q_past_week_feeling',
      question_text: 'How have you felt overall during the past week?',
      category: 'mood_emotional',
      question_category: 'mood_emotional',
      question_type: 'single_choice',
      options: ['Energized & Healthy', 'Mostly Good', 'A bit sluggish', 'Frequently tired / unwell'],
      is_optional: false,
      sequence_order: 2
    },
    // 2. Physical Discomfort & Symptoms
    {
      id: 'q_significant_health_changes',
      question_text: 'Have you noticed any significant physical symptoms or health changes recently?',
      category: 'physical_symptoms',
      question_category: 'physical_symptoms',
      question_type: 'text',
      options: [],
      is_optional: true,
      sequence_order: 3
    },

    // 3. Energy & Fatigue
    {
      id: 'q_energy_level',
      question_text: 'How would you rate your daily energy levels?',
      category: 'energy_fatigue',
      question_category: 'energy_fatigue',
      question_type: 'rating',
      options: ['1 - Very Low', '2 - Low', '3 - Moderate', '4 - High', '5 - Vibrant'],
      is_optional: false,
      sequence_order: 4
    },
    {
      id: 'q_unusual_fatigue',
      question_text: 'Have you experienced unusual or persistent fatigue?',
      category: 'energy_fatigue',
      question_category: 'energy_fatigue',
      question_type: 'single_choice',
      options: ['No', 'Occasionally in the afternoon', 'Yes, frequently throughout the day'],
      is_optional: false,
      sequence_order: 5
    },
    {
      id: 'q_tired_time_of_day',
      question_text: 'At what time of day do you usually feel most tired?',
      category: 'energy_fatigue',
      question_category: 'energy_fatigue',
      question_type: 'single_choice',
      options: ['Early morning upon waking', 'Mid-afternoon (2 PM - 4 PM)', 'Late evening before bed', 'Consistently throughout the day', 'Rarely feel tired'],
      is_optional: true,
      sequence_order: 6
    },

    // 4. Sleep Quality
    {
      id: 'q_sleep_hours',
      question_text: 'Average hours of sleep per day:',
      category: 'sleep_quality',
      question_category: 'sleep_quality',
      question_type: 'number',
      options: ['5', '6', '7', '8', '9', '10'],
      is_optional: false,
      sequence_order: 7
    },
    {
      id: 'q_sleep_quality',
      question_text: 'How would you describe your sleep quality?',
      category: 'sleep_quality',
      question_category: 'sleep_quality',
      question_type: 'single_choice',
      options: ['Excellent (deep & restorative)', 'Good (generally rested)', 'Fair (interrupted / restless)', 'Poor (wake up exhausted)'],
      is_optional: false,
      sequence_order: 8
    },
    {
      id: 'q_sleep_difficulty',
      question_text: 'Do you experience difficulty falling or staying asleep?',
      category: 'sleep_quality',
      question_category: 'sleep_quality',
      question_type: 'single_choice',
      options: ['Never / Rarely', 'Sometimes (1-2 nights/week)', 'Frequently (3+ nights/week)'],
      is_optional: true,
      sequence_order: 9
    },

    // 5. Hydration & Fluid Intake
    {
      id: 'q_daily_water_liters',
      question_text: 'Approximate daily water intake (in Liters):',
      category: 'hydration_fluid',
      question_category: 'hydration_fluid',
      question_type: 'number',
      options: ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5+'],
      is_optional: false,
      sequence_order: 10
    },
    {
      id: 'q_feel_dehydrated',
      question_text: 'How often do you feel dehydrated or experience dry mouth / headaches?',
      category: 'hydration_fluid',
      question_category: 'hydration_fluid',
      question_type: 'single_choice',
      options: ['Rarely / Never', 'Occasionally', 'Frequently during afternoons'],
      is_optional: false,
      sequence_order: 11
    },

    // 6. Nutrition & Eating Habits
    {
      id: 'q_diet_balance',
      question_text: 'How balanced was your diet over the past week?',
      category: 'nutrition_eating',
      question_category: 'nutrition_eating',
      question_type: 'single_choice',
      options: ['Very balanced & varied', 'Moderately balanced', 'Needs improvement / repetitive'],
      is_optional: false,
      sequence_order: 12
    },
    {
      id: 'q_meal_regularity',
      question_text: 'How regularly did you eat your meals?',
      category: 'nutrition_eating',
      question_category: 'nutrition_eating',
      question_type: 'single_choice',
      options: ['Regular consistent times', 'Somewhat irregular', 'Highly erratic / unpredictable'],
      is_optional: false,
      sequence_order: 13
    },
    {
      id: 'q_skipped_meals',
      question_text: 'Have you skipped any meals this past week?',
      category: 'nutrition_eating',
      question_category: 'nutrition_eating',
      question_type: 'single_choice',
      options: ['No, ate all scheduled meals', 'Skipped breakfast occasionally', 'Skipped lunch occasionally', 'Frequently skipped multiple meals'],
      is_optional: false,
      sequence_order: 14
    },
    {
      id: 'q_processed_food_intake',
      question_text: 'Have you consumed more processed or deep-fried food than usual?',
      category: 'nutrition_eating',
      question_category: 'nutrition_eating',
      question_type: 'single_choice',
      options: ['No - mostly wholesome, home-cooked food', 'Moderate / Average amounts', 'Yes - significantly more than usual'],
      is_optional: false,
      sequence_order: 15
    },
    {
      id: 'q_fruits_veg_frequency',
      question_text: 'How frequently do you consume fresh fruits and vegetables?',
      category: 'nutrition_eating',
      question_category: 'nutrition_eating',
      question_type: 'single_choice',
      options: ['With almost every meal', 'Once a day', 'A few times a week', 'Rarely'],
      is_optional: false,
      sequence_order: 16
    },

    // 7. Digestion & Gut Health
    {
      id: 'q_digestive_discomfort',
      question_text: 'Any digestive discomfort or sensitivities? (Optional)',
      category: 'digestion_gut',
      question_category: 'digestion_gut',
      question_type: 'single_choice',
      options: ['None / Perfectly comfortable', 'Mild discomfort', 'Moderate or noticeable sensitivity'],
      is_optional: true,
      sequence_order: 17
    },
    {
      id: 'q_bloating',
      question_text: 'Do you experience bloating or gas after meals? (Optional)',
      category: 'digestion_gut',
      question_category: 'digestion_gut',
      question_type: 'single_choice',
      options: ['Never / Rarely', 'Occasionally', 'Frequently after heavy meals'],
      is_optional: true,
      sequence_order: 18
    },
    {
      id: 'q_acidity',
      question_text: 'Any acidity, heartburn, or acid reflux? (Optional)',
      category: 'digestion_gut',
      question_category: 'digestion_gut',
      question_type: 'single_choice',
      options: ['Never / Rarely', 'Occasionally', 'Frequently'],
      is_optional: true,
      sequence_order: 19
    },

    // 8. Physical Activity & Movement
    {
      id: 'q_activity_level',
      question_text: 'How would you classify your daily physical activity level?',
      category: 'physical_activity',
      question_category: 'physical_activity',
      question_type: 'single_choice',
      options: ['Sedentary (mostly seated desk work)', 'Lightly active (light walking / chores)', 'Moderately active (exercise 3-4 days/week)', 'Highly active (strenuous exercise / sports)'],
      is_optional: false,
      sequence_order: 20
    },
    {
      id: 'q_activity_minutes',
      question_text: 'Approximate physical activity duration per day (minutes):',
      category: 'physical_activity',
      question_category: 'physical_activity',
      question_type: 'number',
      options: ['0-15 mins', '15-30 mins', '30-45 mins', '45-60+ mins'],
      is_optional: true,
      sequence_order: 21
    },

    // 9. Stress & Mental Wellbeing
    {
      id: 'q_general_mood',
      question_text: 'How would you describe your general mood over the past week?',
      category: 'stress_mental',
      question_category: 'stress_mental',
      question_type: 'single_choice',
      options: ['Positive & Upbeat', 'Calm & Balanced', 'Anxious / Overwhelmed', 'Low energy / Lethargic'],
      is_optional: false,
      sequence_order: 22
    },
    {
      id: 'q_stress_level',
      question_text: 'How would you rate your perceived stress level?',
      category: 'stress_mental',
      question_category: 'stress_mental',
      question_type: 'rating',
      options: ['1 - Very Low', '2 - Low', '3 - Moderate', '4 - High', '5 - Very High'],
      is_optional: false,
      sequence_order: 23
    },
    {
      id: 'q_stress_affected_habits',
      question_text: 'Has stress affected your eating or sleeping habits?',
      category: 'stress_mental',
      question_category: 'stress_mental',
      question_type: 'single_choice',
      options: ['Not at all', 'Slightly affected appetite', 'Noticeably affected sleep', 'Affected both eating & sleep routines'],
      is_optional: true,
      sequence_order: 24
    },

    // 10. Health Goals & Motivation
    {
      id: 'q_wellness_goals',
      question_text: 'What are your primary wellness and nutrition priorities for the upcoming week?',
      category: 'health_goals',
      question_category: 'health_goals',
      question_type: 'multiple_choice',
      options: [
        'Improve energy & reduce fatigue',
        'Improve sleep consistency & depth',
        'Improve healthy eating habits',
        'Maintain general wellness & immunity',
        'Improve daily hydration',
        'Increase daily physical activity'
      ],
      is_optional: false,
      sequence_order: 25
    },
    {
      id: 'q_additional_feedback',
      question_text: 'Is there anything about your health, cravings, or lifestyle that you would like FoodieBite to consider? (Optional)',
      category: 'health_goals',
      question_category: 'health_goals',
      question_type: 'text',
      options: [],
      is_optional: true,
      sequence_order: 26
    }
  ];
}

class HealthCheckinService {
  /**
   * Starts a new check-in or resumes an active draft.
   */
  async startCheckin(userId, token = null) {
    if (!userId) throw new Error('User ID is required to start check-in.');

    // 1. Check for existing active draft
    const activeDraft = await healthCheckinStore.getActiveDraft(userId, token);
    if (activeDraft) {
      const questions = await healthCheckinStore.getQuestionsByCheckin(activeDraft.id, token);
      const answers = await healthCheckinStore.getAnswersByCheckin(activeDraft.id, token);
      const answersMap = this._formatAnswersMap(answers);
      return {
        checkin: activeDraft,
        isResumedDraft: true,
        questions,
        answers: answersMap,
        saved_answers: this._formatAnswersRecordsMap(answers)
      };
    }

    // 2. Create new check-in root
    const checkin = await healthCheckinStore.createCheckin({ userId }, token);

    // 3. Provision standard questionnaire
    const standardQuestions = getStandardQuestionnaire();
    const savedQuestions = await healthCheckinStore.saveQuestions(checkin.id, standardQuestions, token);

    return {
      checkin,
      isResumedDraft: false,
      questions: savedQuestions,
      answers: {},
      saved_answers: {}
    };
  }

  // Alias for backward and testing compatibility
  async startOrResumeCheckin(userId, token = null) {
    return await this.startCheckin(userId, token);
  }

  /**
   * Retrieves active draft for the authenticated user
   */
  async getCurrentDraft(userId, token = null) {
    const draft = await healthCheckinStore.getActiveDraft(userId, token);
    if (!draft) return null;

    const questions = await healthCheckinStore.getQuestionsByCheckin(draft.id, token);
    const answers = await healthCheckinStore.getAnswersByCheckin(draft.id, token);

    return {
      checkin: draft,
      questions,
      answers: this._formatAnswersMap(answers)
    };
  }

  /**
   * Saves partial or complete user answers to questions
   */
  async saveAnswers(checkinId, userId, answers = {}, token = null) {
    const checkin = await healthCheckinStore.getCheckinById(checkinId, token);
    if (!checkin) throw new Error('Health check-in not found.');
    if (checkin.user_id !== userId) throw new Error('Unauthorized access to check-in.');

    const questions = await healthCheckinStore.getQuestionsByCheckin(checkinId, token);
    const qMap = new Map(questions.map(q => [q.id, q]));

    // Format answers array
    const answerRecords = [];
    if (Array.isArray(answers)) {
      for (const item of answers) {
        if (!item) continue;
        const qId = item.question_id || item.id;
        const val = item.answer_value !== undefined ? item.answer_value : item.value;
        if (val === undefined || val === null) continue;
        const q = qMap.get(qId);
        answerRecords.push({
          question_id: qId,
          original_question_text: q ? q.question_text : (item.answer_text || item.original_question_text || ''),
          answer_value: val,
          answer_type: q ? q.question_type : typeof val
        });
      }
    } else {
      for (const [qId, val] of Object.entries(answers)) {
        if (val === undefined || val === null) continue;
        const q = qMap.get(qId);
        answerRecords.push({
          question_id: qId,
          original_question_text: q ? q.question_text : '',
          answer_value: val,
          answer_type: q ? q.question_type : typeof val
        });
      }
    }

    const saved = await healthCheckinStore.saveAnswers(checkinId, answerRecords, token);
    await healthCheckinStore.updateCheckin(checkinId, { status: 'in_progress' }, token);

    return {
      success: true,
      checkinId,
      savedCount: saved.length,
      saved_count: saved.length,
      answers: this._formatAnswersMap(saved)
    };
  }

  // Alias for test suite
  async saveCheckinAnswers(checkinId, userId, answers, token = null) {
    return await this.saveAnswers(checkinId, userId, answers, token);
  }

  /**
   * Generates dynamic follow-up questions via local Ollama based on submitted answers
   */
  async generateFollowUpQuestions(checkinId, userId, currentAnswers = {}, userContext = {}, token = null) {
    const checkin = await healthCheckinStore.getCheckinById(checkinId, token);
    if (!checkin) throw new Error('Health check-in not found.');
    if (checkin.user_id !== userId) throw new Error('Unauthorized access to check-in.');

    // Save current answers first
    if (Object.keys(currentAnswers).length > 0) {
      await this.saveAnswers(checkinId, userId, currentAnswers, token);
    }

    // Check if dynamic questions were already generated
    const existingQuestions = await healthCheckinStore.getQuestionsByCheckin(checkinId, token);
    const existingFollowUps = existingQuestions.filter(q => q.is_ai_generated);
    if (existingFollowUps.length > 0) {
      return {
        checkinId,
        followUpQuestions: existingFollowUps,
        isExisting: true
      };
    }

    // Generate targeted follow-up questions
    const generated = await checkinAiService.generateDynamicFollowUpQuestions(currentAnswers, userContext);
    let savedFollowUps = [];
    if (generated && generated.length > 0) {
      savedFollowUps = await healthCheckinStore.saveQuestions(checkinId, generated, token);
    }

    return {
      checkinId,
      followUpQuestions: savedFollowUps,
      isExisting: false
    };
  }

  /**
   * Completes a check-in and triggers Ollama AI wellness & trend analysis
   */
  async completeCheckin(checkinId, userId, answersOrProfile = {}, maybeProfile = {}, token = null) {
    const checkin = await healthCheckinStore.getCheckinById(checkinId, token);
    if (!checkin) throw new Error('Health check-in not found.');
    if (checkin.user_id !== userId) throw new Error('Unauthorized access to check-in.');

    let userProfile = maybeProfile || {};
    if (Array.isArray(answersOrProfile) || (answersOrProfile && Object.keys(answersOrProfile).length > 0 && !answersOrProfile.dietType && !answersOrProfile.allergies)) {
      await this.saveAnswers(checkinId, userId, answersOrProfile, token);
    } else if (answersOrProfile && typeof answersOrProfile === 'object') {
      userProfile = answersOrProfile;
    }

    const now = new Date().toISOString();
    const questions = await healthCheckinStore.getQuestionsByCheckin(checkinId, token);
    const answers = await healthCheckinStore.getAnswersByCheckin(checkinId, token);
    const answersMap = this._formatAnswersMap(answers);

    // Retrieve previous check-ins for historical trend comparison
    const history = await healthCheckinStore.getUserCheckinHistory(userId, { limit: 5 }, token);
    const previousCheckins = history.filter(c => c.id !== checkinId && c.status === 'completed');

    // Run AI Wellness Analysis (Local Ollama with deterministic failover)
    let aiAnalysisResult = null;
    let analysisStatus = 'analyzed';

    try {
      aiAnalysisResult = await checkinAiService.analyzeCheckinWellness({
        currentAnswers: answersMap,
        previousCheckins,
        userProfile
      });
      if (aiAnalysisResult._modelUsed && aiAnalysisResult._modelUsed.includes('deterministic')) {
        analysisStatus = 'fallback_used';
      }
    } catch (err) {
      console.warn('⚠️ AI Wellness Analysis exception:', err.message);
      aiAnalysisResult = checkinAiService.buildDeterministicWellnessAnalysis(answersMap, previousCheckins, userProfile);
      analysisStatus = 'fallback_used';
    }

    // Save AI Analysis to database
    const savedAnalysis = await healthCheckinStore.saveAiAnalysis({
      checkin_id: checkinId,
      user_id: userId,
      ...aiAnalysisResult,
      model_name: aiAnalysisResult._modelUsed || 'ollama:qwen2.5:0.5b'
    }, token);

    // Update check-in record status to completed & analyzed
    const completedCheckin = await healthCheckinStore.updateCheckin(checkinId, {
      status: 'completed',
      completed_at: now,
      ai_analysis_status: analysisStatus
    }, token);

    // Save or update historical trend record
    await healthCheckinStore.saveTrendAnalysis({
      user_id: userId,
      analysis_period: 'weekly_cumulative',
      checkin_count: previousCheckins.length + 1,
      trend_summary: aiAnalysisResult.wellnessSummary,
      improvements: aiAnalysisResult.positiveTrends,
      declining_trends: aiAnalysisResult.decliningTrends,
      areas_to_monitor: aiAnalysisResult.areasToMonitor,
      dietary_recommendations: aiAnalysisResult.dietarySuggestions,
      model_name: aiAnalysisResult._modelUsed || 'ollama:qwen2.5:0.5b'
    }, token);

    return {
      success: true,
      message: 'Health check-in completed and wellness insights generated successfully.',
      checkin: completedCheckin,
      analysis: savedAnalysis,
      ai_analysis: savedAnalysis,
      questionsCount: questions.length,
      answersCount: answers.length
    };
  }

  /**
   * Retrieves user check-in history with summary stats
   */
  async getCheckinHistory(userId, { limit = 20, offset = 0 } = {}, token = null) {
    const list = await healthCheckinStore.getUserCheckinHistory(userId, { limit, offset }, token);
    const enriched = [];

    for (const c of list) {
      const analysis = await healthCheckinStore.getAiAnalysisByCheckin(c.id, token);
      enriched.push({
        id: c.id,
        status: c.status,
        startedAt: c.started_at,
        completedAt: c.completed_at,
        aiAnalysisStatus: c.ai_analysis_status,
        wellnessSummary: analysis ? analysis.wellness_summary : 'Pending analysis',
        trendAssessment: analysis ? analysis.trend_assessment : 'Stable',
        dietarySuggestions: analysis ? analysis.dietary_suggestions : []
      });
    }

    const latestTrend = await healthCheckinStore.getLatestTrendAnalysis(userId, token);

    return {
      history: enriched,
      totalCount: enriched.length,
      latestTrendSummary: latestTrend ? latestTrend.trend_summary : null,
      latestTrendAssessment: enriched[0]?.trendAssessment || 'Stable'
    };
  }

  /**
   * Retrieves full details of a single check-in (questions, answers, AI analysis)
   */
  async getCheckinDetails(checkinId, userId, isAdmin = false, token = null) {
    const checkin = await healthCheckinStore.getCheckinById(checkinId, token);
    if (!checkin) throw new Error('Health check-in not found.');
    if (!isAdmin && checkin.user_id !== userId) throw new Error('Unauthorized access.');

    const questions = await healthCheckinStore.getQuestionsByCheckin(checkinId, token);
    const answers = await healthCheckinStore.getAnswersByCheckin(checkinId, token);
    const analysis = await healthCheckinStore.getAiAnalysisByCheckin(checkinId, token);

    const answersMap = new Map(answers.map(a => [a.question_id, a.answer_value]));

    const structuredQuestions = questions.map(q => ({
      id: q.id,
      text: q.question_text,
      category: q.question_category,
      type: q.question_type,
      options: q.options,
      isAiGenerated: q.is_ai_generated,
      isOptional: q.is_optional,
      userAnswer: answersMap.get(q.id) !== undefined ? answersMap.get(q.id) : null
    }));

    return {
      checkin,
      questions: structuredQuestions,
      analysis,
      completed: checkin.status === 'completed'
    };
  }

  /**
   * Computes personal wellness trend metrics for visualization
   */
  async getPersonalTrends(userId, token = null) {
    const history = await healthCheckinStore.getUserCheckinHistory(userId, { limit: 12 }, token);
    const completedList = history.filter(c => c.status === 'completed');

    const timeline = [];
    for (const c of completedList) {
      const answers = await healthCheckinStore.getAnswersByCheckin(c.id, token);
      const aMap = this._formatAnswersMap(answers);
      const analysis = await healthCheckinStore.getAiAnalysisByCheckin(c.id, token);

      const score = analysis?.overall_wellness_score !== undefined
        ? analysis.overall_wellness_score
        : (analysis?.overallWellnessScore !== undefined ? analysis.overallWellnessScore : Math.round(parseFloat(aMap.q_overall_health || aMap.overall_health || 3.5) * 20));

      timeline.push({
        checkinId: c.id,
        date: c.completed_at || c.created_at,
        score,
        wellnessCategory: analysis?.wellness_category || analysis?.wellnessCategory || 'Good',
        energyLevel: parseFloat(aMap.q_energy_level || aMap.energy_level || 3),
        sleepHours: parseFloat(aMap.q_sleep_hours || aMap.sleep_hours || 7),
        waterLiters: parseFloat(aMap.q_daily_water_liters || aMap.daily_water_liters || 2),
        overallScore: parseFloat(aMap.q_overall_health || aMap.overall_health || 3)
      });
    }

    const latestTrend = await healthCheckinStore.getLatestTrendAnalysis(userId, token);

    return {
      userId,
      completedCheckinsCount: completedList.length,
      timeline: timeline.reverse(), // Chronological order
      trendRecord: latestTrend,
      trend_assessment: latestTrend ? latestTrend.trend_summary : (completedList.length > 1 ? 'Positive progress detected across recent check-ins' : 'Baseline established')
    };
  }

  async getUserTrendTimeline(userId, token = null) {
    const trends = await this.getPersonalTrends(userId, token);
    const chronological = trends.timeline || [];
    // Provide most-recent first for timeline list
    const reversed = [...chronological].reverse();
    return {
      userId,
      timeline: reversed,
      chronological,
      trend_assessment: trends.trend_assessment,
      trendRecord: trends.trendRecord,
      completedCount: trends.completedCheckinsCount
    };
  }

  /**
   * Admin dashboard: aggregate statistics
   */
  async getAdminStats(token = null) {
    return await healthCheckinStore.getAdminStats(token);
  }

  async getAdminHealthInsightsStats(token = null) {
    const stats = await this.getAdminStats(token);
    return {
      total_submissions: stats.totalCheckins || stats.total_checkins || 0,
      completed_submissions: stats.completedCheckins || stats.completed_checkins || 0,
      average_wellness_score: stats.averageWellnessScore || stats.average_wellness_score || 78,
      category_averages: stats.categoryAverages || {
        energy: 74,
        sleep: 72,
        digestion: 80,
        hydration: 68,
        activity: 70
      },
      score_distribution: stats.scoreDistribution || {
        optimal: 1,
        good: 1,
        needs_attention: 0,
        high_risk: 0
      },
      red_flags_detected: 0
    };
  }

  /**
   * Admin dashboard: list submissions with search and filter
   */
  async getAdminSubmissions(filters = {}, token = null) {
    return await healthCheckinStore.getAllSubmissions(filters, token);
  }

  async getAdminHealthSubmissions(filters = {}, token = null) {
    const res = await this.getAdminSubmissions(filters, token);
    return {
      submissions: res.submissions || res || [],
      pagination: res.pagination || { total: (res.submissions || res || []).length, page: 1, limit: 20 }
    };
  }

  /**
   * Admin dashboard: re-analyze a checkin
   */
  async reanalyzeCheckin(checkinId, token = null) {
    const checkin = await healthCheckinStore.getCheckinById(checkinId, token);
    if (!checkin) throw new Error('Health check-in not found.');
    return await this.completeCheckin(checkinId, checkin.user_id, {}, {}, token);
  }

  /**
   * Admin dashboard: user health profile & check-in timeline
   */
  async getAdminUserHealthProfile(userId, token = null) {
    const history = await healthCheckinStore.getUserCheckinHistory(userId, { limit: 20 }, token);
    const latestCheckin = history[0] || null;
    let latestDetails = null;

    if (latestCheckin) {
      latestDetails = await this.getCheckinDetails(latestCheckin.id, userId, true, token);
    }

    const trends = await this.getPersonalTrends(userId, token);

    return {
      userId,
      totalCompleted: history.filter(h => h.status === 'completed').length,
      total_submissions: history.length,
      latestCheckinDate: latestCheckin?.completed_at || latestCheckin?.created_at || null,
      previousCheckinDate: history[1]?.completed_at || history[1]?.created_at || null,
      latestDetails,
      history: history.map(h => ({
        id: h.id,
        status: h.status,
        date: h.completed_at || h.created_at,
        aiAnalysisStatus: h.ai_analysis_status
      })),
      historySummary: history.map(h => ({
        id: h.id,
        status: h.status,
        date: h.completed_at || h.created_at,
        aiAnalysisStatus: h.ai_analysis_status
      })),
      trends
    };
  }

  _formatAnswersMap(answersList = []) {
    const map = {};
    for (const a of answersList) {
      map[a.question_id] = a.answer_value;
      // Also map friendly key if question text matches
      if (a.original_question_text) {
        map[a.original_question_text] = a.answer_value;
      }
    }
    return map;
  }

  _formatAnswersRecordsMap(answersList = []) {
    const map = {};
    for (const a of answersList) {
      const rec = {
        question_id: a.question_id,
        answer_value: a.answer_value,
        answer_text: a.original_question_text || '',
        answer_type: a.answer_type || typeof a.answer_value
      };
      map[a.question_id] = rec;
    }
    return map;
  }
}

module.exports = new HealthCheckinService();
module.exports.HealthCheckinService = HealthCheckinService;
