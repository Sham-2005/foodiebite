import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { C, BackHeader } from '../components/UI';
import AppLayout from '../components/AppLayout';

export default function PrivacyPolicyScreen() {
  return (
    <AppLayout noPadding>
      <BackHeader title="Privacy Policy" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.iconSection}>
          <View style={styles.iconBg}>
            <ShieldCheck size={32} color={C.orange} />
          </View>
          <Text style={styles.lastUpdated}>Last Updated: May 31, 2026</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Introduction</Text>
            <Text style={styles.sectionBody}>
              Welcome to FoodieBite! We value your privacy and are committed to protecting your personal information. This Privacy Policy describes how we collect, use, and share your data when you use our mobile-first application.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Data We Collect</Text>
            <Text style={styles.sectionBody}>
              We collect information to provide a better, highly personalized experience:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>
                • <Text style={{ fontWeight: '700', color: '#fff' }}>Account Credentials</Text>: Email addresses, names, and passwords configured via Firebase Authentication.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={{ fontWeight: '700', color: '#fff' }}>Dietary Profile</Text>: User-configured preferences, dietary selections, spice levels, allergens, and health goals saved in Cloud Firestore.
              </Text>
              <Text style={styles.bulletItem}>
                • <Text style={{ fontWeight: '700', color: '#fff' }}>Medical Reports</Text>: User-uploaded health reports and documents stored securely in Firebase Storage.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. How We Use Data</Text>
            <Text style={styles.sectionBody}>
              Your profile preferences are used strictly to run our local nutrition scoring algorithm, ranking Open Food Facts food recommendations by seasonal fit and health goals. We never sell or share your reports.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Security & Control</Text>
            <Text style={styles.sectionBody}>
              All database records are protected by strict security rules enforcing owner-only read/write access. You can clear your search history, edit your profile details, or delete your reports directly in settings at any time.
            </Text>
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
  iconSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,107,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lastUpdated: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
  },
  contentSection: {
    gap: 20,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },
  bulletList: {
    marginTop: 6,
    paddingLeft: 8,
    gap: 6,
  },
  bulletItem: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },
});
