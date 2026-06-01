import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, ExternalLink, Check, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BtnOrange, GradeBadge, MacroChip, TagPill, FoodImageFallback, C } from '../components/UI';
import { getProductById, gradeColor, normaliseProduct } from '../services/openFoodFacts';
import { apiGetDeliveryLink } from '../services/api';

const GRADE_DESC = {
  a: 'Excellent nutritional quality',
  b: 'Good nutritional quality',
  c: 'Average nutritional quality',
  d: 'Poor nutritional quality',
  e: 'Very poor nutritional quality',
};

export default function FoodDetailScreen() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject, addToCart } = useApp();
  const [food, setFood] = useState(state?.food || null);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [loading, setLoading] = useState(!state?.food);
  const [error, setError] = useState('');
  const [loggedToast, setLoggedToast] = useState(false);

  function handleAddToDietLog() {
    setLoggedToast(true);
    setTimeout(() => setLoggedToast(false), 2500);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFood() {
      if (state?.food) {
        setFood(state.food);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      const product = await getProductById(id);
      if (cancelled) return;

      const normalised = normaliseProduct(product);
      if (normalised) {
        setFood(normalised);
      } else {
        setError('Food details not available.');
      }
      setLoading(false);
    }

    loadFood();
    return () => { cancelled = true; };
  }, [id, state]);

  useEffect(() => {
    let cancelled = false;

    async function loadDelivery() {
      if (!food?.name) return;

      try {
        const data = await apiGetDeliveryLink(food.name);
        if (!cancelled) {
          setDeliveryOptions(data.deliveryOptions || (data.delivery ? [data.delivery] : []));
        }
      } catch {
        if (!cancelled) {
          setDeliveryOptions([
            {
              provider: 'Swiggy Instamart',
              mode: 'search',
              url: `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(food.name)}`,
              label: 'Search on Swiggy Instamart',
            },
            {
              provider: 'Blinkit',
              mode: 'search',
              url: 'https://blinkit.com/s/',
              label: 'Open Blinkit search',
            },
            {
              provider: 'BigBasket',
              mode: 'search',
              url: 'https://www.bigbasket.com/search/',
              label: 'Open BigBasket search',
            },
            {
              provider: 'Zepto',
              mode: 'search',
              url: `https://www.zepto.com/search?query=${encodeURIComponent(food.name)}`,
              label: 'Search on Zepto',
            },
          ]);
        }
      }
    }

    loadDelivery();
    return () => { cancelled = true; };
  }, [food]);

  const isFav = food ? favorites.foods.includes(food.id) : false;

  function handleFav() {
    if (!food) return;
    isFav ? removeSavedFoodObject(food.id) : saveFoodObject(food);
    toggleFavoriteFood(food.id, food);
  }

  if (loading || !food) {
    return (
      <div className="phone-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🍽️</div>
        <p style={{ color: '#888' }}>{loading ? 'Loading food details...' : error || 'Food details not available.'}</p>
        {!loading && <button onClick={() => navigate(-1)} style={{ color: C.orange, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>← Go Back</button>}
      </div>
    );
  }

  const grade = food.grade?.toLowerCase();
  const gColor = gradeColor(grade);

  return (
    <div className="phone-frame" style={{ paddingBottom: 100}}>
      <div className="food-detail-hero" style={{ position: 'relative' }}>
        {food.image
          ? <img className="responsive-media" src={food.image} alt={food.name} onError={e => e.target.style.display = 'none'} />
          : <FoodImageFallback name={food.name} height="100%" />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(0,0,0,0.3) 0%,transparent 40%,#111 100%)' }} />

        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <button onClick={handleFav} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Heart size={18} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#fff'} />
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{food.name}</h1>
          <GradeBadge grade={grade} style={{ flexShrink: 0, marginTop: 3 }} />
        </div>

        {grade && grade !== 'unknown' && (
          <div style={{ background: `${gColor}18`, border: `1px solid ${gColor}44`, borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: gColor, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: gColor, fontWeight: 600 }}>{GRADE_DESC[grade] || 'Nutrition grade: ' + grade.toUpperCase()}</span>
          </div>
        )}

        {food.quantity && (
          <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>Package: {food.quantity}</p>
        )}

        {deliveryOptions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Order on delivery apps</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {deliveryOptions.map((option) => (
                <a
                  key={option.provider}
                  href={option.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 14,
                    padding: '12px 13px',
                    color: '#fff',
                    textDecoration: 'none',
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {option.provider}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {option.label}
                    </div>
                  </div>
                  <ExternalLink size={16} color={C.orange} style={{ flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <MacroChip label="Calories" value={food.calories} unit="kcal" />
          <MacroChip label="Protein" value={food.protein} unit="g" />
          <MacroChip label="Carbs" value={food.carbs} unit="g" />
          <MacroChip label="Fat" value={food.fat} unit="g" />
        </div>

        {(food.fiber > 0 || food.sugar > 0 || food.sodium > 0) && (
          <div style={{ background: C.card, borderRadius: 14, padding: '14px', marginBottom: 20, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Full Nutrition (per 100g)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {food.fiber > 0 && <NutrientRow label="Fiber" value={`${food.fiber}g`} color="#43a047" />}
              {food.sugar > 0 && <NutrientRow label="Sugar" value={`${food.sugar}g`} color="#e53935" />}
              {food.sodium > 0 && <NutrientRow label="Sodium" value={`${food.sodium}mg`} color="#1e88e5" />}
            </div>
          </div>
        )}

        {food.labels?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Labels & Certifications</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {food.labels.slice(0, 8).map(l => (
                <TagPill key={l} label={l.replace('en:', '').replace(/-/g, ' ')} />
              ))}
            </div>
          </div>
        )}

        {food.allergens?.length > 0 && (
          <div style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: 14, padding: '12px 14px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#ff6b6b', marginBottom: 8 }}>Contains Allergens</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {food.allergens.map(a => (
                <span key={a} style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(229,57,53,0.15)', color: '#ff6b6b', fontSize: 11, fontWeight: 600 }}>
                  {a.replace('en:', '').replace(/-/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 4px', borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, color: '#555' }}>Source: Open Food Facts</span>
          <ExternalLink size={11} color="#555" />
        </div>
      </div>

      {/* Floating success toast */}
      {loggedToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#1e8a3e', color: '#fff', padding: '10px 18px', borderRadius: 20,
          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          fontSize: 13, fontWeight: 700, zIndex: 2000, whiteSpace: 'nowrap'
        }}>
          <Check size={16} /> Logged {food.calories} kcal to your daily diet!
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div style={{
        position: 'sticky', bottom: 0,
        width: '100%',
        background: 'rgba(17,19,24,0.95)', borderTop: `1px solid ${C.border}`,
        backdropFilter: 'blur(20px)',
        padding: '12px 16px min(16px, env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 12,
        boxSizing: 'border-box', zIndex: 999,
      }}>
        <button
          onClick={handleFav}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            width: 46,
            height: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0
          }}
        >
          <Heart size={20} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#ccc'} />
        </button>

        <button
          onClick={handleAddToDietLog}
          style={{
            flex: 1,
            background: C.orange,
            border: 'none',
            borderRadius: 12,
            height: 46,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'opacity 0.2s'
          }}
        >
          <Flame size={16} /> Add to Daily Diet Tracker
        </button>
      </div>
    </div>
  );
}

function NutrientRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, color: '#ccc' }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</span>
    </div>
  );
}
