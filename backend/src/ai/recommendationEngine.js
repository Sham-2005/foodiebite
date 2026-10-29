// ─────────────────────────────────────────────────────────────
//  backend/src/ai/recommendationEngine.js
//  Priority-Based Recommendation Engine with Personalized Ranking & Diversity
// ─────────────────────────────────────────────────────────────

const { getAllFoods } = require('./foodKnowledge');
const { getUserProfile, trackRecommendation } = require('./userPreferenceStore');
const { isDietCompatible } = require('../services/dietarySafetyService');
const { buildContextProfile, isFastingCompatible } = require('../services/contextService');
const { getBehavioralProfileSync } = require('../services/behaviorLearningService');

function scoreFoodWithPriority(food, userContext = {}, requestConstraints = {}, exclusions = [], mealType = null, profile = null, context = null, behavioralProfile = null) {
  let score = 10;
  const reasons = [];

  const contextProfile = (context && context.mealPeriod && context.weather && context.season)
    ? context
    : buildContextProfile({
        ...(userContext.contextProfile || userContext.context || context || {}),
        userProfile: userContext._userFoodProfile || userContext
      });

  const userAllergies = Array.isArray(userContext.allergies) 
    ? userContext.allergies 
    : (userContext.allergies ? [userContext.allergies] : []);

  // Phase 2: Active confirmed medical restrictions are safety-critical hard exclusions
  const medicalRestrictions = userContext._userFoodProfile?.activeFoodRestrictions ||
    (Array.isArray(userContext.activeFoodRestrictions)
      ? userContext.activeFoodRestrictions
      : (typeof userContext.activeFoodRestrictions === 'string'
          ? userContext.activeFoodRestrictions.split(',').map(s => s.trim()).filter(Boolean)
          : []));

  const combinedExclusions = new Set([...userAllergies, ...exclusions, ...medicalRestrictions]);

  // Priority 1 & 2: Safety & Allergies & Explicit Exclusions (CRITICAL OVERRIDE)
  for (const excl of combinedExclusions) {
    if (!excl) continue;
    const normExcl = excl.toLowerCase();
    
    if ((food.name && food.name.toLowerCase().includes(normExcl)) || 
        (food.aliases && food.aliases.some(a => a && a.toLowerCase().includes(normExcl))) ||
        (food.allergens && food.allergens.some(i => i && i.toLowerCase().includes(normExcl))) ||
        (food.tags && food.tags.some(t => t && t.toLowerCase().includes(normExcl))) ||
        (food.conditionTags?.avoid && food.conditionTags.avoid.some(t => t && t.toLowerCase() === normExcl))) {
      return { score: -1000, safe: false, reasons: [`Contains excluded item/allergen: ${excl}`] };
    }
  }

  // Phase 4: Religious Fasting / Fasting Constraints (Safety-Critical Hard Gate)
  if (contextProfile?.fasting?.active) {
    const fastingCheck = isFastingCompatible(food, contextProfile.fasting);
    if (!fastingCheck.compatible) {
      return {
        score: -1000,
        safe: false,
        reasons: [`Restricted during ${contextProfile.fasting.type || 'fasting'}: ${fastingCheck.reason}`]
      };
    }
  }

  // Load profile if not provided
  if (!profile) {
    const userId = userContext.id || 'default_user';
    profile = getUserProfile(userId);
  }

  // Check hard exclusions in profile (strength === 1.0)
  if (profile && profile.preferences) {
    const isHardExcluded = profile.preferences.dislikedFoods.some(df => df.value === food.id && df.strength === 1.0) ||
                           (food.cuisine && profile.preferences.dislikedCuisines.some(dc => dc.value.toLowerCase() === food.cuisine.toLowerCase() && dc.strength === 1.0));
    if (isHardExcluded) {
      return { score: -1000, safe: false, reasons: [`Hard excluded by user preference`] };
    }
  }

  // Priority 3 & 4: User Dietary Restrictions
  const diet = (
    requestConstraints.dietType ||
    userContext._userFoodProfile?.dietType ||
    userContext.diet ||
    userContext.dietType ||
    ''
  ).toLowerCase();
  if (diet) {
    if (!isDietCompatible(food, diet)) {
      return { score: -1000, safe: false, reasons: [`Incompatible with ${diet} diet`] };
    }
    if (diet === 'vegetarian' || diet === 'veg') {
      score += 100;
      reasons.push('fits vegetarian diet');
    } else if (diet === 'vegan') {
      score += 120;
      reasons.push('100% plant-based vegan choice');
    } else if (diet === 'eggetarian') {
      score += 100;
      reasons.push('fits eggetarian preference');
    }
  }

  // Session Preference Learning Override (Priority 3.5)
  const sessionDislikes = userContext.sessionDislikes || [];
  const sessionLikes = userContext.sessionLikes || [];
  if (sessionDislikes.some(d => (food.name && food.name.toLowerCase().includes(d.toLowerCase())) || (food.aliases && food.aliases.some(a => a && a.toLowerCase().includes(d.toLowerCase()))))) {
    return { score: -400, safe: true, reasons: ['Previously disliked in session'] };
  }
  if (sessionLikes.some(l => (food.name && food.name.toLowerCase().includes(l.toLowerCase())) || (food.aliases && food.aliases.some(a => a && a.toLowerCase().includes(l.toLowerCase()))))) {
    score += 80;
    reasons.push('matches session preference');
  }

  // Priority 5: Explicit User Request Constraints & Meal-Time Intelligence
  const targetMeal = requestConstraints.mealType || mealType;
  if (targetMeal && food.mealTypes && food.mealTypes.includes(targetMeal.toLowerCase())) {
    score += 80;
    reasons.push(`ideal for ${targetMeal}`);
  } else if (!targetMeal && contextProfile.mealPeriod && food.mealTypes) {
    const period = contextProfile.mealPeriod.toLowerCase();
    const matchesMeal = food.mealTypes.includes(period) || (period.includes('snack') && food.mealTypes.includes('snack'));
    if (matchesMeal) {
      score += 35;
      reasons.push(`ideal for ${period.replace('_', ' ')}`);
    }
  }

  if ((requestConstraints.targetFood && requestConstraints.targetFood.id === food.id) || requestConstraints.food === food.id) {
    score += 300;
    reasons.push('explicitly requested');
  }

  const maxCaloriesLimit = requestConstraints.maxCalories || 
                           userContext.maxCalories ||
                           userContext._userFoodProfile?.maxCaloriesOverride;
  if (maxCaloriesLimit && food.calories > maxCaloriesLimit) {
    return { score: -300, safe: true, reasons: [`Exceeds calorie limit of ${maxCaloriesLimit} kcal`] };
  }

  const minProteinTarget = requestConstraints.minProtein ||
                           userContext.minProtein ||
                           userContext._userFoodProfile?.minProteinOverride;
  if (minProteinTarget && food.protein >= minProteinTarget) {
    score += 40;
    reasons.push(`meets protein target (${food.protein}g >= ${minProteinTarget}g)`);
  }

  if (requestConstraints.isQuick && (food.preparationMinutes <= 15 || (food.tags && food.tags.includes('quick')))) {
    score += 40;
    reasons.push('quick to prepare');
  }

  // Priority 6 & 7: Health Goals & Nutritional Suitability
  const goal = (userContext.goal || userContext.healthGoals || '').toLowerCase();
  
  // Explicit turn goals take priority over profile goals
  const activeHighProtein = requestConstraints.highProtein || goal.includes('high protein') || goal.includes('muscle');
  const activeLightMeal = requestConstraints.lightMeal || goal.includes('weight loss') || goal.includes('weight management');

  if (activeHighProtein) {
    if (food.protein >= 12) {
      score += 60;
      reasons.push(`high protein boost (${food.protein}g protein)`);
    }
  } else if (activeLightMeal) {
    if (food.calories <= 220 || food.fiber >= 3.0) {
      score += 50;
      reasons.push(`light & calorie-conscious (${food.calories} kcal)`);
    }
  }

  // Medically preferred foods boost
  const preferredMedFoods = [
    ...(userContext._userFoodProfile?.foodsToPrefer || []),
    ...(userContext._userFoodProfile?.preferredFoodTags || []),
    ...(userContext._userFoodProfile?.medicalProfile?.preferredFoodTags || []),
    ...(Array.isArray(userContext.foodsToPrefer)
      ? userContext.foodsToPrefer
      : (typeof userContext.foodsToPrefer === 'string'
          ? userContext.foodsToPrefer.split(',').map(s => s.trim()).filter(Boolean)
          : [])),
    ...(Array.isArray(userContext.preferredTags) ? userContext.preferredTags : [])
  ];
  if (preferredMedFoods.length > 0) {
    let matchedTag = null;
    const isMedPreferred = preferredMedFoods.some(p => {
      if (!p) return false;
      const lp = p.toLowerCase();
      if (food.name && food.name.toLowerCase().includes(lp)) { matchedTag = p; return true; }
      if (food.tags && food.tags.some(t => t && t.toLowerCase().includes(lp))) { matchedTag = p; return true; }
      if (food.conditionTags?.prefer && food.conditionTags.prefer.some(t => t && t.toLowerCase() === lp)) { matchedTag = p; return true; }
      return false;
    });
    if (isMedPreferred) {
      score += 40;
      reasons.push(matchedTag ? `matches dietary consideration (${matchedTag})` : 'recommended by medical wellness profile');
    }
  }

  // Priority 8, 9 & 10: Preferences & Cuisine
  const prefList = Array.isArray(userContext.foodPreferences) ? userContext.foodPreferences : [];
  if (prefList.some(p => food.name.toLowerCase().includes(p.toLowerCase()))) {
    score += 30;
    reasons.push('matches your food preferences');
  }

  if (requestConstraints.cuisine) {
    if (food.cuisine && food.cuisine.toLowerCase().includes(requestConstraints.cuisine.toLowerCase())) {
      score += 150;
      reasons.push(`authentic ${food.cuisine} cuisine`);
    } else {
      score -= 300;
    }
  } else {
    // Check unified profile cuisines if no turn-specific cuisine was requested
    const userCuisines = userContext._userFoodProfile?.cuisines ||
      (Array.isArray(userContext.cuisines)
        ? userContext.cuisines
        : (typeof userContext.cuisines === 'string'
            ? userContext.cuisines.split(',').map(s => s.trim()).filter(Boolean)
            : []));
    if (userCuisines.length > 0 && food.cuisine) {
      const matchesCuisine = userCuisines.some(c => c && food.cuisine.toLowerCase().includes(c.toLowerCase()));
      if (matchesCuisine) {
        score += 40;
        reasons.push(`matches your preferred ${food.cuisine} cuisine`);
      }
    }
  }

  // Personalization Scoring from Profile (Soft preferences)
  if (profile) {
    const isExplicitFoodTarget = requestConstraints.targetFood && requestConstraints.targetFood.id === food.id;
    const isExplicitCuisineTarget = requestConstraints.cuisine && food.cuisine && food.cuisine.toLowerCase() === requestConstraints.cuisine.toLowerCase();

    // 1. Liked food bonus
    const liked = profile.preferences.likedFoods.find(lf => lf.value === food.id);
    if (liked) {
      let applyLikedBonus = true;
      if (requestConstraints.targetFood && !isExplicitFoodTarget) applyLikedBonus = false;
      if (requestConstraints.cuisine && !isExplicitCuisineTarget) applyLikedBonus = false;

      if (applyLikedBonus) {
        const bonus = Math.round(50 * liked.strength);
        score += bonus;
        reasons.push(`matches your preferred foods (${liked.source})`);
      }
    }

    // 2. Preferred cuisine bonus
    if (food.cuisine) {
      const prefCuisine = profile.preferences.preferredCuisines.find(pc => pc.value.toLowerCase() === food.cuisine.toLowerCase());
      if (prefCuisine) {
        let applyCuisineBonus = true;
        if (requestConstraints.cuisine && !isExplicitCuisineTarget) applyCuisineBonus = false;

        if (applyCuisineBonus) {
          const bonus = Math.round(60 * prefCuisine.strength);
          score += bonus;
          reasons.push(`preferred ${food.cuisine} cuisine`);
        }
      }
    }

    // 3. Soft Disliked food penalty (S < 1.0)
    const disliked = profile.preferences.dislikedFoods.find(df => df.value === food.id);
    if (disliked && disliked.strength < 1.0) {
      if (isExplicitFoodTarget) {
        reasons.push(`requested despite soft dislike`);
      } else {
        const penalty = Math.round(150 * disliked.strength);
        score -= penalty;
      }
    }

    // 4. Soft Disliked cuisine penalty (S < 1.0)
    if (food.cuisine) {
      const dislikedCuisine = profile.preferences.dislikedCuisines.find(dc => dc.value.toLowerCase() === food.cuisine.toLowerCase());
      if (dislikedCuisine && dislikedCuisine.strength < 1.0) {
        if (isExplicitCuisineTarget) {
          reasons.push(`requested cuisine despite soft dislike`);
        } else {
          const penalty = Math.round(150 * dislikedCuisine.strength);
          score -= penalty;
        }
      }
    }

    // 5. Recent rejection penalty
    if (profile.recentRejections.includes(food.id)) {
      if (!isExplicitFoodTarget) {
        score -= 80;
      }
    }

    // 6. Recent recommendation rotation penalty
    const recIndex = profile.recentRecommendations.indexOf(food.id);
    if (recIndex !== -1) {
      const rotationPenalty = Math.round(120 / (recIndex + 1));
      score -= rotationPenalty;
    }

    // 7. Frequency bonus
    const freqCount = profile.frequentFoods[food.id] || 0;
    if (freqCount > 0) {
      let applyFreqBonus = true;
      if (requestConstraints.targetFood && !isExplicitFoodTarget) applyFreqBonus = false;
      
      if (applyFreqBonus) {
        const bonus = Math.min(20, freqCount * 4);
        score += bonus;
        reasons.push('frequently chosen');
      }
    }
  }

  // ── Phase 4 Contextual Intelligence (Weather, Season, Fasting Suitability, Diversity) ──
  if (contextProfile) {
    // 1. Weather intelligence boost
    if (contextProfile.weather?.category === 'hot' || contextProfile.weather?.category === 'warm') {
      const isCooling = (food.tags && food.tags.includes('cooling')) ||
                        (food.category && /fruit|salad|curd|dairy/i.test(food.category)) ||
                        /salad|fruit|curd|yogurt|cucumber|melon|coconut/i.test(food.name);
      if (isCooling) {
        score += 25;
        reasons.push(`refreshing and hydrating for ${contextProfile.weather.category} weather`);
      }
    } else if (contextProfile.weather?.category === 'cold' || contextProfile.weather?.category === 'cool') {
      const isWarming = (food.tags && food.tags.includes('warm')) ||
                        (food.category && /soup|curry/i.test(food.category)) ||
                        /soup|stew|hot|dal|khichdi|broth/i.test(food.name);
      if (isWarming) {
        score += 25;
        reasons.push(`warming choice for ${contextProfile.weather.category} weather`);
      }
    }

    if (contextProfile.weather?.isRainy || contextProfile.weather?.conditionCategory === 'rainy') {
      const isRainyComfort = (food.category && /soup/i.test(food.category)) ||
                             /soup|tea|khichdi|comfort|broth/i.test(food.name);
      if (isRainyComfort) {
        score += 20;
        reasons.push('comforting meal for rainy weather');
      }
    }

    // 2. Seasonality engine boost
    if (contextProfile.season?.name) {
      const seasonName = contextProfile.season.name.toLowerCase();
      if ((food.tags && food.tags.includes(seasonName)) || (food.seasonalTags && food.seasonalTags.includes(seasonName))) {
        score += 20;
        reasons.push(`in-season ${seasonName} choice`);
      }
    }

    // 3. Fasting suitability boost
    if (contextProfile.fasting?.active) {
      const isVrat = (food.tags && (food.tags.includes('vrat') || food.tags.includes('fasting'))) ||
                     /sabudana|makhana|kuttu|singhara/i.test(food.name);
      if (isVrat) {
        score += 30;
        reasons.push(`matches ${contextProfile.fasting.type || 'fasting'} guidelines`);
      }
    }

    // 4. Bounded history repetition penalty
    if (contextProfile.recentRecommendations && contextProfile.recentRecommendations.length > 0) {
      const fId = String(food.id || '').toLowerCase();
      const fName = String(food.name || '').toLowerCase();
      const lastIdx = contextProfile.recentRecommendations.map(r => String(r).toLowerCase()).lastIndexOf(fId);
      const nameIdx = contextProfile.recentRecommendations.map(r => String(r).toLowerCase()).lastIndexOf(fName);
      const matchIdx = Math.max(lastIdx, nameIdx);

      if (matchIdx !== -1) {
        const turnsAgo = contextProfile.recentRecommendations.length - 1 - matchIdx;
        if (turnsAgo < 3) {
          score -= 30;
        } else if (turnsAgo < 10) {
          score -= 15;
        }
      }
    }
  }

  // ── Phase 5: Behavioral Learning & Preference Evolution ─────────────
  const beh = behavioralProfile ||
    userContext.behavioralProfile ||
    (userContext.id ? getBehavioralProfileSync(userContext.id) : null);

  if (beh) {
    const fId = String(food.id || '').trim();

    // 1. Learned Preferred Food Bonus (+35 * score * conf)
    if (fId && beh.preferredFoods && beh.preferredFoods[fId]) {
      const pf = beh.preferredFoods[fId];
      const bonus = Math.round((pf.score || 0) * (pf.confidence || 0) * 35);
      if (bonus > 0) {
        score += bonus;
        reasons.push('frequently chosen by you');
      }
    }

    // 2. Learned Disliked Food Penalty (-80 * score * conf)
    if (fId && beh.dislikedFoods && beh.dislikedFoods[fId]) {
      const df = beh.dislikedFoods[fId];
      const penalty = Math.round((df.score || 0) * (df.confidence || 0) * 80);
      if (penalty > 0) {
        score -= penalty;
      }
    }

    // 3. Learned Preferred Cuisine Bonus (+25 * score * conf)
    if (food.cuisine && beh.preferredCuisines) {
      const fc = food.cuisine.toLowerCase().trim();
      for (const [c, cData] of Object.entries(beh.preferredCuisines)) {
        if (fc.includes(c.toLowerCase()) || c.toLowerCase().includes(fc)) {
          const bonus = Math.round((cData.score || 0) * (cData.confidence || 0) * 25);
          if (bonus > 0) {
            score += bonus;
            const displayCuisine = food.cuisine.charAt(0).toUpperCase() + food.cuisine.slice(1);
            reasons.push(`matches learned preference for ${displayCuisine} cuisine`);
            break;
          }
        }
      }
    }

    // 4. Learned Disliked Ingredients Penalty (-40 * score * conf)
    if (beh.dislikedIngredients) {
      const foodIngs = [
        ...(food.ingredients || []),
        ...(Array.isArray(food.allergens) ? food.allergens : [])
      ].map(i => String(i).toLowerCase().trim());

      for (const [ing, iData] of Object.entries(beh.dislikedIngredients)) {
        const lIng = ing.toLowerCase();
        if (foodIngs.includes(lIng) || (food.name && food.name.toLowerCase().includes(lIng))) {
          const penalty = Math.round((iData.score || 0) * (iData.confidence || 0) * 40);
          if (penalty > 0) {
            score -= penalty;
            break;
          }
        }
      }
    }
  }

  return { score, safe: true, reasons };
}

