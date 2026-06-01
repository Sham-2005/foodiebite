import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/onboarding'), 2200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="phone-frame" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'radial-gradient(#FF6B35 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Logo */}
      <div style={{
        width: 350, height: 350, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF6B35, #FF8C5A)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, fontSize: 46,
        boxShadow: '0 0 60px rgba(255,107,53,0.35)',
        animation: 'pulse 2s ease-in-out infinite',
        overflow: 'hidden'
      }}>
        <img 
          src="/logo.jpg" 
          alt="FoodieBite Logo" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>

      <h1 style={{
        fontSize: 36, fontWeight: 800, color: '#FF6B35',
        letterSpacing: 0, marginBottom: 6,
      }}>
        FoodieBite
      </h1>
      <p style={{ color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 1.5 }}>
        Smart Food Recommendations<br />For You
      </p>

      {/* Loader */}
      <div style={{ marginTop: 60 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #2a2a2a',
          borderTopColor: '#FF6B35',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{box-shadow:0 0 40px rgba(255,107,53,0.3)} 50%{box-shadow:0 0 80px rgba(255,107,53,0.5)} }
      `}</style>
    </div>
  );
}
