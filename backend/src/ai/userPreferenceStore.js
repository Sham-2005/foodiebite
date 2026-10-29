// ─────────────────────────────────────────────────────────────
//  backend/src/ai/userPreferenceStore.js
//  Deterministic Local User Preference Store
// ─────────────────────────────────────────────────────────────

const { searchFood } = require('./foodKnowledge');

const profiles = new Map();

function getBlankProfile(userId) {
  return {
    userId,
    preferences: {
      likedFoods: [], // array of { value, name, source, strength, updatedAt }
      dislikedFoods: [], // array of { value, name, source, strength, updatedAt }
      preferredCuisines: [], // array of { value, source, strength, updatedAt }
      dislikedCuisines: [], // array of { value, source, strength, updatedAt }
      dietaryPreferences: [], // array of { value, source, strength, updatedAt }
      nutritionGoals: [], // array of { value, source, strength, updatedAt }
      preferredMealTypes: [], // array of { value, source, strength, updatedAt }
      preferredPreparationTypes: [] // array of { value, source, strength, updatedAt }
    },
    preferenceStrength: {}, // key-value map of value -> strength
    frequentFoods: {}, // foodId -> count
    recentFoods: [], // list of foodIds (bounded, max 10)
    recentRejections: [], // list of foodIds (bounded, max 10)
    recentRecommendations: [], // list of foodIds (bounded, max 10)
    learnedPreferences: [], // list of { value, source, strength, type, updatedAt }
    updatedAt: Date.now()
  };
}

function getUserProfile(userId) {
  const id = userId || 'default_user';
  if (!profiles.has(id)) {
    profiles.set(id, getBlankProfile(id));
  }
  return profiles.get(id);
}

function saveUserProfile(userId, profile) {
  const id = userId || 'default_user';
  profiles.set(id, profile);
}

function resetUserProfile(userId) {
  const id = userId || 'default_user';
  const newProfile = getBlankProfile(id);
  profiles.set(id, newProfile);
}

function parsePreferenceDeclaration(text) {
  if (!text || typeof text !== 'string') return null;
  const norm = text.toLowerCase().trim();

  // Reset patterns
  if (norm.includes('forget my food preferences') || norm.includes('reset my preferences') || norm.includes('clear what you learned')) {
    return { type: 'RESET' };
  }

  // Allow again / ok again
  const okayMatches = [
    /([a-z\s\-]+) (?:is|are) (?:okay|ok|fine) now/i,
    /allow ([a-z\s\-]+)/i,
    /can eat ([a-z\s\-]+)/i,
    /allow eating ([a-z\s\-]+)/i
  ];
  for (const regex of okayMatches) {
    const match = norm.match(regex);
    if (match) {
      return { type: 'ALLOW', term: match[1].trim() };
    }
  }

  // Hinglish checks
  if (norm.includes('nahi chahiye') || norm.includes('pasand nahi') || norm.includes('avoid karna')) {
    const index = norm.indexOf('nah');
    let termText = index !== -1 ? norm.substring(0, index).trim() : norm;
    termText = termText.replace('mujhe', '').replace('i', '').trim();
    if (termText.length >= 3) {
      return { type: 'DISLIKE', term: termText, strength: 0.8 };
    }
  }
  if (norm.includes('ab okay') || norm.includes('ab fine') || norm.includes('chalega')) {
    const index = norm.search(/(?:ab|chalega)/);
    let termText = index !== -1 ? norm.substring(0, index).trim() : norm;
    termText = termText.replace('mujhe', '').replace('i', '').trim();
    if (termText.length >= 3) {
      return { type: 'ALLOW', term: termText };
    }
  }

  // Determine type & strength
  let type = null;
  let strength = 0.7; // default moderate

  // Exclude / Never
  if (norm.includes('never give') || norm.includes('never recommend') || norm.includes('exclude') || norm.includes('strictly no') || norm.startsWith('no ') || norm.includes('don\'t want') || norm.includes('without')) {
    type = 'EXCLUDE';
    strength = 1.0;
  }
  // Dislike / Hate / Avoid
  else if (norm.includes('don\'t like') || norm.includes('do not like') || norm.includes('dislike') || norm.includes('avoid')) {
    type = 'DISLIKE';
    strength = 0.7;
  } else if (norm.includes('hate')) {
    type = 'DISLIKE';
    strength = 0.9;
  }
  // Love / Favorite
  else if (norm.includes('love') || norm.includes('favorite') || norm.includes('fav')) {
    type = 'LIKE';
    strength = norm.includes('favorite') || norm.includes('fav') ? 1.0 : 0.9;
  }
  // Like / Prefer
  else if (norm.includes('like') || norm.includes('prefer') || norm.includes('usually eat') || norm.includes('usually prefer')) {
    type = 'LIKE';
    strength = 0.7;
  }

  if (!type) return null;

  // Extract the term
  let termText = norm;
  const stripPatterns = [
    'i love', 'my favorite is', 'my favorite food is', 'my favorite', 'fav', 'really like', 'absolutely love',
    'i don\'t like', 'i do not like', 'i dislike', 'i avoid', 'i hate', 'never give me', 'never recommend', 'exclude',
    'i like', 'i prefer', 'i usually eat', 'i usually prefer', 'food', 'meals', 'eat', 'strictly no',
    'don\'t want', 'without', 'no '
  ];
  for (const pattern of stripPatterns) {
    termText = termText.replace(new RegExp(pattern, 'g'), '');
  }
  termText = termText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();

  // Strip meal context suffix
  const mealSuffixes = ['for breakfast', 'for lunch', 'for dinner', 'for snack', 'for a snack'];
  for (const suffix of mealSuffixes) {
    if (termText.endsWith(suffix)) {
      termText = termText.substring(0, termText.length - suffix.length).trim();
    }
  }

  if (termText.length < 3) return null;

  return { type, term: termText, strength };
}

