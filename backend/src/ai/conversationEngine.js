// ─────────────────────────────────────────────────────────────
//  backend/src/ai/conversationEngine.js
//  Advanced Multi-Turn Context Tracking & Constraint Management Engine
// ─────────────────────────────────────────────────────────────


const { searchFood, FOODS_DATABASE } = require('./foodKnowledge');

const PRECOMPUTED_FOOD_LOOKUPS = FOODS_DATABASE.map(food => {
  const names = [food.name.toLowerCase(), ...food.aliases.map(a => a.toLowerCase())].filter(name => name.length >= 3);
  return {
    food,
    names
  };
});

function extractRecommendedFoodsFromCoachText(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const matched = [];

  for (const lookup of PRECOMPUTED_FOOD_LOOKUPS) {
    let minIndex = -1;
    for (const name of lookup.names) {
      const index = lower.indexOf(name);
      if (index !== -1) {
        if (minIndex === -1 || index < minIndex) {
          minIndex = index;
        }
      }
    }
    
    if (minIndex !== -1) {
      matched.push({
        food: lookup.food,
        index: minIndex
      });
    }
  }

  matched.sort((a, b) => a.index - b.index);

  // Eliminate duplicates and overlapping matches (favoring longer matches)
  const finalFoods = [];
  for (const item of matched) {
    const overlap = finalFoods.find(existing => {
      const existingName = existing.name.toLowerCase();
      const itemName = item.food.name.toLowerCase();
      return existingName.includes(itemName) || itemName.includes(existingName);
    });

    if (overlap) {
      if (item.food.name.length > overlap.name.length) {
        const idx = finalFoods.indexOf(overlap);
        finalFoods[idx] = item.food;
      }
    } else {
      finalFoods.push(item.food);
    }
  }

  return finalFoods;
}

function resolveReferenceFromText(text, previousRecommendations = []) {
  if (!text || !Array.isArray(previousRecommendations) || previousRecommendations.length === 0) return null;
  const norm = text.toLowerCase();

  // Check for second / 2nd / doosra
  if (norm.includes('second one') || norm.includes('2nd option') || norm.includes('option 2') || norm.includes('second option') || norm.includes('second') || norm.includes('second wala') || norm.includes('doosra') || norm.includes('dusra') || norm.includes('woh second') || norm.includes('wo second')) {
    return previousRecommendations[1] || null;
  }
  // Check for first / 1st / pehla
  if (norm.includes('first one') || norm.includes('1st option') || norm.includes('option 1') || norm.includes('first option') || norm.includes('first') || norm.includes('pehla') || norm.includes('pehla wala') || norm.includes('pehle wala')) {
    return previousRecommendations[0] || null;
  }
  // Check for third / 3rd / teesra
  if (norm.includes('third one') || norm.includes('3rd option') || norm.includes('option 3') || norm.includes('third option') || norm.includes('third') || norm.includes('teesra') || norm.includes('teesra wala')) {
    return previousRecommendations[2] || null;
  }
  // Check for last / aakhri / akhri
  if (norm.includes('last one') || norm.includes('last option') || norm.includes('last') || norm.includes('aakhri') || norm.includes('akhri') || norm.includes('akhri wala')) {
    return previousRecommendations[previousRecommendations.length - 1] || null;
  }
  // Check for previous / pehle
  if (norm.includes('previous one') || norm.includes('previous option') || norm.includes('previous') || norm.includes('pehle option') || norm.includes('pehle wala')) {
    return previousRecommendations[previousRecommendations.length - 1] || null;
  }

  return null;
}

