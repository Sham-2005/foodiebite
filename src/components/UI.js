import React from 'react';
import { Heart, Flame } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { gradeColor, gradeLabel } from '../services/openFoodFacts';

export const C = {
  bg: '#111318', card: '#171a20', card2: '#20242c',
  border: 'rgba(255,255,255,0.08)', orange: '#FF6B35', text: '#ffffff',
  muted: '#a0a7b4', muted2: '#6f7785', input: '#171a20', inputB: 'rgba(255,255,255,0.1)',
};

export function BtnOrange({ children, onClick, style, disabled, outline }) {
  return (
    <button disabled={disabled} onClick={onClick} className="tap-button" style={{
      width: '100%', padding: '14px', borderRadius: 12,
      fontWeight: 700, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'opacity 0.2s',
      background: outline ? 'transparent' : C.orange,
      color: outline ? C.orange : '#fff',
      border: outline ? `1.5px solid ${C.orange}` : 'none', ...style,
    }}>{children}</button>
  );
}

export function TextInput({ icon: Icon, placeholder, value, onChange, type = 'text', rightIcon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: C.input, border: `1px solid ${C.inputB}`,
      borderRadius: 10, padding: '12px 14px',
    }}>
      {Icon && <Icon size={18} color={C.muted} />}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{ flex: 1, background: 'none', border: 'none', color: C.text, fontSize: 14, outline: 'none' }} />
      {rightIcon}
    </div>
  );
}

export function GradeBadge({ grade, style }) {
  const color = gradeColor(grade);
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 6, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 13, color: '#fff', ...style,
    }}>{gradeLabel(grade)}</div>
  );
}

export function TagPill({ label, style }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20,
      background: 'rgba(255,107,53,0.12)', color: C.orange,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', ...style,
    }}>{label}</span>
  );
}

export function FoodImageFallback({ name, height = 100, width = '100%' }) {
  const colors = ['#2a1f1a', '#1a2a1f', '#1a1a2a', '#2a2a1a'];
  const bg     = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const emojis = ['🥗', '🍲', '🥙', '🫙', '🥘', '🍱'];
  const emoji  = emojis[(name?.charCodeAt(0) || 0) % emojis.length];
  return (
    <div className="responsive-media" style={{ width, height, minHeight: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span style={{ fontSize: typeof height === 'number' ? height * 0.28 : 'clamp(20px, 8vw, 34px)' }}>{emoji}</span>
      <span style={{ fontSize: 10, color: '#555', textAlign: 'center', padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '90%' }}>
        {name?.slice(0, 18)}
      </span>
    </div>
  );
}

export function FoodCardH({ food }) {
  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject } = useApp();
  const isFav = favorites.foods.includes(food.id);
  const navigate = useNavigate();
  const [imgError, setImgError] = React.useState(false);

  function handleFav(e) {
    e.stopPropagation();
    isFav ? removeSavedFoodObject(food.id) : saveFoodObject(food);
    toggleFavoriteFood(food.id, food);
  }
  return (
    <div className="tap-card" onClick={() => navigate(`/food/${food.id}`, { state: { food } })}
      style={{ background: C.card, borderRadius: 14, overflow: 'hidden', width: '150px', flexShrink: 0, cursor: 'pointer', border: `1px solid ${C.border}` }}>
      <div className="food-card-media" style={{ position: 'relative', overflow: 'hidden' }}>
        {food.image && !imgError
          ? <img className="responsive-media" src={food.image} alt={food.name} onError={() => setImgError(true)} />
          : <FoodImageFallback name={food.name} height="100%" />}
        <button onClick={handleFav} style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Heart size={13} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : '#fff'} />
        </button>
        <GradeBadge grade={food.grade} style={{ position: 'absolute', bottom: 7, left: 7 }} />
      </div>
      <div style={{ padding: '9px 10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{food.name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Flame size={10} color={C.orange} />{food.calories} kcal · {food.protein}g protein
        </div>
      </div>
    </div>
  );
}

export function FoodCardRow({ food }) {
  const { favorites, toggleFavoriteFood, saveFoodObject, removeSavedFoodObject } = useApp();
  const isFav = favorites.foods.includes(food.id);
  const navigate = useNavigate();
  const [imgError, setImgError] = React.useState(false);

  function handleFav(e) {
    e.stopPropagation();
    isFav ? removeSavedFoodObject(food.id) : saveFoodObject(food);
    toggleFavoriteFood(food.id, food);
  }
  return (
    <div className="tap-card" onClick={() => navigate(`/food/${food.id}`, { state: { food } })}
      style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.card, borderRadius: 14, padding: 12, border: `1px solid ${C.border}`, cursor: 'pointer', marginBottom: 10 }}>
      <div className="food-row-media" style={{ position: 'relative', flexShrink: 0 }}>
        {food.image && !imgError
          ? <img className="responsive-media" src={food.image} alt={food.name} style={{ borderRadius: 10 }} onError={() => setImgError(true)} />
          : <FoodImageFallback name={food.name} height="100%" width="100%" />}
        <GradeBadge grade={food.grade} style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, fontSize: 11, borderRadius: 5 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{food.name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>{food.calories} kcal · {food.protein}g protein · {food.carbs}g carbs</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(food.labels || []).slice(0, 2).map(l => (
            <TagPill key={l} label={l.replace('en:', '').replace(/-/g, ' ')} style={{ fontSize: 10 }} />
          ))}
        </div>
      </div>
      <button onClick={handleFav} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
        <Heart size={20} fill={isFav ? '#ff4d6d' : 'transparent'} color={isFav ? '#ff4d6d' : C.muted} />
      </button>
    </div>
  );
}

