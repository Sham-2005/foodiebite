import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BtnOrange, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { CUISINE_OPTIONS, HEALTH_GOALS } from '../data/mockData';

export default function PreferencesScreen() {
  const navigation = useNavigation();
  const { preferences, setPreferences } = useApp();

  const [dietType, setDietType]     = useState(preferences.dietType);
  const [spiceLevel, setSpiceLevel] = useState(preferences.spiceLevel);
  const [cuisines, setCuisines]     = useState(preferences.cuisines);
  const [goals, setGoals]           = useState(preferences.healthGoals);
  const [country, setCountry]       = useState(preferences.country || 'in');
  const [fastingMode, setFastingMode] = useState(
    preferences.fasting?.active ? (preferences.fasting.type || 'navratri') : 'none'
  );

  function toggleCuisine(id) {
    setCuisines(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }
  function toggleGoal(id) {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

  function handleSave() {
    const fasting = fastingMode === 'none'
      ? { active: false, type: null, allowedCategories: [], restrictedCategories: [] }
      : {
          active: true,
          type: fastingMode,
          allowedCategories: fastingMode === 'navratri' ? ['fruit', 'dairy', 'nuts', 'potato', 'sabudana'] : [],
          restrictedCategories: fastingMode === 'navratri' ? ['grains', 'meat', 'onion_garlic'] : (fastingMode === 'ekadashi' ? ['grains', 'beans', 'meat'] : ['meat', 'grains'])
        };

    setPreferences({
      ...preferences,
      dietType,
      spiceLevel,
      cuisines,
      healthGoals: goals,
      country,
      fasting,
      allergies: preferences.allergies || []
    });
    navigation.navigate('Home');
  }

  const choiceBtn = (label, active, onClick) => (
    <TouchableOpacity
      key={label}
      activeOpacity={0.8}
      onPress={onClick}
      style={[
        styles.choiceBtn,
        active ? styles.choiceBtnActive : styles.choiceBtnInactive
      ]}
    >
      <Text style={[styles.choiceBtnText, active ? { color: '#fff' } : { color: '#888' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Tell us about you</Text>
      <Text style={styles.subtitle}>This helps us recommend better food for you</Text>

      {/* Diet Type */}
      <View style={styles.section}>
        <Label>Diet Type</Label>
        <View style={styles.buttonsRow}>
          {['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Keto'].map(d => choiceBtn(d, dietType === d, () => setDietType(d)))}
        </View>
      </View>

      {/* Spice Level */}
      <View style={styles.section}>
        <Label>Spice Level</Label>
        <View style={styles.buttonsRow}>
          {['Mild', 'Medium', 'Spicy'].map(s => choiceBtn(s, spiceLevel === s, () => setSpiceLevel(s)))}
        </View>
      </View>

      {/* Country / Region Recommendations */}
      <View style={styles.section}>
        <Label>Country/Region Recommendations</Label>
        <View style={styles.buttonsRow}>
          {[
            { id: 'in', label: 'India 🇮🇳' },
            { id: 'us', label: 'United States 🇺🇸' },
            { id: 'gb', label: 'United Kingdom 🇬🇧' },
            { id: 'world', label: 'International 🌐' }
          ].map(c => choiceBtn(c.label, country === c.id, () => setCountry(c.id)))}
        </View>
      </View>

      {/* Favourite Cuisines */}
      <View style={styles.section}>
        <Label>Favorite Cuisines</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          {CUISINE_OPTIONS.map(({ id, label, emoji }) => {
            const isSelected = cuisines.includes(id);
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                onPress={() => toggleCuisine(id)}
                style={styles.avatarItem}
              >
                <View style={[
                  styles.avatarCircle,
                  isSelected ? styles.circleActive : styles.circleInactive
                ]}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </View>
                <Text style={[styles.avatarText, isSelected && { color: C.orange }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Health Goals */}
      <View style={styles.section}>
        <Label>Health Goals</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
          {HEALTH_GOALS.map(({ id, label, emoji }) => {
            const isSelected = goals.includes(id);
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                onPress={() => toggleGoal(id)}
                style={styles.goalItem}
              >
                <View style={[
                  styles.goalSquare,
                  isSelected ? styles.squareActive : styles.squareInactive
                ]}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </View>
                <Text style={[styles.goalText, isSelected && { color: C.orange }]} numberOfLines={2}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Fasting Mode (Religious / Custom) */}
      <View style={styles.section}>
        <Label>Fasting Mode (Optional)</Label>
        <View style={styles.buttonsRow}>
          {[
            { id: 'none', label: 'No Fasting' },
            { id: 'navratri', label: 'Navratri / Vrat 🥥' },
            { id: 'ekadashi', label: 'Ekadashi 🌿' },
            { id: 'user_defined', label: 'Custom Fast ⏱️' }
          ].map(f => choiceBtn(f.label, fastingMode === f.id, () => setFastingMode(f.id)))}
        </View>
      </View>

      <BtnOrange onClick={handleSave}>Save &amp; Continue</BtnOrange>
    </ScrollView>
  );
}

function Label({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#111318',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    paddingTop: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 13,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ccc',
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  choiceBtnInactive: {
    backgroundColor: '#1e1e1e',
    borderColor: '#2e2e2e',
  },
  choiceBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  avatarItem: {
    alignItems: 'center',
    width: 65,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  circleActive: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderColor: C.orange,
  },
  circleInactive: {
    backgroundColor: '#1e1e1e',
    borderColor: '#2e2e2e',
  },
  avatarText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  goalItem: {
    alignItems: 'center',
    width: 70,
  },
  goalSquare: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  squareActive: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderColor: C.orange,
  },
  squareInactive: {
    backgroundColor: '#1e1e1e',
    borderColor: '#2e2e2e',
  },
  goalText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
