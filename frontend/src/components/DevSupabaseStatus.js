// ─────────────────────────────────────────────────────────────
//  frontend/src/components/DevSupabaseStatus.js
//  Development-Only Supabase Connection Status Badge
//  Displays: Connected | Connection Failed | Configuration Missing
//  Includes one-click access to the experimental foodiebite_demo viewer.
//  Automatically disabled in production builds (__DEV__ === false).
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { testSupabaseConnection } from '../services/supabaseService.js';
import { isSupabaseConfigured } from '../config/supabaseClient.js';
import DevSupabaseDemoModal from './DevSupabaseDemoModal.js';

export default function DevSupabaseStatus() {
  // Never render in production
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return null;
  }

  const [status, setStatus] = useState('Testing...'); // 'Connected' | 'Connection Failed' | 'Configuration Missing'
  const [details, setDetails] = useState('');
  const [latency, setLatency] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [showDemoModal, setShowDemoModal] = useState(false);

  async function checkStatus() {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        setStatus('Configuration Missing');
        setDetails('NEXT_PUBLIC_SUPABASE_URL or Publishable Key is not set in .env');
        setLoading(false);
        return;
      }

      const res = await testSupabaseConnection();
      setStatus(res.status);
      setDetails(res.message);
      if (res.latencyMs) setLatency(res.latencyMs);
    } catch (err) {
      setStatus('Connection Failed');
      setDetails(err.message || 'Unknown network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'Connected':
        return '#10B981'; // Green
      case 'Connection Failed':
        return '#EF4444'; // Red
      case 'Configuration Missing':
        return '#F59E0B'; // Amber
      default:
        return '#6B7280'; // Gray
    }
  };

  return (
    <View style={styles.floatingContainer}>
      <TouchableOpacity
        style={[styles.badgePill, { borderColor: getStatusColor() }]}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.8}
      >
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.badgeText}>
          Supabase: {loading ? 'Testing...' : status}
        </Text>
        {latency > 0 && status === 'Connected' && (
          <Text style={styles.latencyText}>{latency}ms</Text>
        )}
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Supabase Experimental Status</Text>
          <Text style={styles.detailsMessage}>
            {loading ? 'Performing ping to Supabase...' : details}
          </Text>

          {/* Quick Launcher for foodiebite_demo experiment */}
          <TouchableOpacity
            style={styles.demoLaunchButton}
            onPress={() => {
              setCollapsed(true);
              setShowDemoModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.demoLaunchButtonText}>🍜 View Demo Foods (foodiebite_demo)</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={checkStatus}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.retryButtonText}>Re-test</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setCollapsed(true)}
            >
              <Text style={styles.closeButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Dev-only Modal showing foodiebite_demo records */}
      <DevSupabaseDemoModal
        visible={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'flex-end',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  latencyText: {
    color: '#9CA3AF',
    fontSize: 10,
    marginLeft: 6,
  },
  detailsCard: {
    marginTop: 8,
    width: 290,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  detailsTitle: {
    color: '#F3F4F6',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  detailsMessage: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  demoLaunchButton: {
    backgroundColor: '#059669',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  demoLaunchButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#4B5563',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#E5E7EB',
    fontSize: 11,
  },
});
