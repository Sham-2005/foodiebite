import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Award, CheckCircle2, Mail, Phone, Sparkles } from 'lucide-react-native';
import { C, BackHeader } from '../components/UI';
import AppLayout from '../components/AppLayout';

export default function AboutUsScreen() {
  const features = [
    'Personalized recommendations',
    'Medical report tracking',
    'Favorite foods',
    'AI nutrition assistant',
    'Daily health suggestions',
    'Secure Firebase Authentication',
    'Cloud Firestore Storage',
    'Firebase Storage Medical Reports'
  ];

  const handleEmail = () => {
    Linking.openURL('mailto:sham111205s@gmail.com').catch(err => console.error('Error opening mailto:', err));
  };

  const handlePhone = () => {
    Linking.openURL('tel:+916380138206').catch(err => console.error('Error opening tel:', err));
  };

  return (
    <AppLayout noPadding>
      {/* Header */}
      <BackHeader title="About FoodieBite" />

      {/* Scrollable Container */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        
        {/* Brand Banner */}
        <View style={styles.brandBanner}>
          <View style={styles.brandIconBg}>
            <Sparkles size={36} color={C.orange} />
          </View>
          <Text style={styles.brandTitle}>About FoodieBite</Text>
          <Text style={styles.brandDesc}>
            FoodieBite is an AI-powered food and nutrition platform helping users discover healthier food choices, manage dietary preferences, track medical reports, and receive personalized recommendations.
          </Text>
        </View>

        {/* Features List Section */}
        <Text style={styles.sectionHeading}>Core Features</Text>
        
        <View style={styles.featuresCard}>
          {features.map((feature, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.checkIcon}>
                <CheckCircle2 size={16} color="#4ade80" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Developer Info Section */}
        <Text style={styles.sectionHeading}>Developer Information</Text>

        <View style={styles.devCard}>
          <View style={styles.devHeader}>
            <View style={styles.awardIconBg}>
              <Award size={22} color="#facc15" />
            </View>
            <View>
              <Text style={styles.devName}>Sham S.</Text>
              <Text style={styles.devTitle}>Lead Platform Developer</Text>
            </View>
          </View>

          <View style={styles.contactLinks}>
            <TouchableOpacity onPress={handleEmail} style={styles.contactLink}>
              <Mail size={14} color={C.orange} />
              <Text style={styles.contactText}>sham111205s@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePhone} style={styles.contactLink}>
              <Phone size={14} color={C.orange} />
              <Text style={styles.contactText}>+91 6380138206</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>FoodieBite</Text>
          <Text style={styles.footerInfo}>Version 1.0.0</Text>
          <Text style={styles.footerInfo}>Developed by Sham S.</Text>
          <TouchableOpacity onPress={handleEmail}>
            <Text style={styles.footerEmail}>sham111205s@gmail.com</Text>
          </TouchableOpacity>
          <Text style={styles.footerCopyright}>© 2026 FoodieBite</Text>
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
  brandBanner: {
    alignItems: 'center',
    marginVertical: 12,
    marginBottom: 28,
  },
  brandIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,107,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  brandDesc: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    textAlign: 'center',
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
  featuresCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  devCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 36,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  awardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(250,204,21,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.15)',
  },
  devName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  devTitle: {
    fontSize: 11,
    color: C.muted2,
    marginTop: 1,
  },
  contactLinks: {
    gap: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    paddingTop: 14,
  },
  contactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactText: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: C.border,
    paddingTop: 24,
    gap: 6,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  footerInfo: {
    fontSize: 11,
    color: C.muted2,
    fontWeight: '600',
  },
  footerEmail: {
    color: C.orange,
    fontWeight: '500',
    fontSize: 11,
  },
  footerCopyright: {
    fontSize: 11,
    color: C.muted2,
    marginTop: 4,
  },
});
