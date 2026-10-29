// ─────────────────────────────────────────────────────────────
//  frontend/src/screens/CompareScreen.js
//  FoodieBite Enhanced Side-by-Side Nutrition Comparison
//  Features:
//    1. Ultra-fast Instant Local Search + Debounced Remote OFF Search
//    2. Click-to-Suggest Dropdown with Popular Foods & 1-Tap Comparison Pairs
//    3. Always-Visible Prominent Comparison Button & Quick Swap Action
//    4. Detailed Side-by-Side Macro Breakdown & AI Coach Decision
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Award,
  CheckCircle,
  ArrowLeftRight,
  Search,
  Sparkles,
  X,
  Flame,
  Check,
  TrendingUp,
  RefreshCw,
  Zap,
  Info,
  Scale
} from 'lucide-react-native';

import { BackHeader, C, HealthScoreBadge } from '../components/UI';
import { apiCompareFoods, apiSearchFoods } from '../services/api';
import AppLayout from '../components/AppLayout';
import { FOOD_ITEMS } from '../data/mockData';

// ── Built-in High-Quality Food Catalog for 0ms Instant Search ──
export const POPULAR_FOOD_CATALOG = [
  { id: 'pop-1', name: 'Brown Rice', calories: 216, protein: 5.0, carbs: 45.0, fat: 1.8, fiber: 3.5, sugar: 0.7, healthScore: 84, healthGrade: 'b', category: 'Grain', emoji: '🍚' },
  { id: 'pop-2', name: 'White Rice', calories: 242, protein: 4.4, carbs: 53.0, fat: 0.4, fiber: 0.6, sugar: 0.1, healthScore: 68, healthGrade: 'c', category: 'Grain', emoji: '🍚' },
  { id: 'pop-3', name: 'Paneer (Cottage Cheese)', calories: 265, protein: 18.0, carbs: 3.4, fat: 20.8, fiber: 0.0, sugar: 2.5, healthScore: 78, healthGrade: 'b', category: 'Dairy', emoji: '🧀' },
  { id: 'pop-4', name: 'Tofu (Firm)', calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, fiber: 2.3, sugar: 0.6, healthScore: 92, healthGrade: 'a', category: 'Plant Protein', emoji: '🌱' },
  { id: 'pop-5', name: 'Rolled Oatmeal', calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5, fiber: 10.1, sugar: 1.0, healthScore: 95, healthGrade: 'a', category: 'Breakfast', emoji: '🥣' },
  { id: 'pop-6', name: 'Cornflakes Cereal', calories: 357, protein: 7.5, carbs: 84.0, fat: 0.4, fiber: 3.3, sugar: 10.0, healthScore: 62, healthGrade: 'c', category: 'Breakfast', emoji: '🥣' },
  { id: 'pop-7', name: 'Greek Yogurt (Plain)', calories: 97, protein: 10.0, carbs: 3.6, fat: 5.0, fiber: 0.0, sugar: 3.6, healthScore: 94, healthGrade: 'a', category: 'Dairy', emoji: '🥛' },
  { id: 'pop-8', name: 'Vanilla Ice Cream', calories: 207, protein: 3.5, carbs: 24.0, fat: 11.0, fiber: 0.7, sugar: 21.0, healthScore: 42, healthGrade: 'd', category: 'Dessert', emoji: '🍦' },
  { id: 'pop-9', name: 'Whole Wheat Bread', calories: 247, protein: 13.0, carbs: 41.0, fat: 3.4, fiber: 7.0, sugar: 5.6, healthScore: 88, healthGrade: 'b', category: 'Grain', emoji: '🍞' },
  { id: 'pop-10', name: 'White Bread', calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, fiber: 2.7, sugar: 5.0, healthScore: 58, healthGrade: 'd', category: 'Grain', emoji: '🍞' },
  { id: 'pop-11', name: 'Raw Almonds', calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, sugar: 4.4, healthScore: 92, healthGrade: 'a', category: 'Nuts', emoji: '🥜' },
  { id: 'pop-12', name: 'Cashews', calories: 553, protein: 18.2, carbs: 30.2, fat: 43.8, fiber: 3.3, sugar: 5.9, healthScore: 80, healthGrade: 'b', category: 'Nuts', emoji: '🥜' },
  { id: 'pop-13', name: 'Boiled Eggs (2 pcs)', calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0.0, sugar: 1.1, healthScore: 96, healthGrade: 'a', category: 'Protein', emoji: '🥚' },
  { id: 'pop-14', name: 'Grilled Chicken Breast', calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, sugar: 0.0, healthScore: 98, healthGrade: 'a', category: 'Protein', emoji: '🍗' },
  { id: 'pop-15', name: 'Quinoa (Cooked)', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiber: 2.8, sugar: 0.9, healthScore: 95, healthGrade: 'a', category: 'Grain', emoji: '🥗' },
  { id: 'pop-16', name: 'Avocado', calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7, healthScore: 94, healthGrade: 'a', category: 'Fruit', emoji: '🥑' },
  { id: 'pop-17', name: 'Fresh Apple', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4, healthScore: 95, healthGrade: 'a', category: 'Fruit', emoji: '🍎' },
  { id: 'pop-18', name: 'Fresh Banana', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, healthScore: 86, healthGrade: 'b', category: 'Fruit', emoji: '🍌' },
  { id: 'pop-19', name: 'Lentil Soup (Dal)', calories: 116, protein: 9.0, carbs: 20.0, fat: 0.4, fiber: 7.9, sugar: 1.8, healthScore: 94, healthGrade: 'a', category: 'Soup', emoji: '🍲' },
  { id: 'pop-20', name: 'Spinach Salad', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sugar: 0.4, healthScore: 99, healthGrade: 'a', category: 'Vegetable', emoji: '🥬' },
];

