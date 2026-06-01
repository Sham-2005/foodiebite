import React from 'react';
import { Award, CheckCircle2, Mail, Phone, Sparkles } from 'lucide-react';
import { C, BackHeader } from '../components/UI';

export default function AboutUsScreen() {
  const features = [
    'Personalized recommendations',
    'Medical report tracking',
    'Favorite foods',
    'AI nutrition assistant',
    'Daily health suggestions',
    'Secure Firebase Authentication',
    'Cloud Firestore Storage',
    'Cloudinary Medical Report Storage'
  ];

  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <BackHeader title="About FoodieBite" />

      {/* Scrollable Container */}
      <div style={{ flex: 1, padding: '16px 20px 40px', overflowY: 'auto' }} className="scroll-row">
        
        {/* Brand Banner */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          margin: '12px 0 28px',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: 72, 
            height: 72, 
            borderRadius: 20, 
            background: 'rgba(255,107,53,0.12)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: 16,
            border: `1.5px solid rgba(255,107,53,0.2)`
          }}>
            <Sparkles size={36} color={C.orange} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5, margin: '0 0 10px' }}>
            About FoodieBite
          </h2>
          <p style={{ 
            fontSize: 13, 
            color: C.muted, 
            lineHeight: 1.6, 
            maxWidth: '90%',
            margin: 0
          }}>
            FoodieBite is an AI-powered food and nutrition platform helping users discover healthier food choices, manage dietary preferences, track medical reports, and receive personalized recommendations.
          </p>
        </div>

        {/* Features List Section */}
        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Core Features
        </h3>
        
        <div style={{ 
          background: C.card, 
          borderRadius: 16, 
          padding: '18px 16px', 
          border: `1px solid ${C.border}`, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 14,
          marginBottom: 28 
        }}>
          {features.map((feature, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={16} fill="rgba(74,222,128,0.1)" />
              </div>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* Developer Info Section */}
        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Developer Information
        </h3>

        <div style={{ 
          background: C.card, 
          borderRadius: 16, 
          padding: '20px 18px', 
          border: `1px solid ${C.border}`,
          marginBottom: 36
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: '50%', 
              background: 'rgba(250,204,21,0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#facc15',
              border: '1px solid rgba(250,204,21,0.15)'
            }}>
              <Award size={22} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Sham S.</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 1 }}>Lead Platform Developer</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <a href="mailto:sham111205s@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Mail size={14} color={C.orange} />
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>sham111205s@gmail.com</span>
            </a>
            <a href="tel:+916380138206" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Phone size={14} color={C.orange} />
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>+91 6380138206</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          borderTop: `1px solid ${C.border}`, 
          paddingTop: 24, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 6 
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>FoodieBite</span>
          <span style={{ fontSize: 11, color: C.muted2, fontWeight: 600 }}>Version 1.0.0</span>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Developed by Sham S.</span>
          <a href="mailto:sham111205s@gmail.com" style={{ color: C.orange, fontWeight: 500, fontSize: 11, textDecoration: 'none' }}>sham111205s@gmail.com</a>
          <span style={{ fontSize: 11, color: C.muted2, marginTop: 4 }}>© 2026 FoodieBite</span>
        </div>

      </div>
    </div>
  );
}