function categorizePreference(term) {
  const t = term.toLowerCase().trim();

  // Cuisines
  const cuisines = ['south indian', 'north indian', 'asian', 'continental', 'mediterranean', 'chinese', 'italian', 'mexican'];
  for (const c of cuisines) {
    if (t.includes(c)) return { category: 'cuisine', value: c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
  }

  // Diets
  const diets = ['vegetarian', 'veg', 'vegan', 'eggetarian', 'non-vegetarian', 'non-veg'];
  for (const d of diets) {
    if (t === d || t === `a ${d}` || t.includes(d)) {
      const canonicalDiet = (d === 'veg' || d === 'vegetarian') ? 'vegetarian' : (d === 'non-veg' || d === 'non-vegetarian') ? 'non-vegetarian' : d;
      return { category: 'diet', value: canonicalDiet };
    }
  }

  // Preparation
  const preparations = ['grilled', 'steamed', 'baked', 'fried', 'raw', 'roasted'];
  for (const p of preparations) {
    if (t.includes(p)) return { category: 'preparation', value: p };
  }

  // Nutrition goals
  const goals = ['high protein', 'weight loss', 'muscle gain', 'light meals', 'hydration', 'low calorie', 'light meal'];
  for (const g of goals) {
    if (t.includes(g)) {
      const canonicalGoal = (g === 'light meal') ? 'light meals' : g;
      return { category: 'goal', value: canonicalGoal };
    }
  }

  // Food check
  const food = searchFood(t);
  if (food) {
    return { category: 'food', value: food.id, name: food.name };
  }

  // Fallback as food name
  return { category: 'food', value: t, name: term };
}

function applyPreferenceUpdate(userId, decl) {
  const profile = getUserProfile(userId);
  if (!decl) return false;

  profile.updatedAt = Date.now();

  if (decl.type === 'RESET') {
    resetUserProfile(userId);
    return true;
  }

  const cat = categorizePreference(decl.term);
  if (!cat) return false;

  const key = cat.value;

  if (decl.type === 'ALLOW') {
    if (cat.category === 'food') {
      profile.preferences.dislikedFoods = profile.preferences.dislikedFoods.filter(f => f.value !== key);
      profile.recentRejections = profile.recentRejections.filter(f => f !== key);
      profile.learnedPreferences = profile.learnedPreferences.filter(p => !(p.value === key && p.type === 'dislike'));
    } else if (cat.category === 'cuisine') {
      profile.preferences.dislikedCuisines = profile.preferences.dislikedCuisines.filter(c => c.value !== key);
    }
    syncPreferenceStrength(profile);
    return true;
  }

  const strength = decl.strength || 0.7;

  if (decl.type === 'LIKE') {
    if (cat.category === 'food') {
      profile.preferences.dislikedFoods = profile.preferences.dislikedFoods.filter(f => f.value !== key);
      const existing = profile.preferences.likedFoods.find(f => f.value === key);
      if (existing) {
        existing.strength = strength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.likedFoods.push({ value: key, name: cat.name, source: 'explicit', strength, updatedAt: Date.now() });
      }
    } else if (cat.category === 'cuisine') {
      profile.preferences.dislikedCuisines = profile.preferences.dislikedCuisines.filter(c => c.value !== key);
      const existing = profile.preferences.preferredCuisines.find(c => c.value === key);
      if (existing) {
        existing.strength = strength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.preferredCuisines.push({ value: key, source: 'explicit', strength, updatedAt: Date.now() });
      }
    } else if (cat.category === 'diet') {
      const existing = profile.preferences.dietaryPreferences.find(d => d.value === key);
      if (existing) {
        existing.strength = strength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.dietaryPreferences.push({ value: key, source: 'explicit', strength, updatedAt: Date.now() });
      }
    } else if (cat.category === 'goal') {
      const existing = profile.preferences.nutritionGoals.find(g => g.value === key);
      if (existing) {
        existing.strength = strength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.nutritionGoals.push({ value: key, source: 'explicit', strength, updatedAt: Date.now() });
      }
    } else if (cat.category === 'preparation') {
      const existing = profile.preferences.preferredPreparationTypes.find(p => p.value === key);
      if (existing) {
        existing.strength = strength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.preferredPreparationTypes.push({ value: key, source: 'explicit', strength, updatedAt: Date.now() });
      }
    }
  } else if (decl.type === 'DISLIKE' || decl.type === 'EXCLUDE') {
    const isHardExclusion = decl.type === 'EXCLUDE';
    const finalStrength = isHardExclusion ? 1.0 : strength;

    if (cat.category === 'food') {
      profile.preferences.likedFoods = profile.preferences.likedFoods.filter(f => f.value !== key);
      const existing = profile.preferences.dislikedFoods.find(f => f.value === key);
      if (existing) {
        existing.strength = finalStrength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.dislikedFoods.push({ value: key, name: cat.name, source: 'explicit', strength: finalStrength, updatedAt: Date.now() });
      }
    } else if (cat.category === 'cuisine') {
      profile.preferences.preferredCuisines = profile.preferences.preferredCuisines.filter(c => c.value !== key);
      const existing = profile.preferences.dislikedCuisines.find(c => c.value === key);
      if (existing) {
        existing.strength = finalStrength;
        existing.source = 'explicit';
        existing.updatedAt = Date.now();
      } else {
        profile.preferences.dislikedCuisines.push({ value: key, source: 'explicit', strength: finalStrength, updatedAt: Date.now() });
      }
    }
  }

  syncPreferenceStrength(profile);
  return true;
}

function syncPreferenceStrength(profile) {
  const strength = {};
  
  profile.preferences.likedFoods.forEach(f => { strength[f.value] = f.strength; });
  profile.preferences.preferredCuisines.forEach(c => { strength[c.value] = c.strength; });
  profile.preferences.dietaryPreferences.forEach(d => { strength[d.value] = d.strength; });
  profile.preferences.nutritionGoals.forEach(g => { strength[g.value] = g.strength; });
  profile.preferences.preferredPreparationTypes.forEach(p => { strength[p.value] = p.strength; });

  profile.preferences.dislikedFoods.forEach(f => { strength[f.value] = -f.strength; });
  profile.preferences.dislikedCuisines.forEach(c => { strength[c.value] = -c.strength; });

  profile.learnedPreferences.forEach(p => {
    if (!strength[p.value]) {
      strength[p.value] = p.type === 'dislike' ? -p.strength : p.strength;
    }
  });

  profile.preferenceStrength = strength;
}

function trackSelection(userId, foodId) {
  const profile = getUserProfile(userId);
  if (!foodId) return;

  profile.recentFoods = profile.recentFoods.filter(id => id !== foodId);
  profile.recentFoods.unshift(foodId);
  if (profile.recentFoods.length > 10) {
    profile.recentFoods.pop();
  }

  const count = profile.frequentFoods[foodId] || 0;
  profile.frequentFoods[foodId] = count + 1;

  if (profile.frequentFoods[foodId] >= 3) {
    const existing = profile.learnedPreferences.find(p => p.value === foodId);
    if (!existing) {
      profile.learnedPreferences.push({
        value: foodId,
        source: 'behavior',
        strength: 0.55,
        type: 'food',
        updatedAt: Date.now()
      });
    } else {
      existing.strength = Math.min(0.8, existing.strength + 0.05);
      existing.updatedAt = Date.now();
    }
    syncPreferenceStrength(profile);
  }
}

function trackRejection(userId, foodId) {
  const profile = getUserProfile(userId);
  if (!foodId) return;

  profile.recentRejections = profile.recentRejections.filter(id => id !== foodId);
  profile.recentRejections.unshift(foodId);
  if (profile.recentRejections.length > 10) {
    profile.recentRejections.pop();
  }
}

function trackRecommendation(userId, foodId) {
  const profile = getUserProfile(userId);
  if (!foodId) return;

  profile.recentRecommendations = profile.recentRecommendations.filter(id => id !== foodId);
  profile.recentRecommendations.unshift(foodId);
  if (profile.recentRecommendations.length > 10) {
    profile.recentRecommendations.pop();
  }
}

function decayPreferences(userId) {
  const profile = getUserProfile(userId);

  profile.learnedPreferences.forEach(p => {
    p.strength = p.strength * 0.95;
  });
  profile.learnedPreferences = profile.learnedPreferences.filter(p => p.strength >= 0.1);

  const decayArray = (arr) => {
    arr.forEach(p => {
      if (p.strength < 1.0) {
        p.strength = p.strength * 0.98;
      }
    });
  };

  decayArray(profile.preferences.likedFoods);
  decayArray(profile.preferences.preferredCuisines);
  decayArray(profile.preferences.dietaryPreferences);
  decayArray(profile.preferences.nutritionGoals);
  decayArray(profile.preferences.preferredPreparationTypes);

  syncPreferenceStrength(profile);
}

module.exports = {
  getUserProfile,
  saveUserProfile,
  resetUserProfile,
  parsePreferenceDeclaration,
  categorizePreference,
  applyPreferenceUpdate,
  trackSelection,
  trackRejection,
  trackRecommendation,
  decayPreferences
};
