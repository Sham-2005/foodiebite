// ─────────────────────────────────────────────────────────────
//  frontend/src/components/DevSupabaseDemoModal.js
//  Development-Only Supabase Experiment Modal
//  Displays records from 'foodiebite_demo' (food_name, category)
//  with loading, error, empty states and manual refresh.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { fetchDemoFoods } from '../services/demoFoodService.js';

export default function DevSupabaseDemoModal({ visible, onClose }) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return null;
  }

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  async function loadData(isManualRefresh = false) {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchDemoFoods();
      if (res.success) {
        setFoods(res.data || []);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setError(res.error || 'Failed to retrieve foodiebite_demo records.');
      }
    } catch (err) {
      setError(err.message || 'Unexpected network error.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (visible) {
      loadData(false);
    }
  }, [visible]);

  const getCategoryColor = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('breakfast')) return '#F59E0B'; // Amber
    if (cat.includes('lunch')) return '#10B981'; // Emerald
    if (cat.includes('dinner')) return '#6366F1'; // Indigo
    if (cat.includes('snack')) return '#EC4899'; // Pink
    return '#3B82F6'; // Blue
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.modalTitle}>🍜 Supabase Food Demo</Text>
              <Text style={styles.modalSubtitle}>
                Table: <Text style={styles.monoText}>foodiebite_demo</Text> (Read-Only SELECT)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={onClose}
              role="button"
              aria-label="Close Demo Modal"
            >
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action & Status Row */}
          <View style={styles.statusBarRow}>
            <Text style={styles.statusInfoText}>
              {lastRefreshed ? `Updated at ${lastRefreshed}` : 'Live Supabase Query'}
            </Text>
            <TouchableOpacity
              style={[styles.refreshButton, (loading || refreshing) && styles.refreshButtonDisabled]}
              onPress={() => loadData(true)}
              disabled={loading || refreshing}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Fetching records from foodiebite_demo...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Query Failed</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => loadData(false)}
                >
                  <Text style={styles.retryButtonText}>Retry Query</Text>
                </TouchableOpacity>
              </View>
            ) : foods.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>No Food Records Found</Text>
                <Text style={styles.emptyMessage}>
                  The table <Text style={styles.monoText}>foodiebite_demo</Text> is empty or returned 0 rows.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollList} contentContainerStyle={styles.listContent}>
                <Text style={styles.recordsCountText}>
                  Showing {foods.length} demo records from Supabase:
                </Text>
                {foods.map((food, index) => (
                  <View key={food.id || index} style={styles.foodCard}>
                    <View style={styles.foodCardLeft}>
                      <View style={styles.foodIndexBadge}>
                        <Text style={styles.foodIndexText}>#{food.id}</Text>
                      </View>
                      <View style={styles.foodInfo}>
                        <Text style={styles.foodName}>{food.food_name}</Text>
                        <Text style={styles.foodDate}>
                          Created: {food.created_at ? new Date(food.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: getCategoryColor(food.category) + '22', borderColor: getCategoryColor(food.category) }
                      ]}
                    >
                      <Text style={[styles.categoryText, { color: getCategoryColor(food.category) }]}>
                        {food.category}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Footer Safety Notice */}
          <View style={styles.footerNotice}>
            <Text style={styles.footerNoticeText}>
              🔒 Safe Experiment: Read-only SELECT query. Zero impact on Firebase, Firestore, or production UI.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 100000,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#1E232A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2F3642',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2B323D',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  monoText: {
    fontFamily: 'monospace',
    color: '#6EE7B7',
    fontWeight: '600',
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2B323D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  statusBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#181C22',
    borderBottomWidth: 1,
    borderBottomColor: '#2B323D',
  },
  statusInfoText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  refreshButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    minHeight: 220,
    maxHeight: 400,
    backgroundColor: '#14171C',
  },
  centerContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 12,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorMessage: {
    color: '#D1D5DB',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyMessage: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  scrollList: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  recordsCountText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  foodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E232A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2F3642',
  },
  foodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  foodIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2B323D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodIndexText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  foodDate: {
    color: '#6B7280',
    fontSize: 11,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerNotice: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#181C22',
    borderTopWidth: 1,
    borderTopColor: '#2B323D',
  },
  footerNoticeText: {
    color: '#6B7280',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});

