import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, X, SlidersHorizontal, Sparkles, RefreshCw, LayoutGrid, List } from 'lucide-react-native';
import AppLayout from '../components/AppLayout';
import { FoodCardRow, FoodCardH, SkeletonRow, SkeletonCard, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { useSearch, useRandomProducts } from '../hooks/useFoods';
import { LOCAL_PRODUCTS } from '../services/openFoodFacts';
import { trackSearchedFood } from '../services/localStorageService';
import { trackFoodSearch } from '../services/analyticsEventService';

const QUICK_SEARCHES = ['Chicken', 'Salad', 'Quinoa', 'Tofu', 'Oats', 'Paneer', 'Lentils', 'Yogurt', 'Eggs', 'Avocado'];
const SUGGESTIONS = [
  'Paneer Tikka', 'Biryani', 'Chicken Salad', 'Grilled Chicken',
  'Dal Makhani', 'Roti', 'Oats Porridge', 'Tofu Salad',
  'Greek Yogurt', 'Egg Omelette', 'Avocado Toast', 'Whey Protein',
  'Samosa', 'Idli', 'Dosa', 'Palak Paneer', 'Quinoa Salad',
  'Green Tea', 'Almond Milk', 'Apple', 'Banana', 'Chana Masala'
];
const FILTER_OPTIONS = [
  { id: 'high_protein', label: 'High Protein', fn: foods => foods.filter(f => f.protein >= 10) },
  { id: 'low_calorie',  label: 'Low Calorie',  fn: foods => foods.filter(f => f.calories <= 200) },
  { id: 'low_carb',     label: 'Low Carb',     fn: foods => foods.filter(f => f.carbs <= 15) },
  { id: 'high_fiber',   label: 'High Fiber',   fn: foods => foods.filter(f => f.fiber >= 3) },
  { id: 'grade_a',      label: 'Grade A',      fn: foods => foods.filter(f => f.grade?.toLowerCase() === 'a') },
  { id: 'grade_ab',     label: 'Grade A & B',  fn: foods => foods.filter(f => ['a','b'].includes(f.grade?.toLowerCase())) },
];

function ResponsiveFoodGrid({ children }) {
  const { width } = useWindowDimensions();
  // Responsive columns: Mobile 2, Tablet 3, Desktop 4, Large Desktop 5
  const numCols = width >= 1440 ? 5 : width >= 1024 ? 4 : width >= 640 ? 3 : 2;
  const gap = width >= 1440 ? 18 : width >= 1024 ? 16 : width >= 640 ? 14 : 12;

  if (Platform.OS === 'web') {
    return (
      <div
        className="responsive-food-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
          gap: `${gap}px`,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {React.Children.map(children, (child, idx) => (
          <div
            key={idx}
            className="responsive-food-grid-item"
            style={{
              minWidth: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    );
  }

  const itemWidth = `${(100 / numCols) - 1.5}%`;
  return (
    <View style={[styles.gridFallback, { gap }]}>
      {React.Children.map(children, (child, idx) => (
        <View key={idx} style={[styles.gridItem, { width: itemWidth }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation();
  const { preferences } = useApp();
  const [query, setQuery]           = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [viewMode, setViewMode]     = useState('grid'); // 'grid' | 'list'

  // Track searches
  useEffect(() => {
    if (query && query.trim().length >= 2) {
      const delay = setTimeout(() => {
        trackSearchedFood(query);
        trackFoodSearch(query, (displayed || []).length);
      }, 800);
      return () => clearTimeout(delay);
    }
  }, [query]);

  const { results, loading } = useSearch(query, preferences);
  const { foods: randomFoods, loading: randomLoading, reload: reloadRandom } = useRandomProducts(12);

  // Filter suggestions in real-time
  const filteredSuggestions = query.trim()
    ? SUGGESTIONS.filter(s => 
        s.toLowerCase().includes(query.toLowerCase()) && 
        s.toLowerCase() !== query.toLowerCase().trim()
      )
    : [];

  // Apply additional filter on top of search results
  const filterFn = FILTER_OPTIONS.find(f => f.id === activeFilter)?.fn;
  let displayed = filterFn ? filterFn(results) : results;

  // Fallback to matching local products if the filter returned no products
  if (displayed.length === 0 && activeFilter) {
    const localMatches = LOCAL_PRODUCTS.filter(p => {
      const matchesQuery = !query || 
                           p.name.toLowerCase().includes(query.toLowerCase()) || 
                           p.categories.some(c => c.toLowerCase().includes(query.toLowerCase()));
      if (!matchesQuery) return false;
      const passesFilter = filterFn([p]).length > 0;
      return passesFilter;
    });
    if (localMatches.length > 0) {
      displayed = localMatches;
    }
  }

  return (
    <AppLayout>
      {/* Search Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 4 }}>
          <Text style={{ color: '#fff', fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <View style={styles.searchBarContainer}>
          <Search size={16} color="#666" />
          <TextInput
            autoFocus
            placeholder="Search Open Food Facts..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <X size={14} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Search Suggestions */}
      {query.length > 0 && filteredSuggestions.length > 0 ? (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {filteredSuggestions.slice(0, 5).map(s => (
              <TouchableOpacity 
                key={s} 
                onPress={() => setQuery(s)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionChipText}>🔍 {s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Filters */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTER_OPTIONS.map(f => {
            const isSelected = activeFilter === f.id;
            return (
              <TouchableOpacity 
                key={f.id} 
                onPress={() => setActiveFilter(v => v === f.id ? '' : f.id)} 
                style={[
                  styles.filterChip,
                  isSelected ? { backgroundColor: C.orange, borderColor: C.orange } : { backgroundColor: '#1e1e1e', borderColor: '#2a2a2a' }
                ]}
              >
                <Text style={[styles.filterChipText, isSelected ? { color: '#fff' } : { color: '#888' }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContainer}>
        {query.length > 1 ? (
          /* Results */
          loading ? (
            <View>
              <Text style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>Searching Open Food Facts...</Text>
              <ResponsiveFoodGrid>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                  <SkeletonCard key={i} style={styles.gridCard} />
                ))}
              </ResponsiveFoodGrid>
            </View>
          ) : (
            <View>
              <View style={styles.resultsHeaderRow}>
                <Text style={styles.resultsInfo}>
                  {displayed.length} results for <Text style={{ color: C.orange }}>"{query}"</Text>
                  {activeFilter ? <Text style={{ color: '#555' }}> · filtered</Text> : null}
                </Text>

                {/* View toggle (Grid / List) */}
                <View style={styles.viewToggleGroup}>
                  <TouchableOpacity
                    onPress={() => setViewMode('grid')}
                    style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
                  >
                    <LayoutGrid size={14} color={viewMode === 'grid' ? '#fff' : '#666'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setViewMode('list')}
                    style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                  >
                    <List size={14} color={viewMode === 'list' ? '#fff' : '#666'} />
                  </TouchableOpacity>
                </View>
              </View>

              {displayed.length === 0 ? (
                <View style={styles.noResults}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
                  <Text style={styles.noResultsTitle}>No results found</Text>
                  <Text style={styles.noResultsDesc}>Try a different search or remove filters</Text>
                </View>
              ) : viewMode === 'list' ? (
                <View style={{ flexDirection: 'column' }}>
                  {displayed.map(food => (
                    <FoodCardRow key={food.id || food.foodId} food={food} />
                  ))}
                </View>
              ) : (
                <ResponsiveFoodGrid>
                  {displayed.map(food => (
                    <FoodCardH key={food.id || food.foodId} food={food} style={styles.gridCard} />
                  ))}
                </ResponsiveFoodGrid>
              )}
            </View>
          )
        ) : (
          /* Discovery */
          <View>
            <Text style={styles.sectionTitle}>Quick Searches</Text>
            <View style={styles.quickSearchesGrid}>
              {QUICK_SEARCHES.map(s => (
                <TouchableOpacity key={s} onPress={() => setQuery(s)} style={styles.quickSearchChip}>
                  <Text style={styles.quickSearchText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Discover Products - Responsive Food Grid */}
            <View style={{ marginBottom: 24 }}>
              <View style={styles.discoverHeader}>
                <Sparkles size={16} color={C.orange} style={{ marginRight: 6 }} />
                <Text style={styles.discoverTitle}>Discover Products</Text>
                <Text style={styles.discoverSubtitle}>Random picks</Text>
                <TouchableOpacity
                  onPress={reloadRandom}
                  disabled={randomLoading}
                  style={styles.refreshButton}
                >
                  {randomLoading ? (
                    <ActivityIndicator size="small" color={C.orange} />
                  ) : (
                    <RefreshCw size={15} color={C.orange} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.gridContainer}>
                {randomLoading ? (
                  <ResponsiveFoodGrid>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <SkeletonCard key={i} style={styles.gridCard} />
                    ))}
                  </ResponsiveFoodGrid>
                ) : (
                  <ResponsiveFoodGrid>
                    {randomFoods.map(food => (
                      <FoodCardH key={food.id} food={food} style={styles.gridCard} />
                    ))}
                  </ResponsiveFoodGrid>
                )}
              </View>
            </View>

            {/* OFF info card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>🌍 Powered by Open Food Facts</Text>
              <Text style={styles.infoCardText}>
                3 million+ real food products with full nutrition data. Results are filtered and ranked by your dietary preferences and health goals.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: -4,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted2,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsScroll: {
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,53,0.15)',
  },
  suggestionChipText: {
    color: C.orange,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultsInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 15,
  },
  noResultsDesc: {
    color: '#555',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  quickSearchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickSearchChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
  },
  quickSearchText: {
    color: '#ccc',
    fontSize: 13,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  discoverTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  discoverSubtitle: {
    fontSize: 11,
    color: '#555',
    marginLeft: 'auto',
    marginRight: 8,
  },
  refreshButton: {
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
    borderRadius: 8,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 2,
    gap: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: C.orange,
  },
  gridContainer: {
    marginBottom: 16,
    width: '100%',
  },
  gridFallback: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  gridItem: {
    minHeight: 180,
    display: 'flex',
    flexDirection: 'column',
  },
  gridCard: {
    width: '100%',
    marginRight: 0,
    height: '100%',
    flex: 1,
  },
  infoCard: {
    backgroundColor: 'rgba(255,107,53,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
    marginBottom: 6,
  },
  infoCardText: {
    fontSize: 12,
    color: '#888',
    lineHeight: 20,
  },
});
