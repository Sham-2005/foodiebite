import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import { C, BackHeader } from '../components/UI';
import AppLayout from '../components/AppLayout';

export default function TermsAndConditionsScreen() {
  return (
    <AppLayout noPadding>
      <BackHeader title="Terms & Conditions" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.iconSection}>
          <View style={styles.iconBg}>
            <FileText size={32} color={C.orange} />
          </View>
          <Text style={styles.lastUpdated}>Last Updated: May 31, 2026</Text>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
            <Text style={styles.sectionBody}>
              By accessing or using the FoodieBite app, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the application.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Informational Purpose Only</Text>
            <Text style={styles.sectionBody}>
              All recommendations, nutrient calculations, and medical report insights provided by FoodieBite are for <Text style={{ fontWeight: '700', color: '#fff' }}>informational and educational purposes only</Text>. They do not constitute medical advice, diagnosis, or treatment. Always consult a healthcare professional before modifying your diet.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Conduct & Accounts</Text>
            <Text style={styles.sectionBody}>
              You are responsible for safeguarding your login credentials. You agree to provide accurate registration information (including age and gender inputs) to ensure that the nutrient rankers produce precise, safe outputs.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. External Data Sources</Text>
            <Text style={styles.sectionBody}>
              FoodieBite integrates Open Food Facts and public weather data APIs. While we make every attempt to filter out allergens and score grade tags precisely, we cannot guarantee the absolute completeness or accuracy of third-party datasets.
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
});