function buildCompactState(conversationHistory = []) {
  const state = {
    activeConstraints: {
      highProtein: false,
      lightMeal: false,
      maxCalories: null,
      minProtein: null,
      isCheaper: false,
      isQuick: false,
      dietType: null,
      cuisine: null,
      mealType: null,
      spicy: null,
      filling: false,
      mild: false
    },
    sessionExclusions: [],
    sessionDislikes: [],
    rejectedFoods: [],
    previousRecommendations: [],
    selectedFood: null,
    currentFood: null,
    recentFoods: [],
    temporalContext: null,
    turnNumber: 0,
    excludeIds: []
  };

  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return state;
  }

  // Scan recent turns (bounded to 60 messages / 30 turns to avoid uncontrolled growth)
  const windowMsgs = conversationHistory.slice(-60);

  for (let i = 0; i < windowMsgs.length; i++) {
    const msg = windowMsgs[i];
    if (!msg || !msg.text) continue;

    const text = msg.text;
    const lower = text.toLowerCase();
    const isUser = msg.sender === 'user' || msg.isUser || msg.source === 'user';

    state.turnNumber++;

    if (isUser) {
      // 1. Reset check
      if (lower.includes('reset') || lower.includes('start over') || lower.includes('new conversation') || lower.includes('clear context')) {
        state.activeConstraints = {
          highProtein: false,
          lightMeal: false,
          maxCalories: null,
          minProtein: null,
          isCheaper: false,
          isQuick: false,
          dietType: null,
          cuisine: null,
          mealType: null,
          spicy: null,
          filling: false,
          mild: false
        };
        state.sessionExclusions = [];
        state.sessionDislikes = [];
        state.rejectedFoods = [];
        state.selectedFood = null;
        state.currentFood = null;
        state.recentFoods = [];
        state.temporalContext = null;
        state.excludeIds = [];
        continue;
      }

      // 2. Conversational Corrections
      if (lower.includes('meant breakfast') || lower.includes('mean breakfast')) {
        state.activeConstraints.mealType = 'breakfast';
      } else if (lower.includes('meant dinner') || lower.includes('mean dinner')) {
        state.activeConstraints.mealType = 'dinner';
      } else if (lower.includes('meant lunch') || lower.includes('mean lunch')) {
        state.activeConstraints.mealType = 'lunch';
      } else if (lower.includes('meant snack') || lower.includes('mean snack')) {
        state.activeConstraints.mealType = 'snack';
      }
      if (lower.includes('not vegetarian') || lower.includes('not veg')) {
        state.activeConstraints.dietType = 'any';
      }

      if (lower.includes('chicken, not fish') || lower.includes('chicken not fish')) {
        state.sessionExclusions = state.sessionExclusions.filter(e => e !== 'chicken');
        state.sessionDislikes = state.sessionDislikes.filter(e => e !== 'chicken');
        if (!state.sessionExclusions.includes('fish')) state.sessionExclusions.push('fish');
      }

      // 3. Overrides / Conflict Resolution
      if (lower.includes('filling') || lower.includes('heavy') || lower.includes('pet bharke') || lower.includes('pet bhar')) {
        state.activeConstraints.lightMeal = false;
        state.activeConstraints.filling = true;
      } else if (lower.includes('light') || lower.includes('halka') || lower.includes('less calories') || lower.includes('lower calorie')) {
        state.activeConstraints.lightMeal = true;
        state.activeConstraints.filling = false;
      }

      if (lower.includes('not too much protein') || lower.includes('low protein') || lower.includes('less protein')) {
        state.activeConstraints.highProtein = false;
      } else if (lower.includes('high protein') || lower.includes('protein rich') || lower.includes('more protein') || lower.includes('muscle')) {
        state.activeConstraints.highProtein = true;
      }

      if (lower.includes('less spicy') || lower.includes('not too spicy') || lower.includes('mild') || lower.includes('thoda kam spicy') || lower.includes('kam spicy')) {
        state.activeConstraints.spicy = false;
        state.activeConstraints.mild = true;
      } else if (lower.includes('make it spicy') || lower.includes('spicy') || lower.includes('tikha') || lower.includes('teekha')) {
        state.activeConstraints.spicy = true;
        state.activeConstraints.mild = false;
      }

      // 4. Diet Transitions
      if ((lower.includes('vegetarian') || lower.includes('make it veg') || lower.includes('pure veg') || lower.includes('shakahari')) && !lower.includes('not vegetarian') && !lower.includes('not veg') && !lower.includes('non vegetarian') && !lower.includes('non veg')) {
        state.activeConstraints.dietType = 'vegetarian';
        state.sessionExclusions = state.sessionExclusions.filter(e => e !== 'chicken');
      } else if (lower.includes('vegan')) {
        state.activeConstraints.dietType = 'vegan';
      } else if (lower.includes('eggetarian')) {
        state.activeConstraints.dietType = 'eggetarian';
      }

      // 5. Explicit Constraint Removals
      if (lower.includes('forget the calorie limit') || lower.includes('remove the calorie limit') || lower.includes('no limit on calories') || lower.includes('calories don\'t matter')) {
        state.activeConstraints.maxCalories = null;
        state.activeConstraints.lightMeal = false;
      }
      if (lower.includes('chicken is okay') || lower.includes('chicken is fine') || lower.includes('allow chicken') || lower.includes('can eat chicken') || lower.includes('chicken ab okay') || lower.includes('forget the no chicken') || lower.includes('forget chicken restriction')) {
        state.sessionExclusions = state.sessionExclusions.filter(e => e !== 'chicken');
        state.sessionDislikes = state.sessionDislikes.filter(e => e !== 'chicken');
        state.excludeIds = state.excludeIds.filter(id => !id.includes('chicken'));
        state.activeConstraints.dietType = 'any';
      }
      if (lower.includes('paneer is fine') || lower.includes('paneer is okay') || lower.includes('allow paneer')) {
        state.sessionExclusions = state.sessionExclusions.filter(e => e !== 'paneer');
        state.sessionDislikes = state.sessionDislikes.filter(e => e !== 'paneer');
        state.excludeIds = state.excludeIds.filter(id => !id.includes('paneer'));
      }
      if (lower.includes('don\'t care about price') || lower.includes('remove price limit') || lower.includes('forget price') || lower.includes('forget the price')) {
        state.activeConstraints.isCheaper = false;
      }

      // 6. Constraint Accumulation
      if (lower.includes('cheaper') || lower.includes('budget') || lower.includes('inexpensive') || lower.includes('sasta') || lower.includes('low price')) {
        state.activeConstraints.isCheaper = true;
      }
      if (lower.includes('quick') || lower.includes('fast') || lower.includes('jaldi') || lower.includes('easy')) {
        state.activeConstraints.isQuick = true;
      }

      // Meal & Cuisine Accumulation
      if (lower.includes('breakfast') || lower.includes('subah')) state.activeConstraints.mealType = 'breakfast';
      else if (lower.includes('lunch') || lower.includes('dopahar')) state.activeConstraints.mealType = 'lunch';
      else if (lower.includes('dinner') || lower.includes('raat')) state.activeConstraints.mealType = 'dinner';
      else if (lower.includes('snack') || lower.includes('shaam')) state.activeConstraints.mealType = 'snack';

      if (lower.includes('south indian')) state.activeConstraints.cuisine = 'South Indian';
      else if (lower.includes('north indian')) state.activeConstraints.cuisine = 'North Indian';
      else if (lower.includes('chinese')) state.activeConstraints.cuisine = 'Chinese';
      else if (lower.includes('italian')) state.activeConstraints.cuisine = 'Italian';
      else if (lower.includes('mexican')) state.activeConstraints.cuisine = 'Mexican';

      if (lower.includes('today') || lower.includes('aaj')) state.temporalContext = 'today';
      if (lower.includes('tonight') || lower.includes('raat')) state.temporalContext = 'tonight';
      if (lower.includes('tomorrow') || lower.includes('kal')) state.temporalContext = 'tomorrow';
      if (lower.includes('after workout') || lower.includes('gym') || lower.includes('post workout') || lower.includes('post-workout')) {
        state.temporalContext = 'post-workout';
      }

      // Allergies & Hard Exclusions (Negation extraction)
      // 1. Trigger-first negation: e.g. "no chicken", "without paneer"
      const dislikeMatch = lower.match(/(?:don'?t\s+like|don'?t\s+want|don'?t\s+eat|hate|avoid|dislike|exclude|no|without|no\s+more|allergic\s+to|allergy\s+to)\s+([a-z0-9\s]+)/i);
      if (dislikeMatch && dislikeMatch[1]) {
        const item = dislikeMatch[1].trim().split(/\s+/)[0].replace(/[^a-z0-9]/gi, '');
        if (item.length > 2) {
          if (!state.sessionDislikes.includes(item)) state.sessionDislikes.push(item);
          if (!state.sessionExclusions.includes(item)) state.sessionExclusions.push(item);
        }
      }
      // 2. Item-first negation: e.g. "paneer nahi chahiye", "chicken na chahiye"
      const hinglishDislikeMatch = lower.match(/([a-z0-9\s]+)\s+(?:nahi?\s+chahiye|na\s+chahiye|nahi\s+khao)/i);
      if (hinglishDislikeMatch && hinglishDislikeMatch[1]) {
        const item = hinglishDislikeMatch[1].trim().split(/\s+/).pop().replace(/[^a-z0-9]/gi, '');
        if (item.length > 2) {
          if (!state.sessionDislikes.includes(item)) state.sessionDislikes.push(item);
          if (!state.sessionExclusions.includes(item)) state.sessionExclusions.push(item);
        }
      }

      const referencedSelection = resolveReferenceFromText(text, state.previousRecommendations);
      if (referencedSelection) {
        state.selectedFood = referencedSelection;
        state.currentFood = referencedSelection;
        if (!state.recentFoods.some(r => r.id === referencedSelection.id)) {
          state.recentFoods.unshift(referencedSelection);
        }
      }

      if (lower.includes('don\'t like') || lower.includes('don\'t want') || lower.includes('not that') || lower.includes('yeh wala nahi') || lower.includes('nope') || lower.includes('something else') || lower.includes('different') || lower.includes('another') || lower.includes('nahi chahiye') || lower.includes('aur kuch') || lower.includes('reject')) {
        const refRejection = resolveReferenceFromText(text, state.previousRecommendations);
        if (refRejection) {
          if (!state.rejectedFoods.includes(refRejection.id)) {
            state.rejectedFoods.push(refRejection.id);
          }
          if (!state.excludeIds.includes(refRejection.id)) {
            state.excludeIds.push(refRejection.id);
          }
        } else if (state.previousRecommendations.length > 0) {
          const defaultRejection = state.previousRecommendations[0];
          if (defaultRejection) {
            if (!state.rejectedFoods.includes(defaultRejection.id)) {
              state.rejectedFoods.push(defaultRejection.id);
            }
            if (!state.excludeIds.includes(defaultRejection.id)) {
              state.excludeIds.push(defaultRejection.id);
            }
          }
        }
        state.selectedFood = null;
      }

      // Food entities extraction (User text)
      for (const lookup of PRECOMPUTED_FOOD_LOOKUPS) {
        let found = false;
        for (const name of lookup.names) {
          if (lower.includes(name)) {
            found = true;
            break;
          }
        }
        if (found) {
          state.currentFood = lookup.food;
          if (!state.recentFoods.some(r => r.id === lookup.food.id)) {
            state.recentFoods.unshift(lookup.food);
          }
        }
      }

    } else {
      // Coach Turn
      const recommendedList = extractRecommendedFoodsFromCoachText(text);
      if (recommendedList.length > 0) {
        state.previousRecommendations = recommendedList;
      }
    }
  }

  state.currentMeal = state.activeConstraints.mealType;
  return state;
}

function resolveContextReference(text, activeState = {}) {
  if (!text || typeof text !== 'string') return null;

  const resolved = resolveReferenceFromText(text, activeState.previousRecommendations);
  if (resolved) return resolved;

  // Fallback check
  const norm = text.toLowerCase().trim();
  if (norm.includes(' it') || norm.includes('it ') || norm === 'it' || norm.includes('that') || norm.includes('this') || norm.includes('for it') || norm.includes('in it') || norm.includes('does it') || norm.includes('previous')) {
    if (activeState.selectedFood) return activeState.selectedFood;
    if (activeState.currentFood) return activeState.currentFood;
    if (activeState.recentFoods && activeState.recentFoods[0]) return activeState.recentFoods[0];
  }

  return null;
}

module.exports = {
  buildCompactState,
  resolveContextReference
};
