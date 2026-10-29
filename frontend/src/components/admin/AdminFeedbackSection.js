import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal
} from 'react-native';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Send,
  FileText,
  User,
  Mail,
  Calendar,
  Sparkles,
  RefreshCw,
  X,
  Edit3,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react-native';
import { C } from '../UI';
import {
  apiAdminGetFeedback,
  apiAdminUpdateFeedbackStatus,
  apiAdminDeleteFeedback
} from '../../services/api';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'dietary_safety', label: 'Dietary Safety' },
  { id: 'app_experience', label: 'App Experience' },
  { id: 'food_quality', label: 'Food Quality' },
  { id: 'general', label: 'General Inquiries' }
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Status' },
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'resolved', label: 'Resolved' }
];

const RATING_FILTERS = [
  { id: 'all', label: 'All Ratings' },
  { id: '5', label: '5 Stars' },
  { id: '4', label: '4 Stars' },
  { id: '3', label: '3 Stars' },
  { id: '2', label: '2 Stars' },
  { id: '1', label: '1 Star' }
];

export default function AdminFeedbackSection({ adminUser }) {
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal Dialogs
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [internalNoteText, setInternalNoteText] = useState('');
  const [replyMessageText, setReplyMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAdminGetFeedback({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        rating: selectedRating !== 'all' ? selectedRating : undefined,
        q: searchQuery.trim() || undefined,
        page,
        limit
      });

      if (res && res.success) {
        setFeedbackList(res.feedback || []);
        setTotalCount(res.total || (res.feedback || []).length);
        setTotalPages(res.totalPages || Math.ceil((res.total || 1) / limit) || 1);
      } else {
        setFeedbackList([]);
      }
    } catch (err) {
      console.warn('Error fetching feedback:', err.message);
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [selectedCategory, selectedStatus, selectedRating, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchFeedback();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStatusChange = async (feedbackId, nextStatus) => {
    setActionLoading(true);
    try {
      await apiAdminUpdateFeedbackStatus(feedbackId, { status: nextStatus });
      setFeedbackList(prev => prev.map(f => f.id === feedbackId ? { ...f, status: nextStatus } : f));
      Alert.alert('Status Updated', `Ticket marked as ${nextStatus}.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenNoteModal = (item) => {
    setActiveFeedback(item);
    setInternalNoteText(item.internalNotes || '');
    setNoteModalVisible(true);
  };

  const handleSaveInternalNote = async () => {
    if (!activeFeedback) return;
    setActionLoading(true);
    try {
      await apiAdminUpdateFeedbackStatus(activeFeedback.id, {
        internalNotes: internalNoteText.trim(),
        status: activeFeedback.status === 'pending' ? 'reviewed' : activeFeedback.status
      });
      setFeedbackList(prev => prev.map(f => f.id === activeFeedback.id ? {
        ...f,
        internalNotes: internalNoteText.trim(),
        status: f.status === 'pending' ? 'reviewed' : f.status,
        reviewedBy: adminUser?.email || 'admin@foodiebite.com',
        reviewedAt: new Date().toISOString()
      } : f));
      setNoteModalVisible(false);
      Alert.alert('Note Saved', 'Administrative internal note attached to feedback ticket.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReplyModal = (item) => {
    setActiveFeedback(item);
    setReplyMessageText(item.replyMessage || '');
    setReplyModalVisible(true);
  };

  const handleSendResolutionReply = async () => {
    if (!activeFeedback) return;
    if (!replyMessageText.trim()) {
      Alert.alert('Required', 'Please enter a reply message for the user.');
      return;
    }
    setActionLoading(true);
    try {
      await apiAdminUpdateFeedbackStatus(activeFeedback.id, {
        status: 'resolved',
        replyMessage: replyMessageText.trim()
      });
      setFeedbackList(prev => prev.map(f => f.id === activeFeedback.id ? {
        ...f,
        status: 'resolved',
        replyMessage: replyMessageText.trim(),
        reviewedBy: adminUser?.email || 'admin@foodiebite.com',
        reviewedAt: new Date().toISOString()
      } : f));
      setReplyModalVisible(false);
      Alert.alert('Success', `Resolution email reply sent to ${activeFeedback.email}.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Feedback',
      `Are you sure you want to delete feedback ticket "${item.id}" from ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiAdminDeleteFeedback(item.id);
              setFeedbackList(prev => prev.filter(f => f.id !== item.id));
              setTotalCount(c => Math.max(0, c - 1));
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // Metrics
  const pendingCount = feedbackList.filter(f => f.status === 'pending').length;
  const reviewedCount = feedbackList.filter(f => f.status === 'reviewed').length;
  const resolvedCount = feedbackList.filter(f => f.status === 'resolved').length;
  const avgRating = feedbackList.length > 0
    ? (feedbackList.reduce((acc, f) => acc + (Number(f.rating) || 5), 0) / feedbackList.length).toFixed(1)
    : '5.0';

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
    } catch (_) {
      return String(dateVal);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER & METRICS SUMMARY CARDS ── */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>TOTAL TICKETS</Text>
          <Text style={styles.metricValue}>{totalCount}</Text>
          <Text style={styles.metricSub}>All submitted reviews</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#F59E0B' }]}>
          <Text style={styles.metricLabel}>PENDING REVIEW</Text>
          <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{pendingCount}</Text>
          <Text style={styles.metricSub}>Awaiting staff inspection</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#3B82F6' }]}>
          <Text style={styles.metricLabel}>REVIEWED</Text>
          <Text style={[styles.metricValue, { color: '#60A5FA' }]}>{reviewedCount}</Text>
          <Text style={styles.metricSub}>Internal notes recorded</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#10B981' }]}>
          <Text style={styles.metricLabel}>RESOLVED</Text>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>{resolvedCount}</Text>
          <Text style={styles.metricSub}>Customer answered</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#FF6B35' }]}>
          <Text style={styles.metricLabel}>AVG SATISFACTION</Text>
          <Text style={[styles.metricValue, { color: '#FF6B35' }]}>{avgRating} ★</Text>
          <Text style={styles.metricSub}>From 5-star ratings</Text>
        </View>
      </View>

      {/* ── FILTER & SEARCH CONTROLS ── */}
      <View style={styles.controlsCard}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={C.muted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search feedback text, user name, email, or ticket ID..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color={C.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity onPress={fetchFeedback} style={styles.refreshBtn}>
            <RefreshCw size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersWrapper}>
          {/* Status Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Status:</Text>
            <View style={styles.pillsRow}>
              {STATUS_FILTERS.map(st => (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => { setSelectedStatus(st.id); setPage(1); }}
                  style={[
                    styles.pillBtn,
                    selectedStatus === st.id && styles.pillBtnActive
                  ]}
                >
                  <Text style={[styles.pillText, selectedStatus === st.id && styles.pillTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Category:</Text>
            <View style={styles.pillsRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { setSelectedCategory(cat.id); setPage(1); }}
                  style={[
                    styles.pillBtn,
                    selectedCategory === cat.id && styles.pillBtnActive
                  ]}
                >
                  <Text style={[styles.pillText, selectedCategory === cat.id && styles.pillTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rating Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Rating:</Text>
            <View style={styles.pillsRow}>
              {RATING_FILTERS.map(rf => (
                <TouchableOpacity
                  key={rf.id}
                  onPress={() => { setSelectedRating(rf.id); setPage(1); }}
                  style={[
                    styles.pillBtn,
                    selectedRating === rf.id && styles.pillBtnActive
                  ]}
                >
                  <Text style={[styles.pillText, selectedRating === rf.id && styles.pillTextActive]}>
                    {rf.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── FEEDBACK TICKETS LIST ── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={styles.loadingText}>Loading feedback tickets...</Text>
        </View>
      ) : feedbackList.length === 0 ? (
        <View style={styles.emptyCard}>
          <MessageSquare size={36} color="#475569" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Feedback Records Found</Text>
          <Text style={styles.emptySub}>
            No user feedback matches your current search filters. Try resetting the status or category filter.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {feedbackList.map(item => {
            const isResolved = item.status === 'resolved';
            const isReviewed = item.status === 'reviewed';

            return (
              <View
                key={item.id}
                style={[
                  styles.ticketCard,
                  isResolved
                    ? { borderColor: 'rgba(16,185,129,0.3)' }
                    : isReviewed
                    ? { borderColor: 'rgba(59,130,246,0.3)' }
                    : { borderColor: 'rgba(245,158,11,0.3)' }
                ]}
              >
                {/* Header row */}
                <View style={styles.ticketHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={styles.ticketUserName}>{item.name || 'Anonymous User'}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {(item.category || 'general').replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={styles.ticketEmail}>{item.email}</Text>
                      <Text style={styles.ticketId}>ID: {item.id}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ fontSize: 13 }}>{'⭐'.repeat(Number(item.rating) || 5)}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isResolved
                          ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }
                          : isReviewed
                          ? { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' }
                          : { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#F59E0B' }
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isResolved
                            ? { color: '#34D399' }
                            : isReviewed
                            ? { color: '#93C5FD' }
                            : { color: '#FBBF24' }
                        ]}
                      >
                        {(item.status || 'pending').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.ticketDate}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                </View>

                {/* User Message */}
                <View style={styles.messageBox}>
                  <Text style={styles.messageLabel}>USER FEEDBACK MESSAGE:</Text>
                  <Text style={styles.messageText}>"{item.message}"</Text>
                </View>

                {/* Internal Administrative Notes */}
                {item.internalNotes ? (
                  <View style={styles.internalNotesBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Edit3 size={13} color="#A78BFA" />
                      <Text style={styles.internalNotesTitle}>INTERNAL ADMINISTRATIVE NOTE (Private):</Text>
                    </View>
                    <Text style={styles.internalNotesText}>{item.internalNotes}</Text>
                    {item.reviewedBy ? (
                      <Text style={styles.reviewedByText}>
                        Recorded by <Text style={{ color: '#fff' }}>{item.reviewedBy}</Text> on {formatDateTime(item.reviewedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Customer Email Reply */}
                {item.replyMessage ? (
                  <View style={styles.replyBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Send size={13} color="#34D399" />
                      <Text style={styles.replyTitle}>CUSTOMER EMAIL REPLY (Dispatched):</Text>
                    </View>
                    <Text style={styles.replyText}>{item.replyMessage}</Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.ticketActionsRow}>
                  {item.status === 'pending' && (
                    <TouchableOpacity
                      onPress={() => handleStatusChange(item.id, 'reviewed')}
                      style={styles.actionBtnSecondary}
                    >
                      <CheckCircle size={13} color="#60A5FA" style={{ marginRight: 5 }} />
                      <Text style={[styles.actionBtnText, { color: '#60A5FA' }]}>Mark Reviewed</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleOpenNoteModal(item)}
                    style={styles.actionBtnSecondary}
                  >
                    <Edit3 size={13} color="#A78BFA" style={{ marginRight: 5 }} />
                    <Text style={[styles.actionBtnText, { color: '#A78BFA' }]}>
                      {item.internalNotes ? 'Edit Internal Note' : 'Add Internal Note'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenReplyModal(item)}
                    style={styles.actionBtnPrimary}
                  >
                    <Send size={13} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={styles.actionBtnPrimaryText}>
                      {item.replyMessage ? 'Send Another Reply' : 'Reply & Resolve'}
                    </Text>
                  </TouchableOpacity>

                  {!isResolved && (
                    <TouchableOpacity
                      onPress={() => handleStatusChange(item.id, 'resolved')}
                      style={styles.actionBtnResolveQuick}
                    >
                      <Check size={13} color="#10B981" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>Resolve</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                disabled={page <= 1}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              >
                <ChevronLeft size={16} color={page <= 1 ? '#475569' : '#fff'} />
                <Text style={[styles.pageBtnText, page <= 1 && { color: '#475569' }]}>Previous</Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                Page <Text style={{ color: '#fff', fontWeight: '700' }}>{page}</Text> of {totalPages}
              </Text>

              <TouchableOpacity
                disabled={page >= totalPages}
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              >
                <Text style={[styles.pageBtnText, page >= totalPages && { color: '#475569' }]}>Next</Text>
                <ChevronRight size={16} color={page >= totalPages ? '#475569' : '#fff'} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── MODAL 1: INTERNAL ADMINISTRATIVE NOTE ── */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#A78BFA" />
                <Text style={styles.modalTitle}>Internal Administrative Note</Text>
              </View>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                <X size={18} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Private notes are visible ONLY to authorized administrators. The user will NOT see this content.
            </Text>

            <View style={styles.ticketSnippet}>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                Ticket: <Text style={{ color: '#fff', fontWeight: '700' }}>{activeFeedback?.id}</Text> &bull; User: {activeFeedback?.name} ({activeFeedback?.email})
              </Text>
            </View>

            <TextInput
              multiline
              numberOfLines={4}
              value={internalNoteText}
              onChangeText={setInternalNoteText}
              placeholder="Record findings, internal follow-up steps, or validation notes here..."
              placeholderTextColor="#64748b"
              style={styles.modalTextArea}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setNoteModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveInternalNote}
                disabled={actionLoading}
                style={styles.modalSaveBtn}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Private Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: CUSTOMER EMAIL REPLY & RESOLVE ── */}
      <Modal
        visible={replyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Send size={18} color="#10B981" />
                <Text style={styles.modalTitle}>Send Support Resolution Email</Text>
              </View>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <X size={18} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              This will send a direct transactional resolution email to <strong style={{ color: '#FF6B35' }}>{activeFeedback?.email}</strong> and mark the ticket as resolved.
            </Text>

            <View style={styles.ticketSnippet}>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>
                Original Message: <Text style={{ color: '#cbd5e1', fontStyle: 'italic' }}>"{activeFeedback?.message}"</Text>
              </Text>
            </View>

            <TextInput
              multiline
              numberOfLines={5}
              value={replyMessageText}
              onChangeText={setReplyMessageText}
              placeholder="Type your official customer support resolution message here..."
              placeholderTextColor="#64748b"
              style={styles.modalTextArea}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setReplyModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendResolutionReply}
                disabled={actionLoading}
                style={[styles.modalSaveBtn, { backgroundColor: '#10B981' }]}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Send Resolution Email & Resolve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#161a22',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    borderRadius: 12,
    padding: 14
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4
  },
  metricSub: {
    color: '#64748b',
    fontSize: 11
  },
  controlsCard: {
    backgroundColor: '#161a22',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 14,
    padding: 16,
    gap: 14
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1217',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    padding: 0
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272d3b',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  filtersWrapper: {
    gap: 10
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  filterGroupTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 65
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  pillBtn: {
    backgroundColor: '#0f1217',
    borderWidth: 1,
    borderColor: '#272d3b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20
  },
  pillBtnActive: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderColor: '#FF6B35'
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  pillTextActive: {
    color: '#FF6B35',
    fontWeight: '700'
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10
  },
  emptyCard: {
    backgroundColor: '#161a22',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 14,
    padding: 36,
    alignItems: 'center',
    textAlign: 'center'
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 450,
    lineHeight: 1.5
  },
  ticketCard: {
    backgroundColor: '#161a22',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  ticketUserName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderColor: 'rgba(255,107,53,0.3)',
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4
  },
  categoryBadgeText: {
    color: '#FF8C5A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  ticketEmail: {
    color: '#94a3b8',
    fontSize: 12
  },
  ticketId: {
    color: '#475569',
    fontSize: 11,
    fontFamily: 'monospace'
  },
  statusBadge: {
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  ticketDate: {
    color: '#64748b',
    fontSize: 11
  },
  messageBox: {
    backgroundColor: '#0f1217',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
    padding: 12,
    borderRadius: 8
  },
  messageLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  messageText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 1.5,
    fontStyle: 'italic'
  },
  internalNotesBox: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    borderRadius: 8,
    padding: 12
  },
  internalNotesTitle: {
    color: '#A78BFA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  internalNotesText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 1.5
  },
  reviewedByText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6
  },
  replyBox: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 8,
    padding: 12
  },
  replyTitle: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  replyText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 1.5
  },
  ticketActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap'
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272d3b',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  actionBtnPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  actionBtnResolveQuick: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 'auto',
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)'
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272d3b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4
  },
  pageBtnDisabled: {
    opacity: 0.4
  },
  pageBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  pageInfoText: {
    color: '#94a3b8',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#161a22',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    gap: 14
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1.5
  },
  ticketSnippet: {
    backgroundColor: '#0f1217',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 8,
    padding: 10
  },
  modalTextArea: {
    backgroundColor: '#0f1217',
    borderWidth: 1,
    borderColor: '#272d3b',
    borderRadius: 10,
    color: '#fff',
    padding: 12,
    fontSize: 13,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#272d3b'
  },
  modalCancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  modalSaveBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  }
});
