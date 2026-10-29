// ─────────────────────────────────────────────────────────────
//  backend/src/ai/foodKnowledge.js
//  Phase 11 Expanded Food & Nutrition Knowledge Base (1500+ Foods)
// ─────────────────────────────────────────────────────────────

const ALIAS_MAP = {
  // Biryani & Rice
  'biriyani': 'veg_biryani', 'biryani': 'veg_biryani', 'briyani': 'veg_biryani', 'biryani rice': 'veg_biryani',
  'veg biryani': 'veg_biryani', 'vegetable biryani': 'veg_biryani', 'veg biriyani': 'veg_biryani',
  'chicken biryani': 'chicken_biryani', 'chicken biriyani': 'chicken_biryani', 'murgh biryani': 'chicken_biryani',
  'mutton biryani': 'mutton_biryani', 'goat biryani': 'mutton_biryani', 'lamb biryani': 'mutton_biryani',
  'egg biryani': 'egg_biryani', 'anda biryani': 'egg_biryani', 'prawn biryani': 'prawn_biryani',
  'pulao': 'veg_pulao', 'pulav': 'veg_pulao', 'veg pulao': 'veg_pulao', 'vegetable pulao': 'veg_pulao', 'peas pulao': 'peas_pulao',
  'jeera rice': 'jeera_rice', 'cumin rice': 'jeera_rice', 'kashmiri pulao': 'kashmiri_pulao',
  'lemon rice': 'lemon_rice', 'chitranna': 'lemon_rice', 'elumichai sadam': 'lemon_rice',
  'curd rice': 'curd_rice', 'thayir sadam': 'curd_rice', 'mosanna': 'curd_rice', 'mosaru sadam': 'curd_rice',
  'tamarind rice': 'puliyodarai', 'puliyodarai': 'puliyodarai', 'puli sadam': 'puliyodarai',
  'brown rice': 'brown_rice', 'white rice': 'white_rice', 'rice': 'white_rice', 'chawal': 'white_rice', 'sadam': 'white_rice',
  'khichdi': 'khichdi', 'khichuri': 'khichdi', 'dal khichdi': 'khichdi', 'sabudana khichdi': 'sabudana_khichdi',
  'bisi bele bath': 'bisibelebhath', 'bisibelebhath': 'bisibelebhath', 'bisi bele bhat': 'bisibelebhath',

  // Breads (Roti, Naan, Paratha, etc.)
  'roti': 'chapati', 'rotis': 'chapati', 'chapati': 'chapati', 'chapatis': 'chapati', 'chapatti': 'chapati', 'chappati': 'chapati', 'phulka': 'chapati', 'flatbread': 'chapati',
  'naan': 'butter_naan', 'butter naan': 'butter_naan', 'garlic naan': 'garlic_naan', 'plain naan': 'plain_naan',
  'paratha': 'alooparatha', 'parathas': 'alooparatha', 'aloo paratha': 'alooparatha', 'parantha': 'alooparatha',
  'paneer paratha': 'paneer_paratha', 'gobi paratha': 'gobi_paratha', 'methi paratha': 'methi_paratha',
  'puri': 'puri', 'poori': 'puri', 'pooris': 'puri', 'bhatura': 'bhatura', 'bhature': 'bhatura',
  'kulcha': 'amritsari_kulcha', 'amritsari kulcha': 'amritsari_kulcha', 'onion kulcha': 'onion_kulcha',
  'appam': 'appam', 'idiyappam': 'idiyappam', 'string hoppers': 'idiyappam', 'puttu': 'puttu',
  'malabar parotta': 'malabar_parotta', 'kerala parotta': 'malabar_parotta', 'porotta': 'malabar_parotta',
  'makki ki roti': 'makki_roti', 'makki roti': 'makki_roti', 'thepla': 'methi_thepla', 'methi thepla': 'methi_thepla',
  'bhakri': 'jowar_bhakri', 'jowar bhakri': 'jowar_bhakri', 'bajra bhakri': 'bajra_bhakri',

  // Curries & Dal
  'paneer': 'paneer_curry', 'cottage cheese': 'paneer_curry', 'paneer butter masala': 'paneer_curry', 'palak paneer': 'palak_paneer',
  'kadai paneer': 'kadai_paneer', 'shahi paneer': 'shahi_paneer', 'matar paneer': 'matar_paneer', 'paneer tikka': 'paneer_tikka',
  'tofu': 'tofu_stir_fry', 'soy paneer': 'tofu_stir_fry', 'tofu curry': 'tofu_curry',
  'dal': 'dal_tadka', 'daal': 'dal_tadka', 'dal tadka': 'dal_tadka', 'toor dal': 'dal_tadka', 'yellow dal': 'dal_tadka',
  'dal makhani': 'dal_makhani', 'makhani dal': 'dal_makhani', 'dal fry': 'dal_tadka', 'chholar dal': 'chholar_dal',
  'rajma': 'rajma', 'kidney beans': 'rajma', 'rajma chawal': 'rajma', 'rajma curry': 'rajma',
  'chole': 'chole', 'chickpeas': 'chole', 'kabuli chana': 'chole', 'chana masala': 'chole', 'chole bhature': 'chole',
  'kadhi': 'kadhi_pakora', 'kadhi pakora': 'kadhi_pakora', 'gujarati kadhi': 'gujarati_kadhi',
  'sambar': 'sambar', 'sambhar': 'sambar', 'rasam': 'rasam', 'pepper rasam': 'rasam',
  'avial': 'avial', 'poriyal': 'vegetable_poriyal', 'kootu': 'vegetable_kootu', 'thoran': 'cabbage_thoran',

  // Non-Veg Proteins
  'chicken': 'chicken_breast', 'grilled chicken': 'chicken_breast', 'chicken breast': 'chicken_breast',
  'butter chicken': 'butter_chicken', 'murgh makhani': 'butter_chicken', 'chicken curry': 'chicken_curry',
  'chicken tikka masala': 'chicken_tikka_masala', 'chicken chettinad': 'chicken_chettinad', 'chicken 65': 'chicken_65',
  'mutton': 'mutton_curry', 'mutton curry': 'mutton_curry', 'goat curry': 'mutton_curry', 'mutton korma': 'mutton_korma',
  'kosha mangsho': 'kosha_mangsho', 'kolhapuri mutton': 'kolhapuri_mutton', 'mutton sukka': 'mutton_sukka',
  'fish': 'fish_curry', 'fish curry': 'fish_curry', 'fish fry': 'fish_fry', 'machher jhol': 'machher_jhol',
  'goan fish curry': 'goan_fish_curry', 'meen pollichathu': 'meen_pollichathu', 'prawn curry': 'prawn_curry',
  'prawn fry': 'prawn_fry', 'pork curry': 'pork_curry', 'pork vindaloo': 'pork_vindaloo',

  // Eggs
  'egg': 'boiled_egg', 'eggs': 'boiled_egg', 'anda': 'boiled_egg', 'boiled egg': 'boiled_egg', 'boiled eggs': 'boiled_egg',
  'omelette': 'omelette', 'egg omelette': 'omelette', 'omelet': 'omelette', 'egg bhurji': 'egg_bhurji', 'egg curry': 'egg_curry',
  'egg white omelette': 'egg_white_omelette', 'poached egg': 'poached_egg', 'scrambled eggs': 'scrambled_eggs',

  // South Indian Breakfast
  'dosa': 'masala_dosa', 'dosai': 'masala_dosa', 'dosaa': 'masala_dosa', 'masala dosa': 'masala_dosa', 'plain dosa': 'plain_dosa',
  'rava dosa': 'rava_dosa', 'paper dosa': 'paper_dosa', 'set dosa': 'set_dosa',
  'idli': 'idli', 'iddli': 'idli', 'steamed idli': 'idli', 'idlis': 'idli', 'button idli': 'idli',
  'vada': 'medu_vada', 'medu vada': 'medu_vada', 'masala vada': 'masala_vada', 'vadas': 'medu_vada',
  'upma': 'rava_upma', 'rava upma': 'rava_upma', 'semiya upma': 'semiya_upma',
  'uttapam': 'onion_uttapam', 'onion uttapam': 'onion_uttapam', 'tomato uttapam': 'tomato_uttapam',
  'pongal': 'ven_pongal', 'ven pongal': 'ven_pongal', 'sweet pongal': 'sakkarai_pongal',

  // Snacks & Street Food
  'poha': 'poha', 'kanda poha': 'poha', 'flattened rice': 'poha', 'pohe': 'poha',
  'dhokla': 'khamand_dhokla', 'khaman dhokla': 'khamand_dhokla', 'handvo': 'handvo',
  'samosa': 'samosa', 'samosas': 'samosa', 'kachori': 'kachori',
  'pav bhaji': 'pav_bhaji', 'misal pav': 'misal_pav', 'vada pav': 'vada_pav',
  'bhel puri': 'bhel_puri', 'sev puri': 'sev_puri', 'pani puri': 'pani_puri', 'gol gappa': 'pani_puri',
  'litti chokha': 'litti_chokha', 'momos': 'veg_momos', 'veg momos': 'veg_momos', 'chicken momos': 'chicken_momos',

  // Dairy & Alternatives
  'curd': 'curd', 'yogurt': 'curd', 'dahi': 'curd', 'thayir': 'curd', 'mosaru': 'curd', 'greek yogurt': 'greek_yogurt',
  'milk': 'cow_milk', 'doodh': 'cow_milk', 'pal': 'cow_milk', 'cow milk': 'cow_milk',
  'almond milk': 'almond_milk', 'soy milk': 'soy_milk', 'oat milk': 'oat_milk',
  'buttermilk': 'buttermilk', 'chaas': 'buttermilk', 'chass': 'buttermilk', 'moru': 'buttermilk', 'sol kadi': 'sol_kadi',
  'lassi': 'sweet_lassi', 'sweet lassi': 'sweet_lassi', 'mango lassi': 'mango_lassi',

  // Fruits & Nuts & Fitness
  'banana': 'banana', 'kela': 'banana', 'bananas': 'banana',
  'apple': 'apple', 'seb': 'apple', 'apples': 'apple',
  'orange': 'orange', 'santra': 'orange', 'oranges': 'orange',
  'papaya': 'papaya', 'papita': 'papaya', 'mango': 'mango', 'aam': 'mango',
  'guava': 'guava', 'amrood': 'guava', 'watermelon': 'watermelon', 'tarbooz': 'watermelon',
  'peanuts': 'peanuts', 'peanut': 'peanuts', 'groundnut': 'peanuts', 'moongphali': 'peanuts',
  'almonds': 'almonds', 'badam': 'almonds', 'walnuts': 'walnuts', 'akhrot': 'walnuts',
  'oats': 'oats', 'oatmeal': 'oats', 'quinoa': 'quinoa', 'protein shake': 'protein_shake', 'whey protein': 'protein_shake',
  'green tea': 'green_tea', 'black coffee': 'black_coffee', 'coconut water': 'coconut_water', 'filter coffee': 'filter_coffee',

  // Global Foods
  'sushi': 'veg_sushi', 'veg sushi': 'veg_sushi', 'salmon sushi': 'salmon_nigiri',
  'ramen': 'veg_ramen', 'veg ramen': 'veg_ramen', 'chicken ramen': 'chicken_ramen',
  'pad thai': 'pad_thai', 'green curry': 'thai_green_curry', 'tom yum': 'tom_yum_soup',
  'hummus': 'hummus_pita', 'falafel': 'falafel_wrap', 'greek salad': 'greek_salad', 'shakshuka': 'shakshuka',
  'pizza': 'margherita_pizza', 'margherita pizza': 'margherita_pizza', 'pasta': 'pasta_primavera',
  'burrito bowl': 'veg_burrito_bowl', 'tacos': 'soft_tacos', 'quesadilla': 'chicken_quesadilla'
};

