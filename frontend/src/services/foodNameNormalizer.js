/**
 * ─────────────────────────────────────────────────────────────
 *  frontend/src/services/foodNameNormalizer.js
 *  Central Reusable Food-Name Normalization Service (Frontend ES Module)
 * ─────────────────────────────────────────────────────────────
 *
 *  PURPOSE:
 *  Standardizes food names across the entire application into clear,
 *  natural, recognizable English without changing underlying food identity,
 *  stable identifiers, or cultural meaning.
 * ─────────────────────────────────────────────────────────────
 */

// ── Verified Foreign to English Translations (OpenFoodFacts / International) ──
export const FOREIGN_TRANSLATIONS = Object.freeze({
  'pomme': 'Apple',
  'pommes': 'Apples',
  'banane': 'Banana',
  'bananes': 'Bananas',
  'haferflocken': 'Oats',
  'bio haferflocken': 'Organic Oats',
  'flocons d\'avoine': 'Rolled Oats',
  'lait d\'amande': 'Almond Milk',
  'lait de soja': 'Soy Milk',
  'yaourt grec': 'Greek Yogurt',
  'yaourt nature': 'Plain Yogurt',
  'griechischer joghurt': 'Greek Yogurt',
  'riz complet': 'Brown Rice',
  'brauner reis': 'Brown Rice',
  'arroz integral': 'Brown Rice',
  'lentilles': 'Lentils',
  'linsen': 'Lentils',
  'soupe de lentilles': 'Lentil Soup',
  'linsensuppe': 'Lentil Soup',
  'salade d\'épinards': 'Spinach Salad',
  'spinatsalat': 'Spinach Salad',
  'pain complet': 'Whole Wheat Bread',
  'vollkornbrot': 'Whole Grain Bread',
  'poulet grillé': 'Grilled Chicken',
  'gegrilltes hähnchen': 'Grilled Chicken',
  'huile d\'olive vierge extra': 'Extra-Virgin Olive Oil',
  'nüsse': 'Nuts',
  'gemischte nüsse': 'Mixed Nuts',
  'noix mélangées': 'Mixed Nuts',
  'œufs': 'Eggs',
  'eier': 'Eggs',
  'beurre de cacahuète': 'Peanut Butter',
  'erdnussbutter': 'Peanut Butter',
  'graines de chia': 'Chia Seeds',
  'chiasamen': 'Chia Seeds',
  'fromage blanc': 'Quark / Cottage Cheese',
  'salade de quinoa': 'Quinoa Salad',
  'avocat': 'Avocado',
  'haricots noirs': 'Black Beans',
  'schwarze bohnen': 'Black Beans',
  'tofu fumé': 'Smoked Tofu',
  'geräucherter tofu': 'Smoked Tofu'
});

