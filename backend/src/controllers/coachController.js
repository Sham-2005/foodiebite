const { getFirestoreDb } = require('../config/firebase');
const { generateResponse } = require('../services/foodieBiteAIService');
const { buildUserFoodProfile } = require('../services/profileBuilder');
const { buildMedicalContextSummary } = require('../ai/medicalReportContext');
const { buildContextProfile } = require('../services/contextService');
const { getBehavioralProfileSync } = require('../services/behaviorLearningService');
const { trackFeatureUsage } = require('../services/activityTrackingService');

// ── Timeout constants ────────────────────────────────────────
const FIRESTORE_WRITE_TIMEOUT_MS = 3000;

// ── Helper: resolve with { timedOut:true } after N ms ───────
function withTimeout(promise, ms, label) {
  const timer = new Promise((resolve) =>
    setTimeout(() => resolve({ __timedOut: true, label }), ms)
  );
  return Promise.race([promise, timer]);
}

// ── Helper: get Firestore reference safely ───────────────────
function getDb() {
  return getFirestoreDb();
}

// ── Helper: build sanitized user context using the unified profile ─────
// Accepts the raw Firestore user document (userProfile) and the userId.
// Internally uses buildUserFoodProfile() so every AI consumer sees the
// same normalized fields, computed targets, and safe medical summary.
function buildSanitizedUserContext(userProfile, _ignored, userId) {
  // Build the normalized unified profile
  const profile = buildUserFoodProfile(userProfile);

  const context = {};

  // ── Identity ──────────────────────────────────────────────
  if (userId)        context.id  = userId;
  if (profile.name)  context.name = profile.name;

  // ── Demographics ──────────────────────────────────────────
  if (profile.age)    context.age    = profile.age;
  if (profile.gender) context.gender = profile.gender;

  // ── Diet & preferences ────────────────────────────────────
  if (profile.dietType)   context.diet       = profile.dietType;
  if (profile.spiceLevel) context.spiceLevel = profile.spiceLevel;
  if (profile.cuisines.length > 0)  context.cuisines    = profile.cuisines.join(', ');
  if (profile.healthGoals.length > 0) context.goal      = profile.healthGoals.join(', ');
  if (profile.allergies.length > 0)   context.allergies = profile.allergies.join(', ');

  // ── Physical metrics ──────────────────────────────────────
  if (profile.activityLevel) context.activityLevel = profile.activityLevel;
  if (profile.weightKg)      context.weightKg      = profile.weightKg;
  if (profile.heightCm)      context.heightCm      = profile.heightCm;

  // ── Computed nutritional targets (only when available) ────
  if (profile.bmi)               context.bmi               = profile.bmi;
  if (profile.dailyCalorieTarget) context.dailyCalorieTarget = profile.dailyCalorieTarget;
  if (profile.dailyProteinTarget) context.dailyProteinTarget = profile.dailyProteinTarget;

  // ── Safe medical summary (compact, no raw PDFs) ───────────
  const medicalSummary = buildMedicalContextSummary(profile);
  if (medicalSummary) context.medicalContext = medicalSummary;

  // ── Confirmed medical food exclusions ─────────────────────
  if (profile.activeFoodRestrictions.length > 0) {
    context.activeFoodRestrictions = profile.activeFoodRestrictions.join(', ');
  }

  // ── Medically preferred foods ─────────────────────────────
  if (profile.foodsToPrefer.length > 0) {
    context.foodsToPrefer = profile.foodsToPrefer.slice(0, 6).join(', ');
  }

  // ── Phase 4 Contextual Metadata (Meal, Weather, Season, Fasting) ──
  const contextProfile = buildContextProfile({
    ..._ignored,
    userProfile: profile
  });
  context.contextProfile = contextProfile;
  context.mealPeriod = contextProfile.mealPeriod;
  context.weather = contextProfile.weather;
  context.season = contextProfile.season;
  context.fasting = contextProfile.fasting;
  if (contextProfile.fasting?.active) {
    context.fastingState = `Active fasting: ${contextProfile.fasting.type || 'fasting'}`;
  }

  // ── Phase 5 Behavioral Learning Context ───────────────────
  const behavioralProfile = getBehavioralProfileSync(userId);
  context.behavioralProfile = behavioralProfile;

  const behavioralSummaryParts = [];
  if (behavioralProfile.preferredCuisines && Object.keys(behavioralProfile.preferredCuisines).length > 0) {
    const topCuisines = Object.entries(behavioralProfile.preferredCuisines)
      .sort((a, b) => (b[1].score * b[1].confidence) - (a[1].score * a[1].confidence))
      .slice(0, 2)
      .map(([c]) => c.charAt(0).toUpperCase() + c.slice(1));
    if (topCuisines.length > 0) {
      behavioralSummaryParts.push(`Frequently likes ${topCuisines.join(', ')} food`);
    }
  }

  if (behavioralProfile.preferredSpiceLevel && Object.keys(behavioralProfile.preferredSpiceLevel).length > 0) {
    const topSpice = Object.keys(behavioralProfile.preferredSpiceLevel)[0];
    behavioralSummaryParts.push(`Frequently chooses ${topSpice} spice meals`);
  }

  if (behavioralProfile.preferredIngredients && Object.keys(behavioralProfile.preferredIngredients).length > 0) {
    const topIngs = Object.keys(behavioralProfile.preferredIngredients).slice(0, 3);
    behavioralSummaryParts.push(`Enjoys ingredients: ${topIngs.join(', ')}`);
  }

  if (behavioralProfile.dislikedIngredients && Object.keys(behavioralProfile.dislikedIngredients).length > 0) {
    const disIngs = Object.keys(behavioralProfile.dislikedIngredients).slice(0, 3);
    behavioralSummaryParts.push(`Tends to avoid: ${disIngs.join(', ')}`);
  }

  if (behavioralSummaryParts.length > 0) {
    context.behavioralSummary = behavioralSummaryParts.join('; ');
  }

  return context;
}