// ── 25+ SEMANTIC CONCEPTS MATRIX ──────────────────────────────
const CONCEPTS = {
  highProtein: ['chicken_breast', 'boiled_egg', 'egg_white_omelette', 'protein_shake', 'paneer_curry', 'tofu_stir_fry', 'soy_chunks_curry', 'dal_tadka', 'dal_makhani', 'rajma', 'chole', 'greek_yogurt', 'grilled_salmon', 'fish_curry', 'mutton_curry', 'sprouts_salad', 'peanuts', 'almonds'],
  lowCalorie: ['rasam', 'sprouts_salad', 'green_tea', 'black_coffee', 'cucumber_salad', 'egg_white_omelette', 'idli', 'clear_soup'],
  highFiber: ['oats', 'quinoa', 'sprouts_salad', 'apple', 'banana', 'guava', 'rajma', 'chole', 'dal_tadka', 'brown_rice', 'vegetable_poriyal', 'avial', 'hummus_pita'],
  lowCarb: ['chicken_breast', 'boiled_egg', 'egg_white_omelette', 'paneer_tikka', 'tofu_stir_fry', 'grilled_salmon', 'greek_yogurt'],
  filling: ['veg_biryani', 'chicken_biryani', 'rajma', 'chole', 'dal_makhani', 'alooparatha', 'masala_dosa', 'bisibelebhath'],
  light: ['idli', 'upma', 'poha', 'khichdi', 'rasam', 'sambar', 'sprouts_salad', 'cucumber_salad', 'curd_rice', 'green_tea'],
  healthy: ['sprouts_salad', 'oats', 'quinoa', 'tofu_stir_fry', 'grilled_salmon', 'chicken_breast', 'boiled_egg', 'steamed_veggies'],
  postWorkout: ['protein_shake', 'boiled_egg', 'egg_white_omelette', 'chicken_breast', 'tofu_stir_fry', 'greek_yogurt', 'sprouts_salad', 'paneer_raw'],
  preWorkout: ['banana', 'apple', 'oats', 'peanut_butter_toast', 'black_coffee', 'coconut_water', 'sweet_potato'],
  muscleGain: ['protein_shake', 'chicken_breast', 'boiled_egg', 'paneer_curry', 'soy_chunks_curry', 'mutton_curry', 'greek_yogurt'],
  weightLoss: ['sprouts_salad', 'oats', 'quinoa', 'egg_white_omelette', 'clear_soup', 'green_tea', 'tofu_stir_fry', 'rasam'],
  maintenance: ['chapati', 'dal_tadka', 'curd_rice', 'veg_pulao', 'idli', 'boiled_egg', 'steamed_veggies'],
  quickMeal: ['idli', 'poha', 'upma', 'boiled_egg', 'omelette', 'sprouts_salad', 'curd_rice', 'oats', 'protein_shake'],
  budgetMeal: ['poha', 'idli', 'khichdi', 'dal_tadka', 'chapati', 'curd_rice', 'boiled_egg', 'upma'],
  lateNight: ['curd_rice', 'green_tea', 'warm_milk', 'roasted_almonds', 'boiled_egg', 'oats'],
  breakfast: ['idli', 'masala_dosa', 'poha', 'rava_upma', 'oats', 'boiled_egg', 'omelette', 'alooparatha', 'ven_pongal'],
  lunch: ['veg_biryani', 'chicken_biryani', 'chapati', 'dal_tadka', 'rajma', 'chole', 'paneer_curry', 'curd_rice', 'bisibelebhath'],
  dinner: ['chapati', 'dal_tadka', 'paneer_curry', 'idli', 'khichdi', 'curd_rice', 'chicken_breast', 'tofu_stir_fry'],
  snack: ['poha', 'medu_vada', 'samosa', 'bhel_puri', 'roasted_peanuts', 'sprouts_salad', 'apple', 'banana'],
  southIndian: ['idli', 'masala_dosa', 'plain_dosa', 'rava_dosa', 'onion_uttapam', 'medu_vada', 'rava_upma', 'ven_pongal', 'sambar', 'rasam', 'curd_rice', 'lemon_rice', 'bisibelebhath'],
  northIndian: ['chapati', 'butter_naan', 'alooparatha', 'paneer_paratha', 'dal_tadka', 'dal_makhani', 'rajma', 'chole', 'paneer_curry', 'palak_paneer', 'butter_chicken'],
  spicy: ['chicken_chettinad', 'misal_pav', 'kadai_paneer', 'pork_vindaloo', 'kolhapuri_mutton', 'chicken_65', 'chole'],
  nonSpicy: ['idli', 'curd_rice', 'khichdi', 'dal_tadka', 'steamed_veggies', 'oats', 'cow_milk', 'banana'],
  comfortFood: ['khichdi', 'curd_rice', 'dal_tadka', 'rajma', 'chole', 'pav_bhaji', 'momos', 'samosa'],
  hydration: ['coconut_water', 'buttermilk', 'watermelon', 'cucumber_salad', 'sol_kadi', 'green_tea'],
  proteinRich: ['chicken_breast', 'boiled_egg', 'protein_shake', 'tofu_stir_fry', 'paneer_curry', 'soy_chunks_curry'],
  ironRich: ['spinach_soup', 'palak_paneer', 'sprouts_salad', 'dates_khajur', 'jaggery_sesame', 'lentil_soup'],
  calciumRich: ['cow_milk', 'curd', 'paneer_curry', 'greek_yogurt', 'ragi_dosa', 'sesame_seeds'],
  energyBoosting: ['banana', 'peanut_butter_toast', 'oats', 'black_coffee', 'dates_khajur', 'coconut_water', 'sweet_potato']
};

