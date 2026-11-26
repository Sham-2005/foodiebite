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
  Modal,
  Platform,
  Image,
  useWindowDimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import storage, { getItemSync, removeItemSync, removeItem } from '../services/storage';
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
  Sliders,
  Sparkles,
  Eye,
  Heart,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Database,
  Filter,
  Flame,
  Leaf,
  Layers,
  Info,
  X
} from 'lucide-react-native';
import { C, BackHeader, BtnOrange } from '../components/UI';
import { useApp } from '../context/AppContext';

// Code-split heavy admin modules on demand
const AdminIntelligenceSection = React.lazy(() => import('../components/AdminIntelligenceSection'));
const AdminEmailCampaignSection = React.lazy(() => import('../components/admin/AdminEmailCampaignSection'));
const AdminFeedbackSection = React.lazy(() => import('../components/admin/AdminFeedbackSection'));
const AdminHealthInsightsSection = React.lazy(() => import('../components/admin/AdminHealthInsightsSection'));

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
  apiAdminGetAuditLogs,
  apiAdminGetUserMedicalReports,
  apiAdminGetUserMedicalReportById,
  apiAdminAnalyzeUserMedicalReport,
  apiAdminGetMedicalReportViewUrl,
  apiAdminDeleteUserMedicalReport,
  apiAdminGetFoodDatabase,
  apiAdminGetFoodDatabaseStats,
  apiAdminGetFoodDatabaseItemById
} from '../services/api';
import AppLayout from '../components/AppLayout';

export const ADMIN_THEME = {
  bg: '#0F1117',
  card: '#171B24',
  cardHover: '#1E2430',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#2D3442',
  accent: '#FF6B35'
};

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

