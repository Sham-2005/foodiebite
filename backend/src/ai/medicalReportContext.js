// ─────────────────────────────────────────────────────────────
//  backend/src/ai/medicalReportContext.js
//  Controlled Medical Report Context Abstraction Interface
//
//  Phase 2 update: now accepts an optional pre-built UserFoodProfile
//  so the AI Coach receives a compact, safe medical summary without
//  ever dumping raw PDF text into the conversation.
//
//  SAFETY RULES
//  ─────────────
//  1. Only HIGH-confidence biomarker findings influence the output.
//  2. Output is a compact string, never a raw report or PDF blob.
//  3. Returns null when there is nothing actionable to say.
//  4. Never includes raw OCR text, diagnoses, or disease names.
// ─────────────────────────────────────────────────────────────

'use strict';

/**
 * Build a safe, compact medical context string from a UserFoodProfile.
 * Called by foodieBiteAI.js when preparing the system context for a
 * recommendation or nutrition query.
 *
 * @param {Object} userFoodProfile  - The normalized profile from profileBuilder.js
 * @returns {string|null}           - A short, safe summary or null
 */
function buildMedicalContextSummary(userFoodProfile) {
  if (!userFoodProfile) return null;

  const lines = [];

  // 1. BMI context (computed, never from a report)
  if (userFoodProfile.bmi) {
    let bmiNote = '';
    if (userFoodProfile.bmi < 18.5)      bmiNote = 'underweight';
    else if (userFoodProfile.bmi < 25)   bmiNote = 'healthy weight range';
    else if (userFoodProfile.bmi < 30)   bmiNote = 'overweight';
    else                                  bmiNote = 'obese range';
    lines.push(`BMI: ${userFoodProfile.bmi} (${bmiNote})`);
  }

  // 2. Calorie target (computed from demographics + activity)
  if (userFoodProfile.dailyCalorieTarget) {
    lines.push(`Daily calorie target: ~${userFoodProfile.dailyCalorieTarget} kcal`);
  }

  // 3. Protein target
  if (userFoodProfile.dailyProteinTarget) {
    lines.push(`Daily protein target: ~${userFoodProfile.dailyProteinTarget}g`);
  }

  // 4. Confirmed medical food restrictions (hard exclusions)
  if (userFoodProfile.activeFoodRestrictions && userFoodProfile.activeFoodRestrictions.length > 0) {
    lines.push(`Foods to avoid (medical): ${userFoodProfile.activeFoodRestrictions.slice(0, 6).join(', ')}`);
  }

  // 5. Medically preferred foods
  if (userFoodProfile.foodsToPrefer && userFoodProfile.foodsToPrefer.length > 0) {
    lines.push(`Foods to prefer (medical): ${userFoodProfile.foodsToPrefer.slice(0, 6).join(', ')}`);
  }

  // 5b. Medically preferred nutrient tags
  if (userFoodProfile.preferredFoodTags && userFoodProfile.preferredFoodTags.length > 0) {
    lines.push(`Dietary considerations (prefer): ${userFoodProfile.preferredFoodTags.slice(0, 6).join(', ')}`);
  }

  // 6. Compact wellness summary (confirmed concerns only)
  if (userFoodProfile.wellnessSummary && userFoodProfile.wellnessSummary.length > 0) {
    lines.push(`Wellness notes: ${userFoodProfile.wellnessSummary.slice(0, 3).join('; ')}`);
  }

  return lines.length > 0 ? lines.join(' | ') : null;
}

/**
 * Original interface: retrieve medical context from Firestore by userId.
 * This remains safe by default — returning null — unless a pre-built
 * UserFoodProfile is injected via the second argument.
 *
 * @param {string} userId                    - Authenticated user identifier
 * @param {string} query                     - User message text
 * @param {Object|null} [userFoodProfile]    - Optional pre-built profile from profileBuilder
 * @returns {Promise<string|null>}           - Compact medical summary or null
 */
async function getRelevantMedicalContext(userId, query, userFoodProfile = null) {
  if (userFoodProfile) {
    return buildMedicalContextSummary(userFoodProfile);
  }
  // Safe default: return null unless a profile was explicitly provided
  return null;
}

module.exports = {
  getRelevantMedicalContext,
  buildMedicalContextSummary,
};