function Shimmer({ style }) {
  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ background: 'linear-gradient(90deg,#2a2a2a 25%,#343434 50%,#2a2a2a 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', ...style }} />
    </>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: C.card, borderRadius: 14, overflow: 'hidden', width: '100%', flexShrink: 0, border: `1px solid ${C.border}` }}>
      <Shimmer style={{ aspectRatio: '4 / 3', minHeight: 96, maxHeight: 132 }} />
      <div style={{ padding: '9px 10px 12px' }}>
        <Shimmer style={{ height: 12, borderRadius: 6, marginBottom: 6, width: '80%' }} />
        <Shimmer style={{ height: 10, borderRadius: 6, width: '55%' }} />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="tap-card" style={{ display: 'flex', gap: 12, alignItems: 'center', background: C.card, borderRadius: 14, padding: 12, border: `1px solid ${C.border}`, marginBottom: 10 }}>
      <Shimmer style={{ width: 'clamp(58px, 18vw, 74px)', aspectRatio: '1', borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Shimmer style={{ height: 13, borderRadius: 6, marginBottom: 7, width: '70%' }} />
        <Shimmer style={{ height: 11, borderRadius: 6, marginBottom: 7, width: '50%' }} />
        <Shimmer style={{ height: 18, borderRadius: 10, width: '35%' }} />
      </div>
    </div>
  );
}

export function MacroChip({ label, value, unit }) {
  return (
    <div style={{ flex: 1, background: C.card2, borderRadius: 10, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{value}</span>
      <span style={{ fontSize: 10, color: C.muted }}>{unit || 'g'}</span>
      <span style={{ fontSize: 10, color: C.orange, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export function SectionHeader({ title, onViewAll }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</span>
      {onViewAll && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: C.orange, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View all</button>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
      <p style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>Couldn't load foods</p>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>{message}</p>
      {onRetry && <button onClick={onRetry} style={{ padding: '10px 24px', borderRadius: 10, background: C.orange, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Retry</button>}
    </div>
  );
}

export function BackHeader({ title, right }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
      <button onClick={() => navigate(-1)} style={{ background: '#1e1e1e', border: `1px solid ${C.border}`, borderRadius: '50%', width: 34, height: 34, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
      {title && <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>}
      <div>{right || <span style={{ width: 34, display: 'block' }} />}</div>
    </div>
  );
}
