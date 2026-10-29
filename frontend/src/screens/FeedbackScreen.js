import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Mail, Phone, Star, Send, CheckCircle2, RefreshCw } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { apiSubmitFeedback } from '../services/api';
import { trackRecommendationFeedback } from '../services/analyticsEventService';
import { C, BackHeader, BtnOrange } from '../components/UI';
import AppLayout from '../components/AppLayout';

export default function FeedbackScreen() {
  const { user } = useApp();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');

  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Hydrate fields on user context load
  useEffect(() => {
    setName(user?.name || 'Sham S.');
    setEmail(user?.email || 'sham111205s@gmail.com');
  }, [user]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please complete all form fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await apiSubmitFeedback({
        name,
        email,
        rating,
        message
      });
      trackRecommendationFeedback(rating, message);
      setSuccess(true);
      setMessage('');
      setRating(5);
      // Automatically clear success toast or message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmail = () => {
    Linking.openURL('mailto:sham111205s@gmail.com').catch(err => console.error('Error opening email:', err));
  };

  const handlePhone = () => {
    Linking.openURL('tel:+916380138206').catch(err => console.error('Error opening phone:', err));
  };

  return (
    <AppLayout noPadding>
      {/* Header */}
      <BackHeader title="Feedback & Support" />

      {/* Scrollable Container */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        
        {/* Support Section Card */}
        <Text style={styles.sectionHeading}>Direct Support</Text>

        <View style={styles.supportCard}>
          <Text style={styles.cardTitle}>Need Help?</Text>
          <Text style={styles.cardDesc}>
            Have questions or running into issues with the FoodieBite platform? Get in touch with our lead support engineer directly.
          </Text>

          {/* Developer Contact Info */}
          <View style={styles.contactInfoBox}>
            <Text style={styles.contactDevLabel}>
              Developer: <Text style={{ color: C.orange }}>Sham S.</Text>
            </Text>
            <TouchableOpacity onPress={handleEmail} style={styles.contactItem}>
              <Mail size={12} color={C.muted} />
              <Text style={styles.contactItemText}>sham111205s@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhone} style={styles.contactItem}>
              <Phone size={12} color={C.muted} />
              <Text style={styles.contactItemText}>+91 6380138206</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              onPress={handleEmail}
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,107,53,0.12)', borderColor: 'rgba(255,107,53,0.2)' }]}
            >
              <Mail size={14} color={C.orange} />
              <Text style={{ color: C.orange, fontSize: 13, fontWeight: '700' }}>Send Email</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handlePhone}
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: C.border }]}
            >
              <Phone size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Call Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback Form Card */}
        <Text style={styles.sectionHeading}>Share Your Feedback</Text>

        <View style={styles.feedbackCard}>
          
          {/* Status Alerts */}
          {success ? (
            <View style={styles.successAlert}>
              <CheckCircle2 size={16} color="#4ade80" />
              <Text style={styles.successText}>Thank you for your feedback!</Text>
            </View>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorAlert}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <View style={{ gap: 16 }}>
            
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput 
                placeholder="Enter your name"
                placeholderTextColor="#444"
                value={name} 
                onChangeText={setName}
                style={styles.textInput}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput 
                placeholder="Enter your email"
                placeholderTextColor="#444"
                value={email} 
                onChangeText={setEmail}
                keyboardType="email-address"
                style={styles.textInput}
              />
            </View>

            {/* Star Rating Picker */}
            <View style={{ gap: 8 }}>
              <Text style={styles.inputLabel}>Rating</Text>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isActive = rating >= starValue;
                  return (
                    <TouchableOpacity
                      key={starValue}
                      onPress={() => setRating(starValue)}
                      style={{ padding: 2 }}
                    >
                      <Star 
                        size={28} 
                        fill={isActive ? '#facc15' : 'transparent'} 
                        color={isActive ? '#facc15' : C.muted2} 
                        strokeWidth={2}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Message Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Feedback Message</Text>
              <TextInput 
                placeholder="Share your experience, feature requests, or report a bug..."
                placeholderTextColor="#444"
                value={message} 
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                style={styles.textArea}
              />
            </View>

            {/* Submit Button */}
            <BtnOrange 
              onClick={handleSubmit} 
              disabled={submitting || !message.trim()}
              style={styles.submitBtn}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.submitBtnText}>Submitting...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Send size={15} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Feedback</Text>
                </View>
              )}
            </BtnOrange>

          </View>
        </View>

      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted2,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  supportCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  contactInfoBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    gap: 10,
  },
  contactDevLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactItemText: {
    fontSize: 12,
    color: C.muted,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  feedbackCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  successText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.2)',
  },
  errorText: {
    color: '#ff4d6d',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  textInput: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    textAlignVertical: 'top',
    height: 100,
  },
  submitBtn: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