// ── CORE CHAT HANDLER — FOODIEBITE AI ENGINE ────────────────
exports.handleChatMessage = async (req, res, next) => {
  const reqStart = Date.now();
  console.log(`[COACH] request received +${Date.now() - reqStart}ms`);

  // 1. Authenticate user from request token
  const userId = req.user?.id || req.user?.uid;
  if (!userId) {
    console.warn(`[COACH] authentication failed (missing user ID) +${Date.now() - reqStart}ms`);
    return res.status(401).json({
      success: false,
      source: 'foodiebite_ai_error',
      reply: 'Unauthorized. Please sign in to continue.',
      message: 'Unauthorized. User ID missing.'
    });
  }

  console.log(`[COACH] authentication completed +${Date.now() - reqStart}ms`);

  const { threadId, message } = req.body;
  const tId = threadId || 'default';

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      success: false,
      source: 'foodiebite_ai_error',
      reply: 'Please provide a valid text message.',
      message: 'Message text is required.'
    });
  }

  // Sanitize message: truncate excess length & strip basic HTML tags
  let sanitizedMsg = message.trim().substring(0, 2000).replace(/<[^>]*>?/gm, '');
  if (!sanitizedMsg) {
    sanitizedMsg = message.trim().substring(0, 2000);
  }

  const db = getDb();
  let userProfile = {};
  let userPrefs = {};

  // 2. Load User Profile from Firestore (with 1500ms hard timeout protection)
  if (db) {
    try {
      const userDocResult = await withTimeout(
        db.collection('users').doc(userId).get(),
        1500,
        'loadUserProfile'
      );
      if (userDocResult && !userDocResult.__timedOut && userDocResult.exists) {
        userProfile = userDocResult.data() || {};
        userPrefs = userProfile.preferences || {};
      }
    } catch (err) {
      console.warn('⚠️ User profile load warning:', err.message);
    }
  }
  console.log(`[COACH] profile loaded +${Date.now() - reqStart}ms`);

  // 3. Load Recent Conversation History (with 1500ms hard timeout protection)
  const conversationHistory = [];
  if (db) {
    try {
      const messagesRef = db
        .collection('users').doc(userId)
        .collection('threads').doc(tId)
        .collection('messages');

      const snapResult = await withTimeout(
        messagesRef.orderBy('timestamp', 'asc').limitToLast(6).get(),
        1500,
        'loadConversationHistory'
      );
      if (snapResult && !snapResult.__timedOut && snapResult.forEach) {
        snapResult.forEach(doc => {
          const d = doc.data();
          if (d.text && d.sender) {
            conversationHistory.push({
              sender: d.sender,
              text: d.text
            });
          }
        });
      }
    } catch (err) {
      console.warn('⚠️ Conversation history load warning:', err.message);
    }
  }
  console.log(`[COACH] history loaded +${Date.now() - reqStart}ms`);

  // 4. Build Sanitized User Context & Merge Request Context
  const reqContext = req.body.userContext && typeof req.body.userContext === 'object' ? req.body.userContext : {};
  const unifiedProfile = require('../services/profileBuilder').buildUserFoodProfile(userProfile);
  const contextProfile = buildContextProfile({
    ...req.body,
    ...reqContext,
    userProfile: unifiedProfile
  });
  const userContext = {
    ...buildSanitizedUserContext(userProfile, { ...req.body, ...reqContext }, userId),
    ...reqContext,
    contextProfile,
    // Attach the full profile for internal AI engines (not exposed to client)
    _userFoodProfile: unifiedProfile,
  };

  // 5. Invoke FoodieBite AI Service Abstraction Layer
  console.log(`[COACH] calling FoodieBite AI +${Date.now() - reqStart}ms`);

  let aiResult;
  try {
    aiResult = await generateResponse({
      message: sanitizedMsg,
      userContext,
      conversationHistory
    });
  } catch (err) {
    console.error('[AI ERROR] Unhandled Exception during generateResponse:', {
      name: err.name,
      message: err.message
    });
    return res.status(500).json({
      success: false,
      source: 'foodiebite_ai_error',
      reply: 'An internal error occurred while processing your request. Please try again.',
      message: 'Internal server error.',
      type: 'error',
      options: []
    });
  }

  console.log(`[COACH] FoodieBite AI completed +${Date.now() - reqStart}ms`);

  const isSuccess = aiResult.success !== false;
  const responseSource = aiResult.source || (isSuccess ? 'foodiebite_ai' : 'foodiebite_ai_error');
  const replyText = aiResult.reply || (isSuccess ? 'FoodieBite AI generated an empty response.' : 'FoodieBite AI is temporarily unavailable. Please try again.');
  const options = Array.isArray(aiResult.options) ? aiResult.options : [];
  const type = aiResult.type || (isSuccess ? (options.length > 0 ? 'choice' : 'text') : 'error');
  const sessionId = `${userId}_${tId}`;

  // 6. Save User & AI messages to Firestore (User-Scoped) - only if success or user msg
  let persisted = false;
  if (db && isSuccess) {
    console.log(`[COACH] persisting user message +${Date.now() - reqStart}ms`);
    const messagesRef = db
      .collection('users').doc(userId)
      .collection('threads').doc(tId)
      .collection('messages');

    const userMsgRef = messagesRef.doc();
    const coachMsgRef = messagesRef.doc();

    const saveUser = withTimeout(
      userMsgRef.set({
        id: userMsgRef.id,
        sender: 'user',
        text: message.trim(),
        timestamp: new Date().toISOString(),
        source: 'user',
        confidence: 1.0
      }),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'saveUserMsg'
    );

    const saveCoach = withTimeout(
      coachMsgRef.set({
        id: coachMsgRef.id,
        sender: 'coach',
        text: replyText,
        options,
        type,
        timestamp: new Date().toISOString(),
        source: responseSource,
        confidence: 1.0
      }),
      FIRESTORE_WRITE_TIMEOUT_MS,
      'saveCoachMsg'
    );

    const [userSaveResult, coachSaveResult] = await Promise.allSettled([saveUser, saveCoach]);
    if (userSaveResult.status === 'fulfilled' && coachSaveResult.status === 'fulfilled') {
      persisted = true;
    }
  }

  // 7. Send Standardized JSON Response
  const totalMs = Date.now() - reqStart;
  if (isSuccess && userId) {
    trackFeatureUsage('ai_coach_queries', userId).catch(() => {});
  }
  const responsePayload = {
    success: isSuccess,
    source: responseSource,
    reply: replyText,
    text: replyText,
    type,
    options,
    sessionId,
    threadId: tId,
    persisted,
    nearbyIntent: aiResult.nearbyIntent,
    _timing: { totalMs },
    _debug: {
      provider: 'foodiebite_local_engine',
      model: 'foodiebite-ai-v1',
      userContextFields: Object.keys(userContext)
    }
  };

  console.log(`[COACH] response sent +${Date.now() - reqStart}ms`);
  return res.status(200).json(responsePayload);
};

