import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Modal, Switch, ActivityIndicator, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  User, Mail, Heart, FileText, Bell, Shield, LogOut, Trash2, 
  ChevronRight, CheckCircle2, AlertCircle, RefreshCw, Clock, Calendar, Check, X,
  Info, MessageSquare
} from 'lucide-react-native';
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

const DELIVERY_TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '18:00'];
const FREQUENCIES = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'never', label: 'Never (Disabled)' }
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useApp();
  
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
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFreqPicker, setShowFreqPicker] = useState(false);

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
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setToast(null);
    try {
      await apiDeleteAccount();
      setUser(null);
      setDeleteConfirm(false);
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
    
    setSettings(updatedSettings);
    
    try {
      await apiUpdateNotificationSettings(updatedSettings);
    } catch (e) {
      console.warn('Settings synchronization failed', e);
      setSettings(settings);
      setToast({ type: 'error', msg: 'Failed to save settings preferences.' });
    }
  };

  const handleChangeSetting = async (key, value) => {
    const updatedSettings = {
      ...settings,
      [key]: value
    };
    
    setSettings(updatedSettings);
    
    try {
      await apiUpdateNotificationSettings(updatedSettings);
    } catch (e) {
      console.warn('Settings synchronization failed', e);
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
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.container}>
        
        {/* Profile Card Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.photoURL ? (
              <Image 
                source={{ uri: user.photoURL }} 
                style={styles.avatarImage} 
              />
            ) : (
              <View style={styles.avatarFallback}>
                <User size={38} color={C.orange} />
              </View>
            )}
            <View style={styles.activeDot} />
          </View>
          
          <Text style={styles.userName}>{user?.name || 'FoodieBite User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        {/* Universal Toasts */}
        {toast && (
          <View style={[
            styles.alert,
            toast.type === 'success' ? styles.alertSuccess : styles.alertError
          ]}>
            {toast.type === 'success' ? <CheckCircle2 size={16} color="#4ade80" /> : <AlertCircle size={16} color="#ff4d6d" />}
            <Text style={[styles.alertText, toast.type === 'success' ? { color: '#4ade80' } : { color: '#ff4d6d' }]}>
              {toast.msg}
            </Text>
          </View>
        )}

        {/* Account Settings Menu */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.menuGroup}>
          
          {/* Row 1: Personal Info */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('PersonalInfo')}
            style={styles.menuItem}
          >
            <View style={[styles.menuIconContainer, { color: C.orange }]}>
              <User size={18} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Personal Details</Text>
              <Text style={styles.menuItemSub}>Edit name, credentials & goal profiles</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* Row 2: Saved Favorites */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Favorites')}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <Heart size={18} fill="#ff4d6d" color="#ff4d6d" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Saved Favorites</Text>
              <Text style={styles.menuItemSub}>Explore your saved diet items</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* Row 3: Medical Reports */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('MedicalReports')}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <FileText size={18} color="#38bdf8" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuItemText}>Medical Scans</Text>
                {reportsCount > 0 && (
                  <View style={styles.reportBadge}>
                    <Text style={styles.reportBadgeText}>{reportsCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.menuItemSub}>Upload health profiles & doctor logs</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* Row 4: Notification Settings */}
          <TouchableOpacity 
            onPress={() => setSettingsModal(true)}
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
          >
            <View style={styles.menuIconContainer}>
              <Bell size={18} color="#a78bfa" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Notification Controls</Text>
              <Text style={styles.menuItemSub}>Daily plans, logins & marketing alerts</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

        </View>

        {/* Legals & Policies */}
        <Text style={styles.sectionTitle}>Legals & Policies</Text>
        <View style={styles.menuGroup}>
          
          {/* Privacy Policy */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('PrivacyPolicy')}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <Shield size={18} color="#4ade80" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Privacy Policy</Text>
              <Text style={styles.menuItemSub}>How we protect your biological metrics</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* Terms & Conditions */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('TermsConditions')}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <FileText size={18} color="#facc15" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Terms & Conditions</Text>
              <Text style={styles.menuItemSub}>Terms of service & local algorithm details</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* About Us */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('AboutUs')}
            style={styles.menuItem}
          >
            <View style={styles.menuIconContainer}>
              <Info size={18} color="#38bdf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>About Us</Text>
              <Text style={styles.menuItemSub}>Learn more about FoodieBite platform</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

          {/* Feedback & Support */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Feedback')}
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
          >
            <View style={styles.menuIconContainer}>
              <MessageSquare size={18} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Feedback & Support</Text>
              <Text style={styles.menuItemSub}>Get direct help or share your thoughts</Text>
            </View>
            <ChevronRight size={16} color={C.muted2} />
          </TouchableOpacity>

        </View>

        {/* Side-by-side Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleLogout} style={styles.actionBtn}>
            <LogOut size={16} color="#ff4d6d" />
            <Text style={styles.actionBtnText}>Log Out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDeleteConfirm(true)} style={styles.actionBtn}>
            <Trash2 size={16} color="#ff4d6d" />
            <Text style={styles.actionBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Branded Premium Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>FoodieBite</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
          
          <View style={styles.footerDev}>
            <Text style={styles.footerDevText}>Developed by <Text style={{ color: '#fff' }}>Sham S.</Text></Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:sham111205s@gmail.com')}>
              <Text style={styles.footerEmail}>sham111205s@gmail.com</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerCopyright}>© 2026 FoodieBite</Text>
        </View>

      </ScrollView>

      {/* MODAL 1: NOTIFICATION PREFERENCES */}
      <Modal
        visible={settingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Bell size={20} color={C.orange} />
                <Text style={styles.modalTitle}>Notification Settings</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setSettingsModal(false)}
                style={styles.modalCloseButton}
              >
                <X size={15} color="#fff" />
              </TouchableOpacity>
            </View>

            {settingsLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={C.orange} />
                <Text style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>Loading configurations...</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18 }}>
                
                {/* Granular Preference Switches */}
                <View style={styles.settingsBox}>
                  
                  {/* Switch 1: Daily Suggestions */}
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.switchTitle}>Daily suggestions digest</Text>
                      <Text style={styles.switchDesc}>Daily personal meal plans & target targets</Text>
                    </View>
                    <Switch
                      value={settings.dailySuggestions}
                      onValueChange={() => handleToggleSetting('dailySuggestions')}
                      trackColor={{ false: '#2e3036', true: C.orange }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Switch 2: Login Warning Alerts */}
                  <View style={[styles.switchRow, { borderTopWidth: 1, borderColor: C.border, paddingTop: 14 }]}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.switchTitle}>Login alert notices</Text>
                      <Text style={styles.switchDesc}>Immediate secure alert emails when logins succeed</Text>
                    </View>
                    <Switch
                      value={settings.loginAlerts}
                      onValueChange={() => handleToggleSetting('loginAlerts')}
                      trackColor={{ false: '#2e3036', true: C.orange }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Switch 3: Optional Security Emails */}
                  <View style={[styles.switchRow, { borderTopWidth: 1, borderColor: C.border, paddingTop: 14 }]}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.switchTitle}>Secondary security alerts</Text>
                      <Text style={styles.switchDesc}>Alerts on password updates & verification actions</Text>
                    </View>
                    <Switch
                      value={settings.securityEmails}
                      onValueChange={() => handleToggleSetting('securityEmails')}
                      trackColor={{ false: '#2e3036', true: C.orange }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Switch 4: Marketing Emails */}
                  <View style={[styles.switchRow, { borderTopWidth: 1, borderColor: C.border, paddingTop: 14 }]}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={styles.switchTitle}>Seasonal & recipe emails</Text>
                      <Text style={styles.switchDesc}>Bonus nutrition digests, recipes & tips of the day</Text>
                    </View>
                    <Switch
                      value={settings.marketingEmails}
                      onValueChange={() => handleToggleSetting('marketingEmails')}
                      trackColor={{ false: '#2e3036', true: C.orange }}
                      thumbColor="#fff"
                    />
                  </View>

                </View>

                {/* Delivery Time & Frequency Controls */}
                {settings.dailySuggestions ? (
                  <View style={styles.settingsBox}>
                    
                    {/* Time Picker */}
                    <View style={styles.pickerRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} color={C.muted} />
                        <Text style={styles.pickerLabel}>Delivery Time</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dropdownTrigger}>
                        <Text style={styles.dropdownText}>{settings.deliveryTime} AM</Text>
                        <ChevronRight size={14} color="#fff" style={{ transform: [{ rotate: '90deg' }] }} />
                      </TouchableOpacity>
                    </View>

                    {/* Frequency Menu */}
                    <View style={[styles.pickerRow, { borderTopWidth: 1, borderColor: C.border, paddingTop: 14 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Calendar size={16} color={C.muted} />
                        <Text style={styles.pickerLabel}>Frequency</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowFreqPicker(true)} style={styles.dropdownTrigger}>
                        <Text style={styles.dropdownText}>
                          {FREQUENCIES.find(f => f.value === settings.frequency)?.label || settings.frequency}
                        </Text>
                        <ChevronRight size={14} color="#fff" style={{ transform: [{ rotate: '90deg' }] }} />
                      </TouchableOpacity>
                    </View>

                  </View>
                ) : null}

                {/* Last Receipt Metadata Log Card */}
                <View style={styles.logCard}>
                  <Text style={styles.logCardTitle}>Daily plan status log</Text>
                  {latestEmail ? (
                    <View>
                      <Text style={styles.logEmailSubject}>{latestEmail.subject || 'Smart Nutrition suggestions plan'}</Text>
                      <Text style={styles.logEmailInfo}>
                        Sent: {formatTimestamp(latestEmail.timestamp)}  ·  
                        <Text style={[
                          styles.logEmailStatus, 
                          { color: latestEmail.deliveryStatus === 'success' ? '#4ade80' : '#ff4d6d' }
                        ]}>
                          {" "}{latestEmail.deliveryStatus.toUpperCase()}
                        </Text>
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: C.muted2 }}>No emails dispatched yet in this session.</Text>
                  )}
                </View>

                {/* Test Dispatch Button */}
                <TouchableOpacity
                  onPress={handleTriggerTestEmail}
                  disabled={testTriggering || settings.frequency === 'never' || !settings.dailySuggestions}
                  style={[
                    styles.testBtn,
                    (testTriggering || settings.frequency === 'never' || !settings.dailySuggestions) && { opacity: 0.4 }
                  ]}
                >
                  {testTriggering ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.testBtnText}>Generating Plan...</Text>
                    </View>
                  ) : (
                    <Text style={styles.testBtnText}>🚀 Send Test Health Plan</Text>
                  )}
                </TouchableOpacity>

              </ScrollView>
            )}

          </View>
        </View>
      </Modal>

      {/* MODAL 2: DELETE ACCOUNT CONFIRMATION */}
      <Modal
        visible={deleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteContent}>
            <View style={styles.deleteIconContainer}>
              <Trash2 size={26} color="#ff4d6d" />
            </View>
            
            <Text style={styles.deleteTitle}>Delete Account?</Text>
            <Text style={styles.deleteDesc}>
              Are you absolutely sure? This action is permanent. It will delete your profile, saved foods, and permanently purge all uploaded medical reports.
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => setDeleteConfirm(false)} 
                disabled={deleting}
                style={styles.cancelDeleteBtn}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDeleteAccount} 
                disabled={deleting}
                style={styles.confirmDeleteBtn}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Yes, Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Picker Sub-Modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <Text style={styles.subModalTitle}>Select Delivery Time</Text>
            {DELIVERY_TIMES.map(time => (
              <TouchableOpacity
                key={time}
                onPress={() => {
                  handleChangeSetting('deliveryTime', time);
                  setShowTimePicker(false);
                }}
                style={styles.subModalOption}
              >
                <Text style={[styles.subModalOptionText, settings.deliveryTime === time && { color: C.orange }]}>{time} AM</Text>
                {settings.deliveryTime === time && <Check size={16} color={C.orange} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.subModalClose}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Frequency Picker Sub-Modal */}
      <Modal visible={showFreqPicker} transparent animationType="slide">
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <Text style={styles.subModalTitle}>Select Frequency</Text>
            {FREQUENCIES.map(freq => (
              <TouchableOpacity
                key={freq.value}
                onPress={() => {
                  handleChangeSetting('frequency', freq.value);
                  setShowFreqPicker(false);
                }}
                style={styles.subModalOption}
              >
                <Text style={[styles.subModalOptionText, settings.frequency === freq.value && { color: C.orange }]}>{freq.label}</Text>
                {settings.frequency === freq.value && <Check size={16} color={C.orange} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowFreqPicker(false)} style={styles.subModalClose}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 20,
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3.5,
    borderColor: C.orange,
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 3.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#22c55e',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#111318',
  },
  userName: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    gap: 10,
  },
  alertSuccess: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  alertError: {
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderColor: 'rgba(255,77,109,0.2)',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  menuItemSub: {
    fontSize: 11,
    color: C.muted2,
    marginTop: 2,
  },
  reportBadge: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  reportBadgeText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: {
    color: '#ff4d6d',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 28,
    alignItems: 'center',
    gap: 8,
  },
  footerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  footerVersion: {
    fontSize: 11,
    color: C.muted2,
    fontWeight: '600',
  },
  footerDev: {
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  footerDevText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  footerEmail: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '500',
  },
  footerCopyright: {
    fontSize: 10,
    color: C.muted2,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#14161c',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopWidth: 1.5,
    borderColor: C.border,
    maxHeight: '88%',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  modalTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  settingsBox: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  switchDesc: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252932',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  dropdownText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  logCard: {
    backgroundColor: '#1c1f26',
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 14,
  },
  logCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  logEmailSubject: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  logEmailInfo: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  logEmailStatus: {
    fontWeight: '700',
  },
  testBtn: {
    width: '100%',
    padding: 13,
    borderRadius: 12,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteContent: {
    backgroundColor: '#171a20',
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,77,109,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 8,
  },
  deleteDesc: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  cancelDeleteBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelDeleteText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmDeleteBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ff4d6d',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  subModalContent: {
    backgroundColor: '#14161c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  subModalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  subModalOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  subModalClose: {
    backgroundColor: '#252525',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
});
