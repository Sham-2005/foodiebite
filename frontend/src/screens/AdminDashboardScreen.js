import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Linking,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Activity, 
  BarChart2, 
  Trash2, 
  CheckCircle, 
  ShieldAlert, 
  XCircle, 
  RefreshCw,
  Search,
  Mail,
  UserCheck,
  UserX,
  ArrowLeft,
  ChevronRight,
  Key,
  Shield,
  Calendar,
  Clock,
  Send,
  Utensils,
  Lock,
  LogOut,
  ShieldCheck,
  UserPlus,
  Check,
  LayoutDashboard,
  Settings as SettingsIcon,
  Store,
  Compass,
  AlertCircle,
  AlertTriangle,
  Bell,
  Save,
  Sliders
} from 'lucide-react-native';
import { C, BackHeader, BtnOrange } from '../components/UI';
import { useApp } from '../context/AppContext';

// Code-split heavy admin modules on demand
const AdminIntelligenceSection = React.lazy(() => import('../components/AdminIntelligenceSection'));
const AdminEmailCampaignSection = React.lazy(() => import('../components/admin/AdminEmailCampaignSection'));
const AdminFeedbackSection = React.lazy(() => import('../components/admin/AdminFeedbackSection'));

import { 
  apiAdminLogin,
  getAdminSession,
  clearAdminSession,
  apiAdminCreateAccount,
  apiAdminGetUsers,
  apiAdminGetUserDetails,
  apiAdminUpdateUser,
  apiAdminDisableUser,
  apiAdminDeleteUser,
  apiAdminGetNotificationSettings,
  apiAdminUpdateNotificationSettings,
  apiSendTestEmail,
  apiAdminGetFeedback,
  apiAdminResolveFeedback,
  apiAdminDeleteFeedback,
  apiAdminGetAnalytics,
  apiAdminGetRestaurantRequests,
  apiAdminApproveRestaurantRequest,
  apiAdminRejectRestaurantRequest,
  apiAdminGetAuditLogs
} from '../services/api';
import AppLayout from '../components/AppLayout';

// Helpers
const formatDateTime = (dateVal) => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return String(dateVal);
  }
};

const getDietBadgeStyle = (diet) => {
  const d = String(diet || '').toLowerCase().trim();
  if (d.includes('non') || d.includes('meat') || d.includes('chicken') || d.includes('fish')) {
    return {
      label: 'Non-Veg',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: '#EF4444',
      color: '#F87171'
    };
  }
  if (d.includes('vegan')) {
    return {
      label: 'Vegan',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '#10B981',
      color: '#34D399'
    };
  }
  if (d.includes('egg')) {
    return {
      label: 'Eggetarian',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: '#F59E0B',
      color: '#FBBF24'
    };
  }
  if (d.includes('veg')) {
    return {
      label: 'Veg',
      bg: 'rgba(34, 197, 94, 0.15)',
      border: '#22C55E',
      color: '#4ADE80'
    };
  }
  if (d.includes('keto')) {
    return {
      label: 'Keto',
      bg: 'rgba(168, 85, 247, 0.15)',
      border: '#A855F7',
      color: '#C084FC'
    };
  }
  if (d && d !== 'not configured' && d !== 'none') {
    return {
      label: d.charAt(0).toUpperCase() + d.slice(1),
      bg: 'rgba(59, 130, 246, 0.15)',
      border: '#3B82F6',
      color: '#60A5FA'
    };
  }
  return {
    label: 'Standard',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: '#64748b',
    color: '#94a3b8'
  };
};

