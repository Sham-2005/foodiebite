import React, { useState, useEffect } from 'react';
import { Mail, Phone, Star, Send, CheckCircle2, MessageSquare, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiSubmitFeedback } from '../services/api';
import { C, BackHeader, BtnOrange } from '../components/UI';

export default function FeedbackScreen() {
  const { user } = useApp();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Hydrate fields on user context load
  useEffect(() => {
    setName(user?.name || 'Sham S.');
    setEmail(user?.email || 'sham111205s@gmail.com');
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please complete all form fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await apiSubmitFeedback({
        name,
        email,
        rating,
        message
      });
      setSuccess(true);
      setMessage('');
      setRating(5);
      // Automatically clear success toast or message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <BackHeader title="Feedback & Support" />

      {/* Scrollable Container */}
      <div style={{ flex: 1, padding: '16px 20px 40px', overflowY: 'auto' }} className="scroll-row">
        
        {/* Support Section Card */}
        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Direct Support
        </h3>

        <div style={{ 
          background: C.card, 
          borderRadius: 16, 
          padding: '20px 18px', 
          border: `1px solid ${C.border}`,
          marginBottom: 24
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Need Help?</div>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
            Have questions or running into issues with the FoodieBite platform? Get in touch with our lead support engineer directly.
          </p>

          {/* Developer Contact Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              Developer: <span style={{ color: C.orange }}>Sham S.</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={12} /> sham111205s@gmail.com
            </div>
            <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={12} /> +91 6380138206
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <a 
              href="mailto:sham111205s@gmail.com" 
              className="tap-button"
              style={{ 
                flex: 1, 
                background: 'rgba(255,107,53,0.12)', 
                border: `1px solid rgba(255,107,53,0.2)`, 
                borderRadius: 12, 
                padding: '12px 0', 
                color: C.orange,
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none'
              }}
            >
              <Mail size={14} /> Send Email
            </a>
            <a 
              href="tel:+916380138206" 
              className="tap-button"
              style={{ 
                flex: 1, 
                background: 'rgba(255,255,255,0.04)', 
                border: `1px solid ${C.border}`, 
                borderRadius: 12, 
                padding: '12px 0', 
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none'
              }}
            >
              <Phone size={14} /> Call Support
            </a>
          </div>
        </div>

        {/* Feedback Form Card */}
        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Share Your Feedback
        </h3>

        <div style={{ 
          background: C.card, 
          borderRadius: 16, 
          padding: '20px 18px', 
          border: `1px solid ${C.border}` 
        }}>
          
          {/* Status Alerts */}
          {success && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 12, marginBottom: 18,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              color: '#4ade80', fontSize: 13, fontWeight: 600
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>Thank you for your feedback!</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 12, marginBottom: 18,
              background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)',
              color: '#ff4d6d', fontSize: 13, fontWeight: 600
            }}>
              <span>⚠️ {errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Name Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Name</label>
              <input 
                type="text" 
                placeholder="Enter your name"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                style={{ 
                  background: C.bg, 
                  border: `1px solid ${C.border}`, 
                  borderRadius: 10, 
                  padding: '12px 14px', 
                  color: '#fff', 
                  fontSize: 14, 
                  outline: 'none' 
                }}
                required
              />
            </div>

            {/* Email Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Email</label>
              <input 
                type="email" 
                placeholder="Enter your email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                style={{ 
                  background: C.bg, 
                  border: `1px solid ${C.border}`, 
                  borderRadius: 10, 
                  padding: '12px 14px', 
                  color: '#fff', 
                  fontSize: 14, 
                  outline: 'none' 
                }}
                required
              />
            </div>

            {/* Star Rating Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Rating</label>
              <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isActive = (hoverRating || rating) >= starValue;
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 2,
                        transition: 'transform 0.15s ease'
                      }}
                      className="tap-button"
                    >
                      <Star 
                        size={28} 
                        fill={isActive ? '#facc15' : 'transparent'} 
                        color={isActive ? '#facc15' : C.muted2} 
                        strokeWidth={2}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Feedback Message</label>
              <textarea 
                placeholder="Share your experience, feature requests, or report a bug..."
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                style={{ 
                  background: C.bg, 
                  border: `1px solid ${C.border}`, 
                  borderRadius: 10, 
                  padding: '12px 14px', 
                  color: '#fff', 
                  fontSize: 14, 
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.5
                }}
                required
              />
            </div>

            {/* Submit Button */}
            <BtnOrange 
              type="submit" 
              disabled={submitting || !message.trim()}
              style={{ 
                marginTop: 8, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8 
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin-icon" /> Submitting...
                </>
              ) : (
                <>
                  <Send size={15} /> Submit Feedback
                </>
              )}
            </BtnOrange>

          </form>
        </div>

      </div>
    </div>
  );
}
