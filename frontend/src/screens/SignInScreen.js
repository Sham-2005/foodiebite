import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, BackHandler, Platform } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Mail, Lock, Eye, EyeOff, X, Shield } from 'lucide-react-native';
import { BtnOrange, TextInput, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { apiLogin, apiLoginWithGoogle, apiForgotPassword, apiResendVerificationEmail, apiSendWelcomeEmail } from '../services/api';

export default function SignInScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const notice = route?.params?.verificationNotice;
  const prefillEmail = route?.params?.prefillEmail || '';
  const { setUser } = useApp();
  const [email,    setEmail]    = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // ── Email Verification Resend states ──
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // ── Forgot Password states ──
  const [resetModal, setResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState(null); // { type: 'success'|'error', msg }

  const AUTHORIZED_ADMIN_EMAIL = 'sham111205s@gmail.com';

  // Prevent hardware back button from reopening protected routes when on SignInScreen
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (resetModal) {
          setResetModal(false);
          return true;
        }
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        } else if (BackHandler.removeEventListener) {
          BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        }
      };
    }, [resetModal])
  );

  // Sync prefilled email if passed via navigation params
  useEffect(() => {
    if (prefillEmail && !email) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer = null;
    if (cooldownSeconds > 0) {
      timer = setTimeout(() => {
        setCooldownSeconds(s => s - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cooldownSeconds]);

  function routeAfterAuth(userData, rawEmail) {
    const cleanEmail = (userData?.email || rawEmail || '').trim().toLowerCase();
    const isAdmin = userData?.role === 'admin' || (userData?.role !== 'user' && cleanEmail === AUTHORIZED_ADMIN_EMAIL);
    const isProfileComplete = Boolean(
      userData?.profileCompleted === true ||
      (userData?.age && userData?.gender)
    );

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.location.pathname !== undefined) {
      if (isAdmin) {
        window.location.href = '/admin';
      } else {
        window.location.href = isProfileComplete ? '/home' : '/complete-profile';
      }
      return;
    }

    const targetRoute = isAdmin ? 'Admin' : (isProfileComplete ? 'Home' : 'CompleteProfile');
    if (navigation && typeof navigation.replace === 'function') {
      navigation.replace(targetRoute);
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(targetRoute);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true); setError(''); setIsUnverified(false);
    try {
      const data = await apiLoginWithGoogle();
      if (data?.user) {
        setUser(data.user);
        apiSendWelcomeEmail(data.user).catch(() => {});
        routeAfterAuth(data.user);
      } else if (data?.url && Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message || 'Google Sign In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError(''); setResendSuccess(''); setIsUnverified(false);
    try {
      const data = await apiLogin({ email: cleanEmail, password });
      setUser(data.user);
      apiSendWelcomeEmail(data.user).catch(() => {});
      routeAfterAuth(data.user, cleanEmail);
    } catch (err) {
      if (err.isUnverified || /not been verified|verify your email|email not confirmed/i.test(err.message || '')) {
        setIsUnverified(true);
      }
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const targetEmail = (email || '').trim().toLowerCase();
    if (!targetEmail) {
      setError('Please enter your email address above to resend verification.');
      return;
    }
    setResendLoading(true);
    setResendSuccess('');
    setError('');
    try {
      const res = await apiResendVerificationEmail(targetEmail);
      setResendSuccess(res.message || `Verification email sent to ${targetEmail}!`);
      setCooldownSeconds(60);
    } catch (err) {
      if (err.remainingSeconds) {
        setCooldownSeconds(err.remainingSeconds);
      }
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  }

  async function handleResetPassword() {
    const targetEmail = (resetEmail || '').trim().toLowerCase();
    if (!targetEmail) {
      setResetMsg({ type: 'error', msg: 'Please enter your email address.' });
      return;
    }
    setResetLoading(true);
    setResetMsg(null);
    try {
      await apiForgotPassword(targetEmail);
      setResetMsg({ type: 'success', msg: 'Password reset link sent successfully! Check your inbox and spam folder.' });
      setTimeout(() => {
        setResetModal(false);
        setResetMsg(null);
      }, 3500);
    } catch (err) {
      setResetMsg({ type: 'error', msg: err.message || 'Failed to send password reset link.' });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <View style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back! 👋</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {notice ? (
          <View style={styles.noticeContainer}>
            <Text style={styles.noticeText}>✉️ {notice}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <TextInput 
            icon={Mail} 
            placeholder="Email" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
          />
          <TextInput 
            icon={Lock} 
            placeholder="Password" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry={!showPass}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                {showPass ? <EyeOff size={16} color="#666" /> : <Eye size={16} color="#666" />}
              </TouchableOpacity>
            }
          />
        </View>

        {/* Forgot Password Link */}
        <View style={styles.forgotPasswordContainer}>
          <TouchableOpacity onPress={() => { setResetModal(true); setResetMsg(null); setResetEmail(email); }}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Dedicated Unverified Account Guidance Card */}
        {isUnverified && (
          <View style={styles.unverifiedCard}>
            <Text style={styles.unverifiedTitle}>Email Verification Required</Text>
            <Text style={styles.unverifiedDesc}>
              Please check your inbox (and spam/junk folder) for the confirmation link. If you didn't receive it, request a new link below:
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleResendVerification}
              disabled={resendLoading || cooldownSeconds > 0}
              style={[
                styles.resendBtn,
                (resendLoading || cooldownSeconds > 0) && { opacity: 0.6 }
              ]}
            >
              <Text style={styles.resendBtnText}>
                {resendLoading
                  ? 'Sending...'
                  : cooldownSeconds > 0
                  ? `Resend available in ${cooldownSeconds}s`
                  : '✉️ Resend Verification Email'}
              </Text>
            </TouchableOpacity>
            {resendSuccess ? (
              <Text style={styles.resendSuccessText}>✓ {resendSuccess}</Text>
            ) : null}
          </View>
        )}

        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <BtnOrange onClick={handleSignIn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </BtnOrange>
        </View>

        <View style={{ marginTop: 2, marginBottom: 12 }}>
          <TouchableOpacity 
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={[styles.googleButton, loading && { opacity: 0.7 }]}
          >
            <View style={styles.googleIconContainer}>
              <View style={styles.googleIconRed} />
              <View style={styles.googleIconBlue} />
            </View>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={{ marginTop: 16 }}>
          <Text style={styles.signupPromptText}>
            Don't have an account?{' '}
            <Text style={styles.signupPromptHighlight}>Sign Up</Text>
          </Text>
        </TouchableOpacity>

        {/* Discrete Administrator Access Link */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('Admin')} 
          style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
        >
          <Shield size={13} color="#94a3b8" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '500' }}>
            Administrator Access Portal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Forgot Password Modal */}
      <Modal
        visible={resetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => { setResetModal(false); setResetMsg(null); }}>
                <X size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {resetMsg ? (
              <View style={[
                styles.alertMsg,
                resetMsg.type === 'success' ? styles.alertMsgSuccess : styles.alertMsgError
              ]}>
                <Text style={[
                  styles.alertMsgText,
                  resetMsg.type === 'success' ? { color: '#4ade80' } : { color: '#ff4d6d' }
                ]}>
                  {resetMsg.msg}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 14 }}>
              <Text style={styles.modalDesc}>
                Enter the email address associated with your account. We will send a secure link to reset your password.
              </Text>
              <TextInput 
                icon={Mail} 
                placeholder="Email Address" 
                value={resetEmail} 
                onChangeText={setResetEmail} 
                keyboardType="email-address" 
              />
              <View style={{ marginTop: 8 }}>
                <BtnOrange onClick={handleResetPassword} disabled={resetLoading}>
                  {resetLoading ? 'Sending link...' : 'Send Reset Link'}
                </BtnOrange>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#111318',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    paddingTop: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    color: '#777',
    fontSize: 14,
    marginBottom: 36,
  },
  inputGroup: {
    gap: 14,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: C.orange,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4d6d',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  unverifiedCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  unverifiedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff9266',
    marginBottom: 4,
  },
  unverifiedDesc: {
    fontSize: 12,
    color: '#a0a7b4',
    lineHeight: 17,
    marginBottom: 10,
  },
  resendBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#20242c',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.4)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 2,
  },
  resendBtnText: {
    color: '#ff9266',
    fontSize: 12,
    fontWeight: '600',
  },
  resendSuccessText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#1a1d24',
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 10,
  },
  googleIconContainer: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  googleIconRed: {
    flex: 1,
    backgroundColor: '#EA4335',
  },
  googleIconBlue: {
    flex: 1,
    backgroundColor: '#4285F4',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  signupPromptText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
  signupPromptHighlight: {
    color: C.orange,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#171a20',
    width: '100%',
    maxWidth: 350,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
  },
  modalDesc: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    margin: 0,
  },
  alertMsg: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
  },
  alertMsgSuccess: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  alertMsgError: {
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderColor: 'rgba(255,77,109,0.2)',
  },
  alertMsgText: {
    fontSize: 12,
    fontWeight: '500',
  },
  noticeContainer: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    color: '#22c55e',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
