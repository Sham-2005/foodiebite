import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform
} from 'react-native';
import {
  Activity,
  Heart,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  FileText,
  Eye,
  X,
  User,
  Zap,
  Moon,
  Droplet
} from 'lucide-react-native';
import {
  apiAdminGetHealthInsightsStats,
  apiAdminGetHealthInsightsSubmissions,
  apiAdminGetCheckinDetails,
  apiAdminGetUserHealthCheckinProfile,
  apiAdminReanalyzeCheckin
} from '../../services/api';

const ADMIN_THEME = {
  bg: '#0F1117',
  card: '#171B24',
  cardHover: '#1E2430',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#2D3442',
  accent: '#FF6B35',
  accentLight: 'rgba(255, 107, 53, 0.12)',
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.12)',
  info: '#38BDF8',
  infoLight: 'rgba(56, 189, 248, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)'
};

export default function AdminHealthInsightsSection() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCheckins: 0,
    activeParticipants: 0,
    checkinsThisWeek: 0,
    pendingAnalysis: 0,
    analyzedCheckins: 0
  });

  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, completed, draft, in_progress
  const [reanalyzingId, setReanalyzingId] = useState(null);

  // Inspection modal state
  const [selectedCheckinId, setSelectedCheckinId] = useState(null);
  const [inspectModalVisible, setInspectModalVisible] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [loadingInspection, setLoadingInspection] = useState(false);

  // User Health Profile Modal
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);

  // Load stats and submissions
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, subsRes] = await Promise.all([
        apiAdminGetHealthInsightsStats(),
        apiAdminGetHealthInsightsSubmissions({ status: statusFilter })
      ]);

      if (statsRes && statsRes.stats) setStats(statsRes.stats);
      if (subsRes && subsRes.submissions) setSubmissions(subsRes.submissions);
    } catch (err) {
      console.warn('AdminHealthInsightsSection loadData error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Inspection Modal for a specific check-in
  const handleInspectCheckin = async (checkinId) => {
    try {
      setSelectedCheckinId(checkinId);
      setInspectModalVisible(true);
      setLoadingInspection(true);
      const res = await apiAdminGetCheckinDetails(checkinId);
      if (res) {
        setInspectData(res);
      }
    } catch (err) {
      console.warn('handleInspectCheckin error:', err.message);
    } finally {
      setLoadingInspection(false);
    }
  };

  // Open User Health Profile Modal
  const handleViewUserProfile = async (userId) => {
    if (!userId) return;
    try {
      setUserProfileModalVisible(true);
      setLoadingUserProfile(true);
      const res = await apiAdminGetUserHealthCheckinProfile(userId);
      if (res && res.profile) {
        setUserProfileData(res.profile);
      }
    } catch (err) {
      console.warn('handleViewUserProfile error:', err.message);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  // Re-analyze Check-in
  const handleReanalyze = async (checkinId) => {
    try {
      setReanalyzingId(checkinId);
      const res = await apiAdminReanalyzeCheckin(checkinId);
      if (res && res.analysis) {
        // Refresh inspection data if currently open
        if (inspectData && inspectData.checkin?.id === checkinId) {
          setInspectData(prev => ({ ...prev, analysis: res.analysis }));
        }
        loadData();
      }
    } catch (err) {
      console.warn('handleReanalyze error:', err.message);
    } finally {
      setReanalyzingId(null);
    }
  };

  // Filtered submissions based on search input
  const filteredSubmissions = submissions.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.userName && s.userName.toLowerCase().includes(q)) ||
      (s.userEmail && s.userEmail.toLowerCase().includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q))
    );
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return String(isoStr);
    }
  };

  return (
    <View style={styles.container}>
      {/* Module Title Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.moduleTitle}>Health Insights & Check-in Management</Text>
          <Text style={styles.moduleSubtitle}>
            Review weekly user health surveys, AI wellness trends, and dietary suggestions
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData} activeOpacity={0.8}>
          <RefreshCw size={14} color={ADMIN_THEME.accent} style={{ marginRight: 6 }} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* 5 Summary Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Check-ins</Text>
          <Text style={styles.statValue}>{stats.totalCheckins}</Text>
          <Text style={styles.statSub}>All-time submissions</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Participants</Text>
          <Text style={[styles.statValue, { color: ADMIN_THEME.info }]}>{stats.activeParticipants}</Text>
          <Text style={styles.statSub}>Unique users tracking</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Check-ins This Week</Text>
          <Text style={[styles.statValue, { color: ADMIN_THEME.success }]}>{stats.checkinsThisWeek}</Text>
          <Text style={styles.statSub}>Last 7 days</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending AI Analysis</Text>
          <Text style={[styles.statValue, { color: stats.pendingAnalysis > 0 ? ADMIN_THEME.warning : ADMIN_THEME.textMuted }]}>
            {stats.pendingAnalysis}
          </Text>
          <Text style={styles.statSub}>In processing queue</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Successfully Analyzed</Text>
          <Text style={[styles.statValue, { color: ADMIN_THEME.success }]}>{stats.analyzedCheckins}</Text>
          <Text style={styles.statSub}>AI wellness insights ready</Text>
        </View>
      </View>

      {/* Filter and Search Bar */}
      <View style={styles.filterRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={ADMIN_THEME.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by user email, name, or check-in ID..."
            placeholderTextColor={ADMIN_THEME.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Status Filter Chips */}
        <View style={styles.statusChipsWrap}>
          {['all', 'completed', 'in_progress', 'draft'].map(s => {
            const isSelected = statusFilter === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, isSelected && styles.statusChipActive]}
                onPress={() => setStatusFilter(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.statusChipText, isSelected && styles.statusChipTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Submissions Table / List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={ADMIN_THEME.accent} />
          <Text style={styles.loadingText}>Loading health check-in submissions...</Text>
        </View>
      ) : filteredSubmissions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Activity size={32} color={ADMIN_THEME.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>No Health Check-ins Found</Text>
          <Text style={styles.emptyText}>No check-in submissions match the selected filters.</Text>
        </View>
      ) : (
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, { flex: 2 }]}>User</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Check-in Date</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Status</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>AI Analysis</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Wellness Trend</Text>
            <Text style={[styles.th, { width: 140, textAlign: 'right' }]}>Actions</Text>
          </View>

          {filteredSubmissions.map((item, idx) => (
            <View key={item.id || idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#141720' }]}>
              {/* User Column */}
              <TouchableOpacity
                style={{ flex: 2 }}
                onPress={() => handleViewUserProfile(item.userId)}
                activeOpacity={0.7}
              >
                <Text style={styles.tdUserLink} numberOfLines={1}>{item.userName || 'User'}</Text>
                <Text style={styles.tdSub} numberOfLines={1}>{item.userEmail || item.userId}</Text>
              </TouchableOpacity>

              {/* Date */}
              <Text style={[styles.td, { flex: 1.5 }]} numberOfLines={1}>
                {formatDate(item.completedAt || item.startedAt)}
              </Text>

              {/* Status */}
              <View style={{ flex: 1.2 }}>
                <View style={[
                  styles.badge,
                  item.status === 'completed' ? styles.badgeSuccess : styles.badgeWarning
                ]}>
                  <Text style={[
                    styles.badgeText,
                    item.status === 'completed' ? { color: ADMIN_THEME.success } : { color: ADMIN_THEME.warning }
                  ]}>
                    {item.status}
                  </Text>
                </View>
              </View>

              {/* AI Analysis Status */}
              <View style={{ flex: 1.2 }}>
                <View style={[
                  styles.badge,
                  item.aiAnalysisStatus === 'analyzed' || item.aiAnalysisStatus === 'fallback_used'
                    ? styles.badgeSuccess
                    : styles.badgeInfo
                ]}>
                  <Text style={[
                    styles.badgeText,
                    item.aiAnalysisStatus === 'analyzed' || item.aiAnalysisStatus === 'fallback_used'
                      ? { color: ADMIN_THEME.success }
                      : { color: ADMIN_THEME.info }
                  ]}>
                    {item.aiAnalysisStatus}
                  </Text>
                </View>
              </View>

              {/* Wellness Trend */}
              <Text style={[styles.td, { flex: 1.2, fontWeight: '600' }]}>
                {item.wellnessTrend || 'Stable'}
              </Text>

              {/* Action Buttons */}
              <View style={[styles.tdActions, { width: 140 }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleInspectCheckin(item.id)}
                  activeOpacity={0.8}
                >
                  <Eye size={12} color={ADMIN_THEME.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>Inspect</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: ADMIN_THEME.border }]}
                  onPress={() => handleReanalyze(item.id)}
                  disabled={reanalyzingId === item.id}
                  activeOpacity={0.8}
                >
                  {reanalyzingId === item.id ? (
                    <ActivityIndicator size="small" color={ADMIN_THEME.accent} />
                  ) : (
                    <RefreshCw size={12} color={ADMIN_THEME.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CHECK-IN INSPECTION MODAL                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={inspectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Activity size={20} color={ADMIN_THEME.accent} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Check-in Survey Inspection</Text>
              </View>
              <TouchableOpacity onPress={() => setInspectModalVisible(false)} style={styles.closeBtn}>
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingInspection ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={ADMIN_THEME.accent} />
                <Text style={styles.loadingText}>Loading check-in breakdown...</Text>
              </View>
            ) : inspectData ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 16 }}>
                {/* AI Wellness Analysis Header */}
                {inspectData.analysis && (
                  <View style={styles.aiSummaryBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Sparkles size={16} color={ADMIN_THEME.accent} style={{ marginRight: 6 }} />
                      <Text style={styles.aiSummaryTitle}>AI Wellness Analysis & Interpretation</Text>
                    </View>
                    <Text style={styles.aiSummaryText}>{inspectData.analysis.wellness_summary}</Text>

                    {/* Positive & Declining Trends */}
                    {inspectData.analysis.positive_trends?.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.aiSectionLabel, { color: ADMIN_THEME.success }]}>Positive Trends:</Text>
                        {inspectData.analysis.positive_trends.map((pt, i) => (
                          <Text key={i} style={styles.aiBulletText}>• {pt}</Text>
                        ))}
                      </View>
                    )}

                    {inspectData.analysis.areas_to_monitor?.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.aiSectionLabel, { color: ADMIN_THEME.warning }]}>Areas to Monitor:</Text>
                        {inspectData.analysis.areas_to_monitor.map((am, i) => (
                          <Text key={i} style={styles.aiBulletText}>• {am}</Text>
                        ))}
                      </View>
                    )}

                    {inspectData.analysis.dietary_suggestions?.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.aiSectionLabel, { color: ADMIN_THEME.info }]}>Dietary Recommendations:</Text>
                        {inspectData.analysis.dietary_suggestions.map((ds, i) => (
                          <Text key={i} style={styles.aiBulletText}>• {ds}</Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.disclaimerBox}>
                      <Text style={styles.disclaimerText}>
                        💡 AI-generated wellness insights based on self-reported information. Not a medical diagnosis.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Questions & User Answers */}
                <Text style={styles.inspectSectionHeading}>Survey Questions & User Responses</Text>
                {inspectData.questions?.map((q, idx) => (
                  <View key={q.id || idx} style={styles.inspectQItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.inspectQNum}>Q{idx + 1} ({q.category})</Text>
                      {q.isAiGenerated && (
                        <View style={[styles.badge, styles.badgeAccent]}>
                          <Text style={[styles.badgeText, { color: ADMIN_THEME.accent }]}>AI Follow-up</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.inspectQText}>{q.text}</Text>
                    <Text style={styles.inspectAnswer}>
                      Answer:{' '}
                      <Text style={{ fontWeight: '700', color: ADMIN_THEME.textPrimary }}>
                        {q.userAnswer !== null && q.userAnswer !== undefined
                          ? (Array.isArray(q.userAnswer) ? q.userAnswer.join(', ') : String(q.userAnswer))
                          : 'Not Answered / Skipped'}
                      </Text>
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No data available for this check-in.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 2: USER HEALTH PROFILE & COMPARISON MODAL          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={userProfileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUserProfileModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <User size={20} color={ADMIN_THEME.accent} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>User Health Insights Profile</Text>
              </View>
              <TouchableOpacity onPress={() => setUserProfileModalVisible(false)} style={styles.closeBtn}>
                <X size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingUserProfile ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={ADMIN_THEME.accent} />
                <Text style={styles.loadingText}>Loading user profile history...</Text>
              </View>
            ) : userProfileData ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, gap: 16 }}>
                {/* User Stats Overview */}
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total Completed</Text>
                    <Text style={styles.statValue}>{userProfileData.totalCompleted}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Latest Date</Text>
                    <Text style={[styles.statValue, { fontSize: 13 }]}>{formatDate(userProfileData.latestCheckinDate)}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Previous Date</Text>
                    <Text style={[styles.statValue, { fontSize: 13 }]}>{formatDate(userProfileData.previousCheckinDate)}</Text>
                  </View>
                </View>

                {/* Trend Summary */}
                {userProfileData.trends?.trendRecord?.trend_summary && (
                  <View style={styles.aiSummaryBox}>
                    <Text style={styles.aiSummaryTitle}>Historical Trend Assessment</Text>
                    <Text style={styles.aiSummaryText}>{userProfileData.trends.trendRecord.trend_summary}</Text>
                  </View>
                )}

                {/* Checkin History Timeline */}
                <Text style={styles.inspectSectionHeading}>Check-in Timeline History</Text>
                {userProfileData.historySummary?.map((h, i) => (
                  <View key={h.id || i} style={styles.timelineRow}>
                    <Calendar size={14} color={ADMIN_THEME.textMuted} style={{ marginRight: 8 }} />
                    <Text style={[styles.td, { flex: 1 }]}>{formatDate(h.date)}</Text>
                    <View style={[styles.badge, h.status === 'completed' ? styles.badgeSuccess : styles.badgeWarning]}>
                      <Text style={[styles.badgeText, h.status === 'completed' ? { color: ADMIN_THEME.success } : { color: ADMIN_THEME.warning }]}>
                        {h.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>User health profile unavailable.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  moduleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary
  },
  moduleSubtitle: {
    fontSize: 13,
    color: ADMIN_THEME.textMuted,
    marginTop: 2
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: ADMIN_THEME.accentLight,
    borderWidth: 1,
    borderColor: ADMIN_THEME.accent
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_THEME.accent
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_THEME.textMuted,
    marginBottom: 4
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary
  },
  statSub: {
    fontSize: 11,
    color: ADMIN_THEME.textMuted,
    marginTop: 2
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  searchWrap: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  searchInput: {
    flex: 1,
    color: ADMIN_THEME.textPrimary,
    fontSize: 13
  },
  statusChipsWrap: {
    flexDirection: 'row',
    gap: 6
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: ADMIN_THEME.card,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  statusChipActive: {
    backgroundColor: ADMIN_THEME.accentLight,
    borderColor: ADMIN_THEME.accent
  },
  statusChipText: {
    fontSize: 12,
    color: ADMIN_THEME.textMuted
  },
  statusChipTextActive: {
    color: ADMIN_THEME.accent,
    fontWeight: '600'
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center'
  },
  loadingText: {
    color: ADMIN_THEME.textMuted,
    fontSize: 13,
    marginTop: 8
  },
  emptyBox: {
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary
  },
  emptyText: {
    fontSize: 12,
    color: ADMIN_THEME.textMuted,
    marginTop: 2
  },
  tableCard: {
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border,
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.border
  },
  th: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_THEME.textMuted
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)'
  },
  td: {
    fontSize: 13,
    color: ADMIN_THEME.textSecondary
  },
  tdUserLink: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_THEME.accent
  },
  tdSub: {
    fontSize: 11,
    color: ADMIN_THEME.textMuted,
    marginTop: 2
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  badgeSuccess: {
    backgroundColor: ADMIN_THEME.successLight,
    borderWidth: 1,
    borderColor: ADMIN_THEME.success
  },
  badgeWarning: {
    backgroundColor: ADMIN_THEME.warningLight,
    borderWidth: 1,
    borderColor: ADMIN_THEME.warning
  },
  badgeInfo: {
    backgroundColor: ADMIN_THEME.infoLight,
    borderWidth: 1,
    borderColor: ADMIN_THEME.info
  },
  badgeAccent: {
    backgroundColor: ADMIN_THEME.accentLight,
    borderWidth: 1,
    borderColor: ADMIN_THEME.accent
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  tdActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: ADMIN_THEME.accent
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: ADMIN_THEME.accent
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: ADMIN_THEME.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border,
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_THEME.border,
    backgroundColor: ADMIN_THEME.card
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary
  },
  closeBtn: {
    padding: 6
  },
  aiSummaryBox: {
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  aiSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary
  },
  aiSummaryText: {
    fontSize: 13,
    color: ADMIN_THEME.textSecondary,
    lineHeight: 18
  },
  aiSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4
  },
  aiBulletText: {
    fontSize: 12,
    color: ADMIN_THEME.textSecondary,
    lineHeight: 16,
    marginLeft: 4,
    marginBottom: 2
  },
  disclaimerBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    borderRadius: 6
  },
  disclaimerText: {
    fontSize: 11,
    color: ADMIN_THEME.textMuted,
    fontStyle: 'italic'
  },
  inspectSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_THEME.textPrimary,
    marginTop: 8
  },
  inspectQItem: {
    backgroundColor: ADMIN_THEME.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  },
  inspectQNum: {
    fontSize: 11,
    fontWeight: '600',
    color: ADMIN_THEME.accent
  },
  inspectQText: {
    fontSize: 13,
    color: ADMIN_THEME.textSecondary,
    marginBottom: 6
  },
  inspectAnswer: {
    fontSize: 12,
    color: ADMIN_THEME.textMuted
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_THEME.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ADMIN_THEME.border
  }
});
