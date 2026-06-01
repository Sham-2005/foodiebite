import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, X } from 'lucide-react';
import { BtnOrange, TextInput, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { apiLogin, apiLoginWithGoogle, apiForgotPassword } from '../services/api';

export default function SignInScreen() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // ── Forgot Password states ──
  const [resetModal, setResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState(null); // { type: 'success'|'error', msg }

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

  async function handleSignIn() {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiLogin({ email, password });
      setUser(data.user);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetEmail) {
      setResetMsg({ type: 'error', msg: 'Please enter your email address.' });
      return;
    }
    setResetLoading(true);
    setResetMsg(null);
    try {
      await apiForgotPassword(resetEmail);
      setResetMsg({ type: 'success', msg: 'Password reset link sent successfully! Check your inbox.' });
      setTimeout(() => {
        setResetModal(false);
        setResetMsg(null);
      }, 2500);
    } catch (err) {
      setResetMsg({ type: 'error', msg: err.message || 'Failed to send password reset link.' });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="phone-frame" style={{ padding:'0 24px', display:'flex', flexDirection:'column' }}>
      <button onClick={() => navigate(-1)} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:'20px 0 0', fontSize:20, alignSelf:'flex-start' }}>←</button>

      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', paddingBottom:40 }}>
        <h1 style={{ fontSize:30, fontWeight:800, color:'#fff', marginBottom:6 }}>Welcome Back! 👋</h1>
        <p style={{ color:'#777', fontSize:14, marginBottom:36 }}>Sign in to continue</p>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <TextInput icon={Mail} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
          <TextInput icon={Lock} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type={showPass ? 'text' : 'password'}
            rightIcon={<button onClick={() => setShowPass(v=>!v)} style={{ background:'none', border:'none', color:'#666', cursor:'pointer' }}>{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>}
          />
        </div>

        {/* Forgot Password Link */}
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button 
            type="button"
            onClick={() => { setResetModal(true); setResetMsg(null); setResetEmail(email); }}
            style={{ background: 'none', border: 'none', color: C.orange, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Forgot Password?
          </button>
        </div>

        {error && <p style={{ color:'#ff4d6d', fontSize:12, marginTop:8 }}>{error}</p>}

        <div style={{ marginTop:20, marginBottom:10 }}>
          <BtnOrange onClick={handleSignIn} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</BtnOrange>
        </div>

        <div style={{ marginTop: 2, marginBottom: 12 }}>
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

        <p style={{ textAlign:'center', color:'#666', fontSize:13, marginTop:16 }}>
          Don't have an account?{' '}
          <span onClick={() => navigate('/signup')} style={{ color:C.orange, fontWeight:700, cursor:'pointer' }}>Sign Up</span>
        </p>
      </div>

      {/* ── Forgot Password Modal Overlay ── */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#171a20', width: '100%', maxWidth: 350, borderRadius: 16, padding: 20, boxSizing: 'border-box', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 800 }}>
                Reset Password
              </h3>
              <button onClick={() => { setResetModal(false); setResetMsg(null); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {resetMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                background: resetMsg.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(255,77,109,0.08)',
                border: `1px solid ${resetMsg.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(255,77,109,0.2)'}`,
                color: resetMsg.type === 'success' ? '#4ade80' : '#ff4d6d', fontSize: 12, fontWeight: 500
              }}>
                <span style={{ flex: 1 }}>{resetMsg.msg}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                Enter the email address associated with your account. We will send a secure link to reset your password.
              </p>
              <TextInput 
                icon={Mail} 
                placeholder="Email Address" 
                value={resetEmail} 
                onChange={e => setResetEmail(e.target.value)} 
                type="email" 
              />
              <div style={{ marginTop: 8 }}>
                <BtnOrange type="submit" disabled={resetLoading}>
                  {resetLoading ? 'Sending link...' : 'Send Reset Link'}
                </BtnOrange>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
