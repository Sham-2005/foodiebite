import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Heart, FileText, Bell, Shield, LogOut, Trash2, 
  ChevronRight, CheckCircle2, AlertCircle, RefreshCw, Clock, Calendar, Check, X,
  Info, MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { 
  apiLogout, 
  apiDeleteAccount, 
  apiGetMedicalReports, 
  apiGetNotificationSettings, 
  apiUpdateNotificationSettings, 
  apiTriggerTestNutritionEmail, 
  apiGetEmailHistory 
} from '../services/api';
import { C, BtnOrange } from '../components/UI';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, setUser, checkVerificationStatus } = useApp();
  
  // States
  const [reportsCount, setReportsCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', msg }
  
  // Notification settings modal and parameters
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [testTriggering, setTestTriggering] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [emailHistory, setEmailHistory] = useState([]);
  
  const [settings, setSettings] = useState({
    dailySuggestions: true,
    frequency: 'daily',
    deliveryTime: '07:00',
    loginAlerts: true,
    securityEmails: true,
    marketingEmails: false
  });

  // Dynamic Count Hydration & Preferences Load
  useEffect(() => {
    async function loadProfileMetrics() {
      if (!user) return;
      
      // 1. Get medical reports count
      try {
        const reportData = await apiGetMedicalReports();
        if (reportData && reportData.reports) {
          setReportsCount(reportData.reports.length);
        }
      } catch (e) {
        console.warn('Failed to load reports count', e);
      }

      // 2. Get notification settings preferences
      try {
        setSettingsLoading(true);
        const settingsData = await apiGetNotificationSettings();
        if (settingsData && settingsData.settings) {
          setSettings(settingsData.settings);
        }
      } catch (e) {
        console.warn('Failed to load notification settings', e);
      } finally {
        setSettingsLoading(false);
      }

      // 3. Get email history
      try {
        setHistoryLoading(true);
        const historyData = await apiGetEmailHistory();
        if (historyData && historyData.history) {
          setEmailHistory(historyData.history);
        }
      } catch (e) {
        console.warn('Failed to load email history logs', e);
      } finally {
        setHistoryLoading(false);
      }
    }

    loadProfileMetrics();
  }, [user]);

  // Dismiss Toast helper
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handlers
  const handleLogout = () => {
    apiLogout();
    setUser(null);
    navigate('/onboarding');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setToast(null);
    try {
      await apiDeleteAccount();
      setUser(null);
      setDeleteConfirm(false);
      navigate('/onboarding');
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to delete account. Please re-authenticate and try again.' });
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSetting = async (key) => {
    const updatedSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    // Optimistic Update
    setSettings(updatedSettings);
    
    try {
      await apiUpdateNotificationSettings(updatedSettings);
    } catch (e) {
      console.warn('Settings synchronization failed', e);
      // Revert on failure
      setSettings(settings);
      setToast({ type: 'error', msg: 'Failed to save settings preferences.' });
    }
  };

  const handleChangeSetting = async (key, value) => {
    const updatedSettings = {
      ...settings,
      [key]: value
    };
    
    // Optimistic Update
    setSettings(updatedSettings);
    
    try {
      await apiUpdateNotificationSettings(updatedSettings);
    } catch (e) {
      console.warn('Settings synchronization failed', e);
      // Revert on failure
      setSettings(settings);
      setToast({ type: 'error', msg: 'Failed to update preferences.' });
    }
  };

  const handleTriggerTestEmail = async () => {
    setTestTriggering(true);
    setToast(null);
    try {
      const res = await apiTriggerTestNutritionEmail();
      setToast({ 
        type: 'success', 
        msg: res.message || 'Personalized suggestions generated! Check your inbox.' 
      });
      
      // Refresh email logs
      const historyData = await apiGetEmailHistory();
      if (historyData && historyData.history) {
        setEmailHistory(historyData.history);
      }
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to dispatch test suggestion email.' });
    } finally {
      setTestTriggering(false);
    }
  };

  // Format Helper for timestamps
  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + 
             d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return isoString;
    }
  };

  const latestEmail = emailHistory[0];

  return (
    <AppLayout noPadding>
      
      {/* Scrollable Container */}
      <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto', paddingBottom: 100, height: 'calc(100vh - 84px)', boxSizing: 'border-box' }} className="scroll-row">
        
        {/* Profile Card Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0 32px' }}>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.name || 'User'} 
                style={{ width: 84, height: 84, borderRadius: '50%', border: `3.5px solid ${C.orange}`, objectFit: 'cover' }} 
              />
            ) : (
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(255,107,53,0.12)', border: `3.5px solid ${C.orange}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={38} color={C.orange} />
              </div>
            )}
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#22c55e', width: 18, height: 18, borderRadius: '50%', border: `3px solid ${C.bg}` }} />
          </div>
          
          <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#fff', fontWeight: 800, letterSpacing: -0.3 }}>
            {user?.name || 'FoodieBite User'}
          </h2>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
            {user?.email || 'user@example.com'}
          </span>
        </div>

        {/* Universal Toasts */}
        {toast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 14px', borderRadius: 12, marginBottom: 20, boxSizing: 'border-box',
            background: toast.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(255,77,109,0.08)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(255,77,109,0.2)'}`,
            color: toast.type === 'success' ? '#4ade80' : '#ff4d6d',
            fontSize: 12, fontWeight: 500, textAlign: 'left',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {toast.type === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertCircle size={16} style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{toast.msg}</span>
          </div>
        )}

        {/* Menu Section Grid */}
        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Account Settings
        </h3>

        <div style={{ background: C.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 24 }}>
          
          {/* Row 1: Personal Info */}
          <div 
            onClick={() => navigate('/personal-info')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: C.orange }}>
              <User size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Personal Details</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Edit name, credentials & goal profiles</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* Row 2: Saved Favorites */}
          <div 
            onClick={() => navigate('/favorites')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#ff4d6d' }}>
              <Heart size={18} fill="#ff4d6d" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Saved Favorites</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Explore your saved diet items</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* Row 3: Medical Reports */}
          <div 
            onClick={() => navigate('/medical-reports')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#38bdf8' }}>
              <FileText size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                Medical Scans
                {reportsCount > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 800 }}>
                    {reportsCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Upload health profiles & doctor logs</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* Row 4: Notification Settings */}
          <div 
            onClick={() => setSettingsModal(true)}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#a78bfa' }}>
              <Bell size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Notification Controls</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Daily plans, logins & marketing alerts</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

        </div>

        <h3 style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 12px 4px' }}>
          Legals & Policies
        </h3>

        <div style={{ background: C.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 32 }}>
          
          {/* Privacy Policy */}
          <div 
            onClick={() => navigate('/privacy-policy')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#4ade80' }}>
              <Shield size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Privacy Policy</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>How we protect your biological metrics</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* Terms & Conditions */}
          <div 
            onClick={() => navigate('/terms-conditions')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#facc15' }}>
              <FileText size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Terms & Conditions</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Terms of service & local algorithm details</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* About Us */}
          <div 
            onClick={() => navigate('/about-us')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: `1px solid ${C.border}` }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#38bdf8' }}>
              <Info size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>About Us</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Learn more about FoodieBite platform</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

          {/* Feedback & Support */}
          <div 
            onClick={() => navigate('/feedback')}
            style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
            className="profile-row"
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, color: '#ec4899' }}>
              <MessageSquare size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Feedback & Support</div>
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Get direct help or share your thoughts</div>
            </div>
            <ChevronRight size={16} color={C.muted2} />
          </div>

        </div>

        {/* Side-by-Side Flex Action Triggers */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', cursor: 'pointer', gap: 8 }}>
              <LogOut size={16} color="#ff4d6d" />
              <span style={{ color: '#ff4d6d', fontWeight: 700, fontSize: 14 }}>Log Out</span>
            </div>
          </div>
          <div style={{ flex: 1, background: '#1e1e1e', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div onClick={() => setDeleteConfirm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', cursor: 'pointer', gap: 8 }}>
              <Trash2 size={16} color="#ff4d6d" />
              <span style={{ color: '#ff4d6d', fontWeight: 700, fontSize: 14 }}>Delete Account</span>
            </div>
          </div>
        </div>

        {/* Branded Premium Footer */}
        <div style={{ 
          marginTop: 40,
          borderTop: `1px solid ${C.border}`, 
          paddingTop: 28, 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 10
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>FoodieBite</span>
          <span style={{ fontSize: 11, color: C.muted2, fontWeight: 600 }}>Version 1.0.0</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 11, color: C.muted }}>
            <span style={{ fontWeight: 600 }}>Developed by <span style={{ color: '#fff' }}>Sham S.</span></span>
            <a href="mailto:sham111205s@gmail.com" style={{ color: C.orange, fontWeight: 500 }}>sham111205s@gmail.com</a>
          </div>

          <span style={{ fontSize: 10, color: C.muted2, marginTop: 12 }}>© 2026 FoodieBite</span>
        </div>

      </div>

      {/* MODAL 1: NOTIFICATION PREFERENCES */}
      {settingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', zIndex: 2100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ 
            background: '#14161c', width: '100%', maxWidth: 430, borderTopLeftRadius: 24, borderTopRightRadius: 24, 
            padding: '24px 20px max(24px, env(safe-area-inset-bottom))', boxSizing: 'border-box', borderTop: `1.5px solid ${C.border}`,
            maxHeight: '88vh', overflowY: 'auto'
          }}>
            
            {/* Modal Title bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={20} color={C.orange} />
                <h3 style={{ margin: 0, fontSize: 18, color: '#fff', fontWeight: 800 }}>Notification Settings</h3>
              </div>
              <button 
                onClick={() => setSettingsModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
              >
                <X size={15} />
              </button>
            </div>

            {settingsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <RefreshCw size={24} className="spin-icon" color={C.orange} />
                <span style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>Loading configurations...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* Granular Preference Switches */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                  
                  {/* Switch 1: Daily Suggestions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Daily suggestions digest</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Daily personal meal plans & target targets</div>
                    </div>
                    <button 
                      onClick={() => handleToggleSetting('dailySuggestions')}
                      style={{
                        width: 48, height: 26, borderRadius: 15, background: settings.dailySuggestions ? C.orange : '#2e3036',
                        border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3, left: settings.dailySuggestions ? 25 : 3,
                        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                  {/* Switch 2: Login Warning Alerts */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Login alert notices</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Immediate secure alert emails when logins succeed</div>
                    </div>
                    <button 
                      onClick={() => handleToggleSetting('loginAlerts')}
                      style={{
                        width: 48, height: 26, borderRadius: 15, background: settings.loginAlerts ? C.orange : '#2e3036',
                        border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3, left: settings.loginAlerts ? 25 : 3,
                        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                  {/* Switch 3: Optional Security Emails */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Secondary security alerts</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Alerts on password updates & verification actions</div>
                    </div>
                    <button 
                      onClick={() => handleToggleSetting('securityEmails')}
                      style={{
                        width: 48, height: 26, borderRadius: 15, background: settings.securityEmails ? C.orange : '#2e3036',
                        border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3, left: settings.securityEmails ? 25 : 3,
                        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                  {/* Switch 4: Marketing Emails */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Seasonal & recipe emails</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Bonus nutrition digests, recipes & tips of the day</div>
                    </div>
                    <button 
                      onClick={() => handleToggleSetting('marketingEmails')}
                      style={{
                        width: 48, height: 26, borderRadius: 15, background: settings.marketingEmails ? C.orange : '#2e3036',
                        border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3, left: settings.marketingEmails ? 25 : 3,
                        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                </div>

                {/* Delivery Time & Frequency Controls */}
                {settings.dailySuggestions && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                    
                    {/* Time Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} color={C.muted} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Delivery Time</span>
                      </div>
                      <select 
                        value={settings.deliveryTime}
                        onChange={(e) => handleChangeSetting('deliveryTime', e.target.value)}
                        style={{
                          background: '#252932', color: '#fff', border: `1.5px solid ${C.border}`,
                          borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, outline: 'none'
                        }}
                      >
                        <option value="06:00">06:00 AM</option>
                        <option value="07:00">07:00 AM</option>
                        <option value="08:00">08:00 AM</option>
                        <option value="09:00">09:00 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="18:00">06:00 PM</option>
                      </select>
                    </div>

                    {/* Frequency Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={16} color={C.muted} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Frequency</span>
                      </div>
                      <select 
                        value={settings.frequency}
                        onChange={(e) => handleChangeSetting('frequency', e.target.value)}
                        style={{
                          background: '#252932', color: '#fff', border: `1.5px solid ${C.border}`,
                          borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, outline: 'none'
                        }}
                      >
                        <option value="daily">Every Day</option>
                        <option value="weekly">Every Week</option>
                        <option value="never">Never (Disabled)</option>
                      </select>
                    </div>

                  </div>
                )}

                {/* Last Receipt Metadata Log Card */}
                <div style={{ background: '#1c1f26', border: `1.5px dashed ${C.border}`, borderRadius: 16, padding: 14, textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    Daily plan status log
                  </div>
                  {latestEmail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
                        {latestEmail.subject || 'Smart Nutrition suggestions plan'}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span>Sent: {formatTimestamp(latestEmail.timestamp)}</span>
                        <span>·</span>
                        <span style={{ 
                          color: latestEmail.deliveryStatus === 'success' ? '#4ade80' : '#ff4d6d', 
                          fontWeight: 700, textTransform: 'uppercase', fontSize: 10
                        }}>
                          {latestEmail.deliveryStatus}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: C.muted2 }}>No emails dispatched yet in this session.</span>
                  )}
                </div>

                {/* Test Dispatch Button */}
                <button 
                  onClick={handleTriggerTestEmail}
                  disabled={testTriggering || settings.frequency === 'never' || !settings.dailySuggestions}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: testTriggering ? '#2a2a2a' : C.orange,
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: testTriggering || settings.frequency === 'never' || !settings.dailySuggestions ? 'not-allowed' : 'pointer',
                    opacity: settings.frequency === 'never' || !settings.dailySuggestions ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s'
                  }}
                >
                  {testTriggering ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" /> Generating Plan...
                    </>
                  ) : (
                    <>
                      🚀 Send Test Health Plan
                    </>
                  )}
                </button>

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2: DELETE ACCOUNT CONFIRMATION */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.84)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#171a20', width: '100%', maxWidth: 340, borderRadius: 18, padding: 24, boxSizing: 'border-box', border: `1.5px solid ${C.border}`, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,77,109,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ff4d6d' }}>
              <Trash2 size={26} />
            </div>
            
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#fff', fontWeight: 800, letterSpacing: -0.2 }}>Delete Account?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Are you absolutely sure? This action is permanent. It will delete your profile, saved foods, and permanently purge all uploaded medical reports.
            </p>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setDeleteConfirm(false)} 
                disabled={deleting}
                style={{ flex: 1, padding: '12px', background: '#252525', border: `1px solid ${C.border}`, borderRadius: 12, color: '#ccc', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount} 
                disabled={deleting}
                style={{ flex: 1, padding: '12px', background: '#ff4d6d', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={13} className="spin-icon" /> Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
