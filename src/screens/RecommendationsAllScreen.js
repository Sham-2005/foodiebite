import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Flame, ShieldCheck } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { FoodCardRow, C } from '../components/UI';
import { useRecommendations } from '../hooks/useFoods';
import { useApp } from '../context/AppContext';

export default function RecommendationsAllScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'general'; // 'general' or 'protein'
  
  const { preferences } = useApp();
  const { foods, loading } = useRecommendations(preferences, 40);
  const [visibleCount, setVisibleCount] = React.useState(10);

  // Partition the lists to match HomeScreen logic
  const recommendedFoods = foods.filter(f => f.protein < 9);
  const proteinPicks = [...foods]
    .filter(f => f.protein >= 8)
    .sort((a, b) => b.protein - a.protein);

  const displayedFoods = type === 'protein' ? proteinPicks : recommendedFoods;
  const title = type === 'protein' ? 'High Protein Picks' : 'Personalized For You';
  const subtitle = type === 'protein' 
    ? 'High-density protein selections optimized for muscle growth and recovery.' 
    : 'Balanced foods tailored specifically to your diet, goals, and season.';
  const Icon = type === 'protein' ? Flame : Sparkles;

  return (
    <AppLayout>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#1e1e1e', border: `1px solid ${C.border}`,
            borderRadius: '50%', width: 36, height: 36,
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
          {title}
        </h1>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 16px 80px' }}>
        {/* Intro Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(255,107,53,0.02))',
          borderRadius: 16, padding: '16px 18px',
          border: `1px solid rgba(255,107,53,0.15)`, marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Icon size={16} color={C.orange} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {type === 'protein' ? 'Muscle Fuel' : 'AI Recommendation'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            {subtitle}
          </p>
        </div>

        {/* Results List */}
        <div>
          {loading && displayedFoods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
              Loading curated selections...
            </div>
          ) : displayedFoods.length === 0 ? (
            <div style={{
              background: '#1e1e1e', borderRadius: 14, padding: '40px 16px',
              border: `1px solid ${C.border}`, textAlign: 'center', color: C.muted
            }}>
              <ShieldCheck size={40} color={C.muted2} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 13 }}>No matching foods currently found</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444' }}>Try adjusting your diet preferences</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 12, color: C.muted2, marginBottom: 12, fontWeight: 600 }}>
                Showing {Math.min(visibleCount, displayedFoods.length)} of {displayedFoods.length} premium products
              </p>
              {displayedFoods.slice(0, visibleCount).map(food => (
                <FoodCardRow key={food.id} food={food} />
              ))}

              {/* Load More Button */}
              {displayedFoods.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '13px',
                    borderRadius: 12,
                    background: 'rgba(255,107,53,0.08)',
                    border: `1px solid rgba(255,107,53,0.2)`,
                    color: C.orange,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  className="tap-button"
                >
                  Load More Products
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