// ── Indian Cuisine Verified Translations & Standard Descriptive Titles ──
export const INDIAN_TRANSLATIONS = Object.freeze({
  'bhuna chana': 'Roasted Chickpeas (Bhuna Chana)',
  'kala chana': 'Spiced Black Chickpeas (Kala Chana)',
  'chana masala': 'Chickpea Curry (Chana Masala)',
  'aloo gobi': 'Potato & Cauliflower Curry (Aloo Gobi)',
  'aloo gobhi': 'Potato & Cauliflower Curry (Aloo Gobi)',
  'aloo tikki': 'Crispy Spiced Potato Patties (Aloo Tikki)',
  'aloo paratha': 'Stuffed Potato Flatbread (Aloo Paratha)',
  'gobi paratha': 'Cauliflower Stuffed Flatbread (Gobi Paratha)',
  'palak paneer': 'Spinach & Cottage Cheese (Palak Paneer)',
  'paneer tikka': 'Grilled Cottage Cheese (Paneer Tikka)',
  'paneer bhurji': 'Scrambled Cottage Cheese (Paneer Bhurji)',
  'paneer butter masala': 'Creamy Cottage Cheese Curry (Paneer Butter Masala)',
  'dal makhani': 'Black Lentil Cream Curry (Dal Makhani)',
  'dal tadka': 'Tempered Yellow Lentil Curry (Dal Tadka)',
  'dal palak': 'Lentils with Spinach (Dal Palak)',
  'rajma chawal': 'Kidney Bean Curry & Rice (Rajma Chawal)',
  'rajma': 'Red Kidney Bean Stew (Rajma)',
  'butter chicken': 'Butter Chicken (Murgh Makhani)',
  'murgh makhani': 'Butter Chicken (Murgh Makhani)',
  'tandoori chicken': 'Tandoori Roast Chicken',
  'chicken dum biryani': 'Chicken Dum Biryani',
  'mutton rogan josh': 'Kashmiri Braised Lamb Curry (Rogan Josh)',
  'sarson da saag': 'Mustard Greens Curry with Cornbread (Sarson da Saag)',
  'makki di roti': 'Cornmeal Flatbread (Makki Roti)',
  'makki roti': 'Cornmeal Flatbread (Makki Roti)',
  'baigan bharta': 'Roasted Mashed Eggplant Curry (Baingan Bharta)',
  'baingan bharta': 'Roasted Mashed Eggplant Curry (Baingan Bharta)',
  'lauki kofta': 'Bottle Gourd Dumpling Curry (Lauki Kofta)',
  'masala chaas': 'Spiced Buttermilk (Chaas)',
  'chaas': 'Spiced Buttermilk (Chaas)',
  'haldi doodh': 'Golden Turmeric Milk (Haldi Doodh)',
  'kanda poha': 'Savory Flattened Rice with Peanuts (Poha)',
  'poha': 'Savory Flattened Rice (Poha)',
  'upma': 'Savory Semolina Porridge (Upma)',
  'moong dal cheela': 'Savory Moong Lentil Pancakes (Cheela)',
  'moong dal chilla': 'Savory Moong Lentil Pancakes (Cheela)',
  'methi thepla': 'Fenugreek Spiced Flatbread (Thepla)',
  'thepla': 'Spiced Fenugreek Flatbread (Thepla)',
  'idli sambar': 'Steamed Rice Cakes with Lentil Stew (Idli Sambar)',
  'ragi idli': 'Steamed Finger Millet Cakes (Ragi Idli)',
  'medu vada': 'Crispy Lentil Fritters (Medu Vada)',
  'vada pav': 'Mumbai Spiced Potato Burger (Vada Pav)',
  'bhel puri': 'Tangy Puffed Rice Medley (Bhel Puri)',
  'pani puri': 'Crisp Wheat Puffs with Spiced Mint Water (Pani Puri)',
  'dahi puri': 'Crisp Puffs with Spiced Yogurt & Chutney (Dahi Puri)',
  'sev puri': 'Crisp Crackers with Potatoes & Chutneys (Sev Puri)',
  'dhokla': 'Steamed Savory Chickpea Cake (Dhokla)',
  'kheer': 'Creamy Rice Pudding (Kheer)',
  'gajar halwa': 'Carrot Pudding with Cardamom (Gajar Halwa)',
  'rasgulla': 'Spongy Cottage Cheese Dumplings in Light Syrup (Rasgulla)',
  'gulab jamun': 'Caramelized Milk Dumplings in Rose Syrup (Gulab Jamun)',
  'malai kulfi': 'Traditional Creamy Frozen Kulfi',
  'aam panna': 'Cooling Green Mango Nectar (Aam Panna)',
  'sattu sharbat': 'Roasted Gram Protein Drink (Sattu Sharbat)',
  'kokum sharbat': 'Cooling Kokum Fruit Drink',
  'rasam': 'South Indian Tamarind & Pepper Broth (Rasam)',
  'macher jhol': 'Bengali Mustard Fish Curry (Macher Jhol)',
  'chingri malai curry': 'Prawn Coconut Milk Curry (Chingri Malai)',
  'dal baati churma': 'Lentils with Baked Wheat Rolls (Dal Baati Churma)',
  'undhiyu': 'Gujarati Slow-Cooked Mixed Vegetable Medley (Undhiyu)'
});

const LOWERCASE_WORDS = new Set([
  'with', 'and', '&', 'in', 'on', 'at', 'to', 'for', 'of', 'a', 'an', 'the', 'da', 'di', 'de', 'du'
]);

const PRESERVE_CAPS = new Set([
  'BBQ', 'BLT', 'RDA', 'AI', 'US', 'UK', 'GI', 'EPA', 'DHA', 'B12', 'D3', 'OMEGA-3', 'OMEGA-6'
]);

/**
 * Format a single word for natural English food title capitalization.
 */
