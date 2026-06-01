import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, SlidersHorizontal, Sparkles, RefreshCw } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { FoodCardRow, FoodCardH, SkeletonRow, SkeletonCard, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { useSearch, useRandomProducts } from '../hooks/useFoods';
import { LOCAL_PRODUCTS } from '../services/openFoodFacts';

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

export default function SearchScreen() {
  const navigate = useNavigate();
  const { preferences } = useApp();
  const [query, setQuery]           = useState('');
  const [activeFilter, setActiveFilter] = useState('');

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
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#1e1e1e', border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px 14px' }}>
          <Search size={16} color="#666" />
          <input
            autoFocus
            placeholder="Search real foods from Open Food Facts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search Suggestions Autocomplete */}
      {query.length > 0 && filteredSuggestions.length > 0 && (
        <div style={{ padding: '0 16px 10px', marginTop: -4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggestions</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filteredSuggestions.slice(0, 5).map(s => (
              <button 
                key={s} 
                onClick={() => setQuery(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,107,53,0.08)',
                  border: `1.5px solid rgba(255,107,53,0.15)`,
                  color: C.orange,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🔍 {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '0 16px 12px' }}>
        <div className="scroll-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTER_OPTIONS.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(v => v === f.id ? '' : f.id)} style={{
              padding: '7px 14px', borderRadius: 20, flexShrink: 0, cursor: 'pointer',
              background: activeFilter === f.id ? C.orange : '#1e1e1e',
              color: activeFilter === f.id ? '#fff' : '#888',
              border: `1px solid ${activeFilter === f.id ? C.orange : '#2a2a2a'}`,
              fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {query.length > 1 ? (
        /* Results */
        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>Searching Open Food Facts...</div>
              {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
                {displayed.length} results for <span style={{ color: C.orange }}>"{query}"</span>
                {activeFilter && <span style={{ color: '#555' }}> · filtered</span>}
              </p>
              {displayed.length === 0
                ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                    <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>No results found</p>
                    <p style={{ color: '#555', fontSize: 13 }}>Try a different search or remove filters</p>
                  </div>
                )
                : displayed.map(food => <FoodCardRow key={food.id} food={food} />)
              }
            </>
          )}
        </div>
      ) : (
        /* Discovery */
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Quick Searches</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {QUICK_SEARCHES.map(s => (
              <button key={s} onClick={() => setQuery(s)} style={{
                padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
                background: '#1e1e1e', border: `1px solid ${C.border}`,
                color: '#ccc', fontSize: 13,
              }}>
                {s}
              </button>
            ))}
          </div>

          {/* Discover Products */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={16} color={C.orange} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Discover Products</span>
              <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto', marginRight: 8 }}>Random picks</span>
              <button
                onClick={reloadRandom}
                disabled={randomLoading}
                style={{
                  background: 'rgba(255,107,53,0.12)', border: `1px solid rgba(255,107,53,0.25)`,
                  borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: randomLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <RefreshCw
                  size={15}
                  color={C.orange}
                  style={{
                    animation: randomLoading ? 'spin 0.8s linear infinite' : 'none',
                  }}
                />
              </button>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              maxHeight: '350px', 
              overflowY: 'auto',
              paddingRight: '5px',
            }}>
              {randomLoading
                ? [1,2,3,4].map(i => <SkeletonCard key={i} />)
                : randomFoods.map(food => (
                    <FoodCardH key={food.id} food={food} />
                  ))
              }
            </div>
          </div>

          {/* OFF info card */}
          <div style={{ background: 'rgba(255,107,53,0.07)', border: `1px solid rgba(255,107,53,0.2)`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, marginBottom: 6 }}>🌍 Powered by Open Food Facts</div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7 }}>
              3 million+ real food products with full nutrition data. Results are filtered and ranked by your dietary preferences and health goals.
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
