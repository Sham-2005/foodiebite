/**
 * ─────────────────────────────────────────────────────────────
 *  backend/src/services/__tests__/healthCheckin.test.js
 *  Comprehensive Automated Test Suite for FoodieBite Health Insights:
 *  Weekly Health Check-in, Dynamic Follow-ups, Ollama AI Analysis,
 *  Longitudinal Trends, Profile Integration & Admin Controls.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const healthCheckinService = require('../healthCheckinService');
const checkinAiService = require('../checkinAiService');
const healthCheckinStore = require('../healthCheckinStore');
const { buildUserFoodProfile } = require('../profileBuilder');

async function runHealthCheckinTestSuite() {
  console.log('='.repeat(72));
  console.log(' [UNIT & INTEGRATION TEST SUITE] FoodieBite Health Insights & AI Check-in');
  console.log('='.repeat(72));

  let passed = 0;
  let failed = 0;

  function testAssert(condition, name, details = '') {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${name}${details ? ` (${details})` : ''}`);
    } else {
      failed++;
      console.error(`  ✗ [FAIL] ${name}${details ? ` (${details})` : ''}`);
    }
  }

  const TEST_USER_1 = 'test-user-alpha-' + Date.now();
  const TEST_USER_2 = 'test-user-beta-' + Date.now();
  let checkinSession1Id = null;
  let checkinSession2Id = null;

  try {
    // ── TEST 1: Check-in Initialization & Questionnaire Provisioning ──
    console.log('\n--- 1. Check-in Initialization & Questionnaire Provisioning ---');
    {
      const startResult = await healthCheckinService.startOrResumeCheckin(TEST_USER_1);
      testAssert(Boolean(startResult && startResult.checkin), 'Session created or resumed successfully');
      testAssert(startResult.checkin.status === 'draft', 'Initial check-in status is draft');
      testAssert(startResult.checkin.user_id === TEST_USER_1, 'Session correctly assigned to User 1');

      checkinSession1Id = startResult.checkin.id;

      const questions = startResult.questions || [];
      testAssert(questions.length === 26, 'Provisions exactly 26 standard check-in questions', `found ${questions.length}`);

      // Verify all 10 clinical & lifestyle categories exist
      const EXPECTED_CATEGORIES = [
        'energy_fatigue',
        'digestion_gut',
        'sleep_quality',
        'stress_mental',
        'hydration_fluid',
        'physical_activity',
        'nutrition_eating',
        'physical_symptoms',
        'mood_emotional',
        'health_goals'
      ];
      const categoriesFound = new Set(questions.map(q => q.category));
      const allCategoriesPresent = EXPECTED_CATEGORIES.every(c => categoriesFound.has(c));
      testAssert(allCategoriesPresent, 'All 10 required wellness categories are provisioned', `${categoriesFound.size}/10`);

      // Verify question data structure
      const sampleQ = questions[0];
      testAssert(
        Boolean(sampleQ.id && sampleQ.category && sampleQ.question_text && sampleQ.question_type),
        'Question contains id, category, question_text, and question_type'
      );
    }

    // ── TEST 2: Draft Persistence & Resumption ────────────────────────
    console.log('\n--- 2. Draft Answer Persistence & Resumption ---');
    {
      const sampleAnswers = [
        {
          question_id: 'energy_level',
          category: 'energy_fatigue',
          answer_value: 3,
          answer_text: '3 - Moderate / fluctuations'
        },
        {
          question_id: 'digestive_issues',
          category: 'digestion_gut',
          answer_value: ['bloating', 'acid_reflux'],
          answer_text: 'Bloating, Acid reflux or heartburn'
        },
        {
          question_id: 'water_intake',
          category: 'hydration_fluid',
          answer_value: '1_2_liters',
          answer_text: '1 to 2 Liters (4-8 glasses)'
        }
      ];

      const saveResult = await healthCheckinService.saveCheckinAnswers(
        checkinSession1Id,
        TEST_USER_1,
        sampleAnswers
      );
      testAssert(saveResult.success === true, 'Draft answers saved successfully');
      testAssert(saveResult.saved_count === 3, 'Persisted 3 draft answers', `count: ${saveResult.saved_count}`);

      // Resume checkin session
      const resumed = await healthCheckinService.startOrResumeCheckin(TEST_USER_1);
      testAssert(resumed.checkin.id === checkinSession1Id, 'Resumes the existing draft session');
      testAssert(resumed.saved_answers && Object.keys(resumed.saved_answers).length === 3, 'Resumed session has all 3 saved answers');
      testAssert(resumed.saved_answers.energy_level.answer_value === 3, 'Answer value for energy_level is 3');
      testAssert(Array.isArray(resumed.saved_answers.digestive_issues.answer_value), 'Answer value for digestive_issues is an array');
    }

    // ── TEST 3: Dynamic Follow-up Generation (Ollama + Fallback) ───────
    console.log('\n--- 3. Dynamic Follow-up Generation (Ollama + Safe Fallback) ---');
    {
      const triggerAnswers = [
        {
          question_id: 'energy_level',
          category: 'energy_fatigue',
          answer_value: 1,
          answer_text: '1 - Exhausted / depleted'
        },
        {
          question_id: 'energy_crashes',
          category: 'energy_fatigue',
          answer_value: 'after_lunch',
          answer_text: 'After lunch (afternoon slump)'
        },
        {
          question_id: 'bloating_frequency',
          category: 'digestion_gut',
          answer_value: 'daily',
          answer_text: 'Daily / Severe'
        },
        {
          question_id: 'sleep_hours',
          category: 'sleep_quality',
          answer_value: 'under_5',
          answer_text: 'Less than 5 hours'
        }
      ];

      const t0 = Date.now();
      const dynamicQs = await checkinAiService.generateDynamicFollowUps(triggerAnswers);
      const elapsed = Date.now() - t0;

      testAssert(Array.isArray(dynamicQs) && dynamicQs.length >= 1, 'Dynamic follow-up questions generated', `count: ${dynamicQs.length}`);
      testAssert(elapsed < 4500, 'Dynamic question generator executed within timeout threshold', `${elapsed}ms`);

      const firstDyn = dynamicQs[0];
      testAssert(Boolean(firstDyn.id && firstDyn.question_text && firstDyn.is_dynamic), 'Dynamic question has id, question_text, and is_dynamic=true');
      testAssert(Boolean(firstDyn.parent_category), 'Dynamic question points to a parent category', firstDyn.parent_category);
    }

    // ── TEST 4: Final Submission & Structured AI Wellness Analysis ────
    console.log('\n--- 4. Final Submission & Section 8 AI Wellness Analysis ---');
    {
      // Build a full set of answers across all 10 categories
      const fullAnswers = [
        { question_id: 'energy_level', category: 'energy_fatigue', answer_value: 2, answer_text: '2 - Sluggish' },
        { question_id: 'energy_crashes', category: 'energy_fatigue', answer_value: 'after_lunch', answer_text: 'Afternoon slump' },
        { question_id: 'digestive_issues', category: 'digestion_gut', answer_value: ['bloating'], answer_text: 'Bloating' },
        { question_id: 'bloating_frequency', category: 'digestion_gut', answer_value: 'frequently', answer_text: 'Frequently' },
        { question_id: 'sleep_hours', category: 'sleep_quality', answer_value: '5_6', answer_text: '5 to 6 hours' },
        { question_id: 'sleep_quality_rating', category: 'sleep_quality', answer_value: 3, answer_text: '3 - Fair' },
        { question_id: 'stress_level', category: 'stress_mental', answer_value: 4, answer_text: '4 - High stress' },
        { question_id: 'water_intake', category: 'hydration_fluid', answer_value: 'under_1_liter', answer_text: 'Less than 1 Liter' },
        { question_id: 'physical_activity_days', category: 'physical_activity', answer_value: '1_2', answer_text: '1-2 days' },
        { question_id: 'meals_per_day', category: 'nutrition_eating', answer_value: '2', answer_text: '2 meals' },
        { question_id: 'cravings', category: 'nutrition_eating', answer_value: ['sugar', 'caffeine'], answer_text: 'Sugar, Caffeine' },
        { question_id: 'physical_discomfort', category: 'physical_symptoms', answer_value: ['headache', 'muscle_tension'], answer_text: 'Headache, Muscle tension' },
        { question_id: 'mood_rating', category: 'mood_emotional', answer_value: 3, answer_text: '3 - Neutral / variable' },
        { question_id: 'primary_goal', category: 'health_goals', answer_value: 'improve_energy', answer_text: 'Improve energy and vitality' }
      ];

      const submitResult = await healthCheckinService.completeCheckin(
        checkinSession1Id,
        TEST_USER_1,
        fullAnswers
      );

      testAssert(submitResult.success === true, 'Checkin submission completed successfully');
      testAssert(submitResult.checkin.status === 'completed', 'Checkin session updated to completed status');
      testAssert(Boolean(submitResult.checkin.completed_at), 'Checkin has completed_at timestamp');

      const analysis = submitResult.ai_analysis;
      testAssert(Boolean(analysis), 'Structured AI analysis returned');
      testAssert(
        typeof analysis.overall_wellness_score === 'number' &&
        analysis.overall_wellness_score >= 0 &&
        analysis.overall_wellness_score <= 100,
        'Wellness score is a valid number between 0 and 100',
        `score: ${analysis.overall_wellness_score}`
      );
      testAssert(
        ['Optimal', 'Good', 'Needs Attention', 'High Risk'].includes(analysis.wellness_category),
        'Wellness category matches schema',
        analysis.wellness_category
      );
      testAssert(
        typeof analysis.executive_summary === 'string' && analysis.executive_summary.length > 30,
        'Executive summary is comprehensive'
      );
      testAssert(
        Array.isArray(analysis.key_strengths) && Array.isArray(analysis.primary_concerns),
        'Key strengths and primary concerns are arrays'
      );
      testAssert(
        Boolean(analysis.dietary_recommendations && analysis.dietary_recommendations.hydration_guidance),
        'Dietary recommendations include hydration guidance'
      );
      testAssert(
        Boolean(analysis.lifestyle_recommendations && analysis.lifestyle_recommendations.sleep),
        'Lifestyle recommendations include sleep advice'
      );
      testAssert(
        typeof analysis.disclaimer === 'string' && analysis.disclaimer.includes('FoodieBite'),
        'Mandatory medical disclaimer is present'
      );
    }

    // ── TEST 5: Longitudinal Tracking & Multi-Check-in Trends ─────────
    console.log('\n--- 5. Longitudinal Tracking & Multi-Check-in Trends ---');
    {
      // Create a second checkin session for the same user with improved metrics
      const session2 = await healthCheckinService.startOrResumeCheckin(TEST_USER_1);
      checkinSession2Id = session2.checkin.id;
      testAssert(checkinSession2Id !== checkinSession1Id, 'New check-in session ID created for second submission');

      const improvedAnswers = [
        { question_id: 'energy_level', category: 'energy_fatigue', answer_value: 4, answer_text: '4 - High energy' },
        { question_id: 'energy_crashes', category: 'energy_fatigue', answer_value: 'none', answer_text: 'Rarely or never' },
        { question_id: 'digestive_issues', category: 'digestion_gut', answer_value: [], answer_text: 'None' },
        { question_id: 'bloating_frequency', category: 'digestion_gut', answer_value: 'rarely', answer_text: 'Rarely / Never' },
        { question_id: 'sleep_hours', category: 'sleep_quality', answer_value: '7_8', answer_text: '7 to 8 hours' },
        { question_id: 'sleep_quality_rating', category: 'sleep_quality', answer_value: 4, answer_text: '4 - Good' },
        { question_id: 'stress_level', category: 'stress_mental', answer_value: 2, answer_text: '2 - Low stress' },
        { question_id: 'water_intake', category: 'hydration_fluid', answer_value: '2_3_liters', answer_text: '2 to 3 Liters' },
        { question_id: 'physical_activity_days', category: 'physical_activity', answer_value: '3_4', answer_text: '3-4 days' },
        { question_id: 'meals_per_day', category: 'nutrition_eating', answer_value: '3', answer_text: '3 balanced meals' },
        { question_id: 'cravings', category: 'nutrition_eating', answer_value: [], answer_text: 'None' },
        { question_id: 'physical_discomfort', category: 'physical_symptoms', answer_value: [], answer_text: 'None' },
        { question_id: 'mood_rating', category: 'mood_emotional', answer_value: 4, answer_text: '4 - Positive' },
        { question_id: 'primary_goal', category: 'health_goals', answer_value: 'maintain_health', answer_text: 'Maintain wellness' }
      ];

      const submitResult2 = await healthCheckinService.completeCheckin(
        checkinSession2Id,
        TEST_USER_1,
        improvedAnswers
      );
      testAssert(submitResult2.success === true, 'Second check-in submitted successfully');

      // Fetch user trend timeline
      const timelineData = await healthCheckinService.getUserTrendTimeline(TEST_USER_1);
      testAssert(Boolean(timelineData && timelineData.timeline), 'Timeline retrieved');
      testAssert(timelineData.timeline.length >= 2, 'Timeline contains at least 2 completed check-ins', `count: ${timelineData.timeline.length}`);

      const latest = timelineData.timeline[0];
      const previous = timelineData.timeline[1];
      testAssert(
        latest.score >= previous.score,
        'Wellness score improved in second check-in',
        `${previous.score} -> ${latest.score}`
      );
      testAssert(
        Boolean(timelineData.trend_assessment),
        'Trend assessment summary generated',
        timelineData.trend_assessment
      );
    }

    // ── TEST 6: Food Recommendation Integration (profileBuilder.js) ───
    console.log('\n--- 6. Food Recommendation Integration (profileBuilder.js) ---');
    {
      const baseUserProfile = {
        name: 'Alpha Tester',
        dietType: 'Vegetarian',
        allergies: [],
        cuisinePreferences: ['North Indian', 'South Indian'],
        activityLevel: 'Moderate',
        calorieTarget: 2000
      };

      const enrichedProfile = await buildUserFoodProfile(TEST_USER_1, baseUserProfile);
      testAssert(Boolean(enrichedProfile), 'buildUserFoodProfile executed successfully');
      testAssert(
        Boolean(enrichedProfile.healthCheckinInsights),
        'Enriched profile includes healthCheckinInsights from recent check-ins'
      );
      testAssert(
        typeof enrichedProfile.healthCheckinInsights.wellnessScore === 'number',
        'Profile includes latest wellnessScore',
        `score: ${enrichedProfile.healthCheckinInsights.wellnessScore}`
      );
      testAssert(
        Array.isArray(enrichedProfile.healthCheckinInsights.focusNutrients),
        'Profile includes focusNutrients array'
      );
      testAssert(
        Array.isArray(enrichedProfile.healthCheckinInsights.recommendedFoodCategories),
        'Profile includes recommendedFoodCategories array'
      );
    }

    // ── TEST 7: Tenant Isolation & Access Security ────────────────────
    console.log('\n--- 7. Tenant Isolation & Access Security ---');
    {
      // User 2 attempts to save answers into User 1's checkin session
      let errorCaptured = false;
      try {
        await healthCheckinService.saveCheckinAnswers(
          checkinSession1Id,
          TEST_USER_2, // Unauthorized user
          [{ question_id: 'energy_level', answer_value: 5 }]
        );
      } catch (err) {
        errorCaptured = true;
      }
      testAssert(errorCaptured, 'Unauthorized user cannot modify another user’s check-in');

      // User 2 attempts to view User 1's checkin details
      let viewErrorCaptured = false;
      try {
        await healthCheckinService.getCheckinDetails(checkinSession1Id, TEST_USER_2);
      } catch (err) {
        viewErrorCaptured = true;
      }
      testAssert(viewErrorCaptured, 'Unauthorized user cannot inspect another user’s check-in');
    }

    // ── TEST 8: Admin Statistics, Submissions & Reanalysis ─────────────
    console.log('\n--- 8. Admin Statistics, Submissions & Reanalysis ---');
    {
      const adminStats = await healthCheckinService.getAdminHealthInsightsStats();
      testAssert(Boolean(adminStats), 'Admin health insights statistics retrieved');
      testAssert(
        typeof adminStats.total_submissions === 'number' && adminStats.total_submissions >= 2,
        'Admin stats reflect completed submissions',
        `total: ${adminStats.total_submissions}`
      );
      testAssert(
        typeof adminStats.average_wellness_score === 'number',
        'Admin stats calculate average wellness score',
        `avg: ${adminStats.average_wellness_score}`
      );
      testAssert(
        Boolean(adminStats.category_averages),
        'Admin stats include category averages breakdown'
      );
      testAssert(
        Boolean(adminStats.score_distribution),
        'Admin stats include score distribution buckets'
      );

      // Admin submissions query
      const submissionsResult = await healthCheckinService.getAdminHealthSubmissions({
        limit: 10,
        page: 1
      });
      testAssert(Boolean(submissionsResult && submissionsResult.submissions), 'Admin submissions retrieved');
      testAssert(submissionsResult.submissions.length >= 2, 'Submissions list contains test check-ins');

      // Admin user profile inspection
      const adminUserProfile = await healthCheckinService.getAdminUserHealthProfile(TEST_USER_1);
      testAssert(Boolean(adminUserProfile && adminUserProfile.history), 'Admin user health profile retrieved');
      testAssert(adminUserProfile.total_submissions >= 2, 'Admin user profile reflects all user submissions');

      // Admin re-analysis of existing checkin
      const reanalyzeResult = await healthCheckinService.reanalyzeCheckin(checkinSession1Id);
      testAssert(reanalyzeResult.success === true, 'Admin re-analysis of check-in succeeds');
      testAssert(Boolean(reanalyzeResult.ai_analysis), 'Re-analysis returns updated structured AI analysis');
    }

  } catch (uncaughtErr) {
    failed++;
    console.error('\n✗ UNCAUGHT EXCEPTION in Test Suite:', uncaughtErr);
  }

  console.log('\n' + '='.repeat(72));
  console.log(` HEALTH CHECK-IN TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('='.repeat(72));

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runHealthCheckinTestSuite().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}

module.exports = { runHealthCheckinTestSuite };
