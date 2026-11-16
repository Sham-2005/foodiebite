// ─────────────────────────────────────────────────────────────
//  frontend/src/screens/AuthCallbackScreen.js
//  FoodieBite OAuth Callback Handler (Web & Android Deep-Link)
//  Handles callback tokens, establishes Supabase session,
//  reconciles user profile & preferences, and routes smoothly.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { handleOAuthCallback } from '../services/supabaseAuthService';
import { setToken, saveLocalActiveUser, apiSyncUser } from '../services/api';
import { setItemSync } from '../services/storage.js';
import { C } from '../components/UI';

const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

export default function AuthCallbackScreen() {
  const navigation = useNavigation();
  const { setUser, setPreferences } = useApp();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const processingRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate callback processing (e.g. React StrictMode)
    if (processingRef.current) return;
    processingRef.current = true;

    // Safety timeout: Guarantee that spinner never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(currentLoading => {
        if (currentLoading) {
          setError('Authentication timed out while securing session. Please return to Sign In.');
          return false;
        }
        return false;
      });
    }, 8000);

    async function processCallback() {
      try {
        const rawUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
        const res = await handleOAuthCallback(rawUrl);

        clearTimeout(safetyTimer);

        if (!res.success) {
          setError(res.error || 'Authentication failed. Please try again.');
          setLoading(false);
          return;
        }

        // Establish token and local session
        if (res.session?.access_token) {
          setToken(res.session.access_token);
        }

        const cleanEmail = (res.user?.email || '').trim().toLowerCase();
        const isAdmin = cleanEmail === AUTHORIZED_ADMIN_EMAIL;
        const role = res.profile?.role || (isAdmin ? 'admin' : 'user');

        const isProfileComplete = Boolean(
          isAdmin ||
          (res.profile?.profileCompleted === true) ||
          (res.profile?.age && res.profile?.gender)
        );

        const userData = {
          id: res.user.id,
          uid: res.user.id,
          name: res.profile?.name || res.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          email: cleanEmail,
          role,
          dietType: res.profile?.diet_type || 'Vegetarian',
          age: res.profile?.age || '',
          gender: res.profile?.gender || '',
          profileCompleted: isProfileComplete,
          accountStatus: res.profile?.account_status || 'active',
          disabled: res.profile?.disabled || false,
          preferences: res.profile?.preferences || {
            dietType: 'Vegetarian',
            spiceLevel: 'Medium',
            cuisines: ['indian'],
            healthGoals: ['healthy_eating'],
            country: 'in',
            allergies: [],
            minGrade: 'c',
            emailNotifications: true,
          },
          favoriteFoods: res.profile?.favoriteFoods || [],
          searchHistory: res.profile?.searchHistory || [],
          authProvider: 'google',
        };

        const savedActive = saveLocalActiveUser(userData);
        setUser(savedActive || userData);
        if (userData.preferences) {
          setPreferences(userData.preferences);
        }
        apiSyncUser(savedActive || userData).catch(() => {});

        if (isAdmin) {
          const sessionPayload = { success: true, token: res.session?.access_token, user: userData };
          setItemSync('foodiebite_admin_session', JSON.stringify(sessionPayload));
        }

        // Automatic redirect to / after successful authentication.
        // window.location.replace('/') clears /auth/callback from browser history to prevent loops.
        if (typeof window !== 'undefined' && window.location) {
          window.location.replace('/');
        } else if (navigation && typeof navigation.reset === 'function') {
          navigation.reset({
            index: 0,
            routes: [{ name: isAdmin ? 'Admin' : (isProfileComplete ? 'Home' : 'CompleteProfile') }],
          });
        }
      } catch (err) {
        clearTimeout(safetyTimer);
        setError(err.message || 'An unexpected error occurred during Google Sign In.');
        setLoading(false);
      }
    }

    processCallback();

    return () => {
      clearTimeout(safetyTimer);
    };
  }, []); // Run once on mount; processingRef guards against StrictMode duplicate execution

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.content}>
          <ShieldCheck size={48} color={C.orange} style={{ marginBottom: 16 }} />
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={styles.title}>Completing Google Sign In</Text>
          <Text style={styles.subtitle}>Securing your FoodieBite session...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <AlertCircle size={48} color="#ff4d6d" style={{ marginBottom: 16 }} />
          <Text style={styles.errorTitle}>Authentication Note</Text>
          <Text style={styles.errorDesc}>{error}</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SignIn')}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Return to Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a7b4',
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 13,
    color: '#ff9266',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: C.orange,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

