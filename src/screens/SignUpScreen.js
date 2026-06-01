import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import { BtnOrange, TextInput, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { apiRegister, apiLoginWithGoogle } from '../services/api';

const DIETARY_OPTIONS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Keto', 'Diabetic Friendly'];

function getPrimaryDietType(dietary) {
  if (dietary.includes('Vegetarian')) return 'Vegetarian';
  if (dietary.includes('Vegan')) return 'Vegetarian';
  if (dietary.includes('Eggetarian')) return 'Vegetarian';
  if (dietary.includes('Non-Vegetarian')) return 'Non Vegetarian';
  return 'Vegetarian';
}

function isBackendOfflineError(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(err?.message || '');
}

export default function SignUpScreen() {
  const navigate = useNavigate();
  const { setUser, setPreferences } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', dietary: [],gender: '',age: '' });
  const [showPass, setShowPass] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true); setError('');
    try {
      const data = await apiLoginWithGoogle();
      setUser(data.user);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Google Sign In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handle(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  function toggleDietary(option) {
    setForm(f => ({
      ...f,
      dietary: f.dietary.includes(option)
        ? f.dietary.filter(item => item !== option)
        : [...f.dietary, option],
    }));
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.password || !form.gender || !form.age) {
      setError('Please fill all required fields.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const selectedDietary = form.dietary.length ? form.dietary : ['Vegetarian'];
    const dietType = getPrimaryDietType(selectedDietary);
    const preferences = {
      dietType,
      spiceLevel: 'Medium',
      cuisines: ['indian'],
      healthGoals: ['healthy_eating'],
      allergies: selectedDietary.includes('Diabetic Friendly') ? ['Diabetic Friendly'] : [],
      dietaryPreferences: selectedDietary,
      maxCalories: null,
      minProtein: null,
      minGrade: 'c',
    };

    try {
      const data = await apiRegister({ 
        name: form.name, 
        email: form.email, 
        password: form.password, 
        dietType, 
        preferences,
        age: parseInt(form.age) || '',
        gender: form.gender || ''
      });
      setUser({ ...data.user, preferences: { ...(data.user?.preferences || {}), ...preferences } });
      setPreferences(preferences);
      
      // Registration successful! No verification email required now.
      
      navigate('/complete-profile');
    } catch (err) {
      if (!isBackendOfflineError(err)) {
        setError(err.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setUser({
        id: `local-${Date.now()}`,
        name: form.name,
        email: form.email,
        age: form.age,
        gender: form.gender,
        preferences,
        isLocalOnly: true,
      });
      setPreferences(preferences);
      navigate('/preferences');
    } finally {
      setLoading(false);
    }
  }

  const dietaryLabel = form.dietary.length ? form.dietary.join(', ') : 'Dietary Preferences';

  return (
    <div className="phone-frame" style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '20px 0 0', fontSize: 20, alignSelf: 'flex-start' }}>&larr;</button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Create Account</h1>
        <p style={{ color: '#777', fontSize: 14, marginBottom: 32 }}>Start your healthy journey</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextInput icon={User} placeholder="Full Name" value={form.name} onChange={handle('name')} />
          <TextInput icon={Mail} placeholder="Email" value={form.email} onChange={handle('email')} type="email" />
          <TextInput
            icon={Lock}
            placeholder="Password"
            value={form.password}
            onChange={handle('password')}
            type={showPass ? 'text' : 'password'}
            rightIcon={<button onClick={() => setShowPass(v => !v)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
          />
          <TextInput icon={Lock} placeholder="Confirm Password" value={form.confirm} onChange={handle('confirm')} type="password" />

          {/* Age and Gender Inputs */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                placeholder="Age"
                value={form.age}
                onChange={handle('age')}
                style={{
                  width: '100%',
                  background: '#1e1e1e',
                  border: '1px solid #2e2e2e',
                  borderRadius: 10,
                  padding: '13px 14px',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: 1.2 }}>
              <select
                value={form.gender}
                onChange={handle('gender')}
                style={{
                  width: '100%',
                  background: '#1e1e1e',
                  border: '1px solid #2e2e2e',
                  borderRadius: 10,
                  padding: '13px 14px',
                  color: form.gender ? '#fff' : '#555',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowDropdown(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 10, padding: '13px 14px', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: form.dietary.length ? '#fff' : '#555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{dietaryLabel}</span>
              <ChevronDown size={16} color="#666" />
            </div>

            {showDropdown && (
              <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 99, background: '#252525', borderRadius: 10, border: '1px solid #333', overflow: 'hidden', boxShadow: '0 16px 34px rgba(0,0,0,0.34)' }}>
                {DIETARY_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleDietary(opt)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', fontSize: 14, cursor: 'pointer', color: form.dietary.includes(opt) ? C.orange : '#ccc', background: form.dietary.includes(opt) ? 'rgba(255,107,53,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid #2a2a2a', textAlign: 'left' }}
                  >
                    <span>{opt}</span>
                    {form.dietary.includes(opt) && <Check size={15} />}
                  </button>
                ))}
                <button onClick={() => setShowDropdown(false)} style={{ width: '100%', padding: '11px 16px', fontSize: 13, cursor: 'pointer', color: '#fff', background: C.orange, border: 'none', fontWeight: 700 }}>
                  Done
                </button>
              </div>
            )}
          </div>

          {form.dietary.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {form.dietary.map(opt => (
                <button
                  key={opt}
                  onClick={() => toggleDietary(opt)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 16, background: 'rgba(255,107,53,0.12)', color: C.orange, border: '1px solid rgba(255,107,53,0.24)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {opt}
                  <span style={{ color: '#ffb399' }}>x</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: '#ff4d6d', fontSize: 12, marginTop: 8 }}>{error}</p>}
        <div style={{ marginTop: 28 }}>
          <BtnOrange onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</BtnOrange>
        </div>
        <div style={{ marginTop: 12 }}>
          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              background: '#1a1d24', border: `1.5px solid ${C.border}`,
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'background 0.2s'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.48 0-6.3-2.82-6.3-6.3s2.82-6.3 6.3-6.3c1.8 0 3.42.72 4.635 1.935L21.78 4.86C19.44 2.52 16.02 1.1 12.24 1.1 5.94 1.1 1 6.04 1 12.34s4.94 11.24 11.24 11.24c6.18 0 11.24-5.06 11.24-11.24 0-.78-.06-1.56-.24-2.28H12.24z"/>
            </svg>
            Continue with Google
          </button>
        </div>
        <p style={{ textAlign: 'center', color: '#666', fontSize: 13, marginTop: 20 }}>
          Already have an account?{' '}
          <span onClick={() => navigate('/signin')} style={{ color: C.orange, fontWeight: 700, cursor: 'pointer' }}>Sign In</span>
        </p>
      </div>
    </div>
  );
}
