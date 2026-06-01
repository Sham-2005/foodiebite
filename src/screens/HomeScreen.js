import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, SlidersHorizontal, RefreshCw, CloudRain, MapPin, Thermometer, X, Trash2, Check, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { FoodCardH, SectionHeader, SkeletonCard, ErrorState, C } from '../components/UI';
import { useRecommendations, useWeatherContext } from '../hooks/useFoods';
import { describeWeatherContext } from '../services/weather';

const DIET_CATEGORIES = [
  { id: 'all',      label: 'All',       emoji: '🍽️' },
  { id: 'healthy',  label: 'Healthy',   emoji: '🥗' },
  { id: 'protein',  label: 'Protein',   emoji: '💪' },
  { id: 'lowcarb',  label: 'Low Carb',  emoji: '🥑' },
  { id: 'vegan',    label: 'Vegan',     emoji: '🌱' },
];

function filterByCategory(foods, cat) {
  if (cat === 'all') return foods;
  if (cat === 'healthy') return foods.filter(f => ['a', 'b'].includes(f.grade?.toLowerCase()));
  if (cat === 'protein') return foods.filter(f => f.protein >= 8);
  if (cat === 'lowcarb') return foods.filter(f => f.carbs <= 20);
  if (cat === 'vegan')   return foods.filter(f => f.labels.some(l => l.includes('vegan')));
  return foods;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user, preferences, notifications, markAllAsRead, clearNotification } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);

  const { weather, loading: weatherLoading, error: weatherError, reload: reloadWeather } = useWeatherContext();
  const { foods, loading, error, reload } = useRecommendations(preferences, 30, weather);

  const unreadCount = notifications.filter(n => !n.read).length;

  const name     = user?.name || 'there';
  const filtered = filterByCategory(foods, activeCategory);

  // Partition sections to make them distinct
  // Recommended shows balanced food recommendations (excluding very high protein items to minimize overlap)
  const recommendedFoods = activeCategory === 'all'
    ? filtered.filter(f => f.protein < 9).slice(0, 12)
    : filtered.slice(0, 12);

  // High Protein Picks explicitly sorts high protein items descending by protein density
  const proteinPicks = [...foods]
    .filter(f => f.protein >= 8)
    .sort((a, b) => b.protein - a.protein)
    .slice(0, 8);

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img 
            src="/logo.jpg" 
            alt="FoodieBite Logo" 
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: '50%', 
              objectFit: 'cover',
              border: `1.5px solid ${C.orange}`
            }} 
          />
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 2 }}>Good day,</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{name} 👋</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!loading && (
            <button onClick={() => { reloadWeather(); reload(); }} style={{ background: '#1e1e1e', border: `1px solid ${C.border}`, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <RefreshCw size={15} color="#ccc" />
            </button>
          )}
          <button 
            onClick={() => setShowNotifications(true)} 
            style={{ 
              background: '#1e1e1e', 
              border: `1px solid ${C.border}`, 
              borderRadius: '50%', 
              width: 36, 
              height: 36, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <Bell size={16} color="#ccc" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                background: C.orange,
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                width: 16,
                height: 16,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                padding: 4,
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                border: '1.5px solid #111318'
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{ margin: '0 16px 16px', background: '#1e1e1e', border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,107,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {weather?.rain > 0 ? <CloudRain size={18} color={C.orange} /> : <Thermometer size={18} color={C.orange} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {weatherLoading ? 'Checking weather...' : weather ? `Season: ${weather.season}` : 'Weather unavailable'}
          </div>
          <div style={{ fontSize: 11, color: '#777', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {weather ? describeWeatherContext(weather) : weatherError || 'Using your diet profile only'}
          </div>
        </div>
        {weather?.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#666', fontSize: 11, flexShrink: 0 }}>
            <MapPin size={12} />
            <span>{weather.location.source === 'browser' ? 'You' : 'Avadi'}</span>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ padding: '0 16px 16px' }}>
        <div onClick={() => navigate('/search')} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#1e1e1e', border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        }}>
          <Search size={16} color="#666" />
          <span style={{ fontSize: 14, color: '#555', flex: 1 }}>Search foods, nutrients...</span>
          <SlidersHorizontal size={16} color="#666" />
        </div>
      </div>

      {/* Preference banner */}
      <div style={{ margin: '0 16px 16px', background: 'linear-gradient(135deg,rgba(255,107,53,0.15),rgba(255,107,53,0.05))', borderRadius: 14, padding: '12px 14px', border: `1px solid rgba(255,107,53,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>Your Profile</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {preferences.dietType} · {preferences.healthGoals.map(g => g.replace(/_/g,' ')).join(', ')}
          </div>
        </div>
        <button onClick={() => navigate('/preferences')} style={{ background: 'none', border: `1px solid ${C.orange}44`, borderRadius: 8, color: C.orange, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          Edit
        </button>
      </div>

      {/* Categories */}
      <div style={{ padding: '0 16px 16px' }}>
        <SectionHeader title="Browse by Type" />
        <div className="scroll-row" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {DIET_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 14px', borderRadius: 12, flexShrink: 0, cursor: 'pointer',
              background: activeCategory === cat.id ? C.orange : '#1e1e1e',
              border: `1px solid ${activeCategory === cat.id ? C.orange : C.border}`,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20 }}>{cat.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: activeCategory === cat.id ? '#fff' : '#888' }}>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: '400px', 
              overflowY: 'auto',
              paddingRight: '5px',
      }}>
        {/* Recommended Foods */}
        <div style={{ padding: '0 16px 16px' }}>
          <SectionHeader
            title={`Recommended for You ${!loading && foods.length > 0 ? `(${recommendedFoods.length})` : ''}`}
            onViewAll={() => navigate('/recommendations-all?type=general')}
          />

          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading ? (
            <div className="scroll-row" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : recommendedFoods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#555' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <p style={{ fontSize: 13 }}>No foods found for this filter</p>
            </div>
          ) : (
            <div className="scroll-row" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {recommendedFoods.map(food => <FoodCardH key={food.id} food={food} />)}
            </div>
          )}
        </div>

        {/* High Protein section */}
        {!loading && proteinPicks.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <SectionHeader title="High Protein Picks 💪" onViewAll={() => navigate('/recommendations-all?type=protein')} />
            <div className="scroll-row" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {proteinPicks.map(food => <FoodCardH key={food.id} food={food} />)}
            </div>
          </div>
        )}
      </div>

      {/* Notifications Overlay Panel */}
      {showNotifications && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 17, 21, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Overlay inner card */}
          <div style={{
            background: C.card,
            borderBottom: `1px solid ${C.border}`,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            padding: '20px 16px 16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            maxHeight: '85%',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{ background: 'rgba(255,107,53,0.15)', color: C.orange, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: C.orange, 
                      fontSize: 12, 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Check size={14} />
                    Mark all read
                  </button>
                )}
                <button 
                  onClick={() => setShowNotifications(false)}
                  style={{ 
                    background: '#20242c', 
                    border: `1px solid ${C.border}`, 
                    borderRadius: '50%', 
                    width: 28, 
                    height: 28, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer' 
                  }}
                >
                  <X size={14} color="#fff" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="scroll-row" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>You're all caught up!</div>
                  <div style={{ fontSize: 12, color: C.muted2 }}>Check back later for personalized recommendations and updates.</div>
                </div>
              ) : (
                notifications.map(n => {
                  let IconComponent = Bell;
                  let iconBg = 'rgba(255, 255, 255, 0.05)';
                  let iconColor = C.muted;

                  if (n.type === 'welcome') {
                    IconComponent = Sparkles;
                    iconBg = 'rgba(255,107,53,0.12)';
                    iconColor = C.orange;
                  } else if (n.type === 'weather') {
                    IconComponent = CloudRain;
                    iconBg = 'rgba(59, 130, 246, 0.15)';
                    iconColor = '#3b82f6';
                  } else if (n.type === 'goal') {
                    IconComponent = AlertCircle;
                    iconBg = 'rgba(16, 185, 129, 0.15)';
                    iconColor = '#10b981';
                  }

                  return (
                    <div 
                      key={n.id} 
                      style={{ 
                        background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,107,53,0.04)',
                        border: `1px solid ${n.read ? C.border : 'rgba(255,107,53,0.15)'}`,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        gap: 12,
                        position: 'relative',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Unread dot indicator */}
                      {!n.read && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: C.orange
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{ 
                        width: 38, 
                        height: 38, 
                        borderRadius: 10, 
                        background: iconBg, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                      }}>
                        <IconComponent size={18} color={iconColor} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginBottom: 6 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{n.time}</span>
                        </div>
                      </div>

                      {/* Delete action */}
                      <button 
                        onClick={() => clearNotification(n.id)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer', 
                          alignSelf: 'center', 
                          padding: 4, 
                          color: '#555',
                          transition: 'color 0.2s'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* Transparent bottom to tap and dismiss */}
          <div style={{ flex: 1 }} onClick={() => setShowNotifications(false)} />
        </div>
      )}
    </AppLayout>
  );
}