export const QUICK_COMPARE_PAIRS = [
  { label: 'Brown Rice vs White Rice', foodA: 'Brown Rice', foodB: 'White Rice', emoji: '🍚', desc: 'Whole Grain vs Refined' },
  { label: 'Paneer vs Tofu', foodA: 'Paneer (Cottage Cheese)', foodB: 'Tofu (Firm)', emoji: '🧀', desc: 'Dairy vs Plant Protein' },
  { label: 'Oatmeal vs Cornflakes', foodA: 'Rolled Oatmeal', foodB: 'Cornflakes Cereal', emoji: '🥣', desc: 'High Fiber vs Sugary' },
  { label: 'Greek Yogurt vs Ice Cream', foodA: 'Greek Yogurt (Plain)', foodB: 'Vanilla Ice Cream', emoji: '🥛', desc: 'Protein Snack vs Dessert' },
  { label: 'Wheat Bread vs White Bread', foodA: 'Whole Wheat Bread', foodB: 'White Bread', emoji: '🍞', desc: 'Fiber Rich vs High GI' },
  { label: 'Almonds vs Cashews', foodA: 'Raw Almonds', foodB: 'Cashews', emoji: '🥜', desc: 'Nut Nutrient Face-Off' },
  { label: 'Boiled Eggs vs Chicken', foodA: 'Boiled Eggs (2 pcs)', foodB: 'Grilled Chicken Breast', emoji: '🥚', desc: 'Lean Protein Duel' },
  { label: 'Apple vs Banana', foodA: 'Fresh Apple', foodB: 'Fresh Banana', emoji: '🍎', desc: 'Fiber vs Potassium' },
];

