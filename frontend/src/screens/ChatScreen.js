import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { BackHeader, C } from '../components/UI';
import { apiSendChatMessage } from '../services/api';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
import { Send, Bot, User } from 'lucide-react-native';
import AppLayout from '../components/AppLayout';
import { useApp } from '../context/AppContext';

export default function ChatScreen() {
  const { user, preferences } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Resolve thread ID dynamically from active user session
  const getInitialThreadId = () => {
    const activeMockStr = localStorage.getItem('nb_mock_active');
    const activeMock = activeMockStr ? JSON.parse(activeMockStr) : null;
    const fbUser = auth.currentUser;
    const uid = fbUser ? fbUser.uid : (activeMock ? activeMock.id : 'default');
    return localStorage.getItem(`fb_active_thread_${uid}`) || 'default';
  };
  const [threadId] = useState(getInitialThreadId);
  const scrollViewRef = useRef(null);

  const lastBotMessage = [...messages].reverse().find(m => m.sender === 'coach' || m.sender === 'bot');
  const currentOptions = (lastBotMessage && Array.isArray(lastBotMessage.options) && lastBotMessage.options.length > 0) ? lastBotMessage.options : [];

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat messages
  useEffect(() => {
    if (isFirebaseConfigured) {
      const user = auth.currentUser;
      if (!user) return;

      const path = `users/${user.uid}/threads/${threadId}/messages`;
      const q = query(collection(db, path), orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach((docSnap) => {
          msgs.push(docSnap.data());
        });
        setMessages(msgs);
      });

      return () => unsubscribe();
    } else {
      // Mock engine fallback
      const activeStr = localStorage.getItem('nb_mock_active');
      const active = activeStr ? JSON.parse(activeStr) : null;
      if (active) {
        const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
        setMessages(localMsgs);
      }
    }
  }, [threadId]);

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

    if (!isFirebaseConfigured) {
      const activeStr = localStorage.getItem('nb_mock_active');
      const active = activeStr ? JSON.parse(activeStr) : null;
      if (active) {
        const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
        const updated = [...localMsgs, userMsgObj];
        localStorage.setItem(`chat-${active.id}-${threadId}`, JSON.stringify(updated));
        setMessages(updated);
      }
    } else {
      setMessages(prev => [...prev, userMsgObj]);
    }

    try {
      const clientUserContext = {
        id: user?.uid || user?.id,
        name: user?.name || user?.displayName,
        age: user?.age,
        gender: user?.gender,
        weightKg: user?.weight || preferences?.weight,
        heightCm: user?.height || preferences?.height,
        activityLevel: user?.activityLevel || preferences?.activityLevel,
        dietType: preferences?.dietType,
        allergies: preferences?.allergies,
        cuisines: preferences?.cuisines,
        healthGoals: preferences?.healthGoals,
        spiceLevel: preferences?.spiceLevel,
        maxCalories: preferences?.maxCalories,
        minProtein: preferences?.minProtein,
      };
      const res = await apiSendChatMessage(threadId, userMessage, clientUserContext);
      
      const coachMsgObj = {
        id: `msg-${Date.now()}-reply`,
        sender: 'coach',
        text: res.reply || res.text || res.message || 'FoodieBite AI is temporarily unavailable. Please try again.',
        type: res.type || (res.success === false ? 'error' : 'text'),
        options: Array.isArray(res.options) ? res.options : [],
        source: res.source || (res.success === false ? 'foodiebite_ai_error' : 'foodiebite_ai'),
        timestamp: new Date().toISOString()
      };

      if (!isFirebaseConfigured) {
        const activeStr = localStorage.getItem('nb_mock_active');
        const active = activeStr ? JSON.parse(activeStr) : null;
        if (active) {
          const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
          const updated = [...localMsgs, coachMsgObj];
          localStorage.setItem(`chat-${active.id}-${threadId}`, JSON.stringify(updated));
          setMessages(updated);
        }
      } else {
        setMessages(prev => [...prev.filter(m => m.id !== userMsgObj.id), userMsgObj, coachMsgObj]);
      }
    } catch (err) {
      console.error(err);
      const errorMsgObj = {
        id: `msg-${Date.now()}-err`,
        sender: 'coach',
        text: 'FoodieBite AI is temporarily unavailable. Please try again.',
        type: 'error',
        options: [],
        source: 'foodiebite_ai_error',
        timestamp: new Date().toISOString()
      };

      if (!isFirebaseConfigured) {
        const activeStr = localStorage.getItem('nb_mock_active');
        const active = activeStr ? JSON.parse(activeStr) : null;
        if (active) {
          const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
          const updated = [...localMsgs, errorMsgObj];
          localStorage.setItem(`chat-${active.id}-${threadId}`, JSON.stringify(updated));
          setMessages(updated);
        }
      } else {
        setMessages(prev => [...prev, errorMsgObj]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout noPadding>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1, maxWidth: 840, width: '100%', alignSelf: 'center' }}
      >
        <BackHeader title="FoodieBite AI" />
        
        {/* Messages area */}
        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContainer}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.botIconBg}>
                <Bot size={40} color={C.orange} />
              </View>
              <Text style={styles.emptyTitle}>Welcome to FoodieBite AI!</Text>
              <Text style={styles.emptyDesc}>
                Ask me anything about macros, recipes, meal plans, or food recommendations customized for your profile!
              </Text>
            </View>
          ) : (
            messages.map((m, idx) => {
              const isUser = m.sender === 'user';
              const isError = m.type === 'error' || m.source === 'foodiebite_ai_error';

              return (
                <View 
                  key={m.id || `msg-${idx}`} 
                  style={[
                    styles.messageRow,
                    isUser ? { alignSelf: 'flex-end', flexDirection: 'row-reverse' } : { alignSelf: 'flex-start', flexDirection: 'row' }
                  ]}
                >
                  {!isUser ? (
                    <View style={[styles.msgAvatarBg, isError ? { backgroundColor: 'rgba(239, 68, 68, 0.15)' } : null]}>
                      <Bot size={16} color={isError ? '#ef4444' : C.orange} />
                    </View>
                  ) : null}
                  
                  <View style={[
                    styles.messageBubble,
                    isUser 
                      ? styles.userBubble 
                      : (isError ? styles.errorBubble : styles.coachBubble)
                  ]}>
                    {!isUser ? (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isError ? '#ef4444' : '#10b981' }}>
                          {isError ? 'FoodieBite AI Error' : 'FoodieBite AI'}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.messageText, isError ? { color: '#fca5a5' } : null]}>{m.text}</Text>
                  </View>

                  {isUser ? (
                    <View style={[styles.msgAvatarBg, { backgroundColor: '#222', borderColor: C.border, borderWidth: 1 }]}>
                      <User size={16} color={C.muted} />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {loading ? (
            <View style={[styles.messageRow, { alignSelf: 'flex-start' }]}>
              <View style={styles.msgAvatarBg}>
                <Bot size={16} color={C.orange} />
              </View>
              <View style={[styles.messageBubble, styles.coachBubble, { flexDirection: 'row', gap: 6, alignItems: 'center', minWidth: 60, justifyContent: 'center' }]}>
                <ActivityIndicator size="small" color={C.orange} />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Dynamic Choice Options UI */}
        {currentOptions.length > 0 ? (
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>SELECT AN OPTION</Text>
            
            <View style={styles.dropdownRow}>
              {Platform.OS === 'web' ? (
                <select
                  value={selectedOption}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedOption(val);
                    setInput(val);
                  }}
                  disabled={loading}
                  style={styles.dropdownSelect}
                >
                  <option value="">-- Choose an option --</option>
                  {currentOptions.map((opt, i) => (
                    <option key={i} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  const toSend = selectedOption || input;
                  if (toSend) {
                    handleSend(toSend);
                  }
                }}
                disabled={(!selectedOption && !input.trim()) || loading}
                style={[
                  styles.enterOptionBtn,
                  (selectedOption || input.trim()) ? { backgroundColor: C.orange } : { backgroundColor: 'rgba(255,255,255,0.05)' }
                ]}
              >
                <Text style={[styles.enterOptionBtnText, (selectedOption || input.trim()) ? { color: '#fff' } : { color: '#666' }]}>
                  Enter ↵
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.optionsChipGrid}>
              {currentOptions.map((opt, idx) => {
                const isSelected = selectedOption === opt.value || input === opt.value;
                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={loading}
                    onPress={() => {
                      setSelectedOption(opt.value);
                      setInput(opt.value);
                    }}
                    style={[
                      styles.optionChip,
                      isSelected ? { backgroundColor: 'rgba(255,107,53,0.25)', borderColor: C.orange } : { backgroundColor: '#171a20', borderColor: C.border }
                    ]}
                  >
                    <Text style={[styles.optionChipText, isSelected ? { color: C.orange, fontWeight: '700' } : { color: '#ccc' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Input container */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type your health question here..."
            placeholderTextColor="#666"
            value={input}
            onChangeText={(txt) => {
              setInput(txt);
              if (selectedOption && txt !== selectedOption) {
                setSelectedOption('');
              }
            }}
            editable={!loading}
            onSubmitEditing={() => {
              if (loading) return;
              const toSend = selectedOption || input;
              if (toSend && toSend.trim()) {
                handleSend(toSend);
              }
            }}
            style={[styles.textInput, loading ? { opacity: 0.6 } : null]}
          />
          <TouchableOpacity 
            onPress={() => {
              if (loading) return;
              const toSend = selectedOption || input;
              if (toSend && toSend.trim()) {
                handleSend(toSend);
              }
            }}
            disabled={(!input.trim() && !selectedOption) || loading} 
            style={[
              styles.sendBtn,
              (input.trim() || selectedOption) && !loading ? { backgroundColor: C.orange } : { backgroundColor: 'rgba(255,255,255,0.03)' }
            ]}
          >
            <Send size={18} color={(input.trim() || selectedOption) && !loading ? '#fff' : '#444'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  botIconBg: {
    backgroundColor: 'rgba(255,107,53,0.1)',
    padding: 20,
    borderRadius: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  emptyDesc: {
    color: C.muted,
    fontSize: 13,
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 18,
  },
  messageRow: {
    gap: 10,
    maxWidth: '85%',
  },
  msgAvatarBg: {
    backgroundColor: 'rgba(255,107,53,0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: C.orange,
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 19,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#12141a',
    borderTopWidth: 1,
    borderColor: C.border,
  },
  optionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownSelect: {
    flex: 1,
    backgroundColor: '#1b1f26',
    color: '#fff',
    borderColor: 'rgba(255,107,53,0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    outline: 'none'
  },
  enterOptionBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enterOptionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optionsChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionChipText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

