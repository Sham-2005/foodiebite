import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Sparkles, ChevronRight, Activity, Smile, ArrowRight, 
  ShieldCheck, Scale, Ruler, Heart, CheckCircle2, AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiCompleteProfile } from '../services/api';
import { C, BtnOrange } from '../components/UI';

const DIET_TYPES = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Keto'];
const GENDERS = ['Male', 'Female', 'Other'];
const ACTIVITY_LEVELS = [
  { value: 'Sedentary', label: 'Little to no exercise' },
  { value: 'Lightly Active', label: 'Light exercise (1-3 days/wk)' },
  { value: 'Moderately Active', label: 'Moderate exercise (3-5 days/wk)' },
  { value: 'Very Active', label: 'Heavy exercise (6-7 days/wk)' }
];

export default function CompleteProfileScreen() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  
  // Unauthenticated guard
  useEffect(() => {
    if (!user) {
      navigate('/signin');
    }
  }, [user]);
  
  // Form states
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('Sedentary');
  const [dietType, setDietType] = useState('Vegetarian');
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', msg }

  // Validator
  function validate() {
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) {
      setToast({ type: 'error', msg: 'Please enter a valid age (1 - 120 years).' });
      return false;
    }
    if (!gender) {
      setToast({ type: 'error', msg: 'Please select your gender.' });
      return false;
    }
    if (!height || isNaN(height) || parseInt(height) < 50 || parseInt(height) > 250) {
      setToast({ type: 'error', msg: 'Please enter a valid height (50 - 250 cm).' });
      return false;
    }
    if (!weight || isNaN(weight) || parseFloat(weight) < 20 || parseFloat(weight) > 300) {
      setToast({ type: 'error', msg: 'Please enter a valid weight (20 - 300 kg).' });
      return false;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setToast(null);
    try {
      const res = await apiCompleteProfile({
        age: parseInt(age),
        gender,
        height: parseInt(height),
        weight: parseFloat(weight),
        activityLevel,
        dietType
      });

      if (res.success && res.user) {
        setUser(res.user);
        setToast({ type: 'success', msg: 'Profile completed successfully! Redirecting...' });
        setTimeout(() => navigate('/home'), 1200);
      } else {
        throw new Error('Failed to update profile records.');
      }
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to complete profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      
      {/* Container */}
      <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto', paddingBottom: 60 }}>
        
        {/* Title bar / Header onboarding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0 28px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,107,53,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: C.orange }}>
            <Sparkles size={32} />
          </div>
          
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#fff', fontWeight: 800, letterSpacing: -0.3 }}>
            Complete Your Profile 🥗
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, padding: '0 20px' }}>
            We need a few biological metrics to calculate your target calorie equations and formulate meal plans.
          </p>
        </div>

        {/* Dynamic Toasts */}
        {toast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 14px', borderRadius: 12, marginBottom: 20, boxSizing: 'border-box',
            background: toast.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(255,77,109,0.08)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(255,77,109,0.2)'}`,
            color: toast.type === 'success' ? '#4ade80' : '#ff4d6d',
            fontSize: 12, fontWeight: 500, textAlign: 'left'
          }}>
            {toast.type === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{toast.msg}</span>
          </div>
        )}

        {/* Questionnaire Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Row 1: Age & Height */}
          <div style={{ display: 'flex', gap: 14 }}>
            
            {/* Age field */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Age (Years)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, padding: '12px 14px' }}>
                <Smile size={16} color={C.muted2} />
                <input 
                  type="number" 
                  value={age} 
                  onChange={e => setAge(e.target.value)} 
                  placeholder="24"
                  style={{ width: '100%', background: 'none', border: 'none', color: C.text, fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            {/* Height field */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Height (cm)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, padding: '12px 14px' }}>
                <Ruler size={16} color={C.muted2} />
                <input 
                  type="number" 
                  value={height} 
                  onChange={e => setHeight(e.target.value)} 
                  placeholder="175"
                  style={{ width: '100%', background: 'none', border: 'none', color: C.text, fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

          </div>

          {/* Row 2: Weight & Gender Selector */}
          <div style={{ display: 'flex', gap: 14 }}>
            
            {/* Weight field */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Weight (kg)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, padding: '12px 14px' }}>
                <Scale size={16} color={C.muted2} />
                <input 
                  type="number" 
                  step="0.1"
                  value={weight} 
                  onChange={e => setWeight(e.target.value)} 
                  placeholder="70.5"
                  style={{ width: '100%', background: 'none', border: 'none', color: C.text, fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            {/* Gender buttons */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Gender
              </label>
              <div style={{ display: 'flex', background: '#1c1e24', padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, height: 44, boxSizing: 'border-box' }}>
                {GENDERS.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    style={{
                      flex: 1, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700,
                      background: gender === g ? C.orange : 'transparent',
                      color: gender === g ? '#fff' : C.muted, cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Diet Type Cards */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Select Diet Type
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DIET_TYPES.map(diet => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => setDietType(diet)}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: `1.5px solid ${dietType === diet ? C.orange : C.border}`,
                    background: dietType === diet ? 'rgba(255,107,53,0.12)' : 'rgba(255,255,255,0.02)',
                    color: dietType === diet ? C.orange : C.muted,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {diet}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Level Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Activity Level
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ACTIVITY_LEVELS.map(act => (
                <div
                  key={act.value}
                  onClick={() => setActivityLevel(act.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 12, background: C.card, border: `1.5px solid ${activityLevel === act.value ? C.orange : C.border}`,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', border: `2.5px solid ${activityLevel === act.value ? C.orange : C.muted2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {activityLevel === act.value && <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.orange }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{act.value}</div>
                    <div style={{ fontSize: 10, color: C.muted2, marginTop: 1 }}>{act.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div style={{ marginTop: 12 }}>
            <BtnOrange type="submit" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <RefreshCw size={15} className="spin-icon" /> Completing Onboarding...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  Save Profile & Begin <ArrowRight size={16} />
                </span>
              )}
            </BtnOrange>
          </div>

        </form>

      </div>
    </div>
  );
}

// Simple internal CSS utility mapping keyframe triggers
const styleNode = document.createElement('style');
styleNode.innerHTML = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .spin-icon { animation: spin 1.4s linear infinite; }
`;
document.head.appendChild(styleNode);