const FoodCardImage = ({ uri, name, category }) => {
  const [imageError, setImageError] = useState(false);

  if (!uri || imageError) {
    return (
      <View style={styles.foodGridFallbackImage}>
        <Database size={28} color="#475569" />
        <Text style={styles.foodGridFallbackText} numberOfLines={1}>
          {category || 'FoodieBite'}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.foodGridThumb}
      resizeMode="cover"
      onError={() => setImageError(true)}
    />
  );
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { user, logout } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const isSmallPhone = width < 380;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  // ── AUTHORIZED ADMINISTRATOR AUTHENTICATION STATE ────────
  // Sole authorized administrator: sham111205s@gmail.com
  const [adminSession, setAdminSession] = useState(() => {
    const existing = getAdminSession();
    if (existing && existing.admin?.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      return existing;
    }
    if (user && user.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      const adminSess = {
        success: true,
        adminKey: 'foodiebite_ai_live_key_2026',
        admin: {
          id: user.uid || user.id,
          email: 'sham111205s@gmail.com',
          name: user.displayName || 'Authorized Admin',
          role: 'admin'
        },
        token: user?.token || user?.stsTokenManager?.accessToken || getItemSync('nb_token') || 'foodiebite_ai_live_key_2026'
      };
      try { setItemSync('foodiebite_admin_session', JSON.stringify(adminSess)); } catch (_) {}
      return adminSess;
    }
    return null;
  });

  useEffect(() => {
    if (user && user.email?.toLowerCase().trim() === 'sham111205s@gmail.com') {
      const adminSess = {
        success: true,
        adminKey: 'foodiebite_ai_live_key_2026',
        admin: {
          id: user.uid || user.id,
          email: 'sham111205s@gmail.com',
          name: user.displayName || 'Authorized Admin',
          role: 'admin'
        },
        token: user?.token || user?.stsTokenManager?.accessToken || getItemSync('nb_token') || 'foodiebite_ai_live_key_2026'
      };
      try { setItemSync('foodiebite_admin_session', JSON.stringify(adminSess)); } catch (_) {}
      setAdminSession(adminSess);
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
    try {
      await Promise.all([
        removeItem('nb_token'),
        removeItem('nb_active_session'),
        removeItem('nb_active_user'),
        removeItem('nb_mock_active'),
        removeItem('foodiebite_admin_session'),
        removeItem('foodiebite_redirect_after_login'),
      ]);
    } catch (_) {}
    removeItemSync('nb_token');
    removeItemSync('nb_active_session');
    removeItemSync('nb_active_user');
    removeItemSync('nb_mock_active');
    removeItemSync('foodiebite_admin_session');
    removeItemSync('foodiebite_redirect_after_login');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      try {
        const p = new URLSearchParams(window.location.search).get('tab');
        if (p && ['overview', 'users', 'campaigns', 'foods', 'analytics', 'feedback', 'settings', 'health-insights'].includes(p)) {
          return p;
        }
      } catch (_) { }
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

  // Medical Reports Intelligence state
  const [userMedicalReports, setUserMedicalReports] = useState([]);
  const [loadingMedicalReports, setLoadingMedicalReports] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [activeReportData, setActiveReportData] = useState(null);
  const [loadingReportDetail, setLoadingReportDetail] = useState(false);
  const [analyzingReportId, setAnalyzingReportId] = useState(null);
  const [reportActionMsg, setReportActionMsg] = useState(null);

  // Food Database Management State
  const [foodItems, setFoodItems] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [loadingMoreFoods, setLoadingMoreFoods] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [foodCategoryFilter, setFoodCategoryFilter] = useState('ALL');
  const [foodCuisineFilter, setFoodCuisineFilter] = useState('ALL');
  const [foodDietFilter, setFoodDietFilter] = useState('ALL');
  const [foodSpiceFilter, setFoodSpiceFilter] = useState('ALL');
  const [foodSeasonalityFilter, setFoodSeasonalityFilter] = useState('ALL');
  const [foodSortBy, setFoodSortBy] = useState('name');
  const [foodSortOrder, setFoodSortOrder] = useState('asc');
  const [foodPage, setFoodPage] = useState(1);
  const [foodLimit] = useState(12);
  const [foodTotalPages, setFoodTotalPages] = useState(1);
  const [foodTotalCount, setFoodTotalCount] = useState(0);
  const [selectedFoodItem, setSelectedFoodItem] = useState(null);
  const [loadingFoodDetail, setLoadingFoodDetail] = useState(false);
  const [foodError, setFoodError] = useState(null);
  const [medicalReportsError, setMedicalReportsError] = useState(null);

  // Resolution inline state
  const [resolvingId, setResolvingId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const loadUserMedicalReports = async (uid) => {
    if (!uid) return;
    setLoadingMedicalReports(true);
    setMedicalReportsError(null);
    try {
      const res = await apiAdminGetUserMedicalReports(uid);
      if (res && res.success && Array.isArray(res.reports)) {
        setUserMedicalReports(res.reports);
      } else {
        setUserMedicalReports([]);
      }
    } catch (err) {
      console.warn('loadUserMedicalReports error:', err.message);
      setMedicalReportsError(err.message || 'Failed to retrieve medical reports.');
      setUserMedicalReports([]);
    } finally {
      setLoadingMedicalReports(false);
    }
  };

  const handleSelectUser = async (user, sno) => {
    const uid = user.id || user.uid;
    setSelectedUserId(uid);
    setSelectedUserSno(sno);
    setSelectedUserDetails(user);
    setLoadingUserDetails(true);
    setUserDetailsError(null);
    setMedicalReportsError(null);
    setUserMedicalReports([]);
    setSelectedReportId(null);
    setActiveReportData(null);
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

    loadUserMedicalReports(uid);
  };

  const handleBackToUsersList = () => {
    setSelectedUserId(null);
    setSelectedUserSno(null);
    setSelectedUserDetails(null);
    setUserDetailsError(null);
    setMedicalReportsError(null);
    setUserMedicalReports([]);
    setSelectedReportId(null);
    setActiveReportData(null);
  };

  const handleSelectReport = async (reportId) => {
    if (selectedReportId === reportId && activeReportData) {
      setSelectedReportId(null);
      setActiveReportData(null);
      return;
    }
    setSelectedReportId(reportId);
    setLoadingReportDetail(true);
    try {
      const res = await apiAdminGetUserMedicalReportById(selectedUserId, reportId);
      if (res && res.success && res.report) {
        setActiveReportData(res.report);
      }
    } catch (err) {
      Alert.alert('Report Details Error', err.message);
    } finally {
      setLoadingReportDetail(false);
    }
  };

  const handleAnalyzeReport = async (reportId) => {
    if (!selectedUserId || !reportId) return;
    setAnalyzingReportId(reportId);
    setReportActionMsg('Running Local Ollama (qwen2.5:0.5b) clinical analysis...');
    try {
      const res = await apiAdminAnalyzeUserMedicalReport(selectedUserId, reportId);
      if (res && res.success) {
        const detailed = await apiAdminGetUserMedicalReportById(selectedUserId, reportId);
        if (detailed?.report) {
          setActiveReportData(detailed.report);
          setSelectedReportId(reportId);
        }
        await loadUserMedicalReports(selectedUserId);
        Alert.alert(
          'Analysis Completed',
          `Medical report successfully analyzed using ${res.provider === 'ollama' ? 'Local Ollama AI (qwen2.5:0.5b)' : 'Clinical Deterministic Engine'}.`
        );
      }
    } catch (err) {
      Alert.alert('Analysis Failed', err.message);
    } finally {
      setAnalyzingReportId(null);
      setReportActionMsg(null);
    }
  };

  const handleViewReportDocument = async (reportId) => {
    try {
      const res = await apiAdminGetMedicalReportViewUrl(selectedUserId, reportId);
      if (res?.viewUrl) {
        let fullUrl = res.viewUrl;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `http://localhost:5000${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.open === 'function') {
          window.open(fullUrl, '_blank');
        } else {
          Linking.openURL(fullUrl);
        }
      } else if (res?.rawOcrText) {
        Alert.alert(
          'Report Document (Extracted OCR Text)',
          res.rawOcrText.slice(0, 600) + (res.rawOcrText.length > 600 ? '\n\n...[Preview Truncated]' : '')
        );
      } else {
        Alert.alert('Document Notice', 'No signed URL or extracted document available.');
      }
    } catch (err) {
      Alert.alert('Document View Error', err.message);
    }
  };

  const handleDeleteReport = (report) => {
    const doDelete = async () => {
      try {
        await apiAdminDeleteUserMedicalReport(selectedUserId, report.id);
        if (selectedReportId === report.id) {
          setSelectedReportId(null);
          setActiveReportData(null);
        }
        await loadUserMedicalReports(selectedUserId);
        Alert.alert('Report Removed', 'Medical report permanently deleted from storage and database.');
      } catch (err) {
        Alert.alert('Delete Failed', err.message);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Are you sure you want to permanently delete "${report.reportName}"? This action cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Medical Report',
        `Are you sure you want to permanently delete "${report.reportName}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  // Browser back/forward popstate listener (Web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const onPop = () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const tabParam = sp.get('tab') || 'overview';
        setActiveTab(tabParam);
        setSelectedUserId(null);
      } catch (_) { }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('popstate', onPop);
      }
    };
  }, []);

  // Dedicated Tab Navigation (for footer and top navigation)
  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'overview') {
      // Dashboard button — Special Requirement:
      // Always return admin to main Admin Dashboard view, reset inspection, update URL to /admin
      handleBackToUsersList();
      setUserSearch('');
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
        window.history.pushState({ tab: 'overview' }, '', '/admin');
      }
    } else {
      if (tabId !== 'users') {
        handleBackToUsersList();
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
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

  const loadFoodDatabase = async (page = 1, overrideFilters = {}, isAppend = false) => {
    if (isAppend) {
      setLoadingMoreFoods(true);
    } else {
      setLoadingFoods(true);
    }
    setFoodError(null);
    try {
      const q = overrideFilters.q !== undefined ? overrideFilters.q : foodSearch;
      const cat = overrideFilters.category !== undefined ? overrideFilters.category : foodCategoryFilter;
      const cui = overrideFilters.cuisine !== undefined ? overrideFilters.cuisine : foodCuisineFilter;
      const diet = overrideFilters.dietType !== undefined ? overrideFilters.dietType : foodDietFilter;
      const spice = overrideFilters.spiceLevel !== undefined ? overrideFilters.spiceLevel : foodSpiceFilter;
      const season = overrideFilters.seasonality !== undefined ? overrideFilters.seasonality : foodSeasonalityFilter;
      const sBy = overrideFilters.sortBy !== undefined ? overrideFilters.sortBy : foodSortBy;
      const sOrd = overrideFilters.sortOrder !== undefined ? overrideFilters.sortOrder : foodSortOrder;

      const params = {
        page,
        limit: foodLimit,
        q: q ? q.trim() : undefined,
        category: cat !== 'ALL' ? cat : undefined,
        cuisine: cui !== 'ALL' ? cui : undefined,
        dietType: diet !== 'ALL' ? diet : undefined,
        spiceLevel: spice !== 'ALL' ? spice : undefined,
        seasonality: season !== 'ALL' ? season : undefined,
        sortBy: sBy,
        sortOrder: sOrd
      };

      const res = await apiAdminGetFoodDatabase(params);
      if (res && res.success) {
        const fetchedFoods = res.foods || [];
        if (isAppend) {
          setFoodItems(prev => {
            const existingIds = new Set(prev.map(f => f.id));
            const newRecords = fetchedFoods.filter(f => !existingIds.has(f.id));
            return [...prev, ...newRecords];
          });
        } else {
          setFoodItems(fetchedFoods);
        }
        setFoodPage(res.page || page);
        setFoodTotalPages(res.totalPages || 1);
        setFoodTotalCount(res.total || 0);
      } else {
        throw new Error(res?.message || 'Failed to fetch food database records');
      }
    } catch (err) {
      console.warn('loadFoodDatabase error:', err.message);
      setFoodError(err.message || 'Unable to load food database from server.');
    } finally {
      if (isAppend) {
        setLoadingMoreFoods(false);
      } else {
        setLoadingFoods(false);
      }
    }
  };

  const handleLoadMoreFoods = () => {
    if (loadingMoreFoods || loadingFoods) return;
    if (foodPage >= foodTotalPages || foodItems.length >= foodTotalCount) return;
    loadFoodDatabase(foodPage + 1, {}, true);
  };

  const handleResetFoodFilters = () => {
    setFoodSearch('');
    setFoodCategoryFilter('ALL');
    setFoodCuisineFilter('ALL');
    setFoodDietFilter('ALL');
    setFoodSpiceFilter('ALL');
    setFoodSeasonalityFilter('ALL');
    setFoodSortBy('name');
    setFoodSortOrder('asc');
    loadFoodDatabase(1, {
      q: '',
      category: 'ALL',
      cuisine: 'ALL',
      dietType: 'ALL',
      spiceLevel: 'ALL',
      seasonality: 'ALL',
      sortBy: 'name',
      sortOrder: 'asc'
    }, false);
  };

  const loadFoodsData = async () => {
    setFoodError(null);
    loadFoodDatabase(1, {}, false);
  };

  const handleSelectFoodItem = async (food) => {
    setSelectedFoodItem(food);
    setLoadingFoodDetail(true);
    try {
      const res = await apiAdminGetFoodDatabaseItemById(food.id);
      if (res && res.success && res.food) {
        setSelectedFoodItem(res.food);
      }
    } catch (err) {
      console.warn('handleSelectFoodItem error:', err.message);
    } finally {
      setLoadingFoodDetail(false);
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
    } else if (activeTab === 'foods' && foodItems.length === 0) {
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
    const reason = (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.prompt === 'function')
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
      {/* ── Responsive Admin Header ──────────────────────── */}
      <View style={[
        styles.adminHeaderContainer,
        { paddingTop: Math.max(insets.top, 12) }
      ]}>
        {/* Main Header Bar */}
        <View style={styles.adminHeaderMainRow}>
          {/* Left: Back button & Title */}
          <View style={styles.adminHeaderLeft}>
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate('Home');
              }}
              style={styles.adminBackBtn}
              activeOpacity={0.7}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Shield size={18} color={C.orange} />
              <Text style={styles.adminHeaderTitle} numberOfLines={1}>
                {isSmallPhone ? 'Admin' : 'Admin Dashboard'}
              </Text>
            </View>
          </View>

          {/* Right Controls */}
          <View style={styles.adminHeaderRight}>
            {!isMobile && (
              <View style={styles.adminAuthPill}>
                <View style={styles.onlineDot} />
                <Text style={styles.adminAuthPillText} numberOfLines={1}>
                  sham111205s@gmail.com
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={loadData}
              style={styles.adminHeaderIconBtn}
              activeOpacity={0.7}
              accessibilityLabel="Refresh Data"
            >
              <RefreshCw size={15} color={C.orange} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAdminLogout}
              style={styles.adminLogoutBtn}
              activeOpacity={0.7}
              role="button"
              accessibilityLabel="Sign out of Admin Dashboard"
            >
              <LogOut size={13} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.adminLogoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mobile Sub-Header: Clean Profile & Status Bar */}
        {isMobile && (
          <View style={styles.adminHeaderSubRow}>
            <View style={styles.adminAuthPillMobile}>
              <View style={styles.onlineDot} />
              <Text style={styles.adminAuthPillText} numberOfLines={1}>
                sham111205s@gmail.com
              </Text>
            </View>
            <View style={styles.adminSystemStatusBadge}>
              <View style={styles.systemStatusDot} />
              <Text style={styles.adminSystemStatusText}>System Active</Text>
            </View>
          </View>
        )}
      </View>

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

                {/* Metric Cards Grid - Responsive: 1 col on narrow screens, 2 col on mobile, 4 col on tablet/desktop */}
                <View style={[
                  styles.metricsGridContainer,
                  { flexDirection: isSmallPhone ? 'column' : 'row', flexWrap: 'wrap', gap: 10 }
                ]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleTabSelect('users')}
                    style={[
                      styles.metricCard,
                      {
                        width: isSmallPhone ? '100%' : (isMobile ? '48.5%' : '23.5%'),
                        minHeight: 90
                      }
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <Users size={18} color={C.orange} />
                      <Text style={styles.metricValue}>{users.length}</Text>
                    </View>
                    <Text style={styles.metricSub} numberOfLines={2}>Registered Users Directory</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleTabSelect('users')}
                    style={[
                      styles.metricCard,
                      {
                        width: isSmallPhone ? '100%' : (isMobile ? '48.5%' : '23.5%'),
                        minHeight: 90
                      }
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <UserCheck size={18} color="#10B981" />
                      <Text style={styles.metricValue}>{users.filter(u => !u.disabled).length}</Text>
                    </View>
                    <Text style={styles.metricSub} numberOfLines={2}>Active Consumer Accounts</Text>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.metricCard,
                      {
                        width: isSmallPhone ? '100%' : (isMobile ? '48.5%' : '23.5%'),
                        minHeight: 90
                      }
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <ShieldCheck size={18} color="#38BDF8" />
                      <Text style={styles.metricValue}>Active</Text>
                    </View>
                    <Text style={styles.metricSub} numberOfLines={2}>System Platform Health</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleTabSelect('feedback')}
                    style={[
                      styles.metricCard,
                      {
                        width: isSmallPhone ? '100%' : (isMobile ? '48.5%' : '23.5%'),
                        minHeight: 90
                      }
                    ]}
                  >
                    <View style={styles.metricCardTop}>
                      <MessageSquare size={18} color="#F59E0B" />
                      <Text style={styles.metricValue}>{feedback.length}</Text>
                    </View>
                    <Text style={styles.metricSub} numberOfLines={2}>User Reviews & Feedback</Text>
                  </TouchableOpacity>
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
                        <Text style={styles.metaGridLabel}>User ID (UID)</Text>
                        <Text style={[styles.metaGridValue, { fontSize: 11, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, color: '#94a3b8' }]} numberOfLines={1}>
                          {selectedUserDetails.id || selectedUserDetails.uid}
                        </Text>
                      </View>

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
                        <Text style={styles.metaGridLabel}>Email Verification</Text>
                        <Text style={[styles.metaGridValue, { color: selectedUserDetails.emailVerified ? '#10B981' : '#F59E0B' }]}>
                          {selectedUserDetails.emailVerified ? 'Verified' : 'Unverified'}
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
                        <Text style={styles.metaGridLabel}>Medical Reports</Text>
                        <Text style={[styles.metaGridValue, { color: (userMedicalReports.length > 0 || selectedUserDetails.medicalReportsCount > 0) ? C.orange : C.muted }]}>
                          {userMedicalReports.length || selectedUserDetails.medicalReportsCount || 0} Uploaded
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

                  {/* SECTION 1: DIETARY & NUTRITION PROFILE */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Utensils size={16} color={C.orange} />
                        <Text style={styles.sectionTitle}>Dietary & Nutrition Profile</Text>
                      </View>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{selectedUserDetails.favoritesCount || 0} Favorites</Text>
                      </View>
                    </View>

                    <View style={styles.metaGrid}>
                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Dietary Preference</Text>
                        {(() => {
                          const b = getDietBadgeStyle(selectedUserDetails.dietType || selectedUserDetails.preferences?.dietType);
                          return (
                            <View style={[styles.dietBadge, { backgroundColor: b.bg, borderColor: b.border, alignSelf: 'flex-start', marginTop: 2 }]}>
                              <Text style={[styles.dietBadgeText, { color: b.color }]}>{b.label}</Text>
                            </View>
                          );
                        })()}
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Spice Preference</Text>
                        <Text style={[styles.metaGridValue, { color: '#F97316' }]}>
                          {selectedUserDetails.spiceLevel || selectedUserDetails.preferences?.spiceLevel || 'Medium'}
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Favorite Foods Saved</Text>
                        <Text style={[styles.metaGridValue, { color: '#10B981' }]}>
                          {selectedUserDetails.favoritesCount || 0} items
                        </Text>
                      </View>

                      <View style={styles.metaGridItem}>
                        <Text style={styles.metaGridLabel}>Health Profile Status</Text>
                        <Text style={[styles.metaGridValue, { color: '#38BDF8' }]}>
                          {(userMedicalReports.length > 0 || selectedUserDetails.medicalReportsCount > 0) ? 'Medical Report Synced' : 'Standard Profile'}
                        </Text>
                      </View>
                    </View>

                    {/* Preferred Cuisines */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.metaGridLabel, { marginBottom: 6 }]}>Preferred Cuisines</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(() => {
                          const cuisines = selectedUserDetails.cuisines || selectedUserDetails.preferences?.cuisines || [];
                          if (cuisines.length === 0) return <Text style={{ fontSize: 12, color: '#64748b' }}>No cuisines selected</Text>;
                          return cuisines.map((c, i) => (
                            <View key={i} style={styles.prefChip}>
                              <Text style={styles.prefChipText}>{c}</Text>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>

                    {/* Health Goals */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.metaGridLabel, { marginBottom: 6 }]}>Voluntary Health Goals</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(() => {
                          const goals = selectedUserDetails.healthGoals || selectedUserDetails.preferences?.healthGoals || [];
                          if (goals.length === 0) return <Text style={{ fontSize: 12, color: '#64748b' }}>No voluntary health goals declared</Text>;
                          return goals.map((g, i) => (
                            <View key={i} style={[styles.prefChip, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                              <Text style={[styles.prefChipText, { color: '#10B981' }]}>{String(g).replace(/_/g, ' ')}</Text>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>

                    {/* Allergies & Sensitivities */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.metaGridLabel, { marginBottom: 6 }]}>Allergies & Dietary Restrictions</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(() => {
                          const allergies = selectedUserDetails.allergies || selectedUserDetails.preferences?.allergies || [];
                          if (allergies.length === 0) return <Text style={{ fontSize: 12, color: '#10B981' }}>None declared (Standard safety defaults apply)</Text>;
                          return allergies.map((a, i) => (
                            <View key={i} style={[styles.prefChip, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                              <Text style={[styles.prefChipText, { color: '#EF4444' }]}>{a}</Text>
                            </View>
                          ));
                        })()}
                      </View>
                    </View>
                  </View>

                  {/* SECTION 2: MEDICAL REPORTS & CLINICAL INTELLIGENCE */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <FileText size={16} color={C.orange} />
                        <Text style={styles.sectionTitle}>Medical Reports & Clinical Intelligence</Text>
                      </View>
                      <View style={[styles.countBadge, medicalReportsError ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' } : {}]}>
                        <Text style={[styles.countBadgeText, medicalReportsError ? { color: '#EF4444' } : {}]}>
                          {loadingMedicalReports ? 'Loading...' : medicalReportsError ? 'Error' : `${userMedicalReports.length} Reports`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.privacyNoticeBanner}>
                      <Shield size={13} color="#38BDF8" style={{ marginRight: 6 }} />
                      <Text style={styles.privacyNoticeText}>
                        Clinical Intelligence Mode: Private signed URLs expire in 300s. Zero permanent exposure.
                      </Text>
                    </View>

                    {reportActionMsg && (
                      <View style={styles.actionProgressBanner}>
                        <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 8 }} />
                        <Text style={styles.actionProgressText}>{reportActionMsg}</Text>
                      </View>
                    )}

                    {loadingMedicalReports ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={C.orange} />
                        <Text style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Loading medical reports...</Text>
                      </View>
                    ) : medicalReportsError ? (
                      <View style={styles.emptyStateContainer}>
                        <AlertCircle size={28} color="#EF4444" style={{ marginBottom: 8 }} />
                        <Text style={[styles.emptyStateTitle, { color: '#EF4444' }]}>Unable to Load Medical Reports</Text>
                        <Text style={styles.emptyStateSub}>{medicalReportsError}</Text>
                        <TouchableOpacity
                          style={[styles.primaryBtn, { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }]}
                          onPress={() => loadUserMedicalReports(selectedUserId)}
                        >
                          <RefreshCw size={13} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryBtnText}>Retry Loading</Text>
                        </TouchableOpacity>
                      </View>
                    ) : userMedicalReports.length === 0 ? (
                      <View style={styles.emptyStateContainer}>
                        <FileText size={28} color="#334155" style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyStateTitle}>No Medical Reports Uploaded</Text>
                        <Text style={styles.emptyStateSub}>This user has not yet uploaded any laboratory bloodwork or clinical health documents through FoodieBite.</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 14, marginTop: 12 }}>
                        {userMedicalReports.map((report) => {
                          const isExpanded = selectedReportId === report.id;
                          const isAnalyzing = analyzingReportId === report.id;
                          const cards = (isExpanded && activeReportData?.summaryCards) || report.summaryCards || { totalTests: 0, withinRangeCount: 0, outsideRangeCount: 0, reviewCount: 0 };
                          const testList = (isExpanded && activeReportData?.testResults) || [];
                          const intelligence = (isExpanded && (activeReportData?.analysis?.intelligence || activeReportData?.aiAnalysis)) || null;
                          const healthSummary = (isExpanded && (activeReportData?.healthSummary || activeReportData?.analysis?.healthSummary || report.healthSummary)) || null;

                          return (
                            <View key={report.id} style={styles.medicalReportCard}>
                              {/* Report Header Row */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                                <View style={{ flex: 1, minWidth: 220 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <Text style={styles.reportTitleText}>{report.reportName}</Text>
                                    <View style={[
                                      styles.reportStatusPill,
                                      report.statusIndicator === 'Analysis Completed' || report.hasAnalysis
                                        ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }
                                        : report.statusIndicator === 'Analysis Failed' || report.processingStatus === 'ocr_failed'
                                        ? { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' }
                                        : { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#F59E0B' }
                                    ]}>
                                      <Text style={{
                                        fontSize: 10,
                                        fontWeight: '700',
                                        color: report.statusIndicator === 'Analysis Completed' || report.hasAnalysis
                                          ? '#10B981'
                                          : report.statusIndicator === 'Analysis Failed' || report.processingStatus === 'ocr_failed'
                                          ? '#EF4444'
                                          : '#F59E0B'
                                      }}>
                                        {report.statusIndicator || (report.hasAnalysis ? 'Analysis Completed' : 'Not Analyzed')}
                                      </Text>
                                    </View>
                                  </View>

                                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                                    File: {report.originalFilename} • Uploaded: {formatDateTime(report.uploadDate)} {report.healthSummary?.summaryGenerationDate ? `• Summary: ${formatDateTime(report.healthSummary.summaryGenerationDate)}` : ''}
                                  </Text>
                                </View>

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <TouchableOpacity
                                    onPress={() => handleAnalyzeReport(report.id)}
                                    disabled={isAnalyzing}
                                    style={[styles.reportActionBtn, { backgroundColor: 'rgba(255, 107, 53, 0.15)', borderColor: C.orange }]}
                                  >
                                    {isAnalyzing ? (
                                      <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 4 }} />
                                    ) : (
                                      <Sparkles size={12} color={C.orange} style={{ marginRight: 4 }} />
                                    )}
                                    <Text style={[styles.reportActionBtnText, { color: C.orange }]}>
                                      {isAnalyzing ? 'Analyzing...' : 'Analyze with Ollama'}
                                    </Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() => handleViewReportDocument(report.id)}
                                    style={[styles.reportActionBtn, { backgroundColor: 'rgba(56, 189, 248, 0.12)', borderColor: '#38BDF8' }]}
                                  >
                                    <Eye size={12} color="#38BDF8" style={{ marginRight: 4 }} />
                                    <Text style={[styles.reportActionBtnText, { color: '#38BDF8' }]}>View Document</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() => handleSelectReport(report.id)}
                                    style={[styles.reportActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.15)' }]}
                                  >
                                    {isExpanded ? <ChevronUp size={12} color="#fff" /> : <ChevronDown size={12} color="#fff" />}
                                    <Text style={[styles.reportActionBtnText, { color: '#fff' }]}>
                                      {isExpanded ? 'Hide Details' : 'Lab Table & AI'}
                                    </Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() => handleDeleteReport(report)}
                                    style={[styles.reportActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444', paddingHorizontal: 8 }]}
                                  >
                                    <Trash2 size={12} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Quick Metrics Bar */}
                              <View style={styles.reportMetricsRow}>
                                <View style={styles.reportMetricBadge}>
                                  <Text style={styles.reportMetricNum}>{cards.totalTests}</Text>
                                  <Text style={styles.reportMetricLabel}>Total Tests</Text>
                                </View>
                                <View style={[styles.reportMetricBadge, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                                  <Text style={[styles.reportMetricNum, { color: '#10B981' }]}>{cards.withinRangeCount}</Text>
                                  <Text style={styles.reportMetricLabel}>Within Range</Text>
                                </View>
                                <View style={[styles.reportMetricBadge, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                                  <Text style={[styles.reportMetricNum, { color: '#EF4444' }]}>{cards.outsideRangeCount}</Text>
                                  <Text style={styles.reportMetricLabel}>Outside Range</Text>
                                </View>
                                <View style={[styles.reportMetricBadge, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                                  <Text style={[styles.reportMetricNum, { color: '#F59E0B' }]}>{cards.reviewCount}</Text>
                                  <Text style={styles.reportMetricLabel}>Review Needed</Text>
                                </View>
                              </View>

                              {/* EXPANDED SECTION: LAB TABLE & AI ANALYSIS */}
                              {isExpanded && (
                                <View style={styles.reportExpandedSection}>
                                  {loadingReportDetail ? (
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                      <ActivityIndicator size="small" color={C.orange} />
                                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Loading structured biomarkers & AI insights...</Text>
                                    </View>
                                  ) : (
                                    <View style={{ gap: 14 }}>
                                      {/* 1. STRUCTURED LAB RESULTS TABLE */}
                                      <View style={styles.labTableContainer}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                          <Text style={styles.subSectionTitle}>Extracted Laboratory Biomarkers</Text>
                                          <Text style={{ fontSize: 11, color: C.muted }}>{testList.length} Biomarkers Analyzed</Text>
                                        </View>

                                        {testList.length === 0 ? (
                                          <Text style={{ fontSize: 12, color: C.muted, padding: 8 }}>No structured test rows identified from OCR.</Text>
                                        ) : (
                                          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                            <View style={{ minWidth: 620 }}>
                                              <View style={styles.labTableHeader}>
                                                <Text style={[styles.labTableHeaderCell, { flex: 2.2 }]}>Test Name</Text>
                                                <Text style={[styles.labTableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Measured Result</Text>
                                                <Text style={[styles.labTableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>Unit</Text>
                                                <Text style={[styles.labTableHeaderCell, { flex: 1.8 }]}>Reference Range</Text>
                                                <Text style={[styles.labTableHeaderCell, { width: 88, textAlign: 'center' }]}>Status</Text>
                                              </View>

                                              {testList.map((t, idx) => {
                                                const s = (t.status || 'Normal').toLowerCase();
                                                let statusBg = 'rgba(16,185,129,0.15)';
                                                let statusColor = '#10B981';
                                                let statusBorder = '#10B981';
                                                if (s === 'high') {
                                                  statusBg = 'rgba(239,68,68,0.15)';
                                                  statusColor = '#EF4444';
                                                  statusBorder = '#EF4444';
                                                } else if (s === 'low') {
                                                  statusBg = 'rgba(56,189,248,0.15)';
                                                  statusColor = '#38BDF8';
                                                  statusBorder = '#38BDF8';
                                                } else if (s === 'uncertain' || s === 'review') {
                                                  statusBg = 'rgba(245,158,11,0.15)';
                                                  statusColor = '#F59E0B';
                                                  statusBorder = '#F59E0B';
                                                }

                                                return (
                                                  <View key={t.key || idx} style={[styles.labTableRow, idx % 2 === 1 && { backgroundColor: 'rgba(255,255,255,0.015)' }]}>
                                                    <Text style={[styles.labTableCell, { flex: 2.2, color: '#fff', fontWeight: '600' }]}>{t.test}</Text>
                                                    <Text style={[styles.labTableCell, { flex: 1.2, textAlign: 'right', fontWeight: '700', color: statusColor }]}>{t.result}</Text>
                                                    <Text style={[styles.labTableCell, { flex: 1.2, textAlign: 'center', color: '#94a3b8' }]}>{t.unit || '—'}</Text>
                                                    <Text style={[styles.labTableCell, { flex: 1.8, color: '#94a3b8' }]}>{t.referenceRange || 'Standard Range'}</Text>
                                                    <View style={{ width: 88, alignItems: 'center' }}>
                                                      <View style={[styles.labStatusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                                                        <Text style={[styles.labStatusText, { color: statusColor }]}>{t.status}</Text>
                                                      </View>
                                                    </View>
                                                  </View>
                                                );
                                              })}
                                            </View>
                                          </ScrollView>
                                        )}
                                      </View>

                                      {/* 2. OLLAMA AI CLINICAL INTELLIGENCE CARD */}
                                      {intelligence ? (
                                        <View style={styles.aiInsightsCard}>
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                              <Sparkles size={16} color={C.orange} />
                                              <Text style={styles.aiCardTitle}>Local Ollama Medical Intelligence</Text>
                                            </View>
                                            <View style={styles.aiModelBadge}>
                                              <Text style={styles.aiModelBadgeText}>
                                                {intelligence.model || (intelligence.source === 'ollama' ? 'qwen2.5:0.5b' : 'Deterministic Engine')}
                                              </Text>
                                            </View>
                                          </View>

                                          {/* Summary */}
                                          {intelligence.summary ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Clinical Overview</Text>
                                              <Text style={styles.aiInsightText}>{intelligence.summary}</Text>
                                            </View>
                                          ) : null}

                                          {/* Observations */}
                                          {Array.isArray(intelligence.observations) && intelligence.observations.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Key Observations</Text>
                                              {intelligence.observations.map((obs, i) => (
                                                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                                                  <Text style={{ color: C.orange, fontSize: 13, lineHeight: 18 }}>•</Text>
                                                  <Text style={[styles.aiInsightText, { flex: 1 }]}>{obs}</Text>
                                                </View>
                                              ))}
                                            </View>
                                          ) : null}

                                          {/* General Interpretation */}
                                          {intelligence.generalInterpretation ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Physiological Interpretation (Educational)</Text>
                                              <Text style={styles.aiInsightText}>{intelligence.generalInterpretation}</Text>
                                            </View>
                                          ) : null}

                                          {/* Nutritional Considerations */}
                                          {intelligence.nutritionConsiderations ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Nutritional Considerations</Text>
                                              <Text style={styles.aiInsightText}>{intelligence.nutritionConsiderations}</Text>
                                            </View>
                                          ) : null}

                                          {/* Grounded Food Suggestions */}
                                          {Array.isArray(intelligence.foodSuggestions) && intelligence.foodSuggestions.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Verified FoodieBite Recommendations</Text>
                                              <Text style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                                                Grounded in FoodieBite Knowledge Base & filtered for {selectedUserDetails.dietType || 'Vegetarian'} preferences:
                                              </Text>
                                              <View style={{ gap: 8 }}>
                                                {intelligence.foodSuggestions.map((food, fi) => (
                                                  <View key={fi} style={styles.foodSuggestionCard}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                      <Text style={styles.foodSuggestionTitle}>{food.foodName}</Text>
                                                      {food.benefits ? (
                                                        <View style={styles.foodBenefitPill}>
                                                          <Text style={styles.foodBenefitText}>{food.benefits}</Text>
                                                        </View>
                                                      ) : null}
                                                    </View>
                                                    <Text style={styles.foodSuggestionReason}>{food.reason}</Text>
                                                  </View>
                                                ))}
                                              </View>
                                            </View>
                                          ) : null}

                                          {/* Healthcare Guidance */}
                                          {intelligence.healthcareGuidance ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Healthcare Provider Guidance</Text>
                                              <Text style={styles.aiInsightText}>{intelligence.healthcareGuidance}</Text>
                                            </View>
                                          ) : null}

                                          {/* Prominent Disclaimer Banner */}
                                          <View style={styles.medicalDisclaimerBox}>
                                            <AlertTriangle size={15} color="#F59E0B" style={{ marginTop: 2, marginRight: 8 }} />
                                            <View style={{ flex: 1 }}>
                                              <Text style={styles.medicalDisclaimerTitle}>NON-DIAGNOSTIC MEDICAL DISCLAIMER</Text>
                                              <Text style={styles.medicalDisclaimerText}>
                                                {intelligence.disclaimer || 'This analysis is informational only and is not a medical diagnosis or substitute for professional medical advice. Laboratory results should be interpreted by a qualified healthcare professional in the context of your medical history and symptoms.'}
                                              </Text>
                                            </View>
                                          </View>
                                        </View>
                                      ) : null}

                                      {/* 3. STRUCTURED HEALTH SUMMARY (10 CLINICAL FIELDS) */}
                                      {healthSummary ? (
                                        <View style={[styles.aiInsightsCard, { borderColor: 'rgba(56, 189, 248, 0.25)', marginTop: 8 }]}>
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                              <Activity size={16} color="#38BDF8" />
                                              <Text style={[styles.aiCardTitle, { color: '#38BDF8' }]}>Medical Health Condition Summary</Text>
                                            </View>
                                            <View style={[styles.aiModelBadge, { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                                              <Text style={[styles.aiModelBadgeText, { color: '#38BDF8' }]}>
                                                {healthSummary.analysisStatus || 'Analysis Completed'}
                                              </Text>
                                            </View>
                                          </View>

                                          {/* Report & Generation Dates */}
                                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                                            <Text style={{ fontSize: 11, color: C.muted }}>
                                              Report Date: <Text style={{ color: '#fff', fontWeight: '600' }}>{formatDateTime(healthSummary.reportDate || report.uploadDate)}</Text>
                                            </Text>
                                            {healthSummary.summaryGenerationDate && (
                                              <Text style={{ fontSize: 11, color: C.muted }}>
                                                Summary Generated: <Text style={{ color: '#38BDF8', fontWeight: '600' }}>{formatDateTime(healthSummary.summaryGenerationDate)}</Text>
                                              </Text>
                                            )}
                                          </View>

                                          {/* 1. Overall Health Summary */}
                                          {healthSummary.overallHealthSummary ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Overall Health Summary</Text>
                                              <Text style={styles.aiInsightText}>{healthSummary.overallHealthSummary}</Text>
                                            </View>
                                          ) : null}

                                          {/* 2. Reported Medical Conditions */}
                                          {Array.isArray(healthSummary.reportedMedicalConditions) && healthSummary.reportedMedicalConditions.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Reported Medical Conditions</Text>
                                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                {healthSummary.reportedMedicalConditions.map((cond, ci) => (
                                                  <View key={ci} style={[styles.foodBenefitPill, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
                                                    <Text style={[styles.foodBenefitText, { color: '#EF4444' }]}>{cond}</Text>
                                                  </View>
                                                ))}
                                              </View>
                                            </View>
                                          ) : null}

                                          {/* 3. Abnormal Laboratory Values */}
                                          {Array.isArray(healthSummary.abnormalLaboratoryValues) && healthSummary.abnormalLaboratoryValues.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={[styles.aiInsightHeading, { color: '#EF4444' }]}>Abnormal Laboratory Values ({healthSummary.abnormalLaboratoryValues.length})</Text>
                                              <View style={{ gap: 4, marginTop: 4 }}>
                                                {healthSummary.abnormalLaboratoryValues.map((ab, ai) => (
                                                  <View key={ai} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)' }}>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{ab.test}</Text>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>
                                                      {ab.result} {ab.unit} ({ab.status} • Ref: {ab.referenceRange})
                                                    </Text>
                                                  </View>
                                                ))}
                                              </View>
                                            </View>
                                          ) : (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Abnormal Laboratory Values</Text>
                                              <Text style={{ fontSize: 11, color: '#10B981' }}>✓ All measured laboratory values are within normal reference ranges.</Text>
                                            </View>
                                          )}

                                          {/* 4. Normal Laboratory Values */}
                                          {Array.isArray(healthSummary.normalLaboratoryValues) && healthSummary.normalLaboratoryValues.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={[styles.aiInsightHeading, { color: '#10B981' }]}>Normal Laboratory Values ({healthSummary.normalLaboratoryValues.length} Biomarkers)</Text>
                                              <Text style={styles.aiInsightText}>
                                                {healthSummary.normalLaboratoryValues.map(n => n.test).join(', ')}
                                              </Text>
                                            </View>
                                          ) : null}

                                          {/* 5. Potential Nutritional Considerations */}
                                          {healthSummary.potentialNutritionalConsiderations ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Potential Nutritional Considerations</Text>
                                              <Text style={styles.aiInsightText}>{healthSummary.potentialNutritionalConsiderations}</Text>
                                            </View>
                                          ) : null}

                                          {/* 6. Dietary Recommendations Relevant to FoodieBite */}
                                          {Array.isArray(healthSummary.dietaryRecommendationsRelevantToFoodieBite) && healthSummary.dietaryRecommendationsRelevantToFoodieBite.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={styles.aiInsightHeading}>Dietary Recommendations Relevant to FoodieBite</Text>
                                              <View style={{ gap: 6, marginTop: 4 }}>
                                                {healthSummary.dietaryRecommendationsRelevantToFoodieBite.map((item, ii) => (
                                                  <View key={ii} style={styles.foodSuggestionCard}>
                                                    <Text style={styles.foodSuggestionTitle}>{item.foodName || item.name}</Text>
                                                    <Text style={styles.foodSuggestionReason}>{item.reason || item.benefits}</Text>
                                                  </View>
                                                ))}
                                              </View>
                                            </View>
                                          ) : null}

                                          {/* 7. Items Requiring Medical Follow-up */}
                                          {Array.isArray(healthSummary.itemsRequiringMedicalFollowUp) && healthSummary.itemsRequiringMedicalFollowUp.length > 0 ? (
                                            <View style={styles.aiInsightBlock}>
                                              <Text style={[styles.aiInsightHeading, { color: '#F59E0B' }]}>Items Requiring Medical Follow-up</Text>
                                              {healthSummary.itemsRequiringMedicalFollowUp.map((item, fi) => (
                                                <View key={fi} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 }}>
                                                  <AlertCircle size={12} color="#F59E0B" style={{ marginTop: 2 }} />
                                                  <Text style={[styles.aiInsightText, { flex: 1, color: '#e2e8f0' }]}>{item}</Text>
                                                </View>
                                              ))}
                                            </View>
                                          ) : null}
                                        </View>
                                      ) : null}

                                      {!intelligence && !healthSummary ? (
                                        <View style={{ padding: 14, backgroundColor: C.card2, borderRadius: 10, alignItems: 'center', gap: 6 }}>
                                          <Text style={{ fontSize: 12, color: C.muted }}>AI clinical insights have not yet been generated for this report.</Text>
                                          <TouchableOpacity
                                            onPress={() => handleAnalyzeReport(report.id)}
                                            style={[styles.reportActionBtn, { backgroundColor: 'rgba(255, 107, 53, 0.15)', borderColor: C.orange, marginTop: 4 }]}
                                          >
                                            <Sparkles size={13} color={C.orange} style={{ marginRight: 6 }} />
                                            <Text style={[styles.reportActionBtnText, { color: C.orange }]}>Run Local Ollama Analysis Now</Text>
                                          </TouchableOpacity>
                                        </View>
                                      ) : null}
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
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
                    {isMobile && (
                      <View style={styles.mobileTableHint}>
                        <Text style={styles.mobileTableHintText}>
                          ↔ Swipe horizontally to view all columns
                        </Text>
                      </View>
                    )}
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: '100%' }}>
                      <View style={{ minWidth: 840, flex: 1 }}>
                        {/* Table Header Row */}
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, { width: 44, textAlign: 'center' }]}>S.No</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.4, paddingLeft: 8 }]}>User & Provider</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Email Address</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Diet & Cuisines</Text>
                          <Text style={[styles.tableHeaderCell, { width: 68, textAlign: 'center' }]}>Reports</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.0 }]}>Registered</Text>
                          <Text style={[styles.tableHeaderCell, { flex: 1.0 }]}>Last Login</Text>
                          <Text style={[styles.tableHeaderCell, { width: 78, textAlign: 'center' }]}>Status</Text>
                          <Text style={[styles.tableHeaderCell, { width: 30, textAlign: 'center' }]}></Text>
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
                                <View style={{ flex: 1.6, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: '#cbd5e1' }]} numberOfLines={1}>
                                    {user.email || 'No email provided'}
                                  </Text>
                                </View>

                                {/* 4. Diet & Cuisines */}
                                <View style={{ flex: 1.2, paddingRight: 6 }}>
                                  {(() => {
                                    const b = getDietBadgeStyle(user.dietType || user.preferences?.dietType);
                                    const cuisines = user.cuisines || user.preferences?.cuisines || [];
                                    return (
                                      <View style={{ gap: 2 }}>
                                        <View style={[styles.dietBadge, { backgroundColor: b.bg, borderColor: b.border, alignSelf: 'flex-start' }]}>
                                          <Text style={[styles.dietBadgeText, { color: b.color, fontSize: 10 }]}>{b.label}</Text>
                                        </View>
                                        {cuisines.length > 0 ? (
                                          <Text style={{ fontSize: 10, color: C.muted }} numberOfLines={1}>
                                            {cuisines.slice(0, 2).join(', ')}
                                          </Text>
                                        ) : null}
                                      </View>
                                    );
                                  })()}
                                </View>

                                {/* 5. Medical Reports Count Badge */}
                                <View style={{ width: 68, alignItems: 'center' }}>
                                  {(user.medicalReportsCount || 0) > 0 ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 107, 53, 0.15)', borderColor: 'rgba(255, 107, 53, 0.4)', borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
                                      <FileText size={10} color={C.orange} />
                                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.orange }}>{user.medicalReportsCount}</Text>
                                    </View>
                                  ) : (
                                    <Text style={{ fontSize: 11, color: '#64748b' }}>0</Text>
                                  )}
                                </View>

                                {/* 6. Registered Date */}
                                <View style={{ flex: 1.0, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: C.muted, fontSize: 11 }]} numberOfLines={1}>
                                    {regDate}
                                  </Text>
                                </View>

                                {/* 7. Last Login */}
                                <View style={{ flex: 1.0, paddingRight: 6 }}>
                                  <Text style={[styles.tableCellText, { color: '#94a3b8', fontSize: 11 }]} numberOfLines={1}>
                                    {lastLogin}
                                  </Text>
                                </View>

                                {/* 8. Status */}
                                <View style={{ width: 78, alignItems: 'center' }}>
                                  <View style={[styles.userStatusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
                                    <Text style={[styles.userStatusBadgeText, { color: status.text }]}>
                                      {status.label}
                                    </Text>
                                  </View>
                                </View>

                                {/* Action chevron */}
                                <View style={{ width: 30, alignItems: 'center' }}>
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
                            role="button"
                            aria-label="Previous page"
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
                            role="button"
                            aria-label="Next page"
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

            {/* FOOD DATABASE MANAGEMENT TAB */}
            {activeTab === 'foods' && (
              <View style={{ gap: 16 }}>
                {/* Header card with summary */}
                <View style={styles.foodMgmtHeaderCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Database size={20} color={C.orange} />
                      <Text style={styles.foodMgmtTitle}>Food Database Management & Catalog</Text>
                    </View>
                    <TouchableOpacity
                      onPress={loadFoodsData}
                      style={styles.refreshSmallBtn}
                      disabled={loadingFoods || loadingMoreFoods}
                    >
                      <RefreshCw size={13} color={C.orange} />
                      <Text style={styles.refreshSmallBtnText}>
                        {loadingFoods ? 'Refreshing...' : 'Refresh Database'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.foodMgmtSub}>
                    Unified catalog of verified FoodieBite food knowledge records from primary knowledge base and fallback datasets. Includes complete nutritional profiles, spice levels, allergens, and dietary classifications.
                  </Text>
                </View>

                {/* 1. SEARCH & FILTER CONTROLS TOOLBAR */}
                <View style={styles.foodFilterSection}>
                  {/* Search Bar */}
                  <View style={styles.foodSearchBar}>
                    <Search size={16} color={C.muted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.foodSearchInput}
                      placeholder="Search food by name, category, cuisine, or ingredient..."
                      placeholderTextColor={C.muted}
                      value={foodSearch}
                      onChangeText={(text) => {
                        setFoodSearch(text);
                        loadFoodDatabase(1, { q: text }, false);
                      }}
                      returnKeyType="search"
                    />
                    {foodSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setFoodSearch('');
                          loadFoodDatabase(1, { q: '' }, false);
                        }}
                        style={{ padding: 4 }}
                      >
                        <X size={14} color={C.muted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Dietary Filters */}
                  <View style={{ gap: 8 }}>
                    <Text style={styles.filterGroupLabel}>Dietary Filter:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {['ALL', 'Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'].map((diet) => {
                        const active = foodDietFilter === diet;
                        return (
                          <TouchableOpacity
                            key={diet}
                            onPress={() => {
                              setFoodDietFilter(diet);
                              loadFoodDatabase(1, { dietType: diet }, false);
                            }}
                            style={[styles.foodFilterPill, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillText, active && styles.foodFilterPillTextActive]}>
                              {diet === 'ALL' ? 'All Diets' : diet}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Category Filters */}
                  <View style={{ gap: 8 }}>
                    <Text style={styles.filterGroupLabel}>Category Filter:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {['ALL', 'Curry', 'Dal / Legume', 'Rice / Biryani', 'Grain / Bread', 'Breakfast', 'Snack', 'Dessert / Sweet', 'Beverage', 'Salad', 'Soup', 'Protein', 'Vegetable'].map((cat) => {
                        const active = foodCategoryFilter === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => {
                              setFoodCategoryFilter(cat);
                              loadFoodDatabase(1, { category: cat }, false);
                            }}
                            style={[styles.foodFilterPill, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillText, active && styles.foodFilterPillTextActive]}>
                              {cat === 'ALL' ? 'All Categories' : cat}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Cuisine & Spice Level & Sorting Row */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    {/* Cuisine selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.filterGroupLabel}>Cuisine:</Text>
                      {['ALL', 'North Indian', 'South Indian', 'Mughlai', 'Indo-Chinese', 'Punjabi', 'Bengali', 'Italian'].map((cui) => {
                        const active = foodCuisineFilter === cui;
                        return (
                          <TouchableOpacity
                            key={cui}
                            onPress={() => {
                              setFoodCuisineFilter(cui);
                              loadFoodDatabase(1, { cuisine: cui }, false);
                            }}
                            style={[styles.foodFilterPillSmall, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillSmallText, active && styles.foodFilterPillTextActive]}>
                              {cui === 'ALL' ? 'All Cuisines' : cui}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Spice Level selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.filterGroupLabel}>Spice Level:</Text>
                      {['ALL', 'Mild', 'Medium', 'Spicy', 'Very Spicy'].map((sp) => {
                        const active = foodSpiceFilter === sp;
                        return (
                          <TouchableOpacity
                            key={sp}
                            onPress={() => {
                              setFoodSpiceFilter(sp);
                              loadFoodDatabase(1, { spiceLevel: sp }, false);
                            }}
                            style={[styles.foodFilterPillSmall, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillSmallText, active && styles.foodFilterPillTextActive]}>
                              {sp === 'ALL' ? 'All Spice' : sp}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Seasonality selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.filterGroupLabel}>Season:</Text>
                      {['ALL', 'All Season', 'Summer', 'Winter', 'Monsoon'].map((sea) => {
                        const active = foodSeasonalityFilter === sea;
                        return (
                          <TouchableOpacity
                            key={sea}
                            onPress={() => {
                              setFoodSeasonalityFilter(sea);
                              loadFoodDatabase(1, { seasonality: sea }, false);
                            }}
                            style={[styles.foodFilterPillSmall, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillSmallText, active && styles.foodFilterPillTextActive]}>
                              {sea === 'ALL' ? 'All Seasons' : sea}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Sorting selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.filterGroupLabel}>Sort By:</Text>
                      {[
                        { label: 'Name A-Z', by: 'name', ord: 'asc' },
                        { label: 'Calories ↑', by: 'calories', ord: 'asc' },
                        { label: 'Calories ↓', by: 'calories', ord: 'desc' },
                        { label: 'Protein ↓', by: 'protein', ord: 'desc' },
                      ].map((s) => {
                        const active = foodSortBy === s.by && foodSortOrder === s.ord;
                        return (
                          <TouchableOpacity
                            key={s.label}
                            onPress={() => {
                              setFoodSortBy(s.by);
                              setFoodSortOrder(s.ord);
                              loadFoodDatabase(1, { sortBy: s.by, sortOrder: s.ord }, false);
                            }}
                            style={[styles.foodFilterPillSmall, active && styles.foodFilterPillActive]}
                          >
                            <Text style={[styles.foodFilterPillSmallText, active && styles.foodFilterPillTextActive]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* 2. FOOD RECORDS CATALOG GRID */}
                <View style={{ gap: 16 }}>
                  {loadingFoods ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="small" color={C.orange} />
                      <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Querying food catalog...</Text>
                    </View>
                  ) : foodError ? (
                    <View style={styles.emptyCardBox}>
                      <AlertCircle size={36} color="#EF4444" style={{ marginBottom: 10 }} />
                      <Text style={[styles.emptyStateTitle, { color: '#EF4444' }]}>Unable to Load Food Database</Text>
                      <Text style={styles.emptyStateSub}>{foodError}</Text>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }]}
                        onPress={() => loadFoodsData()}
                      >
                        <RefreshCw size={14} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryBtnText}>Retry Loading</Text>
                      </TouchableOpacity>
                    </View>
                  ) : foodItems.length === 0 ? (
                    <View style={styles.emptyCardBox}>
                      <Database size={36} color="#334155" style={{ marginBottom: 10 }} />
                      <Text style={styles.emptyStateTitle}>
                        {(foodSearch || foodCategoryFilter !== 'ALL' || foodCuisineFilter !== 'ALL' || foodDietFilter !== 'ALL' || foodSpiceFilter !== 'ALL' || foodSeasonalityFilter !== 'ALL')
                          ? 'No Food Records Match Filters'
                          : 'No Food Records Available'}
                      </Text>
                      <Text style={styles.emptyStateSub}>
                        {(foodSearch || foodCategoryFilter !== 'ALL' || foodCuisineFilter !== 'ALL' || foodDietFilter !== 'ALL' || foodSpiceFilter !== 'ALL' || foodSeasonalityFilter !== 'ALL')
                          ? 'Try adjusting your search query, diet type, category, or cuisine filter.'
                          : 'The unified food catalog is empty or currently initializing.'}
                      </Text>
                      {(foodSearch || foodCategoryFilter !== 'ALL' || foodCuisineFilter !== 'ALL' || foodDietFilter !== 'ALL' || foodSpiceFilter !== 'ALL' || foodSeasonalityFilter !== 'ALL') && (
                        <TouchableOpacity
                          style={[styles.outlineBtn, { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }]}
                          onPress={handleResetFoodFilters}
                        >
                          <RefreshCw size={14} color={C.orange} style={{ marginRight: 6 }} />
                          <Text style={[styles.outlineBtnText, { color: C.orange }]}>Reset All Filters</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View>
                      {/* Responsive Grid Container */}
                      <View style={styles.foodGridContainer}>
                        {foodItems.map((food) => {
                          const isVeg = (food.dietType || '').toLowerCase() === 'vegetarian';
                          const isNonVeg = (food.dietType || '').toLowerCase() === 'non-vegetarian';
                          const isVegan = (food.dietType || '').toLowerCase() === 'vegan';
                          const isEgg = (food.dietType || '').toLowerCase() === 'eggetarian';

                          let dietColor = '#10B981';
                          let dietBg = 'rgba(16, 185, 129, 0.12)';
                          if (isNonVeg) {
                            dietColor = '#EF4444';
                            dietBg = 'rgba(239, 68, 68, 0.12)';
                          } else if (isVegan) {
                            dietColor = '#34D399';
                            dietBg = 'rgba(52, 211, 153, 0.12)';
                          } else if (isEgg) {
                            dietColor = '#F59E0B';
                            dietBg = 'rgba(245, 158, 11, 0.12)';
                          }

                          return (
                            <TouchableOpacity
                              key={food.id}
                              style={styles.foodGridCard}
                              onPress={() => handleSelectFoodItem(food)}
                              activeOpacity={0.88}
                            >
                              {/* Food Image with Fallback Placeholder */}
                              <View style={styles.foodGridThumbWrap}>
                                <FoodCardImage uri={food.image} name={food.name} category={food.category} />
                                <View style={[styles.foodGridDietBadge, { backgroundColor: dietBg, borderColor: dietColor }]}>
                                  <Text style={[styles.foodGridDietBadgeText, { color: dietColor }]}>
                                    {food.dietType || 'Vegetarian'}
                                  </Text>
                                </View>
                              </View>

                              {/* Card Content */}
                              <View style={styles.foodGridBody}>
                                <View style={{ gap: 6 }}>
                                  <Text style={styles.foodGridName} numberOfLines={1}>{food.name}</Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <View style={styles.categoryBadge}>
                                      <Text style={styles.categoryBadgeText}>{food.category || 'General'}</Text>
                                    </View>
                                    {food.cuisine ? (
                                      <View style={styles.cuisineBadge}>
                                        <Text style={styles.cuisineBadgeText}>{food.cuisine}</Text>
                                      </View>
                                    ) : null}
                                    {food.spiceLevel ? (
                                      <View style={styles.spiceBadge}>
                                        <Flame size={10} color={C.orange} style={{ marginRight: 2 }} />
                                        <Text style={styles.spiceBadgeText}>{food.spiceLevel}</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>

                                {/* Short Description */}
                                {food.description ? (
                                  <Text style={styles.foodGridDesc} numberOfLines={2}>
                                    {food.description}
                                  </Text>
                                ) : null}

                                {/* Nutrition Highlight Row */}
                                <View style={styles.foodGridNutriPill}>
                                  <View style={styles.foodGridNutriItem}>
                                    <Text style={styles.foodGridNutriVal}>{food.calories || 0}</Text>
                                    <Text style={styles.foodGridNutriUnit}>kcal</Text>
                                  </View>
                                  <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                                  <View style={styles.foodGridNutriItem}>
                                    <Text style={[styles.foodGridNutriVal, { color: '#10B981' }]}>{food.protein || 0}g</Text>
                                    <Text style={styles.foodGridNutriUnit}>protein</Text>
                                  </View>
                                </View>

                                {/* Card Footer: Source & Details CTA */}
                                <View style={styles.foodGridFooter}>
                                  <Text style={styles.foodSourceTag}>
                                    {food.sourceDataset === 'curated_fallback' ? 'Curated' : 'Primary'}
                                  </Text>
                                  <View style={styles.viewFoodBtn}>
                                    <Eye size={12} color="#fff" style={{ marginRight: 4 }} />
                                    <Text style={styles.viewFoodBtnText}>Details</Text>
                                  </View>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* 3. LOAD MORE FOODS BUTTON */}
                      {foodItems.length > 0 && foodItems.length < foodTotalCount && foodPage < foodTotalPages && (
                        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                          <TouchableOpacity
                            style={[styles.loadMoreBtn, loadingMoreFoods && styles.loadMoreBtnDisabled]}
                            onPress={handleLoadMoreFoods}
                            disabled={loadingMoreFoods}
                          >
                            {loadingMoreFoods ? (
                              <>
                                <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 8 }} />
                                <Text style={styles.loadMoreBtnText}>Loading Next 12 Foods...</Text>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={16} color={C.orange} style={{ marginRight: 6 }} />
                                <Text style={styles.loadMoreBtnText}>
                                  Load More Foods ({foodItems.length} of {foodTotalCount} shown)
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* ALL ITEMS LOADED MESSAGE */}
                      {foodItems.length > 0 && (foodItems.length >= foodTotalCount || foodPage >= foodTotalPages) && (
                        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
                          <Text style={{ fontSize: 12, color: C.muted }}>
                            All {foodTotalCount} food records loaded
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* 5. FOOD ITEM DETAILS MODAL / DRAWER */}
                {selectedFoodItem && (
                  <Modal
                    visible={Boolean(selectedFoodItem)}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setSelectedFoodItem(null)}
                  >
                    <View style={styles.modalOverlay}>
                      <View style={styles.foodDetailModalCard}>
                        {/* Modal Header */}
                        <View style={styles.foodModalHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.foodModalTitle}>{selectedFoodItem.name}</Text>
                            <Text style={styles.foodModalSubtitle}>
                              ID: {selectedFoodItem.id} • {selectedFoodItem.cuisine || 'Cuisine'} • {selectedFoodItem.category || 'Category'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setSelectedFoodItem(null)}
                            style={styles.foodModalCloseBtn}
                          >
                            <X size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={true}>
                          <View style={{ gap: 14 }}>
                            {/* Banner Image */}
                            <Image
                              source={{ uri: selectedFoodItem.image }}
                              style={styles.foodModalBanner}
                              resizeMode="cover"
                            />

                            {/* Badges Bar */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              <View style={[styles.dietBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                                <Text style={styles.dietBadgeText}>{selectedFoodItem.dietType || 'Vegetarian'}</Text>
                              </View>
                              <View style={[styles.categoryBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                                <Text style={styles.categoryBadgeText}>{selectedFoodItem.category || 'General'}</Text>
                              </View>
                              <View style={[styles.cuisineBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                                <Text style={styles.cuisineBadgeText}>{selectedFoodItem.cuisine || 'Standard'}</Text>
                              </View>
                              <View style={[styles.spiceBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                                <Flame size={12} color={C.orange} style={{ marginRight: 4 }} />
                                <Text style={styles.spiceBadgeText}>{selectedFoodItem.spiceLevel || 'Medium'} Spice</Text>
                              </View>
                              {selectedFoodItem.seasonality && (
                                <View style={[styles.seasonBadge, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                                  <Text style={styles.seasonBadgeText}>{selectedFoodItem.seasonality}</Text>
                                </View>
                              )}
                            </View>

                            {/* Description */}
                            {selectedFoodItem.description ? (
                              <View style={styles.foodDetailSectionBox}>
                                <Text style={styles.foodDetailSectionTitle}>Description</Text>
                                <Text style={styles.foodDetailDescText}>{selectedFoodItem.description}</Text>
                              </View>
                            ) : null}

                            {/* Complete Nutritional Profile */}
                            <View style={styles.foodDetailSectionBox}>
                              <Text style={styles.foodDetailSectionTitle}>Nutritional Profile (per serving)</Text>
                              <View style={styles.foodNutriCardGrid}>
                                <View style={styles.foodNutriTile}>
                                  <Text style={styles.foodNutriTileVal}>{selectedFoodItem.calories || 0}</Text>
                                  <Text style={styles.foodNutriTileLabel}>Calories (kcal)</Text>
                                </View>
                                <View style={styles.foodNutriTile}>
                                  <Text style={[styles.foodNutriTileVal, { color: '#10B981' }]}>{selectedFoodItem.protein || 0}g</Text>
                                  <Text style={styles.foodNutriTileLabel}>Protein</Text>
                                </View>
                                <View style={styles.foodNutriTile}>
                                  <Text style={[styles.foodNutriTileVal, { color: '#38BDF8' }]}>{selectedFoodItem.carbs || 0}g</Text>
                                  <Text style={styles.foodNutriTileLabel}>Carbohydrates</Text>
                                </View>
                                <View style={styles.foodNutriTile}>
                                  <Text style={[styles.foodNutriTileVal, { color: '#F59E0B' }]}>{selectedFoodItem.fat || 0}g</Text>
                                  <Text style={styles.foodNutriTileLabel}>Total Fat</Text>
                                </View>
                                <View style={styles.foodNutriTile}>
                                  <Text style={[styles.foodNutriTileVal, { color: '#A855F7' }]}>{selectedFoodItem.fiber || 0}g</Text>
                                  <Text style={styles.foodNutriTileLabel}>Dietary Fiber</Text>
                                </View>
                              </View>
                            </View>

                            {/* Ingredients & Aliases */}
                            {Array.isArray(selectedFoodItem.ingredients) && selectedFoodItem.ingredients.length > 0 ? (
                              <View style={styles.foodDetailSectionBox}>
                                <Text style={styles.foodDetailSectionTitle}>Ingredients</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                  {selectedFoodItem.ingredients.map((ing, idx) => (
                                    <View key={idx} style={styles.foodIngredientChip}>
                                      <Text style={styles.foodIngredientChipText}>{ing}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            ) : null}

                            {/* Allergens */}
                            <View style={styles.foodDetailSectionBox}>
                              <Text style={styles.foodDetailSectionTitle}>Allergens & Dietary Compliance</Text>
                              {Array.isArray(selectedFoodItem.allergens) && selectedFoodItem.allergens.length > 0 ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                  {selectedFoodItem.allergens.map((alg, idx) => (
                                    <View key={idx} style={styles.foodAllergenChip}>
                                      <AlertTriangle size={11} color="#EF4444" style={{ marginRight: 4 }} />
                                      <Text style={styles.foodAllergenChipText}>{alg}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <View style={styles.foodAllergenSafeChip}>
                                  <CheckCircle size={12} color="#10B981" style={{ marginRight: 5 }} />
                                  <Text style={styles.foodAllergenSafeText}>No common allergens reported (Allergen-safe profile)</Text>
                                </View>
                              )}
                            </View>

                            {/* Health & Dietary Tags */}
                            {Array.isArray(selectedFoodItem.healthTags) && selectedFoodItem.healthTags.length > 0 ? (
                              <View style={styles.foodDetailSectionBox}>
                                <Text style={styles.foodDetailSectionTitle}>Health & Nutritional Tags</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                  {selectedFoodItem.healthTags.map((tag, idx) => (
                                    <View key={idx} style={styles.foodHealthTagChip}>
                                      <Text style={styles.foodHealthTagText}>#{tag}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            ) : null}

                            {/* Preparation Metadata */}
                            {selectedFoodItem.preparation ? (
                              <View style={styles.foodDetailSectionBox}>
                                <Text style={styles.foodDetailSectionTitle}>Preparation & Culinary Details</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                  {selectedFoodItem.preparation.prepTimeMinutes ? (
                                    <Text style={styles.foodPrepMetaText}>
                                      Prep Time: <Text style={{ color: '#fff' }}>{selectedFoodItem.preparation.prepTimeMinutes} mins</Text>
                                    </Text>
                                  ) : null}
                                  {selectedFoodItem.preparation.cookTimeMinutes ? (
                                    <Text style={styles.foodPrepMetaText}>
                                      Cook Time: <Text style={{ color: '#fff' }}>{selectedFoodItem.preparation.cookTimeMinutes} mins</Text>
                                    </Text>
                                  ) : null}
                                  {selectedFoodItem.preparation.difficulty ? (
                                    <Text style={styles.foodPrepMetaText}>
                                      Difficulty: <Text style={{ color: C.orange }}>{selectedFoodItem.preparation.difficulty}</Text>
                                    </Text>
                                  ) : null}
                                  {selectedFoodItem.preparation.servingSize ? (
                                    <Text style={styles.foodPrepMetaText}>
                                      Serving Size: <Text style={{ color: '#fff' }}>{selectedFoodItem.preparation.servingSize}</Text>
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            ) : null}

                            {/* Source Metadata */}
                            <View style={styles.foodDetailSourceBox}>
                              <Info size={14} color="#94A3B8" style={{ marginRight: 6, marginTop: 2 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.foodDetailSourceTitle}>FoodieBite Grounded Data Source</Text>
                                <Text style={styles.foodDetailSourceText}>
                                  Source: {selectedFoodItem.sourceDataset === 'curated_fallback' ? 'foodiebiteFallbackFoods.js (Curated Fallback Dataset)' : 'foodKnowledge.js (Primary Food Knowledge Base)'} • ID: {selectedFoodItem.id}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                          <TouchableOpacity
                            onPress={() => setSelectedFoodItem(null)}
                            style={styles.modalCancelBtn}
                          >
                            <Text style={styles.modalCancelBtnText}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>
                )}
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
                      <Text style={styles.settingsInfoValue}>Supabase Identity & JWT Token</Text>
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

            {/* HEALTH INSIGHTS TAB */}
            {activeTab === 'health-insights' && (
              <React.Suspense fallback={
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={C.orange} />
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Loading Health Insights Module...</Text>
                </View>
              }>
                <AdminHealthInsightsSection />
              </React.Suspense>
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
                  This will remove the user from Supabase Authentication, delete their database records, favorites, meal logs, medical reports, and all linked resources.
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
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'health-insights', label: isMobile ? 'Insights' : 'Health Insights', icon: Activity },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'foods', label: isMobile ? 'Foods' : 'Food Database', icon: Database },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <View style={styles.adminFooterNav}>
      <View style={styles.adminFooterInner}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onTabSelect(item.id)}
              style={[styles.adminFooterItem, isActive && styles.adminFooterItemActive]}
              activeOpacity={0.7}
              role="button"
              aria-label={`Admin ${item.label}`}
            >
              <View style={[styles.adminFooterIconWrapper, isActive && styles.adminFooterIconActive]}>
                <Icon size={18} color={isActive ? ADMIN_THEME.accent : ADMIN_THEME.textMuted} />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Overview Hero & System Control Center Styles
  overviewHeroCard: {
    backgroundColor: '#171B24',
    borderWidth: 1.5,
    borderColor: '#2D3442',
    borderRadius: 14,
    padding: 18,
  },
  overviewHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  overviewHeroSub: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  quickNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#171B24',
    borderWidth: 1.5,
    borderColor: '#2D3442',
    borderRadius: 12,
    padding: 14,
  },
  quickNavIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  quickNavSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },

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
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 90,
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
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  metricSub: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 15,
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
    color: '#F8FAFC',
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
    color: '#FF6B35',
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
    color: '#94A3B8',
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
    color: '#CBD5E1',
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
    color: '#F8FAFC',
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
    color: '#F8FAFC',
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

  // ── Preferences & Tags Styles ─────────────────
  prefChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  prefChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
    textTransform: 'capitalize',
  },

  // ── Medical Intelligence & Reports Styles ─────
  privacyNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  privacyNoticeText: {
    fontSize: 11,
    color: '#38BDF8',
    flex: 1,
    lineHeight: 15,
  },
  actionProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  actionProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.orange,
  },
  medicalReportCard: {
    backgroundColor: C.card2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  reportTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  reportStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  reportActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  reportActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reportMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  reportMetricBadge: {
    flex: 1,
    minWidth: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  reportMetricNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  reportMetricLabel: {
    fontSize: 9,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  reportExpandedSection: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labTableContainer: {
    backgroundColor: '#12151D',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  labTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  labTableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
  },
  labTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  labTableCell: {
    fontSize: 11,
  },
  labStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  labStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  aiInsightsCard: {
    backgroundColor: '#12151D',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    gap: 12,
  },
  aiCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  aiModelBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiModelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.orange,
  },
  aiInsightBlock: {
    gap: 4,
  },
  aiInsightHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  aiInsightText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  foodSuggestionCard: {
    backgroundColor: C.card2,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  foodSuggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  foodBenefitPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  foodBenefitText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  foodSuggestionReason: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  medicalDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  medicalDisclaimerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  medicalDisclaimerText: {
    fontSize: 10,
    color: '#cbd5e1',
    lineHeight: 14,
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
  adminHeaderContainer: {
    backgroundColor: '#111318',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  adminHeaderMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  adminHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  adminBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  adminHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  adminHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminHeaderIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  adminLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  adminLogoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  adminHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  adminAuthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    maxWidth: 160,
  },
  adminAuthPillMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    maxWidth: 200,
  },
  adminAuthPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  adminSystemStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  systemStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    marginRight: 5,
  },
  adminSystemStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  mobileTableHint: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 53, 0.15)',
  },
  mobileTableHintText: {
    fontSize: 11,
    color: C.orange,
    fontWeight: '600',
  },
  metricsGridContainer: {
    width: '100%',
  },
  metricCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    color: '#F8FAFC',
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
    color: '#F8FAFC',
  },
  adminFooterNav: {
    width: '100%',
    backgroundColor: '#0F1117',
    borderTopWidth: 1,
    borderTopColor: '#2D3442',
    paddingVertical: 6,
    zIndex: 99,
  },
  adminFooterInner: {
    width: '100%',
    maxWidth: 1400,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  adminFooterItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    minWidth: 0,
    gap: 3,
  },
  adminFooterItemActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
  },
  adminFooterIconWrapper: {
    padding: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminFooterIconActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  adminFooterLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  adminFooterLabelActive: {
    color: '#FF6B35',
    fontWeight: '700',
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
    color: '#F8FAFC',
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
    color: '#F8FAFC',
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
    color: '#F8FAFC',
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
    color: '#F8FAFC',
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

  // Food Database Management Styles
  foodStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  foodStatCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    gap: 4,
  },
  foodStatNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  foodStatLabel: {
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foodFilterSection: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  foodSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12151D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    height: 38,
  },
  foodSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
  },
  foodFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  foodFilterPillActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: C.orange,
  },
  foodFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
  },
  foodFilterPillTextActive: {
    color: C.orange,
    fontWeight: '700',
  },
  foodFilterPillSmall: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  foodFilterPillSmallText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.muted,
  },
  foodGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  foodGridCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    overflow: 'hidden',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
    minWidth: 260,
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
  },
  foodGridThumbWrap: {
    width: '100%',
    height: 150,
    backgroundColor: '#1a1f2c',
    position: 'relative',
    overflow: 'hidden',
  },
  foodGridThumb: {
    width: '100%',
    height: '100%',
  },
  foodGridFallbackImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#171B24',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  foodGridFallbackText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  foodGridDietBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  foodGridDietBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  foodGridBody: {
    padding: 14,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 10,
  },
  foodGridName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },
  foodGridDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  foodGridNutriPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  foodGridNutriItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  foodGridNutriVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  foodGridNutriUnit: {
    fontSize: 10,
    color: C.muted,
  },
  foodGridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.orange,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 240,
  },
  loadMoreBtnDisabled: {
    opacity: 0.6,
    borderColor: C.border,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },
  foodRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  foodRowThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#1e2430',
  },
  foodRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  foodRowDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  dietBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  dietBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38BDF8',
  },
  cuisineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  cuisineBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#A855F7',
  },
  spiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  spiceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.orange,
  },
  seasonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  seasonBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
  },
  foodNutriBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  foodNutriItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  foodNutriVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  foodNutriUnit: {
    fontSize: 9,
    color: C.muted,
  },
  foodRowActionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  foodSourceTag: {
    fontSize: 9,
    color: C.muted,
    textTransform: 'uppercase',
  },
  viewFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewFoodBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  foodPaginationWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  foodPageRangeText: {
    fontSize: 12,
    color: C.muted,
  },
  foodDetailModalCard: {
    backgroundColor: '#161922',
    borderWidth: 1,
    borderColor: '#2E3545',
    borderRadius: 16,
    padding: 20,
    maxWidth: 640,
    width: '100%',
    maxHeight: '90%',
  },
  foodModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 10,
  },
  foodModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  foodModalSubtitle: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  foodModalCloseBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  foodModalBanner: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#1e2430',
  },
  foodDetailSectionBox: {
    backgroundColor: '#12151D',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  foodDetailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foodDetailDescText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  foodNutriCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  foodNutriTile: {
    flex: 1,
    minWidth: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  foodNutriTileVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  foodNutriTileLabel: {
    fontSize: 9,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  foodIngredientChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  foodIngredientChipText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  foodAllergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  foodAllergenChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  foodAllergenSafeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  foodAllergenSafeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  foodHealthTagChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  foodHealthTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  foodPrepMetaText: {
    fontSize: 11,
    color: C.muted,
  },
  foodDetailSourceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  foodDetailSourceTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  foodDetailSourceText: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
});
