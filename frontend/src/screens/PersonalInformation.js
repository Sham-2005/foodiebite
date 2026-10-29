import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { ArrowLeft, Edit2, Save, User, Mail, Calendar, Users, CheckCircle, AlertCircle, Key, X, ShieldAlert } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { apiUpdateProfile, apiUpdatePassword } from '../services/api';
import { C, BtnOrange } from '../components/UI';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

function FieldRow({ icon: Icon, label, value, type = 'default', disabled, onChangeText, placeholder }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.fieldContainer,
        disabled ? { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: C.input, borderColor: C.inputB }
      ]}>
        <Icon size={16} color={disabled ? C.muted2 : C.muted} style={{ marginRight: 10 }} />
        <TextInput
          value={value}
          editable={!disabled}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#444"
          keyboardType={type === 'number' ? 'numeric' : 'default'}
          style={[styles.fieldInput, disabled ? { color: C.muted2 } : { color: C.text }]}
        />
      </View>
    </View>
  );
}

export default function PersonalInformation() {
  const navigation = useNavigation();
  const { user, updateUser } = useApp();

  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [toast,   setToast]     = useState(null); // { type: 'success'|'error', msg }

  // ── Password change states ──
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm]   = useState({ current: '', new: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdToast, setPwdToast] = useState(null);
  
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const [formData, setFormData] = useState({
    name:   '',
    email:  '',
    age:    '',
    gender: '',
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setFormData({
        name:   user.name   || '',
        email:  user.email  || '',
        age:    String(user.age || ''),
        gender: user.gender || '',
      });
    }
  }, [user]);

  const handleEdit = () => {
    setToast(null);
    setEditing(true);
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name:   user.name   || '',
        email:  user.email  || '',
        age:    String(user.age || ''),
        gender: user.gender || '',
      });
    }
    setEditing(false);
    setToast(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setToast({ type: 'error', msg: 'Name is required.' });
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setToast({ type: 'error', msg: 'Please enter a valid email address.' });
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      const parsedAge = formData.age ? parseInt(formData.age, 10) : null;
      await apiUpdateProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        age: parsedAge,
        gender: formData.gender
      });
      updateUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        age: parsedAge,
        gender: formData.gender
      });
      setEditing(false);
      setToast({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setToast({ type: 'error', msg: err.message || 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwdToast(null);

    if (!pwdForm.current || !pwdForm.new || !pwdForm.confirm) {
      setPwdToast({ type: 'error', msg: 'All fields are required' });
      return;
    }
    if (pwdForm.new.length < 6) {
      setPwdToast({ type: 'error', msg: 'New password must be at least 6 characters' });
      return;
    }
    if (pwdForm.new !== pwdForm.confirm) {
      setPwdToast({ type: 'error', msg: 'Passwords do not match' });
      return;
    }

    try {
      setPwdLoading(true);
      await apiUpdatePassword({
        currentPassword: pwdForm.current,
        newPassword: pwdForm.new,
      });
      setPwdToast({ type: 'success', msg: 'Password updated successfully!' });
      setPwdForm({ current: '', new: '', confirm: '' });
      setTimeout(() => setPwdModal(false), 1200);
    } catch (err) {
      setPwdToast({ type: 'error', msg: err.message || 'Incorrect current password' });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Personal Information</Text>

        {!editing ? (
          <TouchableOpacity
            onPress={handleEdit}
            style={styles.editBtn}
          >
            <Edit2 size={13} color={C.orange} style={{ marginRight: 4 }} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          >
            <Save size={13} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 }}>
        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {(formData.name || user?.name || 'G').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.avatarName}>{formData.name || 'Your Name'}</Text>
            <Text style={styles.avatarEmail}>{formData.email || 'your@email.com'}</Text>
          </View>
        </View>

        {/* Toast / feedback */}
        {toast && (
          <View style={[
            styles.alert,
            toast.type === 'success' ? styles.alertSuccess : styles.alertError
          ]}>
            {toast.type === 'success' ? <CheckCircle size={16} color="#4ade80" /> : <AlertCircle size={16} color="#ff4d6d" />}
            <Text style={[styles.alertText, toast.type === 'success' ? { color: '#4ade80' } : { color: '#ff4d6d' }]}>
              {toast.msg}
            </Text>
          </View>
        )}

        {/* Form fields container */}
        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>Account Details</Text>

          <FieldRow
            icon={User}
            label="Full Name"
            value={formData.name}
            disabled={!editing}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            placeholder="Enter your name"
          />

          <FieldRow
            icon={Mail}
            label="Email Address"
            value={formData.email}
            disabled={!editing}
            onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
            placeholder="Enter your email"
          />

          <FieldRow
            icon={Calendar}
            label="Age"
            type="number"
            value={formData.age}
            disabled={!editing}
            onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
            placeholder="Enter your age"
          />

          <View style={{ marginBottom: 0 }}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <TouchableOpacity
              disabled={!editing}
              onPress={() => setShowGenderPicker(true)}
              style={[
                styles.fieldContainer,
                !editing ? { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: C.input, borderColor: C.inputB }
              ]}
            >
              <Users size={16} color={!editing ? C.muted2 : C.muted} style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 14, color: formData.gender ? C.text : '#444' }}>
                {formData.gender || 'Select gender'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancel button */}
        {editing && (
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Password change hint */}
        {!editing && (
          <TouchableOpacity 
            onPress={() => setPwdModal(true)}
            style={styles.passwordHintCard}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Key size={16} color={C.orange} />
              <Text style={{ color: '#fff', fontSize: 13 }}>Password</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#444', fontSize: 12 }}>••••••••</Text>
              <Text style={{ fontSize: 12, color: C.orange, fontWeight: '700' }}>Change</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={pwdModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setPwdModal(false); setPwdToast(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Key size={18} color={C.orange} />
                <Text style={styles.modalTitle}>Security</Text>
              </View>
              <TouchableOpacity onPress={() => { setPwdModal(false); setPwdToast(null); }}>
                <X size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {pwdToast && (
              <View style={[
                styles.alert,
                pwdToast.type === 'success' ? styles.alertSuccess : styles.alertError
              ]}>
                {pwdToast.type === 'success' ? <CheckCircle size={14} color="#4ade80" /> : <ShieldAlert size={14} color="#ff4d6d" />}
                <Text style={[styles.alertText, pwdToast.type === 'success' ? { color: '#4ade80' } : { color: '#ff4d6d' }]}>
                  {pwdToast.msg}
                </Text>
              </View>
            )}

            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.modalFieldLabel}>CURRENT PASSWORD</Text>
                <TextInput 
                  secureTextEntry
                  value={pwdForm.current}
                  onChangeText={text => setPwdForm({ ...pwdForm, current: text })}
                  placeholderTextColor="#444"
                  style={styles.modalInput}
                />
              </View>

              <View>
                <Text style={styles.modalFieldLabel}>NEW PASSWORD</Text>
                <TextInput 
                  secureTextEntry
                  value={pwdForm.new}
                  onChangeText={text => setPwdForm({ ...pwdForm, new: text })}
                  placeholderTextColor="#444"
                  style={styles.modalInput}
                />
              </View>

              <View>
                <Text style={styles.modalFieldLabel}>CONFIRM NEW PASSWORD</Text>
                <TextInput 
                  secureTextEntry
                  value={pwdForm.confirm}
                  onChangeText={text => setPwdForm({ ...pwdForm, confirm: text })}
                  placeholderTextColor="#444"
                  style={styles.modalInput}
                />
              </View>

              <TouchableOpacity 
                onPress={handlePasswordChange}
                disabled={pwdLoading}
                style={[styles.modalSubmitBtn, pwdLoading && { opacity: 0.7 }]}
              >
                {pwdLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gender Picker Sub-Modal */}
      <Modal visible={showGenderPicker} transparent animationType="slide">
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <Text style={styles.subModalTitle}>Select Gender</Text>
            {GENDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  setFormData(prev => ({ ...prev, gender: opt }));
                  setShowGenderPicker(false);
                }}
                style={styles.subModalOption}
              >
                <Text style={[styles.subModalOptionText, formData.gender === opt && { color: C.orange }]}>{opt}</Text>
                {formData.gender === opt && <CheckCircle size={16} color={C.orange} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowGenderPicker(false)} style={styles.subModalClose}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#111318',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  backBtn: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: {
    color: C.orange,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 28,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  avatarEmail: {
    fontSize: 12,
    color: '#666',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    gap: 10,
  },
  alertSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  alertError: {
    backgroundColor: 'rgba(255,77,109,0.1)',
    borderColor: 'rgba(255,77,109,0.3)',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  cancelBtn: {
    width: '100%',
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  passwordHintCard: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#171a20',
    width: '100%',
    maxWidth: 360,
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
    fontWeight: '700',
    color: '#fff',
  },
  modalFieldLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
    marginBottom: 5,
  },
  modalInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.inputB,
    borderRadius: 10,
    color: C.text,
    fontSize: 13,
  },
  modalSubmitBtn: {
    marginTop: 8,
    backgroundColor: C.orange,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  modalSubmitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  subModalContent: {
    backgroundColor: '#14161c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  subModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  subModalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  subModalOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  subModalClose: {
    backgroundColor: '#252525',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
});