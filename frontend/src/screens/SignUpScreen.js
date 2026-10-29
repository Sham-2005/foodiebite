import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput as RNTextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, Mail, Lock, Eye, EyeOff, ChevronDown, Check, X } from 'lucide-react-native';
import { BtnOrange, TextInput, C } from '../components/UI';
import { useApp } from '../context/AppContext';
import { apiRegister, apiLoginWithGoogle, apiSendWelcomeEmail } from '../services/api';

const DIETARY_OPTIONS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian', 'Keto', 'Diabetic Friendly'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

function getPrimaryDietType(dietary) {
  if (dietary.includes('Vegetarian')) return 'Vegetarian';
  if (dietary.includes('Vegan')) return 'Vegetarian';
  if (dietary.includes('Eggetarian')) return 'Vegetarian';
  if (dietary.includes('Non-Vegetarian')) return 'Non Vegetarian';
  return 'Vegetarian';
}

function isBackendOfflineError(err) {
  return err instanceof TypeError || /failed to fetch|network/i.test(err?.message || '');
}

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { setUser, setPreferences } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', dietary: [], gender: '', age: '' });
  const [showPass, setShowPass] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true); setError('');
    try {
      const data = await apiLoginWithGoogle();
      setUser(data.user);
    } catch (err) {
      setError(err.message || 'Google Sign In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handle(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function toggleDietary(option) {
    setForm(f => ({
      ...f,
      dietary: f.dietary.includes(option)
        ? f.dietary.filter(item => item !== option)
        : [...f.dietary, option],
    }));
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.password || !form.gender || !form.age) {
      setError('Please fill all required fields.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const selectedDietary = form.dietary.length ? form.dietary : ['Vegetarian'];
    const dietType = getPrimaryDietType(selectedDietary);
    const preferences = {
      dietType,
      spiceLevel: 'Medium',
      cuisines: ['indian'],
      healthGoals: ['healthy_eating'],
      allergies: selectedDietary.includes('Diabetic Friendly') ? ['Diabetic Friendly'] : [],
      dietaryPreferences: selectedDietary,
      maxCalories: null,
      minProtein: null,
      minGrade: 'c',
    };

    try {
      const data = await apiRegister({ 
        name: form.name, 
        email: form.email, 
        password: form.password, 
        dietType, 
        preferences,
        age: parseInt(form.age) || '',
        gender: form.gender || ''
      });
      setUser({ ...data.user, preferences: { ...(data.user?.preferences || {}), ...preferences } });
      setPreferences(preferences);
      apiSendWelcomeEmail().catch(e => console.warn('Welcome email dispatch skipped:', e.message));
    } catch (err) {
      if (!isBackendOfflineError(err)) {
        setError(err.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      const mockUser = {
        id: `local-${Date.now()}`,
        name: form.name,
        email: form.email,
        age: form.age,
        gender: form.gender,
        preferences,
        isLocalOnly: true,
      };
      setUser(mockUser);
      setPreferences(preferences);
    } finally {
      setLoading(false);
    }
  }

  const dietaryLabel = form.dietary.length ? form.dietary.join(', ') : 'Dietary Preferences';

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <View style={styles.formContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your healthy journey</Text>

        <View style={styles.inputGroup}>
          <TextInput icon={User} placeholder="Full Name" value={form.name} onChangeText={val => handle('name', val)} />
          <TextInput icon={Mail} placeholder="Email" value={form.email} onChangeText={val => handle('email', val)} keyboardType="email-address" />
          <TextInput
            icon={Lock}
            placeholder="Password"
            value={form.password}
            onChangeText={val => handle('password', val)}
            secureTextEntry={!showPass}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 4 }}>
                {showPass ? <EyeOff size={16} color="#666" /> : <Eye size={16} color="#666" />}
              </TouchableOpacity>
            }
          />
          <TextInput icon={Lock} placeholder="Confirm Password" value={form.confirm} onChangeText={val => handle('confirm', val)} secureTextEntry />

          {/* Age and Gender Inputs */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <RNTextInput
                placeholder="Age"
                placeholderTextColor="#555"
                value={form.age}
                onChangeText={val => handle('age', val)}
                keyboardType="numeric"
                style={styles.ageInput}
              />
            </View>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setShowGenderModal(true)} 
              style={styles.genderSelect}
            >
              <Text style={[styles.genderSelectText, form.gender ? { color: '#fff' } : { color: '#555' }]} numberOfLines={1}>
                {form.gender || 'Gender'}
              </Text>
              <ChevronDown size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Dietary Dropdown Selector */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setShowDropdown(true)} 
            style={styles.dietarySelect}
          >
            <Text style={[styles.dietarySelectText, form.dietary.length ? { color: '#fff' } : { color: '#555' }]} numberOfLines={1}>
              {dietaryLabel}
            </Text>
            <ChevronDown size={16} color="#666" />
          </TouchableOpacity>

          {/* Chosen Dietary Tags */}
          {form.dietary.length > 0 && (
            <View style={styles.tagsContainer}>
              {form.dietary.map(opt => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggleDietary(opt)}
                  style={styles.tagItem}
                >
                  <Text style={styles.tagText}>{opt}  <Text style={{ color: '#ffb399' }}>x</Text></Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <View style={{ marginTop: 28 }}>
          <BtnOrange onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</BtnOrange>
        </View>

        <View style={{ marginTop: 12 }}>
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

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')} style={{ marginTop: 20 }}>
          <Text style={styles.signinPromptText}>
            Already have an account?{' '}
            <Text style={styles.signinPromptHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              <TouchableOpacity onPress={() => setShowGenderModal(false)}>
                <X size={20} color="#888" />
              </TouchableOpacity>
            </View>
            {GENDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  handle('gender', opt);
                  setShowGenderModal(false);
                }}
                style={styles.modalOption}
              >
                <Text style={[styles.modalOptionText, form.gender === opt && { color: C.orange }]}>{opt}</Text>
                {form.gender === opt && <Check size={18} color={C.orange} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Dietary Picker Modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dietary Preferences</Text>
              <TouchableOpacity onPress={() => setShowDropdown(false)}>
                <X size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {DIETARY_OPTIONS.map(opt => {
                const isSelected = form.dietary.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => toggleDietary(opt)}
                    style={[styles.modalOption, isSelected && { backgroundColor: 'rgba(255,107,53,0.08)' }]}
                  >
                    <Text style={[styles.modalOptionText, isSelected && { color: C.orange }]}>{opt}</Text>
                    {isSelected && <Check size={18} color={C.orange} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowDropdown(false)} style={styles.modalDoneButton}>
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
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
    maxWidth: 500,
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
    marginBottom: 32,
  },
  inputGroup: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  ageInput: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#fff',
    fontSize: 14,
  },
  genderSelect: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  genderSelectText: {
    fontSize: 14,
    flex: 1,
  },
  dietarySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dietarySelectText: {
    fontSize: 14,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.24)',
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    color: '#ff4d6d',
    fontSize: 12,
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
  signinPromptText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
  signinPromptHighlight: {
    color: C.orange,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#171a20',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderColor: C.border,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#ccc',
  },
  modalDoneButton: {
    backgroundColor: C.orange,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  modalDoneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
