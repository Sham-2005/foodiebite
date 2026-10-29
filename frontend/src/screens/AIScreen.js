import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, TextInput, ActivityIndicator, Animated, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bot, Send, Sparkles, Trash2, User, Plus } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { C } from '../components/UI';
import { apiSendChatMessage } from '../services/api';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
import { saveChatHistory, loadChatHistory } from '../services/localStorageService';

const QUICK_PROMPTS = [
  'Suggest a high-protein Indian breakfast',
  'What foods should I avoid with hypercholesterolemia?',
  'Estimate calories for Palak Paneer and Roti',
  'Is Ghee healthy for daily cooking?'
];

function AnimatedDot({ delay }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
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
    ).start();
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.typingDot, { opacity }]} />
  );
}

export default function AIScreen() {
  const navigation = useNavigation();
  const { user, preferences, setNearbyTrigger } = useApp();
  const [queryText, setQueryText] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [messages, setMessages] = useState([]);
  const [optimisticMsgs, setOptimisticMsgs] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  // Deduplicate
  const confirmedTexts = new Set(
    messages.filter(m => m.sender === 'user').map(m => m.text)
  );
  const filteredOptimistic = optimisticMsgs.filter(
    m => m.sender !== 'user' || !confirmedTexts.has(m.text)
  );
  const displayedMessages = [...messages, ...filteredOptimistic];

  const lastBotMessage = [...displayedMessages].reverse().find(m => m.sender === 'bot');
  const currentOptions = (lastBotMessage && Array.isArray(lastBotMessage.options) && lastBotMessage.options.length > 0) ? lastBotMessage.options : [];
  
  // Scoped thread states
  const getInitialThreadId = () => {
    if (user) {
      return localStorage.getItem(`fb_active_thread_${user.uid || user.id}`) || 'default';
    }
    return 'default';
  };
  const [threadId, setThreadId] = useState(getInitialThreadId());
  const [threads, setThreads] = useState([{ id: 'default', name: 'Primary Session' }]);
  
  const scrollViewRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [displayedMessages, isTyping]);

  // Load threads and active thread ID
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`fb_active_thread_${user.uid || user.id}`) || 'default';
      setThreadId(saved);

      if (isFirebaseConfigured) {
        const path = `users/${user.uid || user.id}/threads`;
        getDocs(collection(db, path))
          .then(snap => {
            const list = [{ id: 'default', name: 'Primary Session' }];
            snap.forEach(doc => {
              if (doc.id !== 'default') {
                list.push({ 
                  id: doc.id, 
                  name: doc.data().name || `Session ${doc.id.split('-')[1] ? new Date(Number(doc.id.split('-')[1])).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}` 
                });
              }
            });
            setThreads(list);
          })
          .catch(err => console.warn('Failed to load threads list:', err));
      } else {
        const mockList = JSON.parse(localStorage.getItem(`fb_mock_threads_${user.uid || user.id}`) || '[]');
        setThreads([{ id: 'default', name: 'Primary Session' }, ...mockList]);
      }
    }
  }, [user]);

  const changeThread = (newId) => {
    setThreadId(newId);
    if (user) {
      localStorage.setItem(`fb_active_thread_${user.uid || user.id}`, newId);
    }
  };

  const createNewThread = async () => {
    const newId = `thread-${Date.now()}`;
    const name = `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    if (user) {
      if (isFirebaseConfigured) {
        try {
          await setDoc(doc(db, `users/${user.uid || user.id}/threads`, newId), {
            id: newId,
            name,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Failed to create thread doc in Firestore:', err);
        }
      } else {
        const mockList = JSON.parse(localStorage.getItem(`fb_mock_threads_${user.uid || user.id}`) || '[]');
        const updated = [...mockList, { id: newId, name }];
        localStorage.setItem(`fb_mock_threads_${user.uid || user.id}`, JSON.stringify(updated));
      }
    }
    
    setThreads(prev => [...prev, { id: newId, name }]);
    changeThread(newId);
  };

  // User-scoped Local Chat Backup Helpers (30-day retention)
  const getStorageKey = () => `chat_threads_${user?.uid || user?.id || 'guest'}`;

  const updateLocalBackup = (tId, msgs) => {
    try {
      const keyName = getStorageKey();
      const backupStr = localStorage.getItem(keyName) || '{}';
      const backup = JSON.parse(backupStr);
      
      backup[tId] = msgs.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        type: m.type,
        options: m.options,
        source: m.source,
        timestamp: m.timestamp || Date.now()
      }));

      // Prune messages older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const key in backup) {
        backup[key] = backup[key].filter(m => m.timestamp >= thirtyDaysAgo);
        if (backup[key].length === 0) delete backup[key];
      }

      localStorage.setItem(keyName, JSON.stringify(backup));
    } catch (err) {
      console.error('Failed to update local backup:', err);
    }
  };

  const loadFromLocalBackup = () => {
    try {
      const keyName = getStorageKey();
      const backupStr = localStorage.getItem(keyName) || '{}';
      const backup = JSON.parse(backupStr);
      const tMsgs = backup[threadId] || [];
      setMessages(tMsgs.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        type: m.type,
        options: m.options || [],
        source: m.source || 'foodiebite_ai',
        time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        timestamp: m.timestamp
      })));
    } catch (err) {
      console.error('Failed to load from local backup:', err);
    }
  };

  // Real-time Firestore sync & Local Storage Fallback
  useEffect(() => {
    loadFromLocalBackup();

    if (isFirebaseConfigured) {
      const fbUser = auth.currentUser;
      if (!fbUser) return;

      const path = `users/${fbUser.uid}/threads/${threadId}/messages`;
      const q = query(collection(db, path), orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          msgs.push({
            id: doc.id,
            sender: d.sender === 'user' ? 'user' : 'bot',
            text: d.text,
            type: d.type,
            options: d.options || [],
            source: d.source || 'foodiebite_ai',
            time: d.timestamp ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now()
          });
        });
        setMessages(msgs);
        updateLocalBackup(threadId, msgs);
        setOptimisticMsgs([]);
      }, (err) => {
        console.warn('Firestore onSnapshot failed, using local backup fallback:', err.message);
        loadFromLocalBackup();
      });

      return () => unsubscribe();
    } else {
      const active = JSON.parse(localStorage.getItem('nb_mock_active') || 'null');
      if (active) {
        const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
        const formatted = localMsgs.map(m => ({
          id: m.id,
          sender: m.sender === 'user' ? 'user' : 'bot',
          text: m.text,
          type: m.type,
          options: m.options || [],
          source: m.source || 'foodiebite_ai',
          time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(m.timestamp).getTime()
        }));
        setMessages(formatted);
        updateLocalBackup(threadId, formatted);
      }
    }
  }, [threadId, user]);

  async function handleSend(textToSend) {
    const text = textToSend || selectedOption || queryText;
    if (!text || !text.trim() || isTyping) return;

    setQueryText('');
    setSelectedOption('');
    setIsTyping(true);

    const timestamp = Date.now();
    const userMsg = {
      id: `opt-user-${timestamp}`,
      sender: 'user',
      text: text.trim(),
      source: 'client',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp
    };

    setOptimisticMsgs([userMsg]);

    // Back up user message to localStorage right away (user-scoped)
    try {
      const keyName = getStorageKey();
      const backupStr = localStorage.getItem(keyName) || '{}';
      const backup = JSON.parse(backupStr);
      if (!backup[threadId]) backup[threadId] = [];
      backup[threadId].push(userMsg);
      localStorage.setItem(keyName, JSON.stringify(backup));
    } catch (err) {
      console.error('Failed to back up user message locally:', err);
    }

    const clientTimeoutMs = 22000;
    const clientTimeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ _timedOut: true }), clientTimeoutMs)
    );

    let res = null;
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

      res = await Promise.race([
        apiSendChatMessage(threadId, text.trim(), clientUserContext),
        clientTimeoutPromise
      ]);

      if (res && res._timedOut) {
        res = {
          success: false,
          source: 'foodiebite_ai_error',
          reply: 'FoodieBite AI is temporarily unavailable. Please try again.',
          type: 'error',
          options: []
        };
      }

      const replyMsg = {
        id: `opt-reply-${Date.now()}`,
        sender: 'bot',
        text: res.reply || res.text || res.message || 'FoodieBite AI is temporarily unavailable. Please try again.',
        type: res.type || (res.success === false ? 'error' : 'text'),
        options: Array.isArray(res.options) ? res.options : [],
        source: res.source || (res.success === false ? 'foodiebite_ai_error' : 'foodiebite_ai'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };

      setMessages(prev => [...prev.filter(m => m.id !== userMsg.id), userMsg, replyMsg]);

      if (res && res.nearbyIntent) {
        if (typeof setNearbyTrigger === 'function') {
          setNearbyTrigger(res.nearbyIntent);
        }
      }

      try {
        const keyName = getStorageKey();
        const backupStr = localStorage.getItem(keyName) || '{}';
        const backup = JSON.parse(backupStr);
        if (!backup[threadId]) backup[threadId] = [];
        backup[threadId].push(replyMsg);
        localStorage.setItem(keyName, JSON.stringify(backup));
      } catch (err) {
        console.error('Failed to back up coach reply locally:', err);
      }

      if (isFirebaseConfigured && db && (!res || res.persisted !== true)) {
        try {
          const fbUser = auth.currentUser;
          if (fbUser) {
            const msgsPath = `users/${fbUser.uid}/threads/${threadId}/messages`;
            const msgsColRef = collection(db, msgsPath);

            const userMsgDocRef = doc(msgsColRef);
            await setDoc(userMsgDocRef, {
              id: userMsgDocRef.id,
              sender: 'user',
              text: text.trim(),
              timestamp: new Date(timestamp).toISOString(),
              source: 'user',
              confidence: 1.0
            });

            const coachMsgDocRef = doc(msgsColRef);
            await setDoc(coachMsgDocRef, {
              id: coachMsgDocRef.id,
              sender: 'coach',
              text: replyMsg.text,
              type: replyMsg.type,
              options: replyMsg.options,
              timestamp: new Date(replyMsg.timestamp).toISOString(),
              source: replyMsg.source,
              confidence: 1.0
            });
          }
        } catch (dbErr) {
          console.error('Failed to save messages to Firestore from client side:', dbErr);
        }
      } else if (!isFirebaseConfigured) {
        const active = JSON.parse(localStorage.getItem('nb_mock_active') || 'null');
        if (active) {
          const localMsgs = JSON.parse(localStorage.getItem(`chat-${active.id}-${threadId}`) || '[]');
          const updated = [
            ...localMsgs,
            { id: `msg-${Date.now()}`, sender: 'user', text: text.trim(), source: 'client', timestamp: new Date().toISOString() },
            { id: `msg-${Date.now()}-reply`, sender: 'bot', text: replyMsg.text, type: replyMsg.type, options: replyMsg.options, source: replyMsg.source, timestamp: new Date().toISOString() }
          ];
          localStorage.setItem(`chat-${active.id}-${threadId}`, JSON.stringify(updated));
        }
        loadFromLocalBackup();
      }

    } catch (err) {
      console.error('handleSend unexpected error:', err);
    } finally {
      setOptimisticMsgs([]);
      setIsTyping(false);
    }
  }

  async function clearHistory() {
    try {
      const backupStr = localStorage.getItem('chat_threads') || '{}';
      const backup = JSON.parse(backupStr);
      delete backup[threadId];
      localStorage.setItem('chat_threads', JSON.stringify(backup));
    } catch (err) {
      console.error('Failed to clear local backup:', err);
    }

    if (isFirebaseConfigured) {
      const fbUser = auth.currentUser;
      if (!fbUser) return;
      const path = `users/${fbUser.uid}/threads/${threadId}/messages`;
      const colRef = collection(db, path);
      try {
        const docsSnap = await getDocs(colRef);
        for (const d of docsSnap.docs) {
          await deleteDoc(doc(db, path, d.id));
        }
      } catch (err) {
        console.warn('Failed to delete messages in Firestore:', err.message);
      }
      setMessages([]);
    } else {
      const active = JSON.parse(localStorage.getItem('nb_mock_active'));
      if (active) {
        localStorage.removeItem(`chat-${active.id}-${threadId}`);
        setMessages([]);
      }
    }
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.headerTitle}>FoodieBite AI</Text>
              <View style={styles.onlineIndicator} />
            </View>
            <Text style={styles.headerSubtitle}>Online · AI Food & Nutrition Assistant</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearHistory} style={{ padding: 6 }}>
          <Trash2 size={16} color="#6f7785" />
        </TouchableOpacity>
      </View>

      {/* Threads Selector Bar */}
      <View style={styles.threadsBar}>
        <Text style={styles.threadsLabel}>Sessions:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {threads.map(t => {
            const isSelected = threadId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => changeThread(t.id)}
                style={[
                  styles.threadChip,
                  isSelected ? { backgroundColor: 'rgba(255,107,53,0.12)', borderColor: C.orange } : { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: C.border }
                ]}
              >
                <Text style={[styles.threadChipText, isSelected ? { color: C.orange } : { color: C.muted }]}>{t.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          onPress={createNewThread}
          style={styles.newThreadBtn}
        >
          <Plus size={12} color={C.orange} style={{ marginRight: 2 }} />
          <Text style={styles.newThreadText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Main Chat Panel */}
      <View style={styles.chatPanel}>
        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 14 }}
        >
          {displayedMessages.length === 0 ? (
            <View style={styles.welcomeBox}>
              <View style={styles.welcomeIconContainer}>
                <Bot size={40} color={C.orange} />
              </View>
              <Text style={styles.welcomeTitle}>Welcome to FoodieBite AI!</Text>
              <Text style={styles.welcomeDesc}>
                Ask me anything about macros, recipes, meal plans, or food choices tailored to your preferences!
              </Text>
            </View>
          ) : null}

          {displayedMessages.map(m => {
            const isBot = m.sender !== 'user';
            const isError = m.type === 'error' || m.source === 'foodiebite_ai_error';

            return (
              <View key={m.id} style={[styles.messageRow, isBot ? { flexDirection: 'row' } : { flexDirection: 'row-reverse' }]}>
                <View style={[styles.msgAvatarWrap, isBot ? { backgroundColor: 'rgba(255,107,53,0.12)', borderColor: 'rgba(255,107,53,0.2)' } : { backgroundColor: '#20242c', borderColor: C.border }]}>
                  {isBot ? (
                    <Image 
                      source={require('../assets/logo.jpg')}
                      style={{ width: '100%', height: '100%', borderRadius: 14 }}
                    />
                  ) : (
                    <User size={13} color="#ccc" />
                  )}
                </View>

                <View style={[
                  styles.msgBubble,
                  isBot 
                    ? (isError 
                        ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', borderTopLeftRadius: 0 } 
                        : { backgroundColor: '#171a20', borderColor: C.border, borderTopLeftRadius: 0 }) 
                    : { backgroundColor: C.orange, borderColor: C.orange, borderTopRightRadius: 0 }
                ]}>
                  {isBot ? (
                    <View style={[
                      styles.sourceBadge,
                      { 
                        backgroundColor: isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        borderColor: isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                      }
                    ]}>
                      <Text style={[styles.sourceBadgeText, { color: isError ? '#ef4444' : '#10b981' }]}>
                        {isError ? 'FoodieBite AI Error' : 'FoodieBite AI'}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.msgText, isError ? { color: '#fca5a5' } : null]}>{m.text}</Text>
                  {m.time ? (
                    <Text style={[styles.msgTime, isBot ? { color: '#6f7785' } : { color: 'rgba(255,255,255,0.7)' }]}>
                      {m.time}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={styles.msgAvatarWrap}>
                <Image 
                  source={require('../assets/logo.jpg')}
                  style={{ width: '100%', height: '100%', borderRadius: 14 }}
                />
              </View>
              <View style={styles.typingBubble}>
                <AnimatedDot delay={100} />
                <AnimatedDot delay={200} />
                <AnimatedDot delay={300} />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Suggestion Prompts */}
        {displayedMessages.length === 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Sparkles size={11} color={C.orange} />
              <Text style={styles.commonQuestionsText}>Common Questions</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {QUICK_PROMPTS.map(p => (
                <TouchableOpacity 
                  key={p} 
                  onPress={() => handleSend(p)}
                  style={styles.promptChip}
                >
                  <Text style={styles.promptChipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Dynamic Dropdown / Option UI */}
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
                    setQueryText(val);
                  }}
                  disabled={isTyping}
                  style={{
                    flex: 1,
                    backgroundColor: '#1b1f26',
                    color: '#fff',
                    borderColor: 'rgba(255,107,53,0.3)',
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 13,
                    outline: 'none'
                  }}
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
                  const toSend = selectedOption || queryText;
                  if (toSend) {
                    handleSend(toSend);
                  }
                }}
                disabled={(!selectedOption && !queryText.trim()) || isTyping}
                style={[
                  styles.enterOptionBtn,
                  (selectedOption || queryText.trim()) ? { backgroundColor: C.orange } : { backgroundColor: 'rgba(255,255,255,0.05)' }
                ]}
              >
                <Text style={[styles.enterOptionBtnText, (selectedOption || queryText.trim()) ? { color: '#fff' } : { color: '#666' }]}>
                  Enter ↵
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.optionsChipGrid}>
              {currentOptions.map((opt, idx) => {
                const isSelected = selectedOption === opt.value || queryText === opt.value;
                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={isTyping}
                    onPress={() => {
                      setSelectedOption(opt.value);
                      setQueryText(opt.value);
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

        {/* Message Input Box */}
        <View style={styles.inputBox}>
          <View style={styles.inputContainer}>
            <TextInput 
              placeholder="Ask anything (e.g. oats recipe, healthy snack)..."
              placeholderTextColor="#666"
              value={queryText}
              onChangeText={(txt) => {
                setQueryText(txt);
                if (selectedOption && txt !== selectedOption) {
                  setSelectedOption('');
                }
              }}
              editable={!isTyping}
              onSubmitEditing={() => {
                if (isTyping) return;
                const toSend = selectedOption || queryText;
                if (toSend && toSend.trim()) {
                  handleSend(toSend);
                }
              }}
              style={[styles.textInput, isTyping ? { opacity: 0.6 } : null]}
            />
            <TouchableOpacity 
              onPress={() => {
                if (isTyping) return;
                const toSend = selectedOption || queryText;
                if (toSend && toSend.trim()) {
                  handleSend(toSend);
                }
              }}
              disabled={(!queryText.trim() && !selectedOption) || isTyping}
              style={[
                styles.sendBtn,
                (queryText.trim() || selectedOption) && !isTyping ? { backgroundColor: C.orange } : { backgroundColor: 'rgba(255,255,255,0.03)' }
              ]}
            >
              <Send size={15} color={(queryText.trim() || selectedOption) && !isTyping ? '#fff' : '#444'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppLayout>
  );
}


const styles = StyleSheet.create({
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
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    overflow: 'hidden',
  },
  headerLogo: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  onlineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  headerSubtitle: {
    fontSize: 10,
    color: C.muted,
  },
  threadsBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  threadsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  threadChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  threadChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  newThreadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.orange,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
  },
  newThreadText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '700',
  },
  fallbackBanner: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderBottomWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fallbackBannerText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  chatPanel: {
    flex: 1,
    backgroundColor: '#111318',
  },
  welcomeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    opacity: 0.8,
  },
  welcomeIconContainer: {
    backgroundColor: 'rgba(255,107,53,0.1)',
    padding: 20,
    borderRadius: 40,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  welcomeDesc: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  msgAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  msgBubble: {
    maxWidth: '75%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#fff',
  },
  msgTime: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  typingBubble: {
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    borderTopLeftRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
  },
  commonQuestionsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6f7785',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: C.border,
  },
  promptChipText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: '#111318',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#171a20',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 8,
    alignItems: 'center',
    height: 48,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    borderRadius: 10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#15181e',
    borderTopWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    gap: 8,
  },
  optionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff6b35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enterOptionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterOptionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionsChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionChipText: {
    fontSize: 12,
  },
});