function toTitleCaseWord(word, index, totalWords) {
  if (!word) return '';

  // Hyphenated compounds (e.g., extra-virgin, low-carb, stir-fry)
  if (word.includes('-')) {
    return word.split('-').map((part, idx) => toTitleCaseWord(part, idx, totalWords)).join('-');
  }

  // Preserve recognized acronyms/vitamins
  const upper = word.toUpperCase();
  if (PRESERVE_CAPS.has(upper)) {
    return upper;
  }

  const clean = word.toLowerCase();

  // Articles & prepositions remain lowercase unless first or last word of title
  if (index > 0 && index < totalWords - 1 && LOWERCASE_WORDS.has(clean)) {
    return clean;
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Normalizes any raw food name string to standard, clean English.
 *
 * @param {string} rawName - Raw food title or label
 * @returns {string} Standardized natural English title
 */
export function normalizeFoodName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Nutritious Meal';

  let name = rawName.trim();

  // 1. Decode HTML entities
  name = name
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // 2. Strip language code prefixes (e.g., "en:banana", "fr:pomme")
  name = name.replace(/^[a-z]{2}:/i, '').trim();

  // 3. Convert technical database snake_case identifiers (e.g. "fb_oats_almond_milk")
  if (/^[a-z]+_[a-z0-9_]+$/i.test(name)) {
    name = name.replace(/^fb_/i, '').replace(/_/g, ' ');
  }

  // 4. Normalize repeated whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // 5. Check direct foreign dictionary translation
  const lowerLookup = name.toLowerCase().replace(/_/g, ' ').trim();
  if (FOREIGN_TRANSLATIONS[lowerLookup]) {
    return FOREIGN_TRANSLATIONS[lowerLookup];
  }

  // 6. Check Indian food verified mappings
  if (INDIAN_TRANSLATIONS[lowerLookup]) {
    return INDIAN_TRANSLATIONS[lowerLookup];
  }

  // 7. Standardize piece count abbreviations: "(2 Pcs)", "2 Pcs", "(2 pcs)" -> "(2 Pieces)"
  name = name.replace(/\((\d+)\s*(pcs|pc|pieces|piece)\)/gi, '($1 Pieces)');
  name = name.replace(/\b(\d+)\s*(pcs|pc)\b/gi, '$1 Pieces');

  // 8. Natural Title Case formatting for segments outside and inside parentheses
  const parts = name.split(/(\([^)]+\))/g);
  const formattedParts = parts.map(part => {
    if (part.startsWith('(') && part.endsWith(')')) {
      const inner = part.slice(1, -1).trim();
      const words = inner.split(' ').filter(Boolean);
      const formattedInner = words.map((w, i) => toTitleCaseWord(w, i, words.length)).join(' ');
      return `(${formattedInner})`;
    } else {
      const words = part.split(' ').filter(Boolean);
      return words.map((w, i) => toTitleCaseWord(w, i, words.length)).join(' ');
    }
  });

  let result = formattedParts.join(' ').replace(/\s+/g, ' ').trim();

  // 9. Standardize minor punctuation spacing
  result = result
    .replace(/\s+([,])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bWith\b/g, 'with')
    .replace(/\bIn\b/g, 'in')
    .replace(/\bOf\b/g, 'of');

  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Returns the proper English display name for any food item.
 *
 * @param {Object} food - Food record
 * @returns {string} Standardized natural English title
 */
export function getFoodDisplayName(food) {
  if (!food) return 'Nutritious Meal';
  if (food.displayName) return food.displayName;
  return normalizeFoodName(food.name || food.foodName || food.product_name);
}

/**
 * Normalizes a food object to contain standardized English name and displayName,
 * strictly preserving food id, nutritional data, and metadata integrity.
 *
 * @param {Object} food - Raw food item
 * @returns {Object} Normalized food item
 */
export function normalizeFoodItem(food) {
  if (!food || typeof food !== 'object') return food;

  const currentName = food.name || food.foodName || food.product_name || 'Nutritious Meal';
  const cleanEnglish = normalizeFoodName(currentName);

  return {
    ...food,
    originalName: food.originalName || currentName,
    name: cleanEnglish,
    displayName: cleanEnglish
  };
}

/**
 * Deduplicates an array of food items using stable IDs and normalized names.
 *
 * @param {Array<Object>} foods - Candidate food list
 * @returns {Array<Object>} Unique food list
 */
export function deduplicateFoods(foods) {
  if (!Array.isArray(foods)) return [];

  const seenIds = new Set();
  const seenNormalizedNames = new Set();
  const result = [];

  for (const item of foods) {
    if (!item || typeof item !== 'object') continue;

    const id = item.id || item.foodId || item._id;
    const normName = normalizeFoodName(item.name || '').toLowerCase().trim();

    // Skip if ID already encountered
    if (id && seenIds.has(String(id))) continue;

    // Skip if identical normalized name already in this section
    if (normName && seenNormalizedNames.has(normName)) continue;

    if (id) seenIds.add(String(id));
    if (normName) seenNormalizedNames.add(normName);
    result.push(item);
  }

  return result;
}

/**
 * Normalizes and deduplicates an array of food items.
 *
 * @param {Array<Object>} foods
 * @returns {Array<Object>}
 */
export function normalizeFoodList(foods) {
  if (!Array.isArray(foods)) return [];
  return deduplicateFoods(foods.map(normalizeFoodItem));
}