// Helper to normalize any food item to required format
function normalizeFoodItem(item) {
  if (!item) return null;
  return {
    id: item.id || `f-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: item.name || item.product_name || 'Food Product',
    calories: Number(item.calories || item.nutriments?.['energy-kcal_100g'] || 100),
    protein: Number(item.protein || item.nutriments?.proteins_100g || 4),
    carbs: Number(item.carbs || item.nutriments?.carbohydrates_100g || 15),
    fat: Number(item.fat || item.nutriments?.fat_100g || 2),
    fiber: Number(item.fiber || item.nutriments?.fiber_100g || 2),
    sugar: Number(item.sugar || item.nutriments?.sugars_100g || 2),
    healthScore: Number(item.healthScore || item.nutrition_score || 85),
    healthGrade: String(item.healthGrade || item.nutrition_grades || 'a').toLowerCase(),
    image: item.image || item.image_url || null,
    emoji: item.emoji || '🥗',
    category: item.category || 'General'
  };
}

// In-memory query cache for instant keystroke searches
const searchCache = new Map();

export default function CompareScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [foodA, setFoodA] = useState(null);
  const [foodB, setFoodB] = useState(null);

  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');

  const [resultsA, setResultsA] = useState([]);
  const [resultsB, setResultsB] = useState([]);

  const [focusedSlot, setFocusedSlot] = useState(null); // 'A' | 'B' | null
  const [activeFilterCategory, setActiveFilterCategory] = useState('All');

  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);

  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');

  const debounceTimerA = useRef(null);
  const debounceTimerB = useRef(null);
  const resultsRef = useRef(null);

  // ── Handle Preloaded Items via Navigation Params ────────────
  useEffect(() => {
    if (route.params) {
      const { initialFoodA, initialFoodB, autoCompare } = route.params;
      if (initialFoodA) {
        const found = findFoodByNameOrObj(initialFoodA);
        if (found) setFoodA(found);
      }
      if (initialFoodB) {
        const found = findFoodByNameOrObj(initialFoodB);
        if (found) setFoodB(found);
      }
      if (autoCompare && initialFoodA && initialFoodB) {
        setTimeout(() => {
          const a = findFoodByNameOrObj(initialFoodA);
          const b = findFoodByNameOrObj(initialFoodB);
          if (a && b) executeComparison(a, b);
        }, 300);
      }
    }
  }, [route.params]);

  function findFoodByNameOrObj(target) {
    if (!target) return null;
    if (typeof target === 'object' && target.name) {
      return normalizeFoodItem(target);
    }
    const cleanName = String(target).toLowerCase().trim();
    const matchCatalog = POPULAR_FOOD_CATALOG.find(f => f.name.toLowerCase().includes(cleanName));
    if (matchCatalog) return normalizeFoodItem(matchCatalog);

    const matchMock = FOOD_ITEMS.find(f => f.name.toLowerCase().includes(cleanName));
    if (matchMock) return normalizeFoodItem(matchMock);

    return normalizeFoodItem({ name: target });
  }

  // ── 1. Instant Local Catalog Search ─────────────────────────
  function queryLocalCatalog(term) {
    if (!term || !term.trim()) return [];
    const clean = term.toLowerCase().trim();
    const seen = new Set();
    const matches = [];

    // Search popular catalog first
    POPULAR_FOOD_CATALOG.forEach(item => {
      if (
        item.name.toLowerCase().includes(clean) ||
        (item.category && item.category.toLowerCase().includes(clean))
      ) {
        seen.add(item.name.toLowerCase());
        matches.push(normalizeFoodItem(item));
      }
    });

    // Then search mock data items
    FOOD_ITEMS.forEach(item => {
      const lower = item.name.toLowerCase();
      if (!seen.has(lower) && (lower.includes(clean) || (item.tags && item.tags.some(t => t.toLowerCase().includes(clean))))) {
        seen.add(lower);
        matches.push(normalizeFoodItem(item));
      }
    });

    return matches.slice(0, 15);
  }

  // ── 2. Hybrid Search for Food A ──────────────────────────────
  function handleSearchA(val) {
    setQueryA(val);
    if (!val || val.trim().length === 0) {
      setResultsA([]);
      setSearchingA(false);
      return;
    }

    // Step A: Instant Local Results (<2ms)
    const localMatches = queryLocalCatalog(val);
    setResultsA(localMatches);

    // Step B: Debounced Remote Network Search (300ms)
    if (debounceTimerA.current) clearTimeout(debounceTimerA.current);

    if (val.trim().length >= 2) {
      setSearchingA(true);
      debounceTimerA.current = setTimeout(async () => {
        const cacheKey = `search_${val.trim().toLowerCase()}`;
        if (searchCache.has(cacheKey)) {
          mergeResults(setResultsA, localMatches, searchCache.get(cacheKey));
          setSearchingA(false);
          return;
        }

        try {
          const res = await apiSearchFoods(val.trim());
          const remoteList = (res.products || []).map(normalizeFoodItem);
          searchCache.set(cacheKey, remoteList);
          mergeResults(setResultsA, localMatches, remoteList);
        } catch (_) {
          // Keep local matches on error
        } finally {
          setSearchingA(false);
        }
      }, 300);
    } else {
      setSearchingA(false);
    }
  }

  // ── 3. Hybrid Search for Food B ──────────────────────────────
  function handleSearchB(val) {
    setQueryB(val);
    if (!val || val.trim().length === 0) {
      setResultsB([]);
      setSearchingB(false);
      return;
    }

    // Step A: Instant Local Results (<2ms)
    const localMatches = queryLocalCatalog(val);
    setResultsB(localMatches);

    // Step B: Debounced Remote Network Search (300ms)
    if (debounceTimerB.current) clearTimeout(debounceTimerB.current);

    if (val.trim().length >= 2) {
      setSearchingB(true);
      debounceTimerB.current = setTimeout(async () => {
        const cacheKey = `search_${val.trim().toLowerCase()}`;
        if (searchCache.has(cacheKey)) {
          mergeResults(setResultsB, localMatches, searchCache.get(cacheKey));
          setSearchingB(false);
          return;
        }

        try {
          const res = await apiSearchFoods(val.trim());
          const remoteList = (res.products || []).map(normalizeFoodItem);
          searchCache.set(cacheKey, remoteList);
          mergeResults(setResultsB, localMatches, remoteList);
        } catch (_) {
          // Keep local matches on error
        } finally {
          setSearchingB(false);
        }
      }, 300);
    } else {
      setSearchingB(false);
    }
  }

  function mergeResults(setter, localItems, remoteItems) {
    const map = new Map();
    localItems.forEach(item => map.set(item.name.toLowerCase(), item));
    remoteItems.forEach(item => {
      const key = item.name.toLowerCase();
      if (!map.has(key)) map.set(key, item);
    });
    setter(Array.from(map.values()).slice(0, 20));
  }

  // ── 4. Execute Comparison ────────────────────────────────────
  async function executeComparison(itemA = foodA, itemB = foodB) {
    if (!itemA || !itemB) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiCompareFoods(itemA, itemB);
      setComparison(res);
      // Smooth scroll to comparison results
      setTimeout(() => {
        if (resultsRef.current && typeof resultsRef.current.scrollIntoView === 'function') {
          resultsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 200);
    } catch (err) {
      setError(err.message || 'Failed to compare products');
    } finally {
      setLoading(false);
    }
  }

  // ── 5. Quick Compare Pair Selector ───────────────────────────
  function handleSelectQuickPair(pair) {
    const itemA = findFoodByNameOrObj(pair.foodA);
    const itemB = findFoodByNameOrObj(pair.foodB);
    if (itemA && itemB) {
      setFoodA(itemA);
      setFoodB(itemB);
      setFocusedSlot(null);
      setQueryA('');
      setQueryB('');
      setResultsA([]);
      setResultsB([]);
      executeComparison(itemA, itemB);
    }
  }

  // ── 6. Swap Foods Slot ───────────────────────────────────────
  function handleSwapFoods() {
    const tempA = foodA;
    const tempB = foodB;
    setFoodA(tempB);
    setFoodB(tempA);
    if (comparison && tempA && tempB) {
      executeComparison(tempB, tempA);
    }
  }

  // Filter suggestion list by tab
  const filteredSuggestions = POPULAR_FOOD_CATALOG.filter(item => {
    if (activeFilterCategory === 'All') return true;
    if (activeFilterCategory === 'Protein') return item.protein >= 10;
    if (activeFilterCategory === 'Low Carb') return item.carbs <= 15;
    if (activeFilterCategory === 'Breakfast') return item.category === 'Breakfast' || item.category === 'Dairy';
    if (activeFilterCategory === 'Grain') return item.category === 'Grain';
    return true;
  });

  // ── Render Dedicated Dropdown Menu directly attached to active search bar ─
  function renderDropdownMenu(slot) {
    if (focusedSlot !== slot) return null;
    const isA = slot === 'A';
    const query = isA ? queryA : queryB;
    const results = isA ? resultsA : resultsB;
    const isSearching = isA ? searchingA : searchingB;

    const isQueryActive = query.trim().length > 0;
    const displayItems = isQueryActive ? results : filteredSuggestions;

    return (
      <View style={styles.dropdownMenu}>
        <View style={styles.dropdownHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {isQueryActive ? (
              <Search size={13} color={C.orange} style={{ marginRight: 6 }} />
            ) : (
              <Zap size={13} color={C.orange} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.dropdownHeaderText}>
              {isQueryActive
                ? `Matches for "${query.trim()}" (${displayItems.length})`
                : `Suggestions for Food ${slot}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setFocusedSlot(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dropdownCloseBtn}
          >
            <X size={13} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* Category filter tabs inside dropdown when not typing */}
        {!isQueryActive && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dropdownCategoriesScroll}
          >
            {['All', 'Protein', 'Low Carb', 'Breakfast', 'Grain'].map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveFilterCategory(cat)}
                style={[
                  styles.dropdownCatChip,
                  activeFilterCategory === cat && styles.dropdownCatChipActive
                ]}
              >
                <Text
                  style={[
                    styles.dropdownCatText,
                    activeFilterCategory === cat && styles.dropdownCatTextActive
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Scrollable List of Foods inside dropdown */}
        <ScrollView
          style={styles.dropdownScrollList}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          {isSearching && displayItems.length === 0 ? (
            <View style={styles.dropdownLoadingRow}>
              <ActivityIndicator size="small" color={C.orange} />
              <Text style={styles.dropdownLoadingText}>Searching food database...</Text>
            </View>
          ) : displayItems.length === 0 ? (
            <View style={styles.dropdownEmptyRow}>
              <Text style={styles.dropdownEmptyText}>
                No foods found matching "{query}". Try another keyword.
              </Text>
            </View>
          ) : (
            displayItems.map((item, idx) => (
              <TouchableOpacity
                key={item.id || idx}
                onPress={() => {
                  if (isA) {
                    setFoodA(item);
                    setQueryA('');
                    setResultsA([]);
                  } else {
                    setFoodB(item);
                    setQueryB('');
                    setResultsB([]);
                  }
                  setFocusedSlot(null);
                }}
                style={styles.dropdownItemRow}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemEmojiWrap}>
                  <Text style={{ fontSize: 18 }}>{item.emoji || '🥗'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.dropdownItemTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.dropdownItemSub} numberOfLines={1}>
                    {item.calories} kcal · {item.protein}g protein · {item.carbs}g carbs
                  </Text>
                </View>
                <View style={styles.dropdownItemBadgeWrap}>
                  <View
                    style={[
                      styles.gradeMiniBadge,
                      {
                        backgroundColor:
                          item.healthGrade?.toLowerCase() === 'a'
                            ? 'rgba(34, 197, 94, 0.2)'
                            : item.healthGrade?.toLowerCase() === 'b'
                            ? 'rgba(56, 189, 248, 0.2)'
                            : 'rgba(234, 179, 8, 0.2)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeMiniText,
                        {
                          color:
                            item.healthGrade?.toLowerCase() === 'a'
                              ? '#22c55e'
                              : item.healthGrade?.toLowerCase() === 'b'
                              ? '#38bdf8'
                              : '#eab308',
                        },
                      ]}
                    >
                      Grade {item.healthGrade?.toUpperCase() || 'B'}
                    </Text>
                  </View>
                  <Text style={styles.dropdownSelectPill}>+ Pick</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <AppLayout noPadding>
      <BackHeader title="Compare Foods" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Intro Header */}
        <View style={styles.introBox}>
          <View style={styles.introIcon}>
            <Scale size={22} color={C.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Side-by-Side Food Comparison</Text>
            <Text style={styles.introSubtitle}>
              Select any two foods or pick a quick duel below to analyze macros, calories, glycemic impact, and AI coach recommendation.
            </Text>
          </View>
        </View>

        {/* ── 1-TAP QUICK COMPARE DUELS ───────────────────────── */}
        <View style={styles.quickSection}>
          <View style={styles.quickSectionHeader}>
            <Sparkles size={14} color={C.orange} />
            <Text style={styles.quickSectionTitle}>Popular 1-Tap Comparisons</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPillsScroll}
          >
            {QUICK_COMPARE_PAIRS.map((pair, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSelectQuickPair(pair)}
                style={styles.quickPill}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, marginRight: 5 }}>{pair.emoji}</Text>
                <Text style={styles.quickPillText}>{pair.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── FOOD SELECTION SLOTS ────────────────────────────── */}
        <View style={styles.selectorsCard}>
          {/* Food A Column */}
          <View style={styles.foodSlot}>
            <View style={styles.slotHeaderRow}>
              <View style={[styles.slotBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Text style={[styles.slotBadgeText, { color: '#38bdf8' }]}>FOOD A</Text>
              </View>
              {foodA && (
                <TouchableOpacity
                  onPress={() => { setFoodA(null); setComparison(null); }}
                  style={styles.removeBtn}
                >
                  <X size={13} color="#f87171" />
                  <Text style={styles.removeBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {foodA ? (
              <View style={[styles.chosenCard, styles.chosenCardA]}>
                <Text style={styles.chosenEmoji}>{foodA.emoji || '🥗'}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.chosenName} numberOfLines={1}>{foodA.name}</Text>
                  <Text style={styles.chosenMeta}>
                    {foodA.calories} kcal · {foodA.protein}g protein · Grade {foodA.healthGrade?.toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setFocusedSlot('A')}
                  style={[styles.inputWrap, focusedSlot === 'A' && styles.inputWrapActive]}
                >
                  <Search size={15} color={focusedSlot === 'A' ? C.orange : '#888'} style={styles.inputSearchIcon} />
                  <TextInput
                    placeholder="Click to choose Food A..."
                    placeholderTextColor="#777"
                    value={queryA}
                    onChangeText={handleSearchA}
                    onFocus={() => { setFocusedSlot('A'); setQueryB(''); setResultsB([]); }}
                    style={styles.textInput}
                  />
                  {searchingA && <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 8 }} />}
                  {queryA ? (
                    <TouchableOpacity onPress={() => handleSearchA('')} style={{ padding: 4 }}>
                      <X size={14} color="#888" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {/* ── Direct Dropdown Menu for Food A ── */}
                {renderDropdownMenu('A')}
              </View>
            )}
          </View>

          {/* Swap Button Divider */}
          <View style={styles.swapDivider}>
            <TouchableOpacity
              onPress={handleSwapFoods}
              style={styles.swapCircleBtn}
              activeOpacity={0.8}
              title="Swap Food A and Food B"
            >
              <ArrowLeftRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Food B Column */}
          <View style={styles.foodSlot}>
            <View style={styles.slotHeaderRow}>
              <View style={[styles.slotBadge, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
                <Text style={[styles.slotBadgeText, { color: C.orange }]}>FOOD B</Text>
              </View>
              {foodB && (
                <TouchableOpacity
                  onPress={() => { setFoodB(null); setComparison(null); }}
                  style={styles.removeBtn}
                >
                  <X size={13} color="#f87171" />
                  <Text style={styles.removeBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {foodB ? (
              <View style={[styles.chosenCard, styles.chosenCardB]}>
                <Text style={styles.chosenEmoji}>{foodB.emoji || '🥗'}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.chosenName} numberOfLines={1}>{foodB.name}</Text>
                  <Text style={styles.chosenMeta}>
                    {foodB.calories} kcal · {foodB.protein}g protein · Grade {foodB.healthGrade?.toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setFocusedSlot('B')}
                  style={[styles.inputWrap, focusedSlot === 'B' && styles.inputWrapActive]}
                >
                  <Search size={15} color={focusedSlot === 'B' ? C.orange : '#888'} style={styles.inputSearchIcon} />
                  <TextInput
                    placeholder="Click to choose Food B..."
                    placeholderTextColor="#777"
                    value={queryB}
                    onChangeText={handleSearchB}
                    onFocus={() => { setFocusedSlot('B'); setQueryA(''); setResultsA([]); }}
                    style={styles.textInput}
                  />
                  {searchingB && <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 8 }} />}
                  {queryB ? (
                    <TouchableOpacity onPress={() => handleSearchB('')} style={{ padding: 4 }}>
                      <X size={14} color="#888" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {/* ── Direct Dropdown Menu for Food B ── */}
                {renderDropdownMenu('B')}
              </View>
            )}
          </View>
        </View>

        {/* ── 3. ALWAYS-VISIBLE PROMINENT COMPARISON BUTTON ───── */}
        <View style={styles.actionBtnContainer}>
          {foodA && foodB ? (
            <TouchableOpacity
              onPress={() => executeComparison(foodA, foodB)}
              style={[styles.mainCompareBtn, styles.mainCompareBtnActive]}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.mainCompareBtnText}>Analyzing Nutrition &amp; Health Impact...</Text>
                </>
              ) : (
                <>
                  <Scale size={18} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.mainCompareBtnText}>
                    {comparison ? 'Re-Compare Foods (A vs B)' : '⚡ Compare Foods Now'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (!foodA) setFocusedSlot('A');
                else if (!foodB) setFocusedSlot('B');
              }}
              style={[styles.mainCompareBtn, styles.mainCompareBtnDisabled]}
              activeOpacity={0.8}
            >
              <Info size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <Text style={styles.mainCompareBtnDisabledText}>
                {!foodA && !foodB
                  ? 'Select Food A and Food B to Compare'
                  : !foodA
                  ? '👈 Select Food A to Compare (1 of 2 selected)'
                  : '👉 Select Food B to Compare (1 of 2 selected)'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick Clear All Button when both are filled */}
          {(foodA || foodB) && (
            <TouchableOpacity
              onPress={() => {
                setFoodA(null);
                setFoodB(null);
                setComparison(null);
                setFocusedSlot(null);
              }}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>Reset Both Slots</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── 4. COMPARISON OUTPUT RESULTS ─────────────────────── */}
        {comparison && (
          <div ref={resultsRef} style={{ width: '100%' }}>
            <View style={styles.comparisonBox}>
              {/* Winner Decision Card */}
              <View style={styles.coachBox}>
                <View style={styles.coachHeader}>
                  <View style={styles.coachBadge}>
                    <Award size={16} color="#fff" />
                    <Text style={styles.coachBadgeText}>AI NUTRITIONAL DECISION</Text>
                  </View>
                </View>
                <Text style={styles.coachDecisionText}>
                  {comparison.coachDecision}
                </Text>
              </View>

              {/* Side-by-Side Winner Overview Banner */}
              <View style={styles.versusBanner}>
                <View style={[styles.versusSide, { alignItems: 'flex-start' }]}>
                  <Text style={styles.versusSideName} numberOfLines={1}>{foodA?.name}</Text>
                  <Text style={styles.versusSideScore}>
                    Health Index: {foodA?.healthScore || 80}/100
                  </Text>
                </View>
                <View style={styles.vsCircle}>
                  <Text style={styles.vsCircleText}>VS</Text>
                </View>
                <View style={[styles.versusSide, { alignItems: 'flex-end' }]}>
                  <Text style={styles.versusSideName} numberOfLines={1}>{foodB?.name}</Text>
                  <Text style={styles.versusSideScore}>
                    Health Index: {foodB?.healthScore || 80}/100
                  </Text>
                </View>
              </View>

              {/* Side-by-Side Detailed Nutrients Table */}
              <View style={styles.gridCard}>
                <View style={styles.gridHeaderRow}>
                  <Text style={styles.gridHeaderNutrient}>NUTRIENT (per 100g)</Text>
                  <Text style={styles.gridHeaderFood} numberOfLines={1}>
                    {foodA?.name}
                  </Text>
                  <Text style={styles.gridHeaderFood} numberOfLines={1}>
                    {foodB?.name}
                  </Text>
                </View>

                {Object.keys(comparison.details || {}).map((key) => {
                  const det = comparison.details[key];
                  const isWinnerA = det.winner === 'A';
                  const isWinnerB = det.winner === 'B';

                  const unitLabel =
                    key === 'calories'
                      ? ' kcal'
                      : key === 'healthScore'
                      ? ' / 100'
                      : 'g';

                  return (
                    <View key={key} style={styles.gridRow}>
                      <Text style={styles.gridRowLabel}>
                        {key === 'healthScore' ? 'Health Index Score' : key}
                      </Text>

                      {/* Food A Cell */}
                      <View style={[styles.gridValueSlot, isWinnerA && styles.winnerCellA]}>
                        {key === 'healthScore' ? (
                          <HealthScoreBadge score={det.valA} grade={foodA?.healthGrade} />
                        ) : (
                          <Text
                            style={[
                              styles.gridValueText,
                              isWinnerA && { fontWeight: '800', color: '#10B981' }
                            ]}
                          >
                            {det.valA}
                            {unitLabel}
                          </Text>
                        )}
                        {isWinnerA && (
                          <CheckCircle size={13} color="#10B981" style={{ marginLeft: 4 }} />
                        )}
                      </View>

                      {/* Food B Cell */}
                      <View style={[styles.gridValueSlot, isWinnerB && styles.winnerCellB]}>
                        {key === 'healthScore' ? (
                          <HealthScoreBadge score={det.valB} grade={foodB?.healthGrade} />
                        ) : (
                          <Text
                            style={[
                              styles.gridValueText,
                              isWinnerB && { fontWeight: '800', color: '#10B981' }
                            ]}
                          >
                            {det.valB}
                            {unitLabel}
                          </Text>
                        )}
                        {isWinnerB && (
                          <CheckCircle size={13} color="#10B981" style={{ marginLeft: 4 }} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Bottom Quick Actions */}
              <View style={styles.bottomActionsRow}>
                <TouchableOpacity
                  onPress={handleSwapFoods}
                  style={styles.secondaryActionBtn}
                >
                  <ArrowLeftRight size={14} color="#cbd5e1" style={{ marginRight: 6 }} />
                  <Text style={styles.secondaryActionText}>Swap &amp; Recalculate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setFoodA(null);
                    setFoodB(null);
                    setComparison(null);
                    setFocusedSlot('A');
                  }}
                  style={[styles.secondaryActionBtn, { borderColor: C.orange }]}
                >
                  <Sparkles size={14} color={C.orange} style={{ marginRight: 6 }} />
                  <Text style={[styles.secondaryActionText, { color: C.orange }]}>
                    Compare Other Foods
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </div>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  introBox: {
    flexDirection: 'row',
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 3,
  },
  introSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  quickSection: {
    marginBottom: 16,
  },
  quickSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  quickSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 0.2,
  },
  quickPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2230',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  selectorsCard: {
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  foodSlot: {
    marginBottom: 10,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f87171',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapActive: {
    borderColor: C.orange,
    backgroundColor: '#161922',
  },
  inputSearchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    outlineWidth: 0,
  },
  chosenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chosenCardA: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  chosenCardB: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  chosenEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  chosenName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  chosenMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  swapDivider: {
    alignItems: 'center',
    marginVertical: 4,
  },
  swapCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262a36',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    backgroundColor: '#1a1e28',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.45)',
    borderRadius: 14,
    marginTop: 6,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 999,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  dropdownCloseBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownCategoriesScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  dropdownCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#12151e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropdownCatChipActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  dropdownCatText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  dropdownCatTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  dropdownScrollList: {
    maxHeight: 230,
  },
  dropdownLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  dropdownLoadingText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dropdownEmptyRow: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownEmptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  dropdownItemEmojiWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  dropdownItemSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  dropdownItemBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  gradeMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gradeMiniText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dropdownSelectPill: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBtnContainer: {
    marginBottom: 20,
  },
  mainCompareBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mainCompareBtnActive: {
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    cursor: 'pointer',
  },
  mainCompareBtnDisabled: {
    backgroundColor: '#1a1e28',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    cursor: 'pointer',
  },
  mainCompareBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mainCompareBtnDisabledText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    alignSelf: 'center',
    marginTop: 10,
    padding: 6,
  },
  resetBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
  },
  comparisonBox: {
    gap: 16,
  },
  coachBox: {
    backgroundColor: '#1b202e',
    borderWidth: 1.5,
    borderColor: C.orange,
    borderRadius: 16,
    padding: 16,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  coachBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  coachDecisionText: {
    fontSize: 13,
    color: '#f1f5f9',
    lineHeight: 20,
    fontWeight: '500',
  },
  versusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
  },
  versusSide: {
    flex: 1,
  },
  versusSideName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  versusSideScore: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  vsCircleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  gridCard: {
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e2230',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  gridHeaderNutrient: {
    flex: 1.2,
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  gridHeaderFood: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gridRowLabel: {
    flex: 1.2,
    fontSize: 12,
    textTransform: 'capitalize',
    color: '#cbd5e1',
    fontWeight: '500',
  },
  gridValueSlot: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  winnerCellA: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 6,
  },
  winnerCellB: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 6,
  },
  gridValueText: {
    fontSize: 12,
    color: '#e2e8f0',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#1b1f2a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
});
