import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Save, User, Mail, Calendar, Users, CheckCircle, AlertCircle, Key, X, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { apiUpdateProfile, apiUpdatePassword } from '../services/api';
import { C, BtnOrange } from '../components/UI';

function FieldRow({ icon: Icon, label, name, value, type = 'text', disabled, onChange, placeholder }) {
  return (
    <div  style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: disabled ? 'rgba(255,255,255,0.03)' : C.input,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : C.inputB}`,
        borderRadius: 10, padding: '12px 14px',
        transition: 'border 0.2s, background 0.2s',
      }}>
        <Icon size={16} color={disabled ? C.muted2 : C.muted} />
        <input
          name={name}
          type={type}
          value={value}
          disabled={disabled}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: disabled ? C.muted2 : C.text,
            fontSize: 14,
            outline: 'none',
            cursor: disabled ? 'default' : 'text',
          }}
        />
      </div>
    </div>
  );
}

export default function PersonalInformation() {
  const navigate = useNavigate();
  const { user, updateUser } = useApp();

  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [toast,   setToast]     = useState(null); // { type: 'success'|'error', msg }

  // ── Password change states ──
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm]   = useState({ current: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdToast, setPwdToast] = useState(null);

  const [formData, setFormData] = useState({
    name:   '',
    email:  '',
    age:    '',
    gender: '',
  });

  // ── Load real user data from context on mount ───────────────────────
  useEffect(() => {
    if (user) {
      setFormData({
        name:   user.name   || '',
        email:  user.email  || '',
        age:    user.age    || '',
        gender: user.gender || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = () => {
    setToast(null);
    setEditing(true);
  };

  const handleCancel = () => {
    // Reset to original user data
    if (user) {
      setFormData({
        name:   user.name   || '',
        email:  user.email  || '',
        age:    user.age    || '',
        gender: user.gender || '',
      });
    }
    setEditing(false);
    setToast(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setToast({ type: 'error', msg: 'Name is required.' });
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setToast({ type: 'error', msg: 'Please enter a valid email address.' });
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      const data = await apiUpdateProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        age: formData.age,
        gender: formData.gender
      });
      // Update context so header/profile immediately reflects new details
      updateUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        age: formData.age,
        gender: formData.gender
      });
      setEditing(false);
      setToast({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwdToast(null);

    if (!pwdForm.current || !pwdForm.new || !pwdForm.confirm) {
      setPwdToast({ type: 'error', msg: 'All fields are required' });
      return;
    }
    if (pwdForm.new.length < 6) {
      setPwdToast({ type: 'error', msg: 'New password must be at least 6 characters' });
      return;
    }
    if (pwdForm.new !== pwdForm.confirm) {
      setPwdToast({ type: 'error', msg: 'Passwords do not match' });
      return;
    }

    try {
      setPwdLoading(true);
      await apiUpdatePassword({
        currentPassword: pwdForm.current,
        newPassword: pwdForm.new,
      });
      setPwdToast({ type: 'success', msg: 'Password updated successfully!' });
      setPwdForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwdModal(false), 1200);
    } catch (err) {
      setPwdToast({ type: 'error', msg: err.message || 'Incorrect current password' });
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <div className="phone-frame" style={{ minHeight: '100vh', background: C.bg, color: C.text }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#1e1e1e', border: `1px solid ${C.border}`,
            borderRadius: '50%', width: 36, height: 36,
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
          Personal Information
        </h1>

        {!editing ? (
          <button
            onClick={handleEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,107,53,0.12)', border: `1px solid rgba(255,107,53,0.3)`,
              borderRadius: 20, padding: '6px 12px',
              color: C.orange, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Edit2 size={13} /> Edit
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: saving ? '#333' : C.orange,
              border: 'none', borderRadius: 20, padding: '6px 14px',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <div style={{ padding: '24px 16px' }}>

        {/* ── Avatar card ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#1e1e1e', borderRadius: 16, padding: 16,
          border: `1px solid ${C.border}`, marginBottom: 28,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF6B35,#FF8C5A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>
            {(formData.name || user?.name || 'G').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{formData.name || 'Your Name'}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{formData.email || 'your@email.com'}</div>
          </div>
        </div>

        {/* ── Toast / feedback ── */}
        {toast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10, marginBottom: 20,
            background: toast.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(255,77,109,0.1)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(255,77,109,0.3)'}`,
            color: toast.type === 'success' ? '#4ade80' : '#ff4d6d',
            fontSize: 13, fontWeight: 500,
          }}>
            {toast.type === 'success'
              ? <CheckCircle size={16} />
              : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        {/* ── Form fields ── */}
        <div style={{ background: '#1e1e1e', borderRadius: 14, padding: '20px 16px', border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18, marginTop: 0 }}>
            Account Details
          </p>

          <FieldRow
            icon={User}
            label="Full Name"
            name="name"
            value={formData.name}
            disabled={!editing}
            onChange={handleChange}
            placeholder="Enter your name"
          />

          <FieldRow
            icon={Mail}
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            disabled={!editing}
            onChange={handleChange}
            placeholder="Enter your email"
          />

          <FieldRow
            icon={Calendar}
            label="Age"
            name="age"
            type="number"
            value={formData.age}
            disabled={!editing}
            onChange={handleChange}
            placeholder="Enter your age"
          />

          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              Gender
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: !editing ? 'rgba(255,255,255,0.03)' : C.input,
              border: `1px solid ${!editing ? 'rgba(255,255,255,0.05)' : C.inputB}`,
              borderRadius: 10, padding: '12px 14px',
            }}>
              <Users size={16} color={!editing ? C.muted2 : C.muted} />
              {!editing ? (
                <span style={{ fontSize: 14, color: formData.gender ? C.muted2 : '#444' }}>
                  {formData.gender || 'Not specified'}
                </span>
              ) : (
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  style={{
                    flex: 1, background: 'none', border: 'none',
                    color: formData.gender ? C.text : C.muted2,
                    fontSize: 14, outline: 'none', cursor: 'pointer',
                    appearance: 'none',
                  }}
                >
                  <option value="" style={{ background: '#1e1e1e' }}>Select gender</option>
                  <option value="Male"   style={{ background: '#1e1e1e' }}>Male</option>
                  <option value="Female" style={{ background: '#1e1e1e' }}>Female</option>
                  <option value="Other"  style={{ background: '#1e1e1e' }}>Other</option>
                  <option value="Prefer not to say" style={{ background: '#1e1e1e' }}>Prefer not to say</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── Cancel button (only while editing) ── */}
        {editing && (
          <button
            onClick={handleCancel}
            style={{
              width: '100%', marginTop: 14,
              padding: '13px', borderRadius: 12,
              background: 'transparent',
              border: `1.5px solid ${C.border}`,
              color: C.muted, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}

        {/* ── Password change hint ── */}
        {!editing && (
          <div 
            onClick={() => setPwdModal(true)}
            style={{
              marginTop: 16, padding: '14px 16px',
              background: '#1e1e1e', borderRadius: 12,
              border: `1px solid ${C.border}`,
              fontSize: 13, color: C.muted,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            className="tap-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Key size={16} color={C.orange} />
              <span>Password</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#444', fontSize: 12 }}>••••••••</span>
              <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>Change</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Change Password Modal Overlay ── */}
      {pwdModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: 'env(safe-area-inset-top)' }}>
          <div style={{ background: '#171a20', width: '100%', maxWidth: 360, maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 40px)', overflowY: 'auto', borderRadius: 16, padding: 20, boxSizing: 'border-box', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={18} color={C.orange} /> Security
              </h3>
              <button onClick={() => { setPwdModal(false); setPwdToast(null); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {pwdToast && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 14,
                background: pwdToast.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(255,77,109,0.1)',
                border: `1px solid ${pwdToast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(255,77,109,0.3)'}`,
                color: pwdToast.type === 'success' ? '#4ade80' : '#ff4d6d', fontSize: 12, fontWeight: 500
              }}>
                {pwdToast.type === 'success' ? <CheckCircle size={14} /> : <ShieldAlert size={14} />}
                {pwdToast.msg}
              </div>
            )}

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>CURRENT PASSWORD</label>
                <input 
                  type="password" 
                  value={pwdForm.current}
                  onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>NEW PASSWORD</label>
                <input 
                  type="password" 
                  value={pwdForm.new}
                  onChange={e => setPwdForm({ ...pwdForm, new: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>CONFIRM NEW PASSWORD</label>
                <input 
                  type="password" 
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', background: C.input, border: `1px solid ${C.inputB}`, borderRadius: 10, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ marginTop: 8 }}>
                <BtnOrange type="submit" disabled={pwdLoading}>
                  {pwdLoading ? 'Updating...' : 'Update Password'}
                </BtnOrange>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}