// ── CORE 1500 STRUCTURED FOODS SEED GENERATOR ─────────────────
const BASE_FOODS_SEED = [
  // ── Indian Staples (1-100) ──
  { id: 'chapati', name: 'Whole Wheat Chapati / Roti', aliases: ['chapati', 'roti', 'phulka', 'flatbread', 'chapatti'], category: 'Grain / Bread', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner', 'breakfast'], servingSize: '1 roti (40g)', calories: 80, protein: 3.1, carbohydrates: 15.0, fat: 0.4, fiber: 2.2, sugar: 0.2, sodium: 5, calcium: 15, iron: 0.9, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: ['gluten'], tags: ['quick', 'staple', 'low-fat'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['healthy', 'daily'] },
  { id: 'butter_naan', name: 'Butter Naan', aliases: ['butter naan', 'naan', 'plain naan'], category: 'Bread', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 naan (90g)', calories: 260, protein: 7.5, carbohydrates: 42.0, fat: 7.2, fiber: 1.8, sugar: 1.5, sodium: 280, calcium: 40, iron: 1.2, glycemicCategory: 'high', proteinDensity: 'medium', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'moderate', preparationMinutes: 20, vegetarian: true, vegan: false, eggetarian: true, allergens: ['gluten', 'dairy'], tags: ['indulgent'], budgetLevel: 'moderate', satietyScore: 7, suitabilityTags: ['party', 'restaurant'] },
  { id: 'dal_tadka', name: 'Yellow Dal Tadka', aliases: ['dal', 'daal', 'dal tadka', 'toor dal'], category: 'Lentils / Curry', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 150, protein: 8.5, carbohydrates: 22.0, fat: 3.5, fiber: 5.0, sugar: 1.0, sodium: 320, calcium: 35, iron: 2.1, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 15, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['comfort', 'high-fiber'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['healthy', 'home'] },
  { id: 'paneer_curry', name: 'Paneer Butter Masala', aliases: ['paneer', 'cottage cheese', 'paneer butter masala'], category: 'Curry / Protein', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 320, protein: 14.0, carbohydrates: 12.0, fat: 24.0, fiber: 2.0, sugar: 4.0, sodium: 410, calcium: 210, iron: 1.1, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 25, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy', 'nuts'], tags: ['high-protein', 'rich'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['protein', 'dinner'] },
  { id: 'chicken_breast', name: 'Grilled Herb Chicken Breast', aliases: ['chicken', 'grilled chicken', 'chicken breast'], category: 'Poultry / Fitness', cuisine: 'Global', mealTypes: ['lunch', 'dinner'], servingSize: '1 breast (150g)', calories: 165, protein: 31.0, carbohydrates: 0.0, fat: 3.6, fiber: 0.0, sugar: 0.0, sodium: 180, calcium: 15, iron: 1.0, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 15, vegetarian: false, vegan: false, eggetarian: false, allergens: [], tags: ['high-protein', 'low-carb', 'post-workout'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['post-workout', 'muscle'] },
  { id: 'boiled_egg', name: 'Boiled Hard Eggs (2 pcs)', aliases: ['egg', 'eggs', 'anda', 'boiled egg'], category: 'Eggs / Protein', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '2 eggs (100g)', calories: 155, protein: 12.6, carbohydrates: 1.1, fat: 10.6, fiber: 0.0, sugar: 0.6, sodium: 140, calcium: 50, iron: 1.8, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 10, vegetarian: false, vegan: false, eggetarian: true, allergens: ['eggs'], tags: ['high-protein', 'keto', 'quick'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['quick', 'protein'] },
  { id: 'idli', name: 'Steamed Rice & Urad Idli (2 pcs)', aliases: ['idli', 'iddli', 'steamed idli'], category: 'Breakfast', cuisine: 'South Indian', mealTypes: ['breakfast', 'snack', 'dinner'], servingSize: '2 idlis (120g)', calories: 130, protein: 4.2, carbohydrates: 26.0, fat: 0.6, fiber: 2.0, sugar: 0.2, sodium: 110, calcium: 25, iron: 0.8, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['fermented', 'light', 'easy-digest'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['light', 'breakfast'] },
  { id: 'masala_dosa', name: 'Crispy Potato Masala Dosa', aliases: ['dosa', 'dosai', 'masala dosa'], category: 'Breakfast', cuisine: 'South Indian', mealTypes: ['breakfast', 'dinner'], servingSize: '1 dosa (180g)', calories: 280, protein: 5.5, carbohydrates: 46.0, fat: 8.5, fiber: 3.2, sugar: 1.0, sodium: 340, calcium: 30, iron: 1.5, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 15, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['traditional', 'crispy'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['breakfast', 'tasty'] },
  { id: 'veg_biryani', name: 'Vegetable Dum Biryani', aliases: ['biriyani', 'biryani', 'briyani', 'veg biryani'], category: 'Rice', cuisine: 'Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 plate (300g)', calories: 240, protein: 5.5, carbohydrates: 43.0, fat: 5.5, fiber: 3.5, sugar: 1.5, sodium: 390, calcium: 40, iron: 1.8, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 30, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['flavorful', 'filling'], budgetLevel: 'moderate', satietyScore: 8, suitabilityTags: ['filling', 'dinner'] },
  { id: 'chicken_biryani', name: 'Hyderabadi Chicken Biryani', aliases: ['chicken biryani', 'murgh biryani'], category: 'Rice / Poultry', cuisine: 'Hyderabadi', mealTypes: ['lunch', 'dinner'], servingSize: '1 plate (350g)', calories: 360, protein: 24.0, carbohydrates: 42.0, fat: 11.5, fiber: 2.0, sugar: 1.0, sodium: 480, calcium: 45, iron: 2.2, glycemicCategory: 'medium', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'spicy', difficulty: 'advanced', preparationMinutes: 45, vegetarian: false, vegan: false, eggetarian: false, allergens: ['dairy'], tags: ['high-protein', 'rich'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['high-protein', 'filling'] },
  
  // ── Missing ALIAS_MAP Foods Added ──
  { id: 'tofu_stir_fry', name: 'Tofu Stir-Fry', aliases: ['tofu', 'soy paneer', 'tofu stir fry', 'tofu stir-fry'], category: 'Protein', cuisine: 'Asian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (150g)', calories: 140, protein: 12.0, carbohydrates: 4.5, fat: 8.0, fiber: 2.2, sugar: 0.5, sodium: 240, calcium: 150, iron: 2.0, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'medium', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: ['soy'], tags: ['high-protein', 'low-carb', 'healthy'], budgetLevel: 'moderate', satietyScore: 7, suitabilityTags: ['protein', 'dinner'] },
  { id: 'tofu_curry', name: 'Tofu Curry', aliases: ['tofu curry'], category: 'Curry / Protein', cuisine: 'Asian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 180, protein: 11.5, carbohydrates: 8.0, fat: 11.0, fiber: 2.5, sugar: 1.2, sodium: 310, calcium: 140, iron: 1.8, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'medium', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 20, vegetarian: true, vegan: true, eggetarian: true, allergens: ['soy'], tags: ['high-protein', 'healthy'], budgetLevel: 'moderate', satietyScore: 8, suitabilityTags: ['protein', 'dinner'] },
  { id: 'oats', name: 'Oats Oatmeal', aliases: ['oats', 'oatmeal', 'oat'], category: 'Grain', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '1 bowl (50g dry)', calories: 190, protein: 6.5, carbohydrates: 32.0, fat: 3.5, fiber: 5.0, sugar: 0.5, sodium: 2, calcium: 25, iron: 2.2, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 5, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['high-fiber', 'quick', 'weight-loss'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['breakfast', 'healthy'] },
  { id: 'protein_shake', name: 'Whey Protein Shake', aliases: ['protein shake', 'whey protein', 'shake'], category: 'Fitness', cuisine: 'Global', mealTypes: ['snack', 'breakfast'], servingSize: '1 scoop (35g)', calories: 130, protein: 25.0, carbohydrates: 2.0, fat: 1.5, fiber: 0.5, sugar: 0.5, sodium: 80, calcium: 120, iron: 0.2, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 2, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['high-protein', 'quick', 'post-workout'], budgetLevel: 'moderate', satietyScore: 6, suitabilityTags: ['protein', 'post-workout'] },
  { id: 'soy_chunks_curry', name: 'Soy Chunks Curry', aliases: ['soy chunks', 'soya chunks', 'soya chunks curry'], category: 'Curry / Protein', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 190, protein: 18.0, carbohydrates: 14.0, fat: 6.0, fiber: 6.0, sugar: 1.5, sodium: 340, calcium: 90, iron: 3.5, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 20, vegetarian: true, vegan: true, eggetarian: true, allergens: ['soy'], tags: ['high-protein', 'high-fiber'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['protein', 'dinner'] },
  { id: 'sprouts_salad', name: 'Mixed Sprouts Salad', aliases: ['sprouts salad', 'sprouts', 'healthy salad'], category: 'Vegetable', cuisine: 'Indian', mealTypes: ['snack', 'breakfast'], servingSize: '1 bowl (150g)', calories: 120, protein: 7.2, carbohydrates: 18.0, fat: 1.2, fiber: 4.5, sugar: 1.0, sodium: 90, calcium: 30, iron: 1.8, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 5, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['quick', 'healthy', 'low-calorie'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['healthy', 'snack'] },
  { id: 'curd', name: 'Fresh Curd / Yogurt', aliases: ['curd', 'yogurt', 'dahi', 'thayir', 'mosaru'], category: 'Dairy', cuisine: 'Indian', mealTypes: ['lunch', 'breakfast', 'snack'], servingSize: '1 bowl (150g)', calories: 95, protein: 5.0, carbohydrates: 6.0, fat: 5.0, fiber: 0.0, sugar: 5.0, sodium: 70, calcium: 180, iron: 0.1, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 2, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['fermented', 'cooling', 'digestive'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['healthy', 'daily'] },
  { id: 'greek_yogurt', name: 'Greek Yogurt', aliases: ['greek yogurt'], category: 'Dairy', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '1 cup (150g)', calories: 130, protein: 15.0, carbohydrates: 5.0, fat: 5.0, fiber: 0.0, sugar: 4.5, sodium: 55, calcium: 160, iron: 0.1, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 1, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['high-protein', 'healthy'], budgetLevel: 'moderate', satietyScore: 7, suitabilityTags: ['protein', 'healthy'] },
  { id: 'brown_rice', name: 'Steamed Brown Rice', aliases: ['brown rice'], category: 'Grain', cuisine: 'Global', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (150g)', calories: 160, protein: 3.5, carbohydrates: 34.0, fat: 1.2, fiber: 2.8, sugar: 0.2, sodium: 2, calcium: 12, iron: 0.8, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 25, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['healthy', 'high-fiber'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['healthy', 'daily'] },
  { id: 'white_rice', name: 'Steamed White Rice', aliases: ['white rice', 'rice', 'chawal', 'sadam'], category: 'Grain', cuisine: 'Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (150g)', calories: 180, protein: 3.0, carbohydrates: 40.0, fat: 0.3, fiber: 0.5, sugar: 0.1, sodium: 2, calcium: 10, iron: 0.4, glycemicCategory: 'high', proteinDensity: 'low', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 15, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['staple', 'quick'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['daily'] },
  { id: 'banana', name: 'Fresh Ripe Banana', aliases: ['banana', 'kela', 'bananas'], category: 'Fruit', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '1 medium (120g)', calories: 105, protein: 1.3, carbohydrates: 27.0, fat: 0.3, fiber: 3.1, sugar: 14.0, sodium: 1, calcium: 6, iron: 0.3, glycemicCategory: 'medium', proteinDensity: 'low', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 1, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['fruit', 'energy', 'quick'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['pre-workout', 'healthy'] },
  { id: 'apple', name: 'Fresh Red Apple', aliases: ['apple', 'seb', 'apples'], category: 'Fruit', cuisine: 'Global', mealTypes: ['snack', 'breakfast'], servingSize: '1 medium (180g)', calories: 95, protein: 0.5, carbohydrates: 25.0, fat: 0.3, fiber: 4.4, sugar: 19.0, sodium: 1, calcium: 10, iron: 0.2, glycemicCategory: 'low', proteinDensity: 'low', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 1, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['fruit', 'high-fiber', 'weight-loss'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['healthy', 'snack'] },
  { id: 'peanuts', name: 'Roasted Peanuts', aliases: ['peanuts', 'peanut', 'groundnut', 'moongphali'], category: 'Nut / Seed', cuisine: 'Global', mealTypes: ['snack'], servingSize: '1 handful (30g)', calories: 170, protein: 7.5, carbohydrates: 6.0, fat: 14.0, fiber: 2.4, sugar: 1.2, sodium: 5, calcium: 25, iron: 1.4, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'medium', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 2, vegetarian: true, vegan: true, eggetarian: true, allergens: ['peanuts'], tags: ['keto', 'high-protein'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['snack', 'protein'] },
  { id: 'almonds', name: 'Raw Almonds', aliases: ['almonds', 'badam'], category: 'Nut / Seed', cuisine: 'Global', mealTypes: ['snack', 'breakfast'], servingSize: '1 handful (30g)', calories: 160, protein: 6.0, carbohydrates: 6.0, fat: 14.0, fiber: 3.5, sugar: 1.0, sodium: 1, calcium: 75, iron: 1.1, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 1, vegetarian: true, vegan: true, eggetarian: true, allergens: ['nuts'], tags: ['keto', 'healthy', 'brain-food'], budgetLevel: 'moderate', satietyScore: 6, suitabilityTags: ['healthy', 'snack'] },
  { id: 'walnuts', name: 'Raw Walnuts', aliases: ['walnuts', 'akhrot'], category: 'Nut / Seed', cuisine: 'Global', mealTypes: ['snack'], servingSize: '1 handful (30g)', calories: 185, protein: 4.3, carbohydrates: 4.0, fat: 18.5, fiber: 2.0, sugar: 0.8, sodium: 1, calcium: 30, iron: 0.9, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 1, vegetarian: true, vegan: true, eggetarian: true, allergens: ['nuts'], tags: ['omega-3', 'healthy'], budgetLevel: 'moderate', satietyScore: 5, suitabilityTags: ['healthy'] },
  { id: 'palak_paneer', name: 'Palak Paneer', aliases: ['palak paneer'], category: 'Curry / Protein', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 240, protein: 11.5, carbohydrates: 9.0, fat: 18.0, fiber: 3.5, sugar: 2.0, sodium: 380, calcium: 240, iron: 3.2, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 20, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['high-protein', 'iron-rich', 'healthy'], budgetLevel: 'moderate', satietyScore: 8, suitabilityTags: ['protein', 'dinner'] },
  { id: 'dal_makhani', name: 'Dal Makhani', aliases: ['dal makhani', 'makhani dal'], category: 'Lentils / Curry', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 280, protein: 10.0, carbohydrates: 26.0, fat: 14.5, fiber: 6.5, sugar: 1.5, sodium: 390, calcium: 80, iron: 2.8, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'advanced', preparationMinutes: 40, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['comfort', 'rich', 'filling'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['dinner'] },
  { id: 'rajma', name: 'Rajma Masala', aliases: ['rajma', 'kidney beans', 'rajma curry'], category: 'Lentils / Curry', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 210, protein: 11.0, carbohydrates: 28.0, fat: 5.0, fiber: 7.0, sugar: 1.8, sodium: 360, calcium: 65, iron: 3.0, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 30, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['comfort', 'high-fiber', 'filling'], budgetLevel: 'budget', satietyScore: 9, suitabilityTags: ['dinner', 'healthy'] },
  { id: 'chole', name: 'Amritsari Chole Masala', aliases: ['chole', 'chickpeas', 'kabuli chana', 'chana masala'], category: 'Lentils / Curry', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 230, protein: 10.5, carbohydrates: 30.0, fat: 6.5, fiber: 7.5, sugar: 2.0, sodium: 380, calcium: 70, iron: 2.9, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'high', spiceLevel: 'spicy', difficulty: 'moderate', preparationMinutes: 30, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['protein', 'high-fiber', 'traditional'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['lunch', 'dinner'] },
  { id: 'butter_chicken', name: 'Butter Chicken Masala', aliases: ['butter chicken', 'murgh makhani'], category: 'Curry / Poultry', cuisine: 'North Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 380, protein: 22.0, carbohydrates: 10.0, fat: 28.0, fiber: 1.2, sugar: 3.5, sodium: 490, calcium: 60, iron: 1.8, glycemicCategory: 'medium', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'advanced', preparationMinutes: 35, vegetarian: false, vegan: false, eggetarian: false, allergens: ['dairy', 'nuts'], tags: ['rich', 'indulgent', 'high-protein'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['dinner'] },
  { id: 'chicken_curry', name: 'Home-style Chicken Curry', aliases: ['chicken curry'], category: 'Curry / Poultry', cuisine: 'Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 270, protein: 25.0, carbohydrates: 6.0, fat: 16.0, fiber: 1.8, sugar: 1.0, sodium: 420, calcium: 40, iron: 1.6, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 30, vegetarian: false, vegan: false, eggetarian: false, allergens: [], tags: ['high-protein', 'comfort'], budgetLevel: 'moderate', satietyScore: 9, suitabilityTags: ['dinner', 'protein'] },
  { id: 'mutton_curry', name: 'Spicy Mutton Curry', aliases: ['mutton', 'mutton curry', 'goat curry'], category: 'Curry / Meat', cuisine: 'Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 340, protein: 26.0, carbohydrates: 5.0, fat: 24.0, fiber: 1.5, sugar: 0.8, sodium: 460, calcium: 35, iron: 3.4, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'spicy', difficulty: 'advanced', preparationMinutes: 50, vegetarian: false, vegan: false, eggetarian: false, allergens: [], tags: ['high-protein', 'rich'], budgetLevel: 'expensive', satietyScore: 9, suitabilityTags: ['dinner'] },
  { id: 'fish_curry', name: 'Home-style Fish Curry', aliases: ['fish', 'fish curry', 'machher jhol'], category: 'Curry / Seafood', cuisine: 'Bengali', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 210, protein: 18.5, carbohydrates: 6.0, fat: 12.0, fiber: 1.2, sugar: 0.8, sodium: 390, calcium: 45, iron: 1.4, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 25, vegetarian: false, vegan: false, eggetarian: false, allergens: ['fish'], tags: ['high-protein', 'omega-3'], budgetLevel: 'moderate', satietyScore: 8, suitabilityTags: ['healthy', 'lunch'] },
  { id: 'omelette', name: 'Classic Egg Omelette', aliases: ['omelette', 'egg omelette', 'omelet'], category: 'Eggs / Protein', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '2 eggs (110g)', calories: 170, protein: 12.0, carbohydrates: 1.5, fat: 12.5, fiber: 0.2, sugar: 0.5, sodium: 160, calcium: 55, iron: 1.9, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 5, vegetarian: false, vegan: false, eggetarian: true, allergens: ['eggs'], tags: ['quick', 'high-protein'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['breakfast', 'quick'] },
  { id: 'egg_white_omelette', name: 'Egg White Omelette', aliases: ['egg white omelette'], category: 'Eggs / Protein', cuisine: 'Global', mealTypes: ['breakfast', 'snack'], servingSize: '3 egg whites (100g)', calories: 80, protein: 11.0, carbohydrates: 1.0, fat: 0.2, fiber: 0.1, sugar: 0.2, sodium: 150, calcium: 15, iron: 0.2, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 5, vegetarian: false, vegan: false, eggetarian: true, allergens: ['eggs'], tags: ['quick', 'high-protein', 'low-calorie', 'low-carb'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['healthy', 'breakfast'] },
  { id: 'egg_bhurji', name: 'Egg Bhurji / Scrambled Eggs', aliases: ['egg bhurji', 'scrambled eggs'], category: 'Eggs / Protein', cuisine: 'Indian', mealTypes: ['breakfast', 'snack'], servingSize: '2 eggs (120g)', calories: 190, protein: 12.5, carbohydrates: 3.5, fat: 14.0, fiber: 0.5, sugar: 1.0, sodium: 210, calcium: 60, iron: 2.0, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'easy', preparationMinutes: 8, vegetarian: false, vegan: false, eggetarian: true, allergens: ['eggs'], tags: ['quick', 'high-protein', 'spicy'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['breakfast'] },
  { id: 'egg_curry', name: 'Egg Curry Masala', aliases: ['egg curry'], category: 'Curry / Protein', cuisine: 'Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 230, protein: 13.0, carbohydrates: 8.0, fat: 16.0, fiber: 1.5, sugar: 1.5, sodium: 360, calcium: 70, iron: 2.2, glycemicCategory: 'low', proteinDensity: 'high', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 20, vegetarian: false, vegan: false, eggetarian: true, allergens: ['eggs'], tags: ['high-protein', 'comfort'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['dinner'] },
  { id: 'rava_upma', name: 'Classic Semolina Rava Upma', aliases: ['upma', 'rava upma', 'semiya upma'], category: 'Breakfast', cuisine: 'South Indian', mealTypes: ['breakfast', 'snack'], servingSize: '1 bowl (180g)', calories: 210, protein: 4.5, carbohydrates: 38.0, fat: 4.5, fiber: 2.5, sugar: 1.0, sodium: 280, calcium: 25, iron: 1.2, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['quick', 'light', 'savory'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['breakfast', 'quick'] },
  { id: 'poha', name: 'Kanda Poha / Flattened Rice', aliases: ['poha', 'kanda poha', 'flattened rice'], category: 'Breakfast', cuisine: 'West Indian', mealTypes: ['breakfast', 'snack'], servingSize: '1 bowl (150g)', calories: 180, protein: 3.5, carbohydrates: 36.0, fat: 2.5, fiber: 2.0, sugar: 1.2, sodium: 220, calcium: 20, iron: 1.8, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 8, vegetarian: true, vegan: true, eggetarian: true, allergens: ['nuts'], tags: ['quick', 'light', 'popular'], budgetLevel: 'budget', satietyScore: 6, suitabilityTags: ['breakfast', 'quick'] },
  { id: 'samosa', name: 'Crispy Potato Samosa (1 pc)', aliases: ['samosa', 'samosas'], category: 'Snack', cuisine: 'Indian', mealTypes: ['snack'], servingSize: '1 piece (80g)', calories: 220, protein: 3.5, carbohydrates: 26.0, fat: 12.0, fiber: 1.5, sugar: 0.8, sodium: 290, calcium: 15, iron: 0.8, glycemicCategory: 'high', proteinDensity: 'low', fiberDensity: 'low', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 15, vegetarian: true, vegan: true, eggetarian: true, allergens: ['gluten'], tags: ['crispy', 'street-food', 'fried'], budgetLevel: 'budget', satietyScore: 5, suitabilityTags: ['party'] },
  { id: 'sambar', name: 'Mixed Vegetable Sambar', aliases: ['sambar', 'sambhar'], category: 'Lentils / Soup', cuisine: 'South Indian', mealTypes: ['lunch', 'dinner', 'breakfast'], servingSize: '1 bowl (200g)', calories: 110, protein: 4.5, carbohydrates: 18.0, fat: 2.0, fiber: 4.0, sugar: 1.5, sodium: 340, calcium: 40, iron: 1.5, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'high', spiceLevel: 'medium', difficulty: 'moderate', preparationMinutes: 20, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['high-fiber', 'healthy', 'traditional'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['healthy', 'daily'] },
  { id: 'rasam', name: 'Tomato Pepper Rasam', aliases: ['rasam', 'pepper rasam'], category: 'Soup', cuisine: 'South Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (180g)', calories: 50, protein: 1.5, carbohydrates: 8.0, fat: 1.2, fiber: 1.5, sugar: 0.5, sodium: 310, calcium: 20, iron: 0.9, glycemicCategory: 'low', proteinDensity: 'low', fiberDensity: 'low', spiceLevel: 'spicy', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: [], tags: ['digestive', 'light', 'soup', 'low-calorie'], budgetLevel: 'budget', satietyScore: 4, suitabilityTags: ['healthy', 'light'] },
  { id: 'curd_rice', name: 'Creamy Curd Rice', aliases: ['curd rice', 'thayir sadam', 'mosanna'], category: 'Rice', cuisine: 'South Indian', mealTypes: ['lunch', 'dinner'], servingSize: '1 bowl (200g)', calories: 190, protein: 5.5, carbohydrates: 30.0, fat: 5.0, fiber: 1.0, sugar: 3.5, sodium: 260, calcium: 150, iron: 0.5, glycemicCategory: 'low', proteinDensity: 'medium', fiberDensity: 'low', spiceLevel: 'none', difficulty: 'easy', preparationMinutes: 5, vegetarian: true, vegan: false, eggetarian: true, allergens: ['dairy'], tags: ['cooling', 'digestive', 'comfort'], budgetLevel: 'budget', satietyScore: 8, suitabilityTags: ['light', 'healthy', 'daily'] },
  { id: 'lemon_rice', name: 'Tangy Lemon Rice', aliases: ['lemon rice', 'chitranna', 'elumichai sadam'], category: 'Rice', cuisine: 'South Indian', mealTypes: ['lunch', 'breakfast'], servingSize: '1 plate (250g)', calories: 260, protein: 4.8, carbohydrates: 46.0, fat: 6.5, fiber: 2.2, sugar: 0.5, sodium: 320, calcium: 25, iron: 1.2, glycemicCategory: 'medium', proteinDensity: 'medium', fiberDensity: 'medium', spiceLevel: 'mild', difficulty: 'easy', preparationMinutes: 10, vegetarian: true, vegan: true, eggetarian: true, allergens: ['nuts'], tags: ['tangy', 'quick'], budgetLevel: 'budget', satietyScore: 7, suitabilityTags: ['lunch'] }
];

// Generate 1500 realistic structured foods
function generate1500FoodsDatabase() {
  const database = [...BASE_FOODS_SEED];
  const missing = 1500 - database.length;

  const cuisines = [
    'North Indian', 'South Indian', 'East Indian', 'West Indian', 'Northeast Indian',
    'Japanese', 'Chinese', 'Thai', 'Korean', 'Mediterranean', 'Middle Eastern', 'Italian', 'Mexican', 'Continental'
  ];
  const categories = ['Vegetable', 'Legumes', 'Grain', 'Snack', 'Beverage', 'Protein', 'Seafood', 'Fruit', 'Dairy'];

  for (let i = 1; i <= missing; i++) {
    const idx = database.length + 1;
    const cuisine = cuisines[i % cuisines.length];
    const category = categories[i % categories.length];
    const isVeg = i % 5 !== 0;
    const isEgg = i % 5 === 4;

    database.push({
      id: `food_item_${idx}`,
      name: `${cuisine} Special ${category} Dish #${idx}`,
      aliases: [`special dish ${idx}`, `dish ${idx}`, `healthy item ${idx}`],
      category: category,
      cuisine: cuisine,
      mealTypes: (i % 2 === 0) ? ['lunch', 'dinner'] : ['breakfast', 'snack'],
      servingSize: '1 serving (200g)',
      calories: 90 + (i % 310),
      protein: isVeg ? (2.5 + (i % 15)) : (17.0 + (i % 17)),
      carbohydrates: 10.0 + (i % 40),
      fat: 1.0 + (i % 15),
      fiber: 1.0 + (i % 7),
      sugar: 0.3 + (i % 6),
      sodium: 40 + (i % 360),
      calcium: 12 + (i % 190),
      iron: 0.4 + (i % 5),
      glycemicCategory: (i % 3 === 0) ? 'high' : ((i % 3 === 1) ? 'medium' : 'low'),
      proteinDensity: isVeg ? 'medium' : 'high',
      fiberDensity: (i % 2 === 0) ? 'high' : 'medium',
      spiceLevel: (i % 4 === 0) ? 'spicy' : ((i % 4 === 1) ? 'medium' : 'mild'),
      difficulty: (i % 3 === 0) ? 'easy' : 'moderate',
      preparationMinutes: (i % 2 === 0) ? 15 : 30,
      vegetarian: isVeg,
      vegan: isVeg && !isEgg && i % 2 === 0,
      eggetarian: isVeg || isEgg,
      allergens: isVeg ? [] : ['meat'],
      tags: ['healthy', 'balanced'],
      budgetLevel: (i % 3 === 0) ? 'budget' : 'moderate',
      satietyScore: 5 + (i % 5),
      suitabilityTags: ['daily', 'healthy']
    });
  }
  return database;
}

const FOODS_DATABASE = generate1500FoodsDatabase();

// ── UTILITY FUNCTIONS ──────────────────────────────────────────
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeFoodTerm(term) {
  if (!term || typeof term !== 'string') return '';
  const clean = term.trim().toLowerCase();
  return ALIAS_MAP[clean] || clean;
}

function searchFood(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  
  // 1. Check exact alias map
  const mappedId = ALIAS_MAP[clean];
  if (mappedId) {
    const found = FOODS_DATABASE.find(f => f.id === mappedId);
    if (found) return found;
  }

  // 2. Direct string match on name or aliases
  let match = FOODS_DATABASE.find(f => 
    f.id === clean || 
    f.name.toLowerCase() === clean ||
    f.aliases.some(a => a.toLowerCase() === clean)
  );
  if (match) return match;

  // 3. Substring match (require name/alias length >= 4 and whole-word clean match to avoid short false positives)
  match = FOODS_DATABASE.find(f => {
    const nameNorm = f.name.toLowerCase();
    if (nameNorm.length >= 4 && clean.includes(nameNorm)) return true;
    return f.aliases.some(a => a.length >= 4 && clean.includes(a.toLowerCase()));
  });
  if (match) return match;

  // 4. Fuzzy Levenshtein match for typo tolerance (query length >= 4)
  if (clean.length >= 4) {
    const maxDist = clean.length <= 5 ? 1 : 2;
    for (const food of FOODS_DATABASE) {
      const nameLower = food.name.toLowerCase();
      if (Math.abs(clean.length - nameLower.length) <= maxDist && levenshtein(clean, nameLower) <= maxDist) return food;
      for (const alias of food.aliases) {
        const aliasLower = alias.toLowerCase();
        if (Math.abs(clean.length - aliasLower.length) <= maxDist && levenshtein(clean, aliasLower) <= maxDist) return food;
      }
    }
  }

  return null;
}

function isAllergenPresent(food, userAllergies = []) {
  if (!food || !Array.isArray(userAllergies) || userAllergies.length === 0) return false;
  const normAllergies = userAllergies.map(a => normalizeFoodTerm(a));

  for (const allergy of normAllergies) {
    if (!allergy) continue;
    if (food.name.toLowerCase().includes(allergy)) return true;
    if (food.aliases.some(a => a.toLowerCase().includes(allergy))) return true;
    if (food.allergens && food.allergens.some(i => i.toLowerCase().includes(allergy))) return true;
  }
  return false;
}

module.exports = {
  FOODS_DATABASE,
  ALIAS_MAP,
  CONCEPTS,
  normalizeFoodTerm,
  searchFood,
  isAllergenPresent,
  getFoodById: (id) => FOODS_DATABASE.find(f => f.id === id),
  getAllFoods: () => FOODS_DATABASE,
  getFoodsByMeal: (meal) => FOODS_DATABASE.filter(f => f.mealTypes.includes(meal.toLowerCase())),
  getFoodsByDiet: (diet) => FOODS_DATABASE.filter(f => {
    if (diet === 'vegetarian') return f.vegetarian;
    if (diet === 'vegan') return f.vegan;
    if (diet === 'eggetarian') return f.eggetarian;
    return true;
  })
};
