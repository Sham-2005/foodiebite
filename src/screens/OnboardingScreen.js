import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BtnOrange, C } from '../components/UI';

const SLIDES = [
  {
    emoji: '🥗',
    headline: 'Personalized Food for',
    highlight: 'a Better You',
    body: 'Get AI powered food recommendations based on your preferences, health goals and lifestyle.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
  },
  {
    emoji: '🌦️',
    headline: 'Smart Weather &',
    highlight: 'Season Matching',
    body: 'Eat right for the season. Our engine picks meals perfect for today\'s temperature and weather.',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=80',
  },
  {
    emoji: '💪',
    headline: 'Fuel Your',
    highlight: 'Health Goals',
    body: 'Whether gym, yoga, or weight loss — every recommendation is tailored to your body and goals.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const slide = SLIDES[index];

  return (
    <div className="phone-frame" style={{
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Image */}
      <div className="onboarding-media" style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={slide.image} alt=""
          className="responsive-media"
          style={{ transition: 'opacity 0.4s' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, #111 100%)',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 24px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 12 }}>
            {slide.headline}{' '}
            <span style={{ color: C.orange }}>{slide.highlight}</span>
          </h2>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>{slide.body}</p>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => setIndex(i)} style={{
              width: i === index ? 22 : 7, height: 7,
              borderRadius: 4, background: i === index ? C.orange : '#333',
              cursor: 'pointer', transition: 'width 0.3s, background 0.3s',
            }} />
          ))}
        </div>
        {index === SLIDES.length - 1 ? (
          <BtnOrange onClick={() => navigate('/signup')}>Get Started</BtnOrange>
        ) : (
          <BtnOrange onClick={() => setIndex(i => Math.min(i + 1, SLIDES.length - 1))}>Next</BtnOrange>
        )}
        <button
          onClick={() => navigate('/signup')}
          style={{ background: 'none', border: 'none', color: '#666', marginTop: 14, fontSize: 14, cursor: 'pointer' }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
