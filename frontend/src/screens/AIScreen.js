// ─────────────────────────────────────────────────────────────
//  frontend/src/screens/AIScreen.js
//  FoodieBite AI Nutrition Coach — Standalone & Offline Capable
//  Powered by FoodieBite Local Intelligence Engine
//  Zero Cloud AI & Zero Firebase Dependencies
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bot, Send, Sparkles, Trash2, User, Plus } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { C } from '../components/UI';
import { apiSendChatMessage } from '../services/api';
import { getItemSync, setItemSync, getJSONSync } from '../services/storage.js';

const QUICK_PROMPTS = [
  'Suggest a high-protein Indian breakfast',
  'What foods should I avoid with hypercholesterolemia?',
  'Estimate calories for Palak Paneer and Roti',
  'Is Ghee healthy for daily cooking?'
];

function AnimatedDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, delay]);

  return <Animated.View style={[styles.typingDot, { opacity }]} />;
}

export default function AIScreen() {
  const navigation = useNavigation();
  const { user, preferences, setNearbyTrigger } = useApp();
  const [queryText, setQueryText] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [messages, setMessages] = useState([]);
  const [optimisticMsgs, setOptimisticMsgs] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const userId = user?.uid || user?.id || 'guest_user';

  // Deduplicate optimistic messages
  const confirmedTexts = new Set(
    messages.filter(m => m.sender === 'user').map(m => m.text)
  );
  const filteredOptimistic = optimisticMsgs.filter(
    m => m.sender !== 'user' || !confirmedTexts.has(m.text)
  );
  const displayedMessages = [...messages, ...filteredOptimistic];

  const lastBotMessage = [...displayedMessages].reverse().find(m => m.sender === 'bot');
  const currentOptions = (lastBotMessage && Array.isArray(lastBotMessage.options) && lastBotMessage.options.length > 0)
    ? lastBotMessage.options
    : [];

  // Scoped thread management
  const getInitialThreadId = () => {
    return getItemSync(`fb_active_thread_${userId}`) || 'default';
  };
  const [threadId, setThreadId] = useState(getInitialThreadId());
  const [threads, setThreads] = useState([{ id: 'default', name: 'Primary Session' }]);

  const scrollViewRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [displayedMessages, isTyping]);

  // Load threads list
  useEffect(() => {
    const savedActive = getItemSync(`fb_active_thread_${userId}`) || 'default';
    setThreadId(savedActive);

    const savedThreads = getJSONSync(`fb_threads_list_${userId}`, [{ id: 'default', name: 'Primary Session' }]);
    if (Array.isArray(savedThreads) && savedThreads.length > 0) {
      setThreads(savedThreads);
    } else {
      setThreads([{ id: 'default', name: 'Primary Session' }]);
    }
  }, [userId]);

  const changeThread = (newId) => {
    setThreadId(newId);
    setItemSync(`fb_active_thread_${userId}`, newId);
  };

  const createNewThread = () => {
    const newId = `thread-${Date.now()}`;
    const name = `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const updated = [...threads, { id: newId, name }];
    setThreads(updated);
    setItemSync(`fb_threads_list_${userId}`, JSON.stringify(updated));
    changeThread(newId);
  };

  // User-scoped message history persistence
  const getStorageKey = () => `chat_threads_${userId}`;

  const loadFromStorage = () => {
    try {
      const keyName = getStorageKey();
      const backup = getJSONSync(keyName, {});
      const tMsgs = backup[threadId] || [];

      if (tMsgs.length === 0) {
        // Initial welcome message if thread is blank
        const welcomeMsg = {
          id: 'welcome-msg',
          sender: 'bot',
          text: `👋 **Welcome to FoodieBite AI!**\n\nI'm your personal nutrition & meal planning coach. I can help you with:\n\n• High-protein meals & Indian breakfast ideas\n• Cholesterol, diabetes & blood pressure guidelines\n• Calorie & macro estimates for Indian dishes\n• Healthy substitutions & ingredient checks\n\n*Tap a quick question below or ask me anything!*`,
          type: 'greeting',
          options: QUICK_PROMPTS,
          source: 'foodiebite_local_ai',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
      } else {
        setMessages(tMsgs.map(m => ({
          id: m.id || `msg-${Math.random()}`,
          sender: m.sender,
          text: m.text,
          type: m.type || 'text',
          options: Array.isArray(m.options) ? m.options : [],
          source: m.source || 'foodiebite_local_ai',
          time: m.time || (m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
          timestamp: m.timestamp || Date.now()
        })));
      }
    } catch (err) {
      console.warn('Failed to load chat history:', err);
    }
  };

  const saveToStorage = (tId, msgs) => {
    try {
      const keyName = getStorageKey();
      const backup = getJSONSync(keyName, {});

      backup[tId] = msgs.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        type: m.type,
        options: m.options,
        source: m.source,
        time: m.time,
        timestamp: m.timestamp || Date.now()
      }));

      // Prune messages older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const k in backup) {
        backup[k] = backup[k].filter(m => (m.timestamp || 0) >= thirtyDaysAgo);
        if (backup[k].length === 0) delete backup[k];
      }

      setItemSync(keyName, JSON.stringify(backup));
    } catch (err) {
      console.warn('Failed to save chat history:', err);
    }
  };

  useEffect(() => {
    loadFromStorage();
    setOptimisticMsgs([]);
  }, [threadId, userId]);

  async function handleSend(textToSend) {
    const text = textToSend || selectedOption || queryText;
    if (!text || !text.trim() || isTyping) return;

    setQueryText('');
    setSelectedOption('');
    setIsTyping(true);

    const timestamp = Date.now();
    const userMsg = {
      id: `user-${timestamp}`,
      sender: 'user',
      text: text.trim(),
      source: 'client',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp
    };

    setOptimisticMsgs([userMsg]);

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

    try {
      const res = await apiSendChatMessage(threadId, text.trim(), clientUserContext);

      const replyMsg = {
        id: `reply-${Date.now()}`,
        sender: 'bot',
        text: res.reply || res.text || res.message || 'I am ready to help you with meal planning and nutrition advice!',
        type: res.type || (res.success === false ? 'error' : 'text'),
        options: Array.isArray(res.options) ? res.options : [],
        source: res.source || 'foodiebite_local_ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };

      setMessages(prev => {
        const next = [...prev.filter(m => m.id !== userMsg.id && m.id !== 'welcome-msg'), userMsg, replyMsg];
        saveToStorage(threadId, next);
        return next;
      });

      if (res && res.nearbyIntent && typeof setNearbyTrigger === 'function') {
        setNearbyTrigger(res.nearbyIntent);
        if (navigation && typeof navigation.navigate === 'function') {
          navigation.navigate('Home');
        }
      }
    } catch (err) {
      console.warn('AI query error:', err);
      const fallbackReply = {
        id: `reply-err-${Date.now()}`,
        sender: 'bot',
        text: 'FoodieBite AI is processing your nutrition recommendations. Please try asking again or select an option below.',
        type: 'error',
        options: QUICK_PROMPTS,
        source: 'foodiebite_local_ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };

      setMessages(prev => {
        const next = [...prev.filter(m => m.id !== userMsg.id), userMsg, fallbackReply];
        saveToStorage(threadId, next);
        return next;
      });
    } finally {
      setOptimisticMsgs([]);
      setIsTyping(false);
    }
  }

  function clearHistory() {
    try {
      const keyName = getStorageKey();
      const backup = getJSONSync(keyName, {});
      delete backup[threadId];
      setItemSync(keyName, JSON.stringify(backup));
    } catch (err) {
      console.warn('Failed to clear thread messages:', err);
    }
    loadFromStorage();
  }

  return (
    <AppLayout>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.avatarWrap}>
            <Image
              source={require('../assets/logo.jpg')}
              style={styles.headerLogo}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>FoodieBite AI</Text>
            <Text style={styles.headerSubtitle}>Offline Nutrition Coach</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            onPress={createNewThread}
            style={styles.actionBtn}
            accessibilityLabel="New Chat Session"
          >
            <Plus size={18} color="#FF6B35" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={clearHistory}
            style={styles.actionBtn}
            accessibilityLabel="Clear Chat History"
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Threads Bar */}
      {threads.length > 1 && (
        <ScrollView
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.threadScroll}
          contentContainerStyle={styles.threadContent}
        >
          {threads.map(t => (
            <TouchableOpacity
              key={t.id}
              onPress={() => changeThread(t.id)}
              style={[
                styles.threadPill,
                t.id === threadId && styles.threadPillActive
              ]}
            >
              <Text style={[
                styles.threadPillText,
                t.id === threadId && styles.threadPillTextActive
              ]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {displayedMessages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <View 
              key={msg.id || index}
              style={[
                styles.messageRow,
                isUser ? styles.messageRowUser : styles.messageRowBot
              ]}
            >
              {!isUser && (
                <View style={styles.botIconCircle}>
                  <Bot size={16} color="#FF6B35" />
                </View>
              )}

              <View style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.botBubble,
                msg.type === 'error' && styles.errorBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  isUser ? styles.userMessageText : styles.botMessageText
                ]}>
                  {msg.text}
                </Text>

                {msg.time ? (
                  <Text style={[
                    styles.messageTime,
                    isUser ? styles.userTime : styles.botTime
                  ]}>
                    {msg.time}
                  </Text>
                ) : null}
              </View>

              {isUser && (
                <View style={styles.userIconCircle}>
                  <User size={16} color="#fff" />
                </View>
              )}
            </View>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <View style={[styles.messageRow, styles.messageRowBot]}>
            <View style={styles.botIconCircle}>
              <Bot size={16} color="#FF6B35" />
            </View>
            <View style={[styles.messageBubble, styles.botBubble, styles.typingBubble]}>
              <AnimatedDot delay={0} />
              <AnimatedDot delay={150} />
              <AnimatedDot delay={300} />
            </View>
          </View>
        )}

        {/* Suggestion Options Pills */}
        {!isTyping && currentOptions.length > 0 && (
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsPrompt}>Suggested Follow-ups:</Text>
            <View style={styles.optionsWrap}>
              {currentOptions.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSend(opt)}
                  style={styles.optionPill}
                  activeOpacity={0.7}
                >
                  <Sparkles size={14} color="#FF6B35" style={{ marginRight: 6 }} />
                  <Text style={styles.optionPillText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask FoodieBite AI about nutrition..."
          placeholderTextColor="#9ca3af"
          value={queryText}
          onChangeText={setQueryText}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          multiline={false}
          editable={!isTyping}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!queryText.trim() || isTyping}
          style={[
            styles.sendBtn,
            (!queryText.trim() || isTyping) && styles.sendBtnDisabled
          ]}
          activeOpacity={0.8}
        >
          {isTyping ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#171717',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  headerLogo: {
    width: 38,
    height: 38,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadScroll: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#1a1a1a',
  },
  threadContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  threadPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#262626',
  },
  threadPillActive: {
    backgroundColor: '#FF6B35',
  },
  threadPillText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  threadPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowBot: {
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
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#FF6B35',
    borderBottomRightRadius: 4,
  },
  botBubble: {
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
    lineHeight: 21,
  },
  userMessageText: {
    color: '#fff',
    fontWeight: '500',
  },
  botMessageText: {
    color: '#e5e7eb',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  botTime: {
    color: '#6b7280',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF6B35',
  },
  optionsContainer: {
    marginTop: 8,
    marginBottom: 12,
    paddingLeft: 36,
  },
  optionsPrompt: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 8,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionPillText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#171717',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#262626',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#404040',
    opacity: 0.5,
  },
});