function recommendFoods({ userContext = {}, requestConstraints = {}, exclusions = [], mealType = null, excludeFoodIds = [], limit = 3, context = {}, behavioralProfile = null }) {
  const allFoods = getAllFoods();
  let wasPoolExhausted = false;

  const userId = userContext.id || 'default_user';
  const profile = getUserProfile(userId);
  const behProfile = behavioralProfile || userContext.behavioralProfile || getBehavioralProfileSync(userId);

  const contextProfile = (context && context.mealPeriod && context.weather && context.season)
    ? context
    : buildContextProfile({
        ...(userContext.contextProfile || userContext.context || context || {}),
        userProfile: userContext._userFoodProfile || userContext
      });

  // Anti-repetition filtering (Priority 8: Variety)
  let availableFoods = allFoods.filter(food => 
    !excludeFoodIds.includes(food.id) &&
    !excludeFoodIds.includes(food.name)
  );

  let scored = availableFoods
    .map(food => {
      const evaluation = scoreFoodWithPriority(food, userContext, requestConstraints, exclusions, mealType, profile, contextProfile, behProfile);
      return { food, score: evaluation.score, safe: evaluation.safe, reasons: evaluation.reasons };
    })
    .filter(item => item.safe !== false && item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 && excludeFoodIds.length > 0) {
    return {
      success: true,
      recommendedFoods: [],
      reply: "I've run out of suitable alternative recommendations matching your criteria. Try resetting your preferences or relaxing some constraints!",
      recommendations: [],
      wasPoolExhausted: true,
      behavioralProfile: behProfile
    };
  }

  let selected = [];
  if (limit >= 3 && scored.length >= 3) {
    selected.push(scored[0], scored[1]);

    const checkIsPersonalized = (f) => {
      if (!profile && !behProfile) return false;
      const isLiked = profile?.preferences.likedFoods.some(lf => lf.value === f.id);
      const isPrefCuisine = f.cuisine && profile?.preferences.preferredCuisines.some(pc => pc.value.toLowerCase() === f.cuisine.toLowerCase());
      const isLearned = profile?.learnedPreferences.some(lp => lp.value === f.id);
      const isBehFood = behProfile?.preferredFoods && behProfile.preferredFoods[f.id];
      const isBehCuisine = f.cuisine && behProfile?.preferredCuisines && behProfile.preferredCuisines[f.cuisine.toLowerCase()];
      return isLiked || isPrefCuisine || isLearned || isBehFood || isBehCuisine;
    };

    let explorationCandidate = null;
    for (let i = 2; i < scored.length; i++) {
      if (!checkIsPersonalized(scored[i].food)) {
        explorationCandidate = scored[i];
        break;
      }
    }

    if (explorationCandidate) {
      selected.push(explorationCandidate);
    } else {
      selected.push(scored[2]);
    }
  } else {
    selected = scored.slice(0, limit);
  }

  if (selected.length === 0) {
    return {
      success: false,
      recommendedFoods: [],
      reply: "I couldn't find any foods matching your combination of constraints. Try relaxing calorie limits or dietary restrictions!",
      behavioralProfile: behProfile
    };
  }

  // Register final recommendations in profile
  selected.forEach(item => {
    trackRecommendation(userId, item.food.id);
  });

  const name = userContext.name || 'there';
  let responseText = wasPoolExhausted 
    ? `I've reached the end of new unique options matching your strict criteria, ${name}. Here are top refreshed recommendations:\n\n`
    : `Here are recommendations tailored for you, ${name}:\n\n`;

  selected.forEach((item, index) => {
    const f = item.food;
    const rationale = item.reasons.length > 0 ? item.reasons.join(', ') : 'great balanced option';
    responseText += `${index + 1}. **${f.name}** (${f.servingSize})\n`;
    responseText += `   • **Nutrition:** ${f.calories} kcal | Protein: ${f.protein}g | Carbs: ${f.carbohydrates}g | Fat: ${f.fat}g\n`;
    responseText += `   • **Why:** ${rationale.charAt(0).toUpperCase() + rationale.slice(1)}.\n\n`;
  });

  const recommendedFoods = selected.map(s => ({ ...s.food, score: s.score, reasons: s.reasons }));

  return {
    success: true,
    reply: responseText.trim(),
    recommendations: selected.map(s => s.food),
    recommendedFoods,
    contextProfile,
    behavioralProfile: behProfile,
    wasPoolExhausted
  };
}

module.exports = {
  scoreFoodWithPriority,
  recommendFoods
};
