// ─────────────────────────────────────────────────────────────
//  frontend/src/screens/ChatScreen.js
//  FoodieBite Chat Screen — Standalone & Offline Capable
//  Zero Firebase & Zero Cloud AI dependencies
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BackHeader, C } from '../components/UI';
import { apiSendChatMessage } from '../services/api';
import { Send, Bot, User, Sparkles } from 'lucide-react-native';
import AppLayout from '../components/AppLayout';
import { useApp } from '../context/AppContext';
import storage, { getItemSync, setItemSync, getJSONSync } from '../services/storage.js';

export default function ChatScreen() {
  const { user, preferences } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(false);

  const userId = user?.uid || user?.id || 'guest_user';
  const getInitialThreadId = () => {
    return getItemSync(`fb_active_thread_${userId}`) || 'default';
  };
  const [threadId] = useState(getInitialThreadId);
  const scrollViewRef = useRef(null);

  const lastBotMessage = [...messages].reverse().find(m => m.sender === 'coach' || m.sender === 'bot');
  const currentOptions = (lastBotMessage && Array.isArray(lastBotMessage.options) && lastBotMessage.options.length > 0)
    ? lastBotMessage.options
    : [];

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const getStorageKey = () => `chat_threads_${userId}`;

  // Load chat messages
  useEffect(() => {
    try {
      const backup = getJSONSync(getStorageKey(), {});
      const localMsgs = backup[threadId] || [];
      if (localMsgs.length > 0) {
        setMessages(localMsgs);
      } else {
        const welcome = {
          id: 'welcome',
          sender: 'coach',
          text: "Hi! I'm your FoodieBite AI Nutrition Coach. How can I help with your meals and health goals today?",
          source: 'foodiebite_local_ai',
          options: [
            'Suggest a high-protein Indian breakfast',
            'What foods should I avoid with hypercholesterolemia?',
            'Estimate calories for Palak Paneer and Roti',
            'Is Ghee healthy for daily cooking?'
          ],
          timestamp: new Date().toISOString()
        };
        setMessages([welcome]);
      }
    } catch (err) {
      console.warn('Failed to load chat messages:', err);
    }
  }, [threadId, userId]);

  const saveMessages = (msgs) => {
    try {
      const key = getStorageKey();
      const backup = getJSONSync(key, {});
      backup[threadId] = msgs;
      setItemSync(key, JSON.stringify(backup));
    } catch (err) {
      console.warn('Failed to save chat messages:', err);
    }
  };

  async function handleSend(overrideText) {
    const textToSend = overrideText || selectedOption || input;
    if (!textToSend || textToSend.trim() === '' || loading) return;

    const userMessage = textToSend.trim();
    setInput('');
    setSelectedOption('');
    setLoading(true);

    const userMsgObj = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userMessage,
      source: 'client',
      timestamp: new Date().toISOString()
    };

    const nextMsgs = [...messages.filter(m => m.id !== 'welcome'), userMsgObj];
    setMessages(nextMsgs);
    saveMessages(nextMsgs);

    try {
      const clientUserContext = {
        id: userId,
        name: user?.name || user?.displayName || 'User',
        age: user?.age || 25,
        gender: user?.gender || 'not_specified',
        weightKg: user?.weight || preferences?.weight || 65,
        heightCm: user?.height || preferences?.height || 170,
        activityLevel: user?.activityLevel || preferences?.activityLevel || 'moderate',
        dietType: preferences?.dietType || user?.dietType || 'balanced',
        allergies: Array.isArray(preferences?.allergies) ? preferences.allergies : [],
        cuisines: Array.isArray(preferences?.cuisines) ? preferences.cuisines : ['Indian'],
        healthGoals: Array.isArray(preferences?.healthGoals) ? preferences.healthGoals : ['healthy_eating'],
        spiceLevel: preferences?.spiceLevel || 'medium',
        maxCalories: preferences?.maxCalories || 2000,
        minProtein: preferences?.minProtein || 60,
      };

      const res = await apiSendChatMessage(threadId, userMessage, clientUserContext);

      const coachMsgObj = {
        id: `msg-${Date.now()}-reply`,
        sender: 'coach',
        text: res.reply || res.text || res.message || 'I am ready to help you with meal planning and nutrition advice!',
        type: res.type || (res.success === false ? 'error' : 'text'),
        options: Array.isArray(res.options) ? res.options : [],
        source: res.source || 'foodiebite_local_ai',
        timestamp: new Date().toISOString()
      };

      const updated = [...nextMsgs, coachMsgObj];
      setMessages(updated);
      saveMessages(updated);
    } catch (err) {
      console.warn('ChatScreen query error:', err);
      const errorMsgObj = {
        id: `msg-${Date.now()}-err`,
        sender: 'coach',
        text: 'FoodieBite AI is processing your request. Please try again or pick an option below.',
        type: 'error',
        options: [
          'Suggest a high-protein Indian breakfast',
          'Estimate calories for Palak Paneer and Roti',
          'What foods should I avoid with hypercholesterolemia?'
        ],
        source: 'foodiebite_local_ai',
        timestamp: new Date().toISOString()
      };

      const updated = [...nextMsgs, errorMsgObj];
      setMessages(updated);
      saveMessages(updated);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <BackHeader title="FoodieBite AI Coach" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.messagesList}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            const isError = m.type === 'error';

            return (
              <View 
                key={m.id} 
                style={[
                  styles.messageRow, 
                  isUser ? styles.userRow : styles.coachRow
                ]}
              >
                {!isUser && (
                  <View style={styles.botIconCircle}>
                    <Bot size={16} color="#FF6B35" />
                  </View>
                )}
                <View 
                  style={[
                    styles.messageBubble, 
                    isUser 
                      ? styles.userBubble 
                      : (isError ? styles.errorBubble : styles.coachBubble)
                  ]}
                >
                  <Text style={[styles.messageText, isUser ? styles.userText : styles.coachText]}>
                    {m.text}
                  </Text>
                </View>
                {isUser && (
                  <View style={styles.userIconCircle}>
                    <User size={16} color="#fff" />
                  </View>
                )}
              </View>
            );
          })}

          {loading && (
            <View style={[styles.messageRow, styles.coachRow]}>
              <View style={styles.botIconCircle}>
                <Bot size={16} color="#FF6B35" />
              </View>
              <View style={[styles.messageBubble, styles.coachBubble, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Thinking...</Text>
              </View>
            </View>
          )}

          {!loading && currentOptions.length > 0 && (
            <View style={{ marginTop: 12, paddingLeft: 34 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: '600' }}>
                Follow-up Suggestions:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {currentOptions.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleSend(opt)}
                    style={styles.optionPill}
                    activeOpacity={0.7}
                  >
                    <Sparkles size={12} color="#FF6B35" style={{ marginRight: 6 }} />
                    <Text style={styles.optionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask about calories, macros, diets..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            editable={!loading}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!input.trim() || loading) && styles.disabledSend]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  messagesList: {
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  coachRow: {
    justifyContent: 'flex-start',
  },
  botIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  userIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#FF6B35',
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
    fontWeight: '500',
  },
  coachText: {
    color: '#e5e7eb',
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#171717',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#262626',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSend: {
    backgroundColor: '#404040',
    opacity: 0.5,
  },
});
