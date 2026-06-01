import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BtnOrange, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { CUISINE_OPTIONS, HEALTH_GOALS } from '../data/mockData';

export default function PreferencesScreen() {
  const navigate = useNavigate();
  const { preferences, setPreferences } = useApp();

  const [dietType, setDietType]     = useState(preferences.dietType);
  const [spiceLevel, setSpiceLevel] = useState(preferences.spiceLevel);
  const [cuisines, setCuisines]     = useState(preferences.cuisines);
  const [goals, setGoals]           = useState(preferences.healthGoals);
  const [country, setCountry]       = useState(preferences.country || 'in');

  function toggleCuisine(id) {
    setCuisines(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }
  function toggleGoal(id) {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

  function handleSave() {
    setPreferences({ dietType, spiceLevel, cuisines, healthGoals: goals, country, allergies: [] });
    navigate('/home');
  }

  const choiceBtn = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: '9px 20px', borderRadius: 20,
      background: active ? C.orange : '#1e1e1e',
      color: active ? '#fff' : '#888',
      border: `1px solid ${active ? C.orange : '#2e2e2e'}`,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.2s',
    }}>
      {label}
    </button>
  );

  return (
    <div className="phone-frame" style={{
      padding: '0 20px 32px',
      display: 'flex', flexDirection: 'column',
    }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '20px 0 0', fontSize: 20, alignSelf: 'flex-start' }}>←</button>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 12, marginBottom: 4 }}>Tell us about you</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 28 }}>This helps us recommend better food for you</p>

      {/* Diet Type */}
      <div style={{ marginBottom: 24 }}>
        <Label>Diet Type</Label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['Vegetarian', 'Non Vegetarian'].map(d => choiceBtn(d, dietType === d, () => setDietType(d)))}
        </div>
      </div>

      {/* Spice Level */}
      <div style={{ marginBottom: 24 }}>
        <Label>Spice Level</Label>
        <div style={{ display: 'flex', gap: 10 }}>
          {['Mild', 'Medium', 'Spicy'].map(s => choiceBtn(s, spiceLevel === s, () => setSpiceLevel(s)))}
        </div>
      </div>

      {/* Country / Region Recommendations */}
      <div style={{ marginBottom: 24 }}>
        <Label>Country/Region Recommendations</Label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'in', label: 'India 🇮🇳' },
            { id: 'us', label: 'United States 🇺🇸' },
            { id: 'gb', label: 'United Kingdom 🇬🇧' },
            { id: 'world', label: 'International 🌐' }
          ].map(c => choiceBtn(c.label, country === c.id, () => setCountry(c.id)))}
        </div>
      </div>

      {/* Favourite Cuisines */}
      <div style={{ marginBottom: 24 }}>
        <Label>Favorite Cuisines</Label>
        <div style={{ display: 'flex', gap: 14 }}>
          {CUISINE_OPTIONS.map(({ id, label, emoji }) => (
            <div key={id} onClick={() => toggleCuisine(id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: cuisines.includes(id) ? 'rgba(255,107,53,0.15)' : '#1e1e1e',
                border: `2px solid ${cuisines.includes(id) ? C.orange : '#2e2e2e'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, transition: 'all 0.2s',
              }}>
                {emoji}
              </div>
              <span style={{ fontSize: 11, color: cuisines.includes(id) ? C.orange : '#666', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Health Goals */}
      <div style={{ marginBottom: 32 }}>
        <Label>Health Goals</Label>
        <div style={{ display: 'flex', gap: 14 }}>
          {HEALTH_GOALS.map(({ id, label, emoji }) => (
            <div key={id} onClick={() => toggleGoal(id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <div style={{
                width: 54, height: 54, borderRadius: 14,
                background: goals.includes(id) ? 'rgba(255,107,53,0.15)' : '#1e1e1e',
                border: `2px solid ${goals.includes(id) ? C.orange : '#2e2e2e'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, transition: 'all 0.2s',
              }}>
                {emoji}
              </div>
              <span style={{ fontSize: 10, color: goals.includes(id) ? C.orange : '#666', fontWeight: 600, textAlign: 'center', maxWidth: 60 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <BtnOrange onClick={handleSave}>Save &amp; Continue</BtnOrange>
    </div>
  );
}

function Label({ children }) {
  return <p style={{ fontSize: 14, fontWeight: 700, color: '#ccc', marginBottom: 12 }}>{children}</p>;
}
