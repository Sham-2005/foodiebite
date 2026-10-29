import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, ArrowRight, Scale, Ruler, Smile, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { apiCompleteProfile } from '../services/api';
import { C, BtnOrange } from '../components/UI';

const DIET_TYPES = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Keto'];
const GENDERS = ['Male', 'Female', 'Other'];
const ACTIVITY_LEVELS = [
  { value: 'Sedentary', label: 'Little to no exercise' },
  { value: 'Lightly Active', label: 'Light exercise (1-3 days/wk)' },
  { value: 'Moderately Active', label: 'Moderate exercise (3-5 days/wk)' },
  { value: 'Very Active', label: 'Heavy exercise (6-7 days/wk)' }
];

export default function CompleteProfileScreen() {
  const navigation = useNavigation();
  const { user, setUser } = useApp();
  
  // Unauthenticated guard
  useEffect(() => {
    if (!user) {
      navigation.navigate('SignIn');
    }
  }, [user]);
  
  // Form states
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('Sedentary');
  const [dietType, setDietType] = useState('Vegetarian');
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', msg }

  // Validator
  function validate() {
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) {
      setToast({ type: 'error', msg: 'Please enter a valid age (1 - 120 years).' });
      return false;
    }
    if (!gender) {
      setToast({ type: 'error', msg: 'Please select your gender.' });
      return false;
    }
    if (!height || isNaN(height) || parseInt(height) < 50 || parseInt(height) > 250) {
      setToast({ type: 'error', msg: 'Please enter a valid height (50 - 250 cm).' });
      return false;
    }
    if (!weight || isNaN(weight) || parseFloat(weight) < 20 || parseFloat(weight) > 300) {
      setToast({ type: 'error', msg: 'Please enter a valid weight (20 - 300 kg).' });
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    setToast(null);
    try {
      const res = await apiCompleteProfile({
        age: parseInt(age),
        gender,
        height: parseInt(height),
        weight: parseFloat(weight),
        activityLevel,
        dietType
      });

      if (res.success && res.user) {
        const completedUser = {
          ...res.user,
          age:              res.user.age    || parseInt(age),
          gender:           res.user.gender || gender,
          profileCompleted: true,
        };
        setUser(completedUser);
        setToast({ type: 'success', msg: 'Profile completed successfully! Redirecting...' });
        setTimeout(() => navigation.navigate('Home'), 1200);
      } else {
        throw new Error('Failed to update profile records.');
      }
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to complete profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Onboarding Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Sparkles size={32} color={C.orange} />
          </View>
          <Text style={styles.title}>Complete Your Profile 🥗</Text>
          <Text style={styles.subtitle}>
            We need a few biological metrics to calculate your target calorie equations and formulate meal plans.
          </Text>
        </View>

        {/* Dynamic Alert Toasts */}
        {toast && (
          <View style={[
            styles.alert,
            toast.type === 'success' ? styles.alertSuccess : styles.alertError
          ]}>
            {toast.type === 'success' ? <CheckCircle2 size={16} color="#4ade80" /> : <AlertCircle size={16} color="#ff4d6d" />}
            <Text style={[styles.alertText, toast.type === 'success' ? { color: '#4ade80' } : { color: '#ff4d6d' }]}>
              {toast.msg}
            </Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.form}>
          
          {/* Row 1: Age & Height */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Age (Years)</Text>
              <View style={styles.inputWrapper}>
                <Smile size={16} color={C.muted2} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="24"
                  placeholderTextColor="#555"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  style={styles.inputField}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Height (cm)</Text>
              <View style={styles.inputWrapper}>
                <Ruler size={16} color={C.muted2} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="175"
                  placeholderTextColor="#555"
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="numeric"
                  style={styles.inputField}
                />
              </View>
            </View>
          </View>

          {/* Row 2: Weight & Gender */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Weight (kg)</Text>
              <View style={styles.inputWrapper}>
                <Scale size={16} color={C.muted2} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="70.5"
                  placeholderTextColor="#555"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  style={styles.inputField}
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderContainer}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGender(g)}
                    style={[styles.genderTab, gender === g && styles.genderTabActive]}
                  >
                    <Text style={[styles.genderTabText, gender === g && { color: '#fff' }]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Diet Type Selector */}
          <View>
            <Text style={styles.label}>Select Diet Type</Text>
            <View style={styles.dietContainer}>
              {DIET_TYPES.map(diet => (
                <TouchableOpacity
                  key={diet}
                  onPress={() => setDietType(diet)}
                  style={[
                    styles.dietChip,
                    dietType === diet ? styles.dietChipActive : styles.dietChipInactive
                  ]}
                >
                  <Text style={[
                    styles.dietChipText,
                    dietType === diet ? { color: C.orange } : { color: C.muted }
                  ]}>
                    {diet}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Activity Level Selector */}
          <View>
            <Text style={styles.label}>Activity Level</Text>
            <View style={{ gap: 10 }}>
              {ACTIVITY_LEVELS.map(act => (
                <TouchableOpacity
                  key={act.value}
                  activeOpacity={0.8}
                  onPress={() => setActivityLevel(act.value)}
                  style={[
                    styles.activityRow,
                    activityLevel === act.value ? styles.activityRowActive : styles.activityRowInactive
                  ]}
                >
                  <View style={[
                    styles.radioCircle,
                    activityLevel === act.value ? { borderColor: C.orange } : { borderColor: C.muted2 }
                  ]}>
                    {activityLevel === act.value && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{act.value}</Text>
                    <Text style={styles.activityDesc}>{act.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <View style={{ marginTop: 12 }}>
            <BtnOrange onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <View style={styles.btnLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.btnLoadingText}>Completing Onboarding...</Text>
                </View>
              ) : (
                <View style={styles.btnLoading}>
                  <Text style={styles.btnLoadingText}>Save Profile & Begin</Text>
                  <ArrowRight size={16} color="#fff" style={{ marginLeft: 6 }} />
                </View>
              )}
            </BtnOrange>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111318',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
    textAlign: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,107,53,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    gap: 10,
  },
  alertSuccess: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  alertError: {
    backgroundColor: 'rgba(255,77,109,0.08)',
    borderColor: 'rgba(255,77,109,0.2)',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputB,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  inputField: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    backgroundColor: '#1c1e24',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    height: 44,
  },
  genderTab: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderTabActive: {
    backgroundColor: C.orange,
  },
  genderTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  dietContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dietChipActive: {
    borderColor: C.orange,
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  dietChipInactive: {
    borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dietChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  activityRowActive: {
    backgroundColor: C.card,
    borderColor: C.orange,
  },
  activityRowInactive: {
    backgroundColor: C.card,
    borderColor: C.border,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.orange,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  activityDesc: {
    fontSize: 10,
    color: C.muted2,
    marginTop: 1,
  },
  btnLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLoadingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