const getProviderInfo = (user) => {
  const p = (user?.authProvider || user?.provider || '').toLowerCase();
  if (p.includes('google')) {
    return { label: 'Google', bg: 'rgba(66, 133, 244, 0.15)', border: '#4285F4', text: '#93C5FD' };
  }
  return { label: 'Email', bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', text: '#6EE7B7' };
};

const getStatusInfo = (user) => {
  const isDisabled = user?.disabled === true || user?.accountStatus === 'disabled' || user?.accountStatus === 'suspended';
  if (isDisabled) {
    return { label: 'Disabled', bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', text: '#FCA5A5' };
  }
  return { label: 'Active', bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', text: '#6EE7B7' };
};

const formatDateOnly = (dateVal) => {
  if (!dateVal) return 'Recent';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateVal);
  }
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();

  const { user, logout } = useApp();

  // ── AUTHORIZED ADMINISTRATOR AUTHENTICATION STATE ────────
  // Sole authorized administrator: sham111205s@gmail.com
  const [adminSession, setAdminSession] = useState(() => {
    const existing = getAdminSession();
    if (existing && existing.admin?.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      return existing;
    }
    if (user && user.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      return {
        success: true,
        admin: {
          id: user.uid || user.id,
          email: 'sham111205s@gmail.com',
          name: user.displayName || 'Authorized Admin',
          role: 'admin'
        },
        token: user?.stsTokenManager?.accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('nb_token') : null) || 'admin_token'
      };
    }
    return null;
  });

  useEffect(() => {
    if (user && user.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      setAdminSession({
        success: true,
        admin: {
          id: user.uid || user.id,
          email: 'sham111205s@gmail.com',
          name: user.displayName || 'Authorized Admin',
          role: 'admin'
        },
        token: user?.stsTokenManager?.accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('nb_token') : null) || 'admin_token'
      });
    }
  }, [user]);

  const handleAdminLogout = async () => {
    try {
      clearAdminSession();
      setAdminSession(null);
      if (logout) {
        await logout();
      } else {
        await apiLogout();
        if (setUser) setUser(null);
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('nb_token');
      localStorage.removeItem('nb_active_session');
      localStorage.removeItem('nb_mock_active');
      localStorage.removeItem('foodiebite_admin_session');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('foodiebite_admin_session');
      sessionStorage.removeItem('foodiebite_redirect_after_login');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/signin';
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
    }
  };

  // Action banner for admin notifications
  const [actionBanner, setActionBanner] = useState(null); // { type: 'success' | 'error', message: '' }

  // Action confirmation modal (for reliable cross-platform web dialogs)
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    type: null, // 'disable' | 'delete_step1' | 'delete_step2'
    user: null,
    isDisable: false,
    loading: false,
    error: null
  });

  // Prompt Disable/Enable user modal
  const promptDisableUser = (targetUser) => {
    if (!targetUser) return;
    const isDisable = !targetUser.disabled;
    setConfirmModal({
      visible: true,
      type: 'disable',
      user: targetUser,
      isDisable,
      loading: false,
      error: null
    });
  };

  // Execute Disable/Enable user
  const executeDisableUser = async () => {
    const target = confirmModal.user;
    if (!target) return;
    const uid = target.id || target.uid;
    const nextDisabled = confirmModal.isDisable;
    setConfirmModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      await apiAdminDisableUser(uid, nextDisabled);
      setUsers(prev => prev.map(u => (u.id === uid || u.uid === uid) ? { ...u, disabled: nextDisabled, accountStatus: nextDisabled ? 'disabled' : 'active' } : u));
      if (selectedUserDetails && (selectedUserDetails.id === uid || selectedUserDetails.uid === uid)) {
        setSelectedUserDetails(prev => ({ ...prev, disabled: nextDisabled, accountStatus: nextDisabled ? 'disabled' : 'active' }));
      }
      setConfirmModal({ visible: false, type: null, user: null, isDisable: false, loading: false, error: null });
      setActionBanner({
        type: 'success',
        message: `User account "${target.email}" has been ${nextDisabled ? 'disabled' : 'enabled'} successfully.`
      });
      setTimeout(() => setActionBanner(null), 5000);
    } catch (err) {
      setConfirmModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to update account status.' }));
    }
  };

  // Prompt Delete Account - Step 1
  const promptDeleteUserStep1 = (targetUser) => {
    if (!targetUser) return;
    if (targetUser.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      setActionBanner({ type: 'error', message: 'The primary authorized administrator account cannot be deleted.' });
      setTimeout(() => setActionBanner(null), 5000);
      return;
    }
    setConfirmModal({
      visible: true,
      type: 'delete_step1',
      user: targetUser,
      isDisable: false,
      loading: false,
      error: null
    });
  };

  // Delete Account - Step 2 (Require second confirmation)
  const proceedToDeleteStep2 = () => {
    setConfirmModal(prev => ({ ...prev, type: 'delete_step2', error: null }));
  };

  // Execute Permanent Delete user
  const executeDeleteUser = async () => {
    const target = confirmModal.user;
    if (!target) return;
    const uid = target.id || target.uid;
    setConfirmModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      await apiAdminDeleteUser(uid);
      setUsers(prev => prev.filter(u => u.id !== uid && u.uid !== uid));
      handleBackToUsersList();
      setConfirmModal({ visible: false, type: null, user: null, isDisable: false, loading: false, error: null });
      setActionBanner({
        type: 'success',
        message: `User account "${target.email}" and all associated records have been permanently deleted.`
      });
      setTimeout(() => setActionBanner(null), 6000);
    } catch (err) {
      setConfirmModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to permanently delete user account.' }));
    }
  };

  // Notification Management State
  const [notificationSettings, setNotificationSettings] = useState({
    welcomeEmailEnabled: true,
    dailyRecommendationsEnabled: true,
    dailyRecommendationSchedule: '0 8 * * *',
    recommendationHour: 8,
    marketingEmailsEnabled: false,
    securityAlertsEnabled: true,
    adminFeedbackAlertsEnabled: true,
    provider: 'Brevo SMTP'
  });
  const [loadingNotificationSettings, setLoadingNotificationSettings] = useState(false);
  const [savingNotificationSettings, setSavingNotificationSettings] = useState(false);
  const [notificationSaveStatus, setNotificationSaveStatus] = useState(null); // { type, message }
  const [showNotificationManager, setShowNotificationManager] = useState(true);

  // Test Email state
  const [testEmailRecipient, setTestEmailRecipient] = useState('sham111205s@gmail.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  const loadNotificationSettings = async () => {
    setLoadingNotificationSettings(true);
    try {
      const res = await apiAdminGetNotificationSettings();
      if (res && res.success && res.settings) {
        setNotificationSettings(res.settings);
      }
    } catch (err) {
      console.warn('Failed to load notification settings:', err.message);
    } finally {
      setLoadingNotificationSettings(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotificationSettings(true);
    setNotificationSaveStatus(null);
    try {
      const res = await apiAdminUpdateNotificationSettings(notificationSettings);
      if (res && res.success) {
        setNotificationSaveStatus({
          type: 'success',
          message: 'Notification settings and scheduler configuration saved successfully!'
        });
        if (res.settings) setNotificationSettings(res.settings);
      } else {
        setNotificationSaveStatus({
          type: 'error',
          message: res?.message || 'Failed to save notification settings.'
        });
      }
    } catch (err) {
      setNotificationSaveStatus({
        type: 'error',
        message: err.message || 'Error saving notification preferences.'
      });
    } finally {
      setSavingNotificationSettings(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setTestEmailResult({
        success: false,
        message: 'Please provide a valid recipient email address.'
      });
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await apiSendTestEmail({
        to: testEmailRecipient.trim(),
        subject: 'FoodieBite Test Food Recommendation & Notification',
        message: 'This is a live test notification from FoodieBite Admin Dashboard to verify email delivery.',
        html: '<div style="font-family: sans-serif; padding: 20px; background: #111318; color: #fff;"><h2>FoodieBite Test Delivery</h2><p>This email confirms that FoodieBite email services and provider are operating correctly.</p></div>'
      });
      if (res && res.success) {
        setTestEmailResult({
          success: true,
          message: `Email dispatched successfully via Brevo SMTP! (Message ID: ${res.messageId || 'confirmed'})`
        });
      } else {
        setTestEmailResult({
          success: false,
          message: res?.message || 'Email delivery failed at provider.'
        });
      }
    } catch (err) {
      setTestEmailResult({
        success: false,
        message: `Provider Delivery Error: ${err.message}`
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Tab state: defaults to 'overview' (Main Dashboard) or URL query parameter
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const p = new URLSearchParams(window.location.search).get('tab');
        if (p && ['overview', 'users', 'campaigns', 'foods', 'analytics', 'feedback', 'settings'].includes(p)) {
          return p;
        }
      } catch (_) {}
    }
    return 'overview';
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for dashboard data
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [restaurantRequests, setRestaurantRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Search/Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [feedbackFilter, setFeedbackFilter] = useState('all'); // all, pending, resolved
  const [restaurantFilter, setRestaurantFilter] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  
  // User inspection details state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserSno, setSelectedUserSno] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [userDetailsError, setUserDetailsError] = useState(null);

  // Resolution inline state
  const [resolvingId, setResolvingId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const handleSelectUser = async (user, sno) => {
    const uid = user.id || user.uid;
    setSelectedUserId(uid);
    setSelectedUserSno(sno);
    setSelectedUserDetails(user);
    setLoadingUserDetails(true);
    setUserDetailsError(null);
    try {
      const res = await apiAdminGetUserDetails(uid);
      if (res && res.success && res.user) {
        setSelectedUserDetails(res.user);
      }
    } catch (err) {
      console.warn('Failed to load user info:', err.message);
      setUserDetailsError(err.message);
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleBackToUsersList = () => {
    setSelectedUserId(null);
    setSelectedUserSno(null);
    setSelectedUserDetails(null);
    setUserDetailsError(null);
  };

  // Browser back/forward popstate listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab') || 'overview';
      setActiveTab(tabParam);
      setSelectedUserId(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Dedicated Tab Navigation (for footer and top navigation)
  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'overview') {
      // Dashboard button — Special Requirement:
      // Always return admin to main Admin Dashboard view, reset inspection, update URL to /admin
      handleBackToUsersList();
      setUserSearch('');
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ tab: 'overview' }, '', '/admin');
      }
    } else {
      if (tabId !== 'users') {
        handleBackToUsersList();
      }
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({ tab: tabId }, '', `/admin?tab=${tabId}`);
      }
    }
  };

  // Targeted loaders for independent dashboard sections
  const loadOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, feedbackRes] = await Promise.all([
        apiAdminGetAnalytics().catch(() => ({ success: true, analytics: null })),
        apiAdminGetUsers().catch(() => ({ success: true, users: [] })),
        apiAdminGetFeedback().catch(() => ({ success: true, feedback: [] }))
      ]);

      if (statsRes?.success && statsRes.analytics) setStats(statsRes.analytics);
      if (usersRes?.success && usersRes.users) setUsers(usersRes.users);
      if (feedbackRes?.success && feedbackRes.feedback) setFeedback(feedbackRes.feedback);
    } catch (err) {
      console.error('Error loading admin overview data:', err);
      setError(err.message || 'Failed to fetch overview metrics.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsersData = async () => {
    setLoading(true);
    setError(null);
    try {
      const uRes = await apiAdminGetUsers();
      if (uRes?.success && Array.isArray(uRes.users)) {
        setUsers(uRes.users);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users directory.');
    } finally {
      setLoading(false);
    }
  };

  const loadFoodsData = async () => {
    setLoadingRequests(true);
    try {
      const reqsRes = await apiAdminGetRestaurantRequests();
      if (reqsRes?.success && reqsRes.requests) {
        setRestaurantRequests(reqsRes.requests);
      }
    } catch (err) {
      console.warn('Failed to load restaurant requests:', err.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadFeedbackData = async () => {
    setLoading(true);
    try {
      const fbRes = await apiAdminGetFeedback();
      if (fbRes?.success && fbRes.feedback) {
        setFeedback(fbRes.feedback);
      }
    } catch (err) {
      console.warn('Failed to load feedback:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dispatch data loader depending on active tab
  const loadData = () => {
    if (activeTab === 'overview') loadOverviewData();
    else if (activeTab === 'users') loadUsersData();
    else if (activeTab === 'foods') loadFoodsData();
    else if (activeTab === 'feedback') loadFeedbackData();
    else if (activeTab === 'settings') loadNotificationSettings();
    else loadOverviewData();
  };

  // Load only the data needed for the currently opened admin tab
  useEffect(() => {
    if (!adminSession) return;
    if (activeTab === 'overview' && !stats) {
      loadOverviewData();
    } else if (activeTab === 'users' && users.length === 0) {
      loadUsersData();
    } else if (activeTab === 'foods' && restaurantRequests.length === 0) {
      loadFoodsData();
    } else if (activeTab === 'feedback' && feedback.length === 0) {
      loadFeedbackData();
    } else if (activeTab === 'settings') {
      loadNotificationSettings();
    }
  }, [activeTab, adminSession]);

  const handleApproveRequest = async (id) => {
    try {
      await apiAdminApproveRestaurantRequest(id);
      const updated = await apiAdminGetRestaurantRequests();
      if (updated?.requests) setRestaurantRequests(updated.requests);
      Alert.alert('Approved', 'Restaurant listing approved successfully.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleRejectRequest = async (id) => {
    const reason = typeof window !== 'undefined' && window.prompt 
      ? window.prompt('Enter rejection reason for merchant:', 'Does not meet menu standards') 
      : 'Does not meet menu standards';
    if (reason !== null) {
      try {
        await apiAdminRejectRestaurantRequest(id, reason || 'Did not meet listing criteria');
        const updated = await apiAdminGetRestaurantRequests();
        if (updated?.requests) setRestaurantRequests(updated.requests);
        Alert.alert('Rejected', 'Restaurant request marked as rejected.');
      } catch (err) {
        Alert.alert('Error', err.message);
      }
    }
  };

  // Action: Toggle Role
  const handleToggleRole = (userId, currentRole) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    Alert.alert(
      "Confirm Role Change",
      `Are you sure you want to change this user's role to ${nextRole}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              await apiAdminUpdateUser(userId, { role: nextRole });
              setUsers(users.map(u => u.id === userId || u.uid === userId ? { ...u, role: nextRole } : u));
              if (selectedUserDetails && (selectedUserDetails.id === userId || selectedUserDetails.uid === userId)) {
                setSelectedUserDetails(prev => ({ ...prev, role: nextRole }));
              }
            } catch (err) {
              Alert.alert('Error', `Error toggling role: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  // Action: Disable/Enable Account
  const handleToggleDisable = (userId, currentDisabled) => {
    const nextDisabled = !currentDisabled;
    Alert.alert(
      nextDisabled ? "Disable Account" : "Enable Account",
      `Are you sure you want to ${nextDisabled ? 'DISABLE' : 'ENABLE'} this user account?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              await apiAdminDisableUser(userId, nextDisabled);
              setUsers(users.map(u => u.id === userId || u.uid === userId ? { ...u, disabled: nextDisabled } : u));
              if (selectedUserDetails && (selectedUserDetails.id === userId || selectedUserDetails.uid === userId)) {
                setSelectedUserDetails(prev => ({ ...prev, disabled: nextDisabled }));
              }
            } catch (err) {
              Alert.alert('Error', `Error updating account status: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  // Action: Resolve Feedback
  const handleResolveFeedback = async (feedbackId) => {
    if (!replyText.trim()) {
      Alert.alert('Required', 'Please enter a response message.');
      return;
    }
    try {
      await apiAdminResolveFeedback(feedbackId, replyText, 'resolved');
      setFeedback(feedback.map(f => f.id === feedbackId ? { ...f, status: 'resolved', replyMessage: replyText } : f));
      setResolvingId(null);
      setReplyText('');
      Alert.alert('Success', 'Feedback resolved and email reply sent.');
    } catch (err) {
      Alert.alert('Error', `Error resolving feedback: ${err.message}`);
    }
  };

  // Action: Delete Feedback
  const handleDeleteFeedback = (feedbackId) => {
    Alert.alert(
      "Delete Feedback",
      "Are you sure you want to delete this feedback document permanently?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await apiAdminDeleteFeedback(feedbackId);
              setFeedback(feedback.filter(f => f.id !== feedbackId));
            } catch (err) {
              Alert.alert('Error', `Error deleting feedback: ${err.message}`);
            }
          }
        }
      ]
    );
  };

  // Filtered lists
  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE);

  const filteredFeedback = feedback.filter(f => {
    if (feedbackFilter === 'pending') return f.status === 'pending';
    if (feedbackFilter === 'resolved') return f.status === 'resolved';
    return true;
  });

  if (!adminSession) {
    return (
      <AppLayout noPadding>
        <View style={{ flex: 1, backgroundColor: '#111318', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={{ color: C.muted, marginTop: 12 }}>Authenticating authorized administrator...</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout noPadding footer={<AdminFooter activeTab={activeTab} onTabSelect={handleTabSelect} />} hideNearby={true}>
      <BackHeader title="Admin Dashboard" right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.adminAuthPill}>
            <View style={styles.onlineDot} />
            <Text style={styles.adminAuthPillText} numberOfLines={1}>
              sham111205s@gmail.com
            </Text>
          </View>
          <TouchableOpacity onPress={loadData} style={{ padding: 4 }}>
            <RefreshCw size={15} color={C.orange} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleAdminLogout} 
            style={styles.adminLogoutBtn} 
            accessibilityLabel="Sign out of Admin Dashboard"
          >
            <LogOut size={12} color="#EF4444" style={{ marginRight: 3 }} />
            <Text style={styles.adminLogoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      } />

      {/* Global Admin Action Alert Banner */}
      {actionBanner && (
        <View style={[
          styles.actionBanner,
          actionBanner.type === 'success' ? styles.actionBannerSuccess : styles.actionBannerError
        ]}>
          {actionBanner.type === 'success' ? <CheckCircle size={16} color="#10B981" /> : <AlertTriangle size={16} color="#EF4444" />}
          <Text style={[styles.actionBannerText, { color: actionBanner.type === 'success' ? '#34D399' : '#F87171' }]}>
            {actionBanner.message}
          </Text>
          <TouchableOpacity onPress={() => setActionBanner(null)} style={{ padding: 4 }}>
            <XCircle size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        {loading && activeTab === 'overview' && !stats ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.orange} />
            <Text style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>Syncing dashboard metrics...</Text>
          </View>
        ) : error && activeTab === 'overview' && !stats ? (
          <View style={styles.errorBox}>
            <ShieldAlert size={48} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.errorTitle}>Access Denied or Connection Failure</Text>
            <Text style={styles.errorText}>{error}</Text>
            <BtnOrange onClick={loadData} style={{ width: 'auto', paddingHorizontal: 24, marginTop: 12 }}>Retry Load</BtnOrange>
          </View>
        ) : (
          <View>

            {/* OVERVIEW TAB (MAIN ADMIN DASHBOARD) */}
            {activeTab === 'overview' && (
              <View style={{ gap: 16 }}>
                {/* Greeting banner */}
                <View style={styles.overviewHeroCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <LayoutDashboard size={20} color={C.orange} />
                      <Text style={styles.overviewHeroTitle}>FoodieBite System Control Center</Text>
                    </View>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>Live Real-Time Sync</Text>
                    </View>
                  </View>
                  <Text style={styles.overviewHeroSub}>
                    Centralized platform administration for user directory, restaurant partnership approvals, and AI performance.
                  </Text>
                </View>

                {/* Metric Cards Grid */}
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => handleTabSelect('users')}
                      style={styles.metricCard}
                    >
                      <Users size={20} color={C.orange} style={{ marginBottom: 8 }} />
                      <Text style={styles.metricValue}>{users.length}</Text>
                      <Text style={styles.metricSub}>Registered Users Directory</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => handleTabSelect('users')}
                      style={styles.metricCard}
                    >
                      <UserCheck size={20} color="#10B981" style={{ marginBottom: 8 }} />
                      <Text style={styles.metricValue}>{users.filter(u => !u.disabled).length}</Text>
                      <Text style={styles.metricSub}>Active Consumer Accounts</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={styles.metricCard}>
                      <ShieldCheck size={20} color="#38BDF8" style={{ marginBottom: 8 }} />
                      <Text style={styles.metricValue}>Active</Text>
                      <Text style={styles.metricSub}>System Platform Health</Text>
                    </View>

                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => handleTabSelect('feedback')}
                      style={styles.metricCard}
                    >
                      <MessageSquare size={20} color="#F59E0B" style={{ marginBottom: 8 }} />
                      <Text style={styles.metricValue}>{feedback.length}</Text>
                      <Text style={styles.metricSub}>User Reviews & Feedback</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Navigation Panels */}
                <View style={{ gap: 10 }}>
                  <Text style={styles.sectionTitle}>Dashboard Quick Actions</Text>
                  
                  <TouchableOpacity 
                    onPress={() => handleTabSelect('users')}
                    style={styles.quickNavRow}
                  >
                    <View style={styles.quickNavIconBox}>
                      <Users size={18} color={C.orange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quickNavTitle}>Manage Users Directory</Text>
                      <Text style={styles.quickNavSub}>View all accounts, sign-in methods, roles, and real-time login histories.</Text>
                    </View>
                    <ChevronRight size={18} color={C.muted} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => handleTabSelect('feedback')}
                    style={styles.quickNavRow}
                  >
                    <View style={[styles.quickNavIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                      <MessageSquare size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quickNavTitle}>User Reviews & Feedback</Text>
                      <Text style={styles.quickNavSub}>Inspect customer reviews, reply to ratings, and resolve pending feedback tickets.</Text>
                    </View>
                    <ChevronRight size={18} color={C.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <View style={{ gap: 16 }}>
                <React.Suspense fallback={
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={C.orange} />
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Loading Analytics Module...</Text>
                  </View>
                }>
                  <AdminIntelligenceSection />
                </React.Suspense>

                {/* AI Coach Platform Health Status */}
                {stats && (
                <View style={styles.statusCard}>
                  <View style={styles.statusHeader}>
                    <Text style={styles.statusTitle}>AI Coach Platform Health</Text>
                    <View style={[styles.slaBadge, { backgroundColor: stats.aiSuccessRate > 90 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                      <Text style={[styles.slaText, { color: stats.aiSuccessRate > 90 ? '#10B981' : '#F59E0B' }]}>
                        {stats.aiSuccessRate}% SLA Success
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View style={styles.statusRow}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>Total Chat Queries processed:</Text>
                      <Text style={{ fontWeight: '700', color: '#fff', fontSize: 12 }}>{stats.totalAiQueries}</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>Primary AI (Gemini):</Text>
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 12 }}>{stats.geminiCount} requests</Text>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>Mock Fallback Engine triggers:</Text>
                      <Text style={{ color: stats.fallbackCount > 0 ? '#FF6B35' : C.muted, fontWeight: '700', fontSize: 12 }}>{stats.fallbackCount} sessions</Text>
                    </View>

                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${stats.totalAiQueries > 0 ? (stats.geminiCount / stats.totalAiQueries) * 100 : 100}%` }]} />
                    </View>
                    <Text style={styles.progressDesc}>
                      Orange indicates ratio of queries solved by Gemini without falling back.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              selectedUserId && selectedUserDetails ? (
                /* USER DETAILS INSPECTION VIEW */
                <View style={{ gap: 16 }}>
                  {/* Back Navigation Bar */}
                  <TouchableOpacity onPress={handleBackToUsersList} style={styles.backNavRow}>
                    <ArrowLeft size={16} color={C.orange} style={{ marginRight: 6 }} />
                    <Text style={styles.backNavText}>Back to Users List</Text>
                  </TouchableOpacity>

                  {/* Profile Header Card */}
                  <View style={styles.userDetailHeaderCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <View style={styles.userSnoBadge}>
                            <Text style={styles.userSnoBadgeText}>#{selectedUserSno || 1}</Text>
                          </View>
                          <Text style={styles.userDetailName}>
                            {selectedUserDetails.name || 'Anonymous User'}
                          </Text>
                          {selectedUserDetails.role === 'admin' ? (
                            <View style={styles.adminTag}>
                              <Text style={styles.adminTagText}>ADMIN</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Mail size={12} color={C.muted} />
                          <Text style={styles.userDetailEmail}>{selectedUserDetails.email}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[
                          styles.statusBadge,
                          selectedUserDetails.disabled ? { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' } : { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' },
                          { borderWidth: 1 }
                        ]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: selectedUserDetails.disabled ? '#EF4444' : '#10B981' }}>
                            {selectedUserDetails.disabled ? 'Disabled' : 'Active Account'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Metadata Grid */}
                    <View style={styles.metaGrid}>
                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Auth Provider</Text>
                        <Text style={[styles.metaGridValue, { color: selectedUserDetails.authProvider === 'google.com' ? '#38BDF8' : '#FBBF24', textTransform: 'capitalize' }]}>
                          {selectedUserDetails.authProvider === 'google.com' ? 'Google' : (selectedUserDetails.authProvider || 'Password')}
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Account Status</Text>
                        <Text style={[styles.metaGridValue, { color: selectedUserDetails.disabled ? '#EF4444' : '#10B981' }]}>
                          {selectedUserDetails.disabled ? 'Disabled' : 'Active Account'}
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Registered Date</Text>
                        <Text style={styles.metaGridValue}>
                          {formatDateTime(selectedUserDetails.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Last Sign-in</Text>
                        <Text style={styles.metaGridValue}>
                          {formatDateTime(selectedUserDetails.lastSignInTime || selectedUserDetails.lastActiveAt || selectedUserDetails.createdAt)}
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Dietary Type</Text>
                        {(() => {
                          const b = getDietBadgeStyle(selectedUserDetails.dietType || selectedUserDetails.preferences?.dietType);
                          return (
                            <View style={[styles.dietBadge, { backgroundColor: b.bg, borderColor: b.border, alignSelf: 'flex-start', marginTop: 4 }]}>
                              <Text style={[styles.dietBadgeText, { color: b.color }]}>{b.label}</Text>
                            </View>
                          );
                        })()}
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Email Verification</Text>
                        <Text style={[styles.metaGridValue, { color: selectedUserDetails.emailVerified ? '#10B981' : '#F59E0B' }]}>
                          {selectedUserDetails.emailVerified ? 'Verified' : 'Unverified'}
                        </Text>
                      </View>
                    </View>

                    {/* Admin Action Buttons */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                      <TouchableOpacity 
                        onPress={() => promptDisableUser(selectedUserDetails)}
                        style={[
                          styles.userActionBtn,
                          selectedUserDetails.disabled ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' } : { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' }
                        ]}
                      >
                        {selectedUserDetails.disabled ? <UserCheck size={13} color="#10B981" /> : <UserX size={13} color="#EF4444" />}
                        <Text style={[styles.userActionBtnText, { color: selectedUserDetails.disabled ? '#10B981' : '#EF4444' }]}>
                          {selectedUserDetails.disabled ? 'Enable Account' : 'Disable Account'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => promptDeleteUserStep1(selectedUserDetails)}
                        style={[
                          styles.userActionBtn,
                          { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' }
                        ]}
                      >
                        <Trash2 size={13} color="#EF4444" />
                        <Text style={[styles.userActionBtnText, { color: '#EF4444' }]}>
                          Permanently Delete Account
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* SECTION 1: SENT EMAIL HISTORY */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Mail size={16} color={C.orange} />
                        <Text style={styles.sectionTitle}>Sent Email History</Text>
                      </View>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {(selectedUserDetails.emails || []).length} Dispatched
                        </Text>
                      </View>
                    </View>

                    {loadingUserDetails ? (
                      <View style={{ padding: 18, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={C.orange} />
                        <Text style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Loading sent email records...</Text>
                      </View>
                    ) : (selectedUserDetails.emails && selectedUserDetails.emails.length > 0) ? (
                      <View style={{ gap: 10, marginTop: 12 }}>
                        {selectedUserDetails.emails.map((em, idx) => (
                          <View key={em.id || idx} style={styles.emailLogCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.emailSubjectText} numberOfLines={2}>
                                  {em.subject}
                                </Text>
                                <Text style={styles.emailRecipientText}>
                                  Recipient: {em.recipient}
                                </Text>
                                {em.sender ? (
                                  <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                    From: {em.sender}
                                  </Text>
                                ) : null}
                                {em.details ? (
                                  <View style={styles.emailSnippetBox}>
                                    <Text style={styles.emailSnippetText} numberOfLines={3}>
                                      "{em.details}"
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <View style={styles.deliveredPill}>
                                  <CheckCircle size={10} color="#10B981" style={{ marginRight: 3 }} />
                                  <Text style={styles.deliveredPillText}>{String(em.status || 'Delivered').toUpperCase()}</Text>
                                </View>
                                <Text style={styles.emailTimestampText}>
                                  {formatDateTime(em.timestamp)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.emptyStateContainer}>
                        <Mail size={22} color="#334155" style={{ marginBottom: 6 }} />
                        <Text style={styles.emptyStateTitle}>No emails dispatched yet</Text>
                        <Text style={styles.emptyStateSub}>No automated notifications, password reset links, or support replies have been dispatched to {selectedUserDetails.email}.</Text>
                      </View>
                    )}
                  </View>

                  {/* SECTION 2: USER ACTIVITY & SECURITY LOG */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} color={C.orange} />
                        <Text style={styles.sectionTitle}>User Activities & Security Events</Text>
                      </View>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {(selectedUserDetails.activities || []).length} Events
                        </Text>
                      </View>
                    </View>

                    {loadingUserDetails ? (
                      <View style={{ padding: 18, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={C.orange} />
                        <Text style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Loading user activity timeline...</Text>
                      </View>
                    ) : (selectedUserDetails.activities && selectedUserDetails.activities.length > 0) ? (
                      <View style={{ gap: 8, marginTop: 12 }}>
                        {selectedUserDetails.activities.filter(act => act.type !== 'medical_report').map((act, idx) => {
                          const isPassword = act.type === 'password_change';
                          const isLogin = act.type === 'login';
                          const isReg = act.type === 'registration';
                          const isFb = act.type === 'feedback';
                          const isPref = act.type === 'preference_update';

                          let eventIconColor = '#94a3b8';
                          if (isPassword) {
                            eventIconColor = '#F59E0B';
                          } else if (isLogin) {
                            eventIconColor = '#10B981';
                          } else if (isReg) {
                            eventIconColor = '#3B82F6';
                          } else if (isFb) {
                            eventIconColor = '#A855F7';
                          } else if (isPref) {
                            eventIconColor = '#22C55E';
                          }

                          return (
                            <View key={act.id || idx} style={[styles.activityEventCard, { borderLeftColor: eventIconColor }]}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    {isPassword ? <Key size={12} color={eventIconColor} /> :
                                     isLogin ? <UserCheck size={12} color={eventIconColor} /> :
                                     isReg ? <Users size={12} color={eventIconColor} /> :
                                     isFb ? <MessageSquare size={12} color={eventIconColor} /> :
                                     isPref ? <Utensils size={12} color={eventIconColor} /> :
                                     <Activity size={12} color={eventIconColor} />}
                                    <Text style={[styles.activityEventTitle, { color: isPassword ? '#F59E0B' : '#fff' }]}>
                                      {act.title}
                                    </Text>
                                  </View>
                                  <Text style={styles.activityEventDetails}>
                                    {act.details}
                                  </Text>
                                </View>

                                <Text style={styles.activityTimestampText}>
                                  {formatDateTime(act.timestamp)}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.emptyStateContainer}>
                        <Clock size={22} color="#334155" style={{ marginBottom: 6 }} />
                        <Text style={styles.emptyStateTitle}>No recorded activities</Text>
                        <Text style={styles.emptyStateSub}>No recent password changes, logins, or profile modifications found for this account.</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                /* ORGANIZED USERS TABLE VIEW */
                <View style={{ gap: 14 }}>
                  {/* Search bar */}
                  <View style={styles.searchBar}>
                    <Search size={16} color={C.muted} />
                    <TextInput 
                      placeholder="Search by username, email, or diet type..." 
                      placeholderTextColor="#444"
                      value={userSearch}
                      onChangeText={setUserSearch}
                      style={styles.searchInput}
                    />
                  </View>

                  {/* Summary row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 12, color: C.muted }}>
                      Showing <Text style={{ color: '#fff', fontWeight: '700' }}>{filteredUsers.length}</Text> registered users
                    </Text>
                    <Text style={{ fontSize: 11, color: C.orange }}>Click any user row to view details</Text>
                  </View>

                  {/* Table Container */}
                  <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: '100%' }}>
                      <View style={{ minWidth: 700, flex: 1 }}>
                        {/* Table Header Row */}
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { width: 44, textAlign: 'center' }]}>S.No</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.4, paddingLeft: 8 }]}>User & Provider</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>Email Address</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Registered</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>Last Login</Text>
                          <Text style={[styles.tableHeaderCell, { width: 78, textAlign: 'center' }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { width: 32, textAlign: 'center' }]}></Text>
                        </View>

                        {/* Table Body */}
                        {filteredUsers.length === 0 ? (
                          <View style={{ padding: 28, alignItems: 'center' }}>
                            <Text style={styles.emptyText}>No users match search criteria</Text>
                          </View>
                        ) : (
                          paginatedUsers.map((user, index) => {
                            const globalIndex = (userPage - 1) * USERS_PER_PAGE + index;
                            const userName = user.name || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
                            const provider = getProviderInfo(user);
                            const status = getStatusInfo(user);
                            const regDate = formatDateOnly(user.createdAt || user.metadata?.creationTime || user.registrationDate);
                            const lastLogin = formatDateOnly(user.lastSignInTime || user.lastLoginAt || user.lastLogin || user.metadata?.lastSignInTime);

                            return (
                              <TouchableOpacity 
                                key={user.id || user.uid || globalIndex} 
                                activeOpacity={0.7}
                                onPress={() => handleSelectUser(user, globalIndex + 1)}
                                style={[
                                  styles.tableRow,
                                  globalIndex % 2 === 1 ? { backgroundColor: 'rgba(255,255,255,0.015)' } : null,
                                  user.disabled ? { opacity: 0.6 } : null
                                ]}
                              >
                                {/* 1. S.No */}
                                <Text style={[styles.tableCellText, { width: 44, textAlign: 'center', color: C.muted, fontWeight: '700' }]}>
                                  {globalIndex + 1}
                                </Text>

                                {/* 2. User & Provider */}
                                <View style={{ flex: 1.4, paddingLeft: 8, paddingRight: 6 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={[styles.tableCellText, { fontWeight: '700', color: '#fff' }]} numberOfLines={1}>
                                      {userName}
                                    </Text>
                                    {user.role === 'admin' ? (
                                      <View style={styles.adminTag}>
                                        <Text style={styles.adminTagText}>ADMIN</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <View style={{ flexDirection: 'row', marginTop: 3 }}>
                                    <View style={[styles.providerPill, { backgroundColor: provider.bg, borderColor: provider.border }]}>
                                      <Text style={[styles.providerPillText, { color: provider.text }]}>
                                        {provider.label}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* 3. Email Address */}
                                <View style={{ flex: 1.8, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: '#cbd5e1' }]} numberOfLines={1}>
                                    {user.email || 'No email provided'}
                                  </Text>
                                </View>

                                {/* 4. Registered Date */}
                                <View style={{ flex: 1.1, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: C.muted, fontSize: 11 }]} numberOfLines={1}>
                                    {regDate}
                                  </Text>
                                </View>

                                {/* 5. Last Login */}
                                <View style={{ flex: 1.1, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: '#94a3b8', fontSize: 11 }]} numberOfLines={1}>
                                    {lastLogin}
                                  </Text>
                                </View>

                                {/* 6. Status */}
                                <View style={{ width: 78, alignItems: 'center' }}>
                                  <View style={[styles.userStatusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
                                    <Text style={[styles.userStatusBadgeText, { color: status.text }]}>
                                      {status.label}
                                    </Text>
                                  </View>
                                </View>

                                {/* Action chevron */}
                                <View style={{ width: 32, alignItems: 'center' }}>
                                  <ChevronRight size={15} color={C.muted} />
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </ScrollView>

                    {/* Clean Pagination Controls Bar */}
                    {filteredUsers.length > USERS_PER_PAGE && (
                      <View style={styles.paginationRow}>
                        <Text style={styles.paginationInfoText}>
                          Showing {(userPage - 1) * USERS_PER_PAGE + 1}–{Math.min(userPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            disabled={userPage <= 1}
                            onPress={() => setUserPage(p => Math.max(1, p - 1))}
                            style={[styles.pageBtn, userPage <= 1 && styles.pageBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel="Previous page"
                          >
                            <Text style={[styles.pageBtnText, userPage <= 1 && styles.pageBtnTextDisabled]}>Previous</Text>
                          </TouchableOpacity>
                          <View style={styles.pageIndicator}>
                            <Text style={styles.pageIndicatorText}>{userPage} / {totalUserPages}</Text>
                          </View>
                          <TouchableOpacity
                            disabled={userPage >= totalUserPages}
                            onPress={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                            style={[styles.pageBtn, userPage >= totalUserPages && styles.pageBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel="Next page"
                          >
                            <Text style={[styles.pageBtnText, userPage >= totalUserPages && styles.pageBtnTextDisabled]}>Next</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )
            )}

            {/* FEEDBACK TAB */}
            {activeTab === 'feedback' && (
              <React.Suspense fallback={
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={C.orange} />
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Loading Feedback Module...</Text>
                </View>
              }>
                <AdminFeedbackSection adminUser={adminSession} />
              </React.Suspense>
            )}

            {/* EMAIL CAMPAIGNS TAB */}
            {activeTab === 'campaigns' && (
              <React.Suspense fallback={
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={C.orange} />
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Loading Campaigns Module...</Text>
                </View>
              }>
                <AdminEmailCampaignSection users={users} onRefreshUsers={loadData} />
              </React.Suspense>
            )}

            {/* FOOD MANAGEMENT TAB */}
            {activeTab === 'foods' && (
              <View style={{ gap: 16 }}>
                {/* Header card with summary */}
                <View style={styles.foodMgmtHeaderCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Utensils size={20} color={C.orange} />
                      <Text style={styles.foodMgmtTitle}>Restaurant & Food Discovery Management</Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        setLoadingRequests(true);
                        try {
                          const res = await apiAdminGetRestaurantRequests();
                          if (res?.requests) setRestaurantRequests(res.requests);
                        } finally {
                          setLoadingRequests(false);
                        }
                      }}
                      style={styles.refreshSmallBtn}
                    >
                      <RefreshCw size={13} color={C.orange} />
                      <Text style={styles.refreshSmallBtnText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.foodMgmtSub}>
                    Manage merchant onboarding requests, live OpenStreetMap discovery caches, and allergen compliance standards.
                  </Text>
                </View>

                {/* Filter selector: ALL, PENDING, APPROVED, REJECTED */}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'ALL', label: `All Requests (${restaurantRequests.length})` },
                    { id: 'PENDING', label: `Pending (${restaurantRequests.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length})` },
                    { id: 'APPROVED', label: `Approved (${restaurantRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length})` },
                    { id: 'REJECTED', label: `Rejected (${restaurantRequests.filter(r => (r.status || '').toLowerCase() === 'rejected').length})` }
                  ].map(f => (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setRestaurantFilter(f.id)}
                      style={[
                        styles.filterTab,
                        restaurantFilter === f.id ? { backgroundColor: C.card2, borderColor: C.border } : { backgroundColor: 'transparent', borderColor: 'transparent' }
                      ]}
                    >
                      <Text style={[styles.filterTabText, restaurantFilter === f.id ? { color: '#fff' } : { color: C.muted }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Requests List */}
                <View style={{ gap: 12 }}>
                  {(() => {
                    const filteredReqs = restaurantRequests.filter(r => {
                      if (restaurantFilter === 'ALL') return true;
                      return (r.status || 'pending').toUpperCase() === restaurantFilter;
                    });

                    if (filteredReqs.length === 0) {
                      return (
                        <View style={styles.emptyCardBox}>
                          <Store size={36} color="#334155" style={{ marginBottom: 10 }} />
                          <Text style={styles.emptyStateTitle}>No Restaurant Requests Found</Text>
                          <Text style={styles.emptyStateSub}>
                            {restaurantFilter === 'PENDING'
                              ? 'All incoming merchant onboarding requests have been verified and processed.'
                              : 'No restaurant applications matching this filter.'}
                          </Text>
                        </View>
                      );
                    }

                    return filteredReqs.map(req => {
                      const isPending = (req.status || 'pending').toLowerCase() === 'pending';
                      const isApproved = (req.status || '').toLowerCase() === 'approved';
                      const isRejected = (req.status || '').toLowerCase() === 'rejected';

                      let badgeColor = '#F59E0B';
                      let badgeBg = 'rgba(245, 158, 11, 0.12)';
                      if (isApproved) {
                        badgeColor = '#10B981';
                        badgeBg = 'rgba(16, 185, 129, 0.12)';
                      } else if (isRejected) {
                        badgeColor = '#EF4444';
                        badgeBg = 'rgba(239, 68, 68, 0.12)';
                      }

                      return (
                        <View key={req.id} style={styles.reqCard}>
                          <View style={styles.reqCardHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.reqRestaurantName}>{req.restaurantName || req.name || 'Unnamed Merchant'}</Text>
                                <View style={[styles.reqStatusBadge, { backgroundColor: badgeBg }]}>
                                  <Text style={[styles.reqStatusText, { color: badgeColor }]}>
                                    {(req.status || 'PENDING').toUpperCase()}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.reqCuisineSub}>{req.cuisine || 'Multi-Cuisine'} • {req.dietaryOptions || 'Standard'}</Text>
                            </View>
                            <Text style={styles.reqDateText}>
                              {formatDateOnly(req.createdAt || req.submittedAt)}
                            </Text>
                          </View>

                          <View style={styles.reqDetailsGrid}>
                            <View style={styles.reqDetailItem}>
                              <Text style={styles.reqDetailLabel}>Contact Person:</Text>
                              <Text style={styles.reqDetailValue}>{req.contactPerson || req.contactName || 'N/A'}</Text>
                            </View>
                            <View style={styles.reqDetailItem}>
                              <Text style={styles.reqDetailLabel}>Email:</Text>
                              <Text style={styles.reqDetailValue}>{req.email || req.contactEmail || 'N/A'}</Text>
                            </View>
                            <View style={styles.reqDetailItem}>
                              <Text style={styles.reqDetailLabel}>Phone:</Text>
                              <Text style={styles.reqDetailValue}>{req.phone || req.contactPhone || 'N/A'}</Text>
                            </View>
                            <View style={styles.reqDetailItem}>
                              <Text style={styles.reqDetailLabel}>Location:</Text>
                              <Text style={styles.reqDetailValue}>{req.address || req.city || 'Chennai, India'}</Text>
                            </View>
                          </View>

                          {req.notes ? (
                            <View style={styles.reqNotesBox}>
                              <Text style={styles.reqNotesText}>
                                <Text style={{ fontWeight: '700', color: '#cbd5e1' }}>Merchant Notes: </Text>
                                {req.notes}
                              </Text>
                            </View>
                          ) : null}

                          {req.rejectionReason ? (
                            <View style={[styles.reqNotesBox, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                              <Text style={[styles.reqNotesText, { color: '#F87171' }]}>
                                <Text style={{ fontWeight: '700' }}>Rejection Reason: </Text>
                                {req.rejectionReason}
                              </Text>
                            </View>
                          ) : null}

                          {/* Approval Actions */}
                          {isPending && (
                            <View style={styles.reqActionRow}>
                              <TouchableOpacity
                                onPress={() => handleApproveRequest(req.id)}
                                style={styles.approveBtn}
                              >
                                <Check size={14} color="#fff" />
                                <Text style={styles.approveBtnText}>Approve & Publish</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleRejectRequest(req.id)}
                                style={styles.rejectBtn}
                              >
                                <X size={14} color="#EF4444" />
                                <Text style={styles.rejectBtnText}>Reject Application</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    });
                  })()}
                </View>

                {/* Overpass Food Discovery Caching & Sync Card */}
                <View style={styles.cacheControlCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Compass size={18} color="#10B981" />
                    <Text style={styles.cacheControlTitle}>Live OSM Discovery & Search Cache</Text>
                  </View>
                  <Text style={styles.cacheControlSub}>
                    Local restaurants are indexed from OpenStreetMap Overpass API and cached in memory with a 15-minute TTL.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Cache Purged', 'Local discovery cache cleared successfully.')}
                      style={styles.purgeCacheBtn}
                    >
                      <Trash2 size={13} color="#fff" />
                      <Text style={styles.purgeCacheBtnText}>Purge Search Cache</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <View style={{ gap: 16 }}>
                {/* Admin Session Security Card */}
                <View style={styles.settingsCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Shield size={20} color={C.orange} />
                      <Text style={styles.settingsTitle}>Administrator Access & Session</Text>
                    </View>
                    <View style={styles.onlineDotWrap}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineDotText}>Authenticated</Text>
                    </View>
                  </View>

                  <View style={styles.settingsInfoGrid}>
                    <View style={styles.settingsInfoRow}>
                      <Text style={styles.settingsInfoLabel}>Authorized Admin Email:</Text>
                      <Text style={[styles.settingsInfoValue, { color: C.orange }]}>sham111205s@gmail.com</Text>
                    </View>
                    <View style={styles.settingsInfoRow}>
                      <Text style={styles.settingsInfoLabel}>Privilege Level:</Text>
                      <Text style={[styles.settingsInfoValue, { color: C.orange, fontWeight: '700' }]}>Super Administrator (Root)</Text>
                    </View>
                    <View style={styles.settingsInfoRow}>
                      <Text style={styles.settingsInfoLabel}>Email Authorization:</Text>
                      <Text style={[styles.settingsInfoValue, { color: '#10B981' }]}>Verified Exclusive Access</Text>
                    </View>
                    <View style={styles.settingsInfoRow}>
                      <Text style={styles.settingsInfoLabel}>Session Auth Method:</Text>
                      <Text style={styles.settingsInfoValue}>Firebase Identity & JWT Token</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={handleAdminLogout}
                      style={styles.lockSessionBtn}
                    >
                      <LogOut size={14} color="#EF4444" />
                      <Text style={styles.lockSessionBtnText}>Lock & Terminate Admin Session</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Notification Management & Email Sending Card */}
                <View style={styles.settingsCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Bell size={20} color={C.orange} />
                      <Text style={styles.settingsTitle}>Notification & Email Delivery</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowNotificationManager(!showNotificationManager)}
                      style={[styles.refreshSmallBtn, { backgroundColor: showNotificationManager ? C.orange : 'rgba(255,107,53,0.15)' }]}
                    >
                      <Sliders size={13} color={showNotificationManager ? '#fff' : C.orange} />
                      <Text style={[styles.refreshSmallBtnText, { color: showNotificationManager ? '#fff' : C.orange }]}>
                        {showNotificationManager ? 'Hide Notifications' : 'Manage Notifications'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.settingsSub}>
                    Configure automated system emails, scheduled daily food recommendations, and test email provider delivery status.
                  </Text>

                  {showNotificationManager && (
                    <View style={{ marginTop: 16, gap: 14 }}>
                      {/* Save status notification */}
                      {notificationSaveStatus && (
                        <View style={[
                          styles.statusAlertCard,
                          notificationSaveStatus.type === 'success' ? styles.statusAlertSuccess : styles.statusAlertError
                        ]}>
                          {notificationSaveStatus.type === 'success' ? <CheckCircle size={16} color="#10B981" /> : <AlertTriangle size={16} color="#EF4444" />}
                          <Text style={[
                            styles.statusAlertText,
                            { color: notificationSaveStatus.type === 'success' ? '#34D399' : '#F87171' }
                          ]}>
                            {notificationSaveStatus.message}
                          </Text>
                        </View>
                      )}

                      {/* Preferences Section */}
                      <View style={styles.notificationGroupCard}>
                        <Text style={styles.notificationGroupHeader}>Automated Email Preferences</Text>
                        
                        {/* 1. Welcome Email */}
                        <View style={styles.notificationToggleRow}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.toggleRowTitle}>Welcome Email</Text>
                            <Text style={styles.toggleRowSub}>Send onboarding welcome email when a new user registers on FoodieBite</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setNotificationSettings(prev => ({ ...prev, welcomeEmailEnabled: !prev.welcomeEmailEnabled }))}
                            style={[styles.togglePill, notificationSettings.welcomeEmailEnabled ? styles.togglePillActive : styles.togglePillInactive]}
                          >
                            <Text style={styles.togglePillText}>{notificationSettings.welcomeEmailEnabled ? 'ENABLED' : 'DISABLED'}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* 2. Daily Recommendations */}
                        <View style={styles.notificationToggleRow}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.toggleRowTitle}>Daily Food Recommendations</Text>
                            <Text style={styles.toggleRowSub}>Send daily AI food recommendation emails matching user dietary preferences</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setNotificationSettings(prev => ({ ...prev, dailyRecommendationsEnabled: !prev.dailyRecommendationsEnabled }))}
                            style={[styles.togglePill, notificationSettings.dailyRecommendationsEnabled ? styles.togglePillActive : styles.togglePillInactive]}
                          >
                            <Text style={styles.togglePillText}>{notificationSettings.dailyRecommendationsEnabled ? 'ENABLED' : 'DISABLED'}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* 3. Cron Schedule Input */}
                        <View style={{ paddingTop: 10, paddingBottom: 6 }}>
                          <Text style={styles.toggleRowTitle}>Recommendation Dispatch Schedule (Cron Expression)</Text>
                          <Text style={styles.toggleRowSub}>Cron schedule for automated daily recommendation batch delivery</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                            <TextInput
                              style={styles.scheduleInput}
                              value={notificationSettings.dailyRecommendationSchedule || '0 8 * * *'}
                              onChangeText={(txt) => setNotificationSettings(prev => ({ ...prev, dailyRecommendationSchedule: txt }))}
                              placeholder="0 8 * * *"
                              placeholderTextColor="#555"
                            />
                            <Text style={{ fontSize: 12, color: C.muted }}>Default: 8:00 AM (0 8 * * *)</Text>
                          </View>
                        </View>

                        {/* 4. Marketing Emails */}
                        <View style={styles.notificationToggleRow}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.toggleRowTitle}>Promotional & Campaign Emails</Text>
                            <Text style={styles.toggleRowSub}>Permit manual and periodic email campaign blasts</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setNotificationSettings(prev => ({ ...prev, marketingEmailsEnabled: !prev.marketingEmailsEnabled }))}
                            style={[styles.togglePill, notificationSettings.marketingEmailsEnabled ? styles.togglePillActive : styles.togglePillInactive]}
                          >
                            <Text style={styles.togglePillText}>{notificationSettings.marketingEmailsEnabled ? 'ENABLED' : 'DISABLED'}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* 5. Security Alerts */}
                        <View style={styles.notificationToggleRow}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.toggleRowTitle}>Security & Account Alerts</Text>
                            <Text style={styles.toggleRowSub}>Immediate dispatch of password change and account security notices</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setNotificationSettings(prev => ({ ...prev, securityAlertsEnabled: !prev.securityAlertsEnabled }))}
                            style={[styles.togglePill, notificationSettings.securityAlertsEnabled ? styles.togglePillActive : styles.togglePillInactive]}
                          >
                            <Text style={styles.togglePillText}>{notificationSettings.securityAlertsEnabled ? 'ENABLED' : 'DISABLED'}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* 6. Admin Feedback Alerts */}
                        <View style={[styles.notificationToggleRow, { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.toggleRowTitle}>Admin Feedback Notifications</Text>
                            <Text style={styles.toggleRowSub}>Notify administrator when users submit new platform feedback</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setNotificationSettings(prev => ({ ...prev, adminFeedbackAlertsEnabled: !prev.adminFeedbackAlertsEnabled }))}
                            style={[styles.togglePill, notificationSettings.adminFeedbackAlertsEnabled ? styles.togglePillActive : styles.togglePillInactive]}
                          >
                            <Text style={styles.togglePillText}>{notificationSettings.adminFeedbackAlertsEnabled ? 'ENABLED' : 'DISABLED'}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Save button */}
                        <TouchableOpacity
                          onPress={handleSaveNotificationSettings}
                          disabled={savingNotificationSettings}
                          style={[styles.saveNotificationBtn, savingNotificationSettings && { opacity: 0.7 }]}
                        >
                          {savingNotificationSettings ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Save size={15} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.saveNotificationBtnText}>Save Notification Settings</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Test Email Dispatch Section */}
                      <View style={styles.notificationGroupCard}>
                        <Text style={styles.notificationGroupHeader}>Verify Email Service & Provider Delivery</Text>
                        <Text style={styles.toggleRowSub}>
                          Send a live test email through Brevo SMTP to verify connectivity and real provider delivery without mock data.
                        </Text>

                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.toggleRowTitle}>Recipient Email Address</Text>
                          <TextInput
                            style={styles.testEmailInput}
                            value={testEmailRecipient}
                            onChangeText={setTestEmailRecipient}
                            placeholder="admin@foodiebite.com"
                            placeholderTextColor="#555"
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                        </View>

                        <TouchableOpacity
                          onPress={handleSendTestEmail}
                          disabled={sendingTestEmail}
                          style={[styles.sendTestEmailBtn, sendingTestEmail && { opacity: 0.7 }]}
                        >
                          {sendingTestEmail ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Send size={15} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={styles.saveNotificationBtnText}>Dispatch Live Test Email</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* Test Result Display */}
                        {testEmailResult && (
                          <View style={[
                            styles.testResultCard,
                            testEmailResult.success ? styles.testResultSuccess : styles.testResultError
                          ]}>
                            {testEmailResult.success ? <CheckCircle size={16} color="#10B981" /> : <AlertTriangle size={16} color="#EF4444" />}
                            <Text style={[
                              styles.testResultText,
                              { color: testEmailResult.success ? '#34D399' : '#F87171' }
                            ]}>
                              {testEmailResult.message}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* Audit Logs Card */}
                <View style={styles.settingsCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Activity size={18} color="#38BDF8" />
                      <Text style={styles.settingsTitle}>Security Audit Logs</Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        setLoadingAuditLogs(true);
                        try {
                          const res = await apiAdminGetAuditLogs();
                          if (res?.logs) setAuditLogs(res.logs);
                        } finally {
                          setLoadingAuditLogs(false);
                        }
                      }}
                      style={styles.refreshSmallBtn}
                    >
                      <RefreshCw size={13} color={C.orange} />
                      <Text style={styles.refreshSmallBtnText}>Sync Logs</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.settingsSub}>
                    Immutable log of administrative operations, role modifications, and authentication transactions.
                  </Text>

                  <View style={{ gap: 8, marginTop: 12 }}>
                    {auditLogs.length === 0 ? (
                      <View style={{ padding: 18, alignItems: 'center' }}>
                        <Text style={styles.emptyText}>No administrative audit records logged yet.</Text>
                      </View>
                    ) : (
                      auditLogs.map((log, idx) => (
                        <View key={log.id || idx} style={styles.auditLogItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.auditLogAction}>{log.action || log.event || 'System Event'}</Text>
                            <Text style={styles.auditLogDate}>{formatDateTime(log.timestamp || log.createdAt)}</Text>
                          </View>
                          <Text style={styles.auditLogDetails}>
                            {log.details || log.description || `Executed by ${log.performedBy || 'Admin'}`}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            )}

          </View>
        )}
      </ScrollView>

      {/* Action Confirmation Modal (Cross-platform Web & Native) */}
      <Modal
        visible={confirmModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!confirmModal.loading) {
            setConfirmModal({ visible: false, type: null, user: null, isDisable: false, loading: false, error: null });
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[
                styles.modalIconBox,
                confirmModal.type === 'delete_step2' ? { backgroundColor: 'rgba(239,68,68,0.2)' } :
                confirmModal.type === 'delete_step1' ? { backgroundColor: 'rgba(245,158,11,0.2)' } :
                confirmModal.isDisable ? { backgroundColor: 'rgba(239,68,68,0.2)' } : { backgroundColor: 'rgba(16,185,129,0.2)' }
              ]}>
                {confirmModal.type === 'delete_step2' ? <Trash2 size={24} color="#EF4444" /> :
                 confirmModal.type === 'delete_step1' ? <AlertTriangle size={24} color="#F59E0B" /> :
                 confirmModal.isDisable ? <UserX size={24} color="#EF4444" /> : <UserCheck size={24} color="#10B981" />}
              </View>
              <Text style={styles.modalTitle}>
                {confirmModal.type === 'delete_step2' ? 'Final Confirmation Required' :
                 confirmModal.type === 'delete_step1' ? 'Permanently Delete Account' :
                 confirmModal.isDisable ? 'Disable Account' : 'Enable Account'}
              </Text>
            </View>

            <View style={styles.modalBody}>
              {confirmModal.type === 'delete_step2' ? (
                <Text style={styles.modalText}>
                  CRITICAL: You are about to permanently destroy the account for{' '}
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmModal.user?.email}</Text>.
                  {'\n\n'}
                  This will remove the user from Firebase Authentication, delete their Firestore documents, subcollections, favorites, meal logs, and all linked resources.
                  {'\n\n'}
                  This action is irreversible.
                </Text>
              ) : confirmModal.type === 'delete_step1' ? (
                <Text style={styles.modalText}>
                  Are you sure you want to permanently delete user{' '}
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmModal.user?.name || 'User'}</Text> ({confirmModal.user?.email})?
                  {'\n\n'}
                  Unlike disabling an account, permanent deletion wipes all account data and cannot be recovered.
                </Text>
              ) : (
                <Text style={styles.modalText}>
                  Are you sure you want to {confirmModal.isDisable ? 'DISABLE' : 'ENABLE'} account access for{' '}
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmModal.user?.name || 'User'}</Text> ({confirmModal.user?.email})?
                  {'\n\n'}
                  {confirmModal.isDisable
                    ? 'The user will have active sessions revoked and will be barred from signing in until re-enabled.'
                    : 'The user will be restored to active status and allowed to log in and use FoodieBite.'}
                </Text>
              )}

              {confirmModal.error ? (
                <View style={styles.modalErrorBox}>
                  <AlertCircle size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.modalErrorText}>{confirmModal.error}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setConfirmModal({ visible: false, type: null, user: null, isDisable: false, loading: false, error: null })}
                disabled={confirmModal.loading}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              {confirmModal.type === 'delete_step1' ? (
                <TouchableOpacity
                  onPress={proceedToDeleteStep2}
                  style={[styles.modalConfirmBtn, { backgroundColor: '#F59E0B' }]}
                >
                  <Text style={styles.modalConfirmBtnText}>Proceed to Final Confirmation</Text>
                </TouchableOpacity>
              ) : confirmModal.type === 'delete_step2' ? (
                <TouchableOpacity
                  onPress={executeDeleteUser}
                  disabled={confirmModal.loading}
                  style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                >
                  {confirmModal.loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Yes, Permanently Delete</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={executeDisableUser}
                  disabled={confirmModal.loading}
                  style={[
                    styles.modalConfirmBtn,
                    { backgroundColor: confirmModal.isDisable ? '#EF4444' : '#10B981' }
                  ]}
                >
                  {confirmModal.loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>
                      {confirmModal.isDisable ? 'Disable Account' : 'Enable Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

function AdminFooter({ activeTab, onTabSelect }) {
  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'foods', label: 'Food Management', icon: Utensils },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <View style={styles.adminFooterNav}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.adminFooterScroll}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onTabSelect(item.id)}
              style={[styles.adminFooterItem, isActive && styles.adminFooterItemActive]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Admin ${item.label}`}
            >
              <View style={[styles.adminFooterIconWrapper, isActive && styles.adminFooterIconActive]}>
                <Icon size={19} color={isActive ? C.orange : '#94a3b8'} />
              </View>
              <Text
                style={[styles.adminFooterLabel, isActive && styles.adminFooterLabelActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tabBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 80,
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  metricSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    marginTop: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  slaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBg: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.orange,
  },
  progressDesc: {
    fontSize: 10,
    color: C.muted2,
    textAlign: 'center',
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    padding: 0,
  },
  emptyText: {
    textAlign: 'center',
    color: C.muted2,
    fontSize: 13,
    paddingVertical: 20,
  },
  userItemCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#fff',
  },
  adminTag: {
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: 'rgba(255,107,53,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: C.orange,
  },
  userEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userEmailText: {
    fontSize: 11,
    color: C.muted,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  userActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  userActionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feedbackCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feedbackName: {
    fontWeight: '700',
    fontSize: 13,
    color: '#fff',
  },
  feedbackEmail: {
    fontSize: 11,
    color: C.muted,
  },
  feedbackStatusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  feedbackMsgBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  feedbackMsgText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    color: '#cbd5e1',
  },
  replyBox: {
    backgroundColor: 'rgba(255,107,53,0.05)',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 2.5,
    borderLeftColor: C.orange,
    marginBottom: 10,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#f1f5f9',
  },
  replyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBtnText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteFeedbackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteFeedbackBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineReplyBox: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
  },
  replyInput: {
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    color: '#fff',
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    height: 60,
  },
  sendReplyBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendReplyBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelReplyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelReplyBtnText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  reportCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 10,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportFilename: {
    fontWeight: '700',
    fontSize: 13,
    color: '#fff',
  },
  reportUserSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  reportDate: {
    fontSize: 10,
    color: C.muted2,
  },
  reportAnalysisBox: {
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.01)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  reportSummaryText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#f1f5f9',
    lineHeight: 16,
  },
  analysisSecTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: C.orange,
    marginBottom: 4,
  },
  biomarkerRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  biomarkerBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.card2,
  },
  biomarkerBadgeText: {
    fontSize: 10,
  },
  recommendedText: {
    fontSize: 11,
    color: C.muted,
  },
  openUrlBtn: {
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openUrlBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  aiLogCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 6,
  },
  aiLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiLogBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiLogTime: {
    fontSize: 10,
    color: C.muted2,
  },
  aiLogMsg: {
    fontSize: 12,
    color: '#fff',
    fontStyle: 'italic',
    marginTop: 4,
  },
  aiLogFooter: {
    marginTop: 4,
  },
  aiLogUser: {
    fontSize: 10,
    color: C.muted2,
  },

  // ── Organized Users Table Styles ─────────────
  tableCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1.5,
    borderColor: C.border,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableCellText: {
    fontSize: 12,
    color: '#f8fafc',
  },
  dietBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ── User Details View Styles ─────────────────
  backNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.orange,
  },
  userDetailHeaderCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 12,
  },
  userSnoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  userSnoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  userDetailName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  userDetailEmail: {
    fontSize: 12,
    color: C.muted,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  metaGridItem: {
    flex: 1,
    minWidth: 130,
    backgroundColor: C.card2,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metaGridLabel: {
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  metaGridValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f1f5f9',
  },

  // ── Section Card & Logs ───────────────────────
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
  },

  // ── Email Log Styles ──────────────────────────
  emailLogCard: {
    backgroundColor: C.card2,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  emailSubjectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  emailRecipientText: {
    fontSize: 11,
    color: C.muted,
  },
  emailSnippetBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: C.orange,
  },
  emailSnippetText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontStyle: 'italic',
  },
  deliveredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  deliveredPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  emailTimestampText: {
    fontSize: 10,
    color: C.muted2,
  },

  // ── Empty States ──────────────────────────────
  emptyStateContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 16,
  },

  // ── Activity Event Styles ─────────────────────
  activityEventCard: {
    backgroundColor: C.card2,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
  },
  activityEventTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityEventDetails: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  activityTimestampText: {
    fontSize: 10,
    color: C.muted2,
    alignSelf: 'flex-start',
  },

  // ── Administrator Login Portal Styles ─────────
  adminLoginWrapper: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 520,
  },
  adminLoginBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    marginTop: 20,
  },
  adminShieldBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  adminLoginTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  adminLoginSubtitle: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  adminLoginErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  adminLoginErrorText: {
    fontSize: 12,
    color: '#F87171',
    flex: 1,
  },
  adminInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  adminInputText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    padding: 0,
  },
  adminLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 6,
  },
  adminLoginBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  adminSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  adminSecurityNoticeText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  adminAuthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    maxWidth: 130,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  adminAuthPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  adminLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  adminLogoutBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  adminAuthSegmentWrapper: {
    flexDirection: 'row',
    backgroundColor: C.card2,
    borderRadius: 10,
    padding: 3,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  adminAuthSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 7,
  },
  adminAuthSegmentBtnActive: {
    backgroundColor: C.orange,
  },
  adminAuthSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  adminAuthSegmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  adminLoginSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  adminLoginSuccessText: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
    flex: 1,
  },
  adminDietChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
  },
  adminDietChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  adminDietChipText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  adminDietChipTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  providerPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  providerPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  userStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  userStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adminFooterNav: {
    width: '100%',
    backgroundColor: '#111318',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    zIndex: 99,
  },
  adminFooterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    minWidth: 460,
    paddingHorizontal: 8,
  },
  adminFooterItem: {
    flex: 1,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 3,
  },
  adminFooterItemActive: {
    opacity: 1,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
    gap: 10,
  },
  paginationInfoText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  pageBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: '#64748b',
  },
  pageIndicator: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  pageIndicatorText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  adminFooterIconWrapper: {
    padding: 3,
    borderRadius: 8,
  },
  adminFooterIconActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
  },
  adminFooterLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  adminFooterLabelActive: {
    color: C.orange,
    fontWeight: '700',
  },
  foodMgmtHeaderCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  foodMgmtTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  foodMgmtSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  refreshSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  refreshSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
  },
  emptyCardBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  reqCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  reqCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  reqRestaurantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  reqStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  reqStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reqCuisineSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 3,
  },
  reqDateText: {
    fontSize: 11,
    color: C.muted,
  },
  reqDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: C.card2,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  reqDetailItem: {
    minWidth: '45%',
    flex: 1,
  },
  reqDetailLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reqDetailValue: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '500',
    marginTop: 1,
  },
  reqNotesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
  },
  reqNotesText: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },
  reqActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 9,
    borderRadius: 8,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  cacheControlCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginTop: 8,
  },
  cacheControlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cacheControlSub: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
  },
  purgeCacheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  purgeCacheBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  settingsCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  settingsSub: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
  },
  onlineDotWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  onlineDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  settingsInfoGrid: {
    gap: 8,
    backgroundColor: C.card2,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  settingsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsInfoLabel: {
    fontSize: 12,
    color: C.muted,
  },
  settingsInfoValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  lockSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  lockSessionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  auditLogItem: {
    backgroundColor: C.card2,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 4,
  },
  auditLogAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  auditLogDate: {
    fontSize: 10,
    color: C.muted,
  },
  auditLogDetails: {
    fontSize: 11,
    color: '#cbd5e1',
  },

  // Action Banner Styles
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  actionBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  actionBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },

  // Notification Management Styles
  statusAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusAlertSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  statusAlertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  statusAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  notificationGroupCard: {
    backgroundColor: C.card2,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  notificationGroupHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  notificationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  toggleRowSub: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
  },
  togglePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  togglePillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  togglePillInactive: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: '#475569',
  },
  togglePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  scheduleInput: {
    backgroundColor: '#0F1117',
    borderWidth: 1,
    borderColor: '#2E3545',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'monospace',
    minWidth: 140,
  },
  testEmailInput: {
    backgroundColor: '#0F1117',
    borderWidth: 1,
    borderColor: '#2E3545',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  saveNotificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  saveNotificationBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sendTestEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  testResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  testResultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  testResultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  testResultText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal Styles (Cross-platform Web Dialog)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#2E3545',
    borderRadius: 16,
    padding: 22,
    maxWidth: 460,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
  },
  modalBody: {
    marginBottom: 18,
  },
  modalText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  modalErrorText: {
    fontSize: 11,
    color: '#F87171',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#262A36',
  },
  modalCancelBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
