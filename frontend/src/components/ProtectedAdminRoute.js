import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShieldAlert, Home } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { getAdminSession } from '../services/api';

const LazyAdminDashboardScreen = React.lazy(() => import('../screens/AdminDashboardScreen'));

const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default function ProtectedAdminRoute(props) {
  const { user, authLoading } = useApp();
  const navigation = useNavigation();

  const adminSession = getAdminSession();
  const sessionUser = adminSession?.user && normalizeEmail(adminSession.user.email) === AUTHORIZED_ADMIN_EMAIL
    ? adminSession.user
    : null;
  const effectiveUser = user || sessionUser;

  const cleanEmail = normalizeEmail(effectiveUser?.email);
  const isAuthorized = !!effectiveUser && cleanEmail === AUTHORIZED_ADMIN_EMAIL;

  // Scenario C: Unauthenticated visitor -> Redirect to SignIn
  useEffect(() => {
    if (!authLoading && !effectiveUser) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('foodiebite_redirect_after_login', 'admin');
      }
      navigation.navigate('SignIn');
    }
  }, [authLoading, effectiveUser, navigation]);

  // Loading state: Never render admin content before auth is confirmed
  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Verifying administrator authorization...</Text>
      </View>
    );
  }

  // If unauthenticated, show loading/redirecting view while navigation executes
  if (!effectiveUser) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>Redirecting to login...</Text>
      </View>
    );
  }

  // Scenario B: Normal authenticated user -> Access Denied view
  if (!isAuthorized) {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldAlert size={42} color="#EF4444" />
          </View>

          <Text style={styles.deniedTitle}>Access Denied</Text>
          <Text style={styles.deniedMessage}>You don't have access to this page.</Text>
          <Text style={styles.deniedSub}>
            This area is restricted to authorized administrators only.
          </Text>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Return to FoodieBite home page"
          >
            <Home size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.homeButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Scenario A: Authorized administrator -> Grant access with Suspense fallback
  return (
    <React.Suspense fallback={
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading Admin Control Center...</Text>
      </View>
    }>
      <LazyAdminDashboardScreen {...props} />
    </React.Suspense>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 14,
    fontWeight: '500',
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1d24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  deniedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  deniedMessage: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  deniedSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
