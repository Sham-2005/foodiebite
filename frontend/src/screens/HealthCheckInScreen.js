import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Activity,
  Heart,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Droplet,
  Moon,
  Zap,
  Apple,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Save,
  Send,
  ArrowRight,
  Compass,
  FileText
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { C, BackHeader, BtnOrange } from '../components/UI';
import {
  apiStartCheckin,
  apiGetCurrentCheckinDraft,
  apiSaveCheckinAnswers,
  apiGetCheckinFollowUps,
  apiCompleteCheckin,
  apiGetCheckinHistory,
  apiGetCheckinDetails,
  apiGetPersonalWellnessTrends
} from '../services/api';

const THEME = {
  bg: '#111318',
  card: '#1A1D24',
  cardActive: '#222732',
  border: '#2D3442',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  accent: '#FF6B35',
  accentLight: 'rgba(255, 107, 53, 0.12)',
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.12)',
  info: '#38BDF8',
  infoLight: 'rgba(56, 189, 248, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)'
};

export default function HealthCheckInScreen() {
  const navigation = useNavigation();
  const { user } = useApp();

  // Navigation tab state: 'overview' | 'survey' | 'history'
  const [activeTab, setActiveTab] = useState('overview');

  // Loading & refreshing states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingFollowUps, setGeneratingFollowUps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null); // { type: 'success' | 'error', text }

  // Survey state
  const [checkinId, setCheckinId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [followUpQuestions, setFollowUpQuestions] = useState([]);
  const [surveyStep, setSurveyStep] = useState(1); // 1 = Standard Questions, 2 = AI Follow-ups, 3 = Completed Analysis
  const [latestAnalysis, setLatestAnalysis] = useState(null);

  // History & Trends state
  const [historyList, setHistoryList] = useState([]);
  const [trendData, setTrendData] = useState(null);
  const [expandedCheckinId, setExpandedCheckinId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});

  // Show Toast Helper
  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Load Overview & Draft on Mount ──────────────────────────────
  const loadCheckinData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch History
      const histRes = await apiGetCheckinHistory(10);
      if (histRes && histRes.history) {
        setHistoryList(histRes.history);
      }

      // 2. Fetch Personal Trends
      const trendRes = await apiGetPersonalWellnessTrends();
      if (trendRes && trendRes.trends) {
        setTrendData(trendRes.trends);
      }

      // 3. Fetch Active Draft
      const draftRes = await apiGetCurrentCheckinDraft();
      if (draftRes && draftRes.hasDraft && draftRes.draft) {
        setCheckinId(draftRes.draft.id);
        if (draftRes.questions) setQuestions(draftRes.questions);
        if (draftRes.answers) setAnswers(draftRes.answers);
      } else if (histRes?.history?.[0]?.id) {
        // Load latest analysis for overview display
        const latestDetail = await apiGetCheckinDetails(histRes.history[0].id);
        if (latestDetail?.analysis) {
          setLatestAnalysis(latestDetail.analysis);
        }
      }
    } catch (err) {
      console.warn('loadCheckinData note:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCheckinData();
  }, [loadCheckinData]);

  // ── Start / Resume Survey ───────────────────────────────────────
  const handleStartSurvey = async () => {
    try {
      setLoading(true);
      const res = await apiStartCheckin();
      if (res && res.checkin) {
        setCheckinId(res.checkin.id);
        setQuestions(res.questions || []);
        setAnswers(res.answers || {});
        setSurveyStep(1);
        setActiveTab('survey');
        showToast(res.isResumedDraft ? 'Resumed active draft check-in.' : 'New check-in started!');
      }
    } catch (err) {
      showToast(err.message || 'Failed to start check-in', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Answer Input Change ───────────────────────────────────
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // ── Multi-select goal toggle ────────────────────────────────────
  const toggleGoalSelection = (questionId, goalOption) => {
    setAnswers(prev => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const exists = current.includes(goalOption);
      const updated = exists ? current.filter(g => g !== goalOption) : [...current, goalOption];
      return { ...prev, [questionId]: updated };
    });
  };

  // ── Save Draft ──────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!checkinId) return;
    try {
      setSavingDraft(true);
      await apiSaveCheckinAnswers(checkinId, answers);
      showToast('Draft saved successfully! You can resume anytime.');
    } catch (err) {
      showToast(err.message || 'Failed to save draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Proceed to Dynamic Follow-ups Step ──────────────────────────
  const handleProceedToFollowUps = async () => {
    if (!checkinId) return;
    try {
      setGeneratingFollowUps(true);
      // Save current answers first
      await apiSaveCheckinAnswers(checkinId, answers);

      // Query local Ollama for dynamic follow-ups
      const res = await apiGetCheckinFollowUps(checkinId, answers, {
        diet: user?.dietType,
        goals: user?.preferences?.healthGoals
      });

      if (res && res.followUpQuestions && res.followUpQuestions.length > 0) {
        setFollowUpQuestions(res.followUpQuestions);
        setSurveyStep(2);
      } else {
        // No clarification needed, proceed straight to completion
        handleFinalSubmit();
      }
    } catch (err) {
      console.warn('handleProceedToFollowUps fallback:', err.message);
      // On failure, don't block user
      handleFinalSubmit();
    } finally {
      setGeneratingFollowUps(false);
    }
  };

  // ── Final Submission & AI Wellness Analysis ──────────────────────
  const handleFinalSubmit = async () => {
    if (!checkinId) return;
    try {
      setSubmitting(true);
      // Save any follow-up answers
      await apiSaveCheckinAnswers(checkinId, answers);

      const res = await apiCompleteCheckin(checkinId, {
        diet: user?.dietType,
        goals: user?.preferences?.healthGoals
      });

      if (res && res.analysis) {
        setLatestAnalysis(res.analysis);
        setSurveyStep(3);
        showToast('Check-in submitted and AI analysis complete!');
        // Refresh history and trends in background
        apiGetCheckinHistory(10).then(h => h?.history && setHistoryList(h.history));
        apiGetPersonalWellnessTrends().then(t => t?.trends && setTrendData(t.trends));
      }
    } catch (err) {
      showToast(err.message || 'Submission failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Expand Historical Check-in Item ──────────────────────────────
  const toggleHistoryItem = async (histId) => {
    if (expandedCheckinId === histId) {
      setExpandedCheckinId(null);
      return;
    }
    setExpandedCheckinId(histId);
    if (!expandedDetails[histId]) {
      try {
        const details = await apiGetCheckinDetails(histId);
        if (details) {
          setExpandedDetails(prev => ({ ...prev, [histId]: details }));
        }
      } catch (e) {
        console.warn('Failed to load check-in details', e);
      }
    }
  };

  // ── Format Helper ────────────────────────────────────────────────
  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return String(isoStr);
    }
  };

  return (
    <AppLayout activeRoute="Profile">
      <View style={styles.container}>
        <BackHeader title="Health Check-in & Insights" onBack={() => navigation.goBack()} />

        {/* Global Toast Banner */}
        {toastMessage && (
          <View style={[
            styles.toastBanner,
            toastMessage.type === 'error' ? styles.toastError : styles.toastSuccess
          ]}>
            {toastMessage.type === 'error' ? (
              <AlertCircle size={16} color="#EF4444" style={{ marginRight: 8 }} />
            ) : (
              <CheckCircle2 size={16} color="#22C55E" style={{ marginRight: 8 }} />
            )}
            <Text style={[
              styles.toastText,
              toastMessage.type === 'error' ? { color: '#FCA5A5' } : { color: '#86EFAC' }
            ]}>
              {toastMessage.text}
            </Text>
          </View>
        )}

        {/* Navigation Tabs Header */}
        <View style={styles.tabsHeader}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color={activeTab === 'overview' ? THEME.accent : THEME.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'survey' && styles.tabBtnActive]}
            onPress={() => {
              if (!checkinId) handleStartSurvey();
              else setActiveTab('survey');
            }}
            activeOpacity={0.8}
          >
            <Activity size={16} color={activeTab === 'survey' ? THEME.accent : THEME.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabBtnText, activeTab === 'survey' && styles.tabBtnTextActive]}>
              {checkinId && surveyStep !== 3 ? 'Active Survey' : 'New Check-in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Clock size={16} color={activeTab === 'history' ? THEME.accent : THEME.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>History & Trends</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.accent} />
            <Text style={styles.loadingText}>Loading health insights...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadCheckinData(); }}
                tintColor={THEME.accent}
              />
            }
          >
            {/* ══════════════════════════════════════════════════════════ */}
            {/* TAB 1: OVERVIEW & INSIGHTS                               */}
            {/* ══════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                {/* Hero Status Card */}
                <View style={styles.heroCard}>
                  <View style={styles.heroHeader}>
                    <View style={styles.iconCircle}>
                      <Activity size={24} color={THEME.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.heroTitle}>FoodieBite Health Insights</Text>
                      <Text style={styles.heroSubtitle}>
                        Weekly self-check-ins analyzed by our local Ollama AI engine
                      </Text>
                    </View>
                    <View style={styles.trendBadge}>
                      <Text style={styles.trendBadgeText}>
                        {latestAnalysis?.trendAssessment || historyList[0]?.trendAssessment || 'Ready'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.heroDivider} />

                  <View style={styles.heroMetaRow}>
                    <View style={styles.heroMetaItem}>
                      <Calendar size={14} color={THEME.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.heroMetaLabel}>Last Check-in:</Text>
                      <Text style={styles.heroMetaValue}>
                        {historyList[0]?.completedAt ? formatDate(historyList[0].completedAt) : 'Never'}
                      </Text>
                    </View>
                    <View style={styles.heroMetaItem}>
                      <CheckCircle2 size={14} color={THEME.success} style={{ marginRight: 4 }} />
                      <Text style={styles.heroMetaLabel}>Total Completed:</Text>
                      <Text style={styles.heroMetaValue}>
                        {historyList.filter(h => h.status === 'completed').length}
                      </Text>
                    </View>
                  </View>

                  {/* Primary CTA */}
                  <TouchableOpacity
                    style={styles.heroCtaBtn}
                    onPress={handleStartSurvey}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.heroCtaText}>
                      {checkinId && surveyStep !== 3 ? 'Resume Active Check-in' : 'Start Health Check-in'}
                    </Text>
                    <ArrowRight size={16} color="#fff" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>

                {/* Latest AI Wellness Insights Card */}
                {latestAnalysis ? (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Sparkles size={18} color={THEME.accent} style={{ marginRight: 8 }} />
                      <Text style={styles.cardTitle}>Latest AI Wellness Analysis</Text>
                    </View>

                    <Text style={styles.wellnessSummaryText}>{latestAnalysis.wellnessSummary}</Text>

                    {/* Positive Trends */}
                    {latestAnalysis.positiveTrends?.length > 0 && (
                      <View style={styles.insightSection}>
                        <Text style={styles.insightSectionTitle}>✅ Positive Observations</Text>
                        {latestAnalysis.positiveTrends.map((t, idx) => (
                          <Text key={idx} style={styles.insightBullet}>• {t}</Text>
                        ))}
                      </View>
                    )}

                    {/* Areas to Monitor */}
                    {latestAnalysis.areasToMonitor?.length > 0 && (
                      <View style={styles.insightSection}>
                        <Text style={[styles.insightSectionTitle, { color: THEME.warning }]}>⚠️ Areas to Monitor</Text>
                        {latestAnalysis.areasToMonitor.map((a, idx) => (
                          <Text key={idx} style={styles.insightBullet}>• {a}</Text>
                        ))}
                      </View>
                    )}

                    {/* Dietary Suggestions */}
                    {latestAnalysis.dietarySuggestions?.length > 0 && (
                      <View style={styles.insightSection}>
                        <Text style={[styles.insightSectionTitle, { color: THEME.info }]}>🥗 FoodieBite Dietary Recommendations</Text>
                        {latestAnalysis.dietarySuggestions.map((s, idx) => (
                          <Text key={idx} style={styles.insightBullet}>• {s}</Text>
                        ))}
                      </View>
                    )}

                    {/* Medical Disclaimer */}
                    <View style={styles.disclaimerBox}>
                      <Text style={styles.disclaimerText}>
                        💡 {latestAnalysis.medicalDisclaimer || 'AI wellness insights are educational based on self-reported survey information. Not a medical diagnosis.'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.cardEmpty}>
                    <Compass size={36} color={THEME.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={styles.cardEmptyTitle}>No Health Check-ins Yet</Text>
                    <Text style={styles.cardEmptyDesc}>
                      Complete your first 2-minute wellness survey whenever you are ready. Our local AI will analyze your energy, sleep, hydration, and diet to provide personalized recommendations!
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* TAB 2: ACTIVE SURVEY FLOW                                */}
            {/* ══════════════════════════════════════════════════════════ */}
            {activeTab === 'survey' && (
              <View style={styles.tabContent}>
                {surveyStep === 1 && (
                  <View>
                    {/* Survey Top Action Bar */}
                    <View style={styles.surveyActionBar}>
                      <View>
                        <Text style={styles.surveyTitle}>Health & Wellness Survey</Text>
                        <Text style={styles.surveySubtitle}>Answer honestly; symptom questions are optional.</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.saveDraftBtn}
                        onPress={handleSaveDraft}
                        disabled={savingDraft}
                        activeOpacity={0.8}
                      >
                        {savingDraft ? (
                          <ActivityIndicator size="small" color={THEME.accent} />
                        ) : (
                          <>
                            <Save size={14} color={THEME.accent} style={{ marginRight: 4 }} />
                            <Text style={styles.saveDraftText}>Save Draft</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Questions List */}
                    {questions.map((q, idx) => (
                      <View key={q.id || idx} style={styles.questionCard}>
                        <View style={styles.questionHeader}>
                          <Text style={styles.questionNumber}>Question {idx + 1}</Text>
                          {q.is_optional && (
                            <View style={styles.optionalBadge}>
                              <Text style={styles.optionalBadgeText}>Optional</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.questionText}>{q.question_text || q.text}</Text>

                        {/* Rating (1-5) */}
                        {q.question_type === 'rating' && (
                          <View style={styles.ratingRow}>
                            {[1, 2, 3, 4, 5].map(num => {
                              const isSelected = String(answers[q.id]) === String(num);
                              return (
                                <TouchableOpacity
                                  key={num}
                                  style={[styles.ratingChip, isSelected && styles.ratingChipActive]}
                                  onPress={() => handleAnswerChange(q.id, num)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.ratingChipText, isSelected && styles.ratingChipTextActive]}>
                                    {num}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Single Choice Options */}
                        {q.question_type === 'single_choice' && Array.isArray(q.options) && (
                          <View style={styles.optionsWrap}>
                            {q.options.map((opt, oIdx) => {
                              const isSelected = answers[q.id] === opt;
                              return (
                                <TouchableOpacity
                                  key={oIdx}
                                  style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                  onPress={() => handleAnswerChange(q.id, opt)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                    {opt}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Multiple Choice (Goals) */}
                        {q.question_type === 'multiple_choice' && Array.isArray(q.options) && (
                          <View style={styles.optionsWrap}>
                            {q.options.map((opt, oIdx) => {
                              const currentSelected = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                              const isSelected = currentSelected.includes(opt);
                              return (
                                <TouchableOpacity
                                  key={oIdx}
                                  style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                  onPress={() => toggleGoalSelection(q.id, opt)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                    {isSelected ? '✓ ' : ''}{opt}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Numeric Input */}
                        {q.question_type === 'number' && (
                          <View style={styles.optionsWrap}>
                            {(q.options && q.options.length > 0 ? q.options : ['5', '6', '7', '8', '9', '10']).map((num, nIdx) => {
                              const isSelected = String(answers[q.id]) === String(num);
                              return (
                                <TouchableOpacity
                                  key={nIdx}
                                  style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                  onPress={() => handleAnswerChange(q.id, num)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                    {num}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Free Text Input */}
                        {q.question_type === 'text' && (
                          <TextInput
                            style={styles.textInput}
                            placeholder="Type optional notes or observations..."
                            placeholderTextColor={THEME.textMuted}
                            value={answers[q.id] || ''}
                            onChangeText={val => handleAnswerChange(q.id, val)}
                            multiline
                            numberOfLines={3}
                          />
                        )}
                      </View>
                    ))}

                    {/* Proceed CTA */}
                    <TouchableOpacity
                      style={styles.submitSurveyBtn}
                      onPress={handleProceedToFollowUps}
                      disabled={generatingFollowUps}
                      activeOpacity={0.85}
                    >
                      {generatingFollowUps ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.submitSurveyText}>Analyze & Continue</Text>
                          <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 2: Dynamic Ollama Follow-ups */}
                {surveyStep === 2 && (
                  <View>
                    <View style={styles.followUpHeaderCard}>
                      <Sparkles size={22} color={THEME.accent} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.followUpHeaderTitle}>AI Clarification Questions</Text>
                        <Text style={styles.followUpHeaderSubtitle}>
                          Our local Ollama AI generated 1-2 targeted follow-ups based on your answers. You may answer or skip them.
                        </Text>
                      </View>
                    </View>

                    {followUpQuestions.map((fq, fIdx) => (
                      <View key={fq.id || fIdx} style={styles.questionCard}>
                        <View style={styles.questionHeader}>
                          <Text style={styles.questionNumber}>Clarification #{fIdx + 1}</Text>
                          <View style={[styles.optionalBadge, { backgroundColor: THEME.accentLight }]}>
                            <Text style={[styles.optionalBadgeText, { color: THEME.accent }]}>AI Follow-up</Text>
                          </View>
                        </View>
                        <Text style={styles.questionText}>{fq.question_text}</Text>

                        <View style={styles.optionsWrap}>
                          {(fq.options || ['Often', 'Occasionally', 'Rarely', 'Not sure']).map((opt, oIdx) => {
                            const isSelected = answers[fq.id] === opt;
                            return (
                              <TouchableOpacity
                                key={oIdx}
                                style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                onPress={() => handleAnswerChange(fq.id, opt)}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}

                    {/* Final Submission Buttons */}
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                      <TouchableOpacity
                        style={[styles.skipBtn, { flex: 1 }]}
                        onPress={handleFinalSubmit}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.skipBtnText}>Skip Follow-ups</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.submitSurveyBtn, { flex: 2, marginTop: 0 }]}
                        onPress={handleFinalSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.submitSurveyText}>Complete & Submit</Text>
                            <CheckCircle2 size={18} color="#fff" style={{ marginLeft: 8 }} />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Step 3: Completed & Analyzed View */}
                {surveyStep === 3 && latestAnalysis && (
                  <View style={styles.card}>
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <CheckCircle2 size={48} color={THEME.success} style={{ marginBottom: 12 }} />
                      <Text style={[styles.cardTitle, { fontSize: 20, textAlign: 'center' }]}>
                        Check-in Completed Successfully!
                      </Text>
                      <Text style={{ color: THEME.textMuted, fontSize: 13, marginTop: 4 }}>
                        Your responses have been saved and analyzed permanently.
                      </Text>
                    </View>

                    <View style={styles.heroDivider} />

                    <Text style={styles.wellnessSummaryText}>{latestAnalysis.wellnessSummary}</Text>

                    {/* Suggestions */}
                    {latestAnalysis.dietarySuggestions?.length > 0 && (
                      <View style={styles.insightSection}>
                        <Text style={[styles.insightSectionTitle, { color: THEME.info }]}>
                          🥗 FoodieBite Tailored Dietary Guidance
                        </Text>
                        {latestAnalysis.dietarySuggestions.map((s, idx) => (
                          <Text key={idx} style={styles.insightBullet}>• {s}</Text>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.heroCtaBtn, { marginTop: 20 }]}
                      onPress={() => setActiveTab('overview')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.heroCtaText}>Return to Overview</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* TAB 3: HISTORY & TRENDS                                  */}
            {/* ══════════════════════════════════════════════════════════ */}
            {activeTab === 'history' && (
              <View style={styles.tabContent}>
                {/* Trend Summary Card */}
                {trendData?.trendRecord?.trend_summary && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <TrendingUp size={18} color={THEME.accent} style={{ marginRight: 8 }} />
                      <Text style={styles.cardTitle}>Historical Wellness Progression</Text>
                    </View>
                    <Text style={styles.wellnessSummaryText}>{trendData.trendRecord.trend_summary}</Text>
                  </View>
                )}

                {/* Timeline Metrics progression */}
                {trendData?.timeline?.length > 0 && (
                  <View style={styles.card}>
                    <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Key Metrics Over Time</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {trendData.timeline.map((entry, idx) => (
                        <View key={idx} style={styles.timelineMetricCard}>
                          <Text style={styles.timelineDate}>{formatDate(entry.date)}</Text>
                          <View style={styles.metricRow}>
                            <Zap size={14} color={THEME.accent} />
                            <Text style={styles.metricLabel}>Energy: {entry.energyLevel}/5</Text>
                          </View>
                          <View style={styles.metricRow}>
                            <Moon size={14} color={THEME.info} />
                            <Text style={styles.metricLabel}>Sleep: {entry.sleepHours}h</Text>
                          </View>
                          <View style={styles.metricRow}>
                            <Droplet size={14} color={THEME.info} />
                            <Text style={styles.metricLabel}>Water: {entry.waterLiters}L</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Previous Submissions List */}
                <Text style={[styles.sectionHeading, { marginTop: 12 }]}>Previous Submissions</Text>

                {historyList.length === 0 ? (
                  <View style={styles.cardEmpty}>
                    <Text style={styles.cardEmptyTitle}>No historical check-ins found</Text>
                  </View>
                ) : (
                  historyList.map(item => {
                    const isExpanded = expandedCheckinId === item.id;
                    const details = expandedDetails[item.id];
                    return (
                      <View key={item.id} style={styles.historyCard}>
                        <TouchableOpacity
                          style={styles.historyCardHeader}
                          onPress={() => toggleHistoryItem(item.id)}
                          activeOpacity={0.8}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyDate}>{formatDate(item.completedAt || item.startedAt)}</Text>
                            <Text style={styles.historySummaryText} numberOfLines={isExpanded ? 0 : 2}>
                              {item.wellnessSummary}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                            <View style={styles.trendBadge}>
                              <Text style={styles.trendBadgeText}>{item.trendAssessment || 'Stable'}</Text>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={16} color={THEME.textMuted} style={{ marginTop: 8 }} />
                            ) : (
                              <ChevronDown size={16} color={THEME.textMuted} style={{ marginTop: 8 }} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Expanded Question & Answer View */}
                        {isExpanded && (
                          <View style={styles.historyExpandedContent}>
                            <View style={styles.heroDivider} />
                            {details?.questions ? (
                              details.questions.map((q, qIdx) => (
                                <View key={q.id || qIdx} style={styles.historyQRow}>
                                  <Text style={styles.historyQLabel}>{q.text}</Text>
                                  <Text style={styles.historyQAnswer}>
                                    {q.userAnswer ? (Array.isArray(q.userAnswer) ? q.userAnswer.join(', ') : String(q.userAnswer)) : 'Not answered'}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <ActivityIndicator size="small" color={THEME.accent} />
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8
  },
  toastSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22C55E',
    borderWidth: 1
  },
  toastError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1
  },
  toastText: {
    fontSize: 13,
    fontWeight: '500'
  },
  tabsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    gap: 8
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.card
  },
  tabBtnActive: {
    backgroundColor: THEME.accentLight,
    borderWidth: 1,
    borderColor: THEME.accent
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textMuted
  },
  tabBtnTextActive: {
    color: THEME.accent
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  tabContent: {
    gap: 16
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  loadingText: {
    color: THEME.textMuted,
    fontSize: 14,
    marginTop: 12
  },
  heroCard: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.accentLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary
  },
  heroSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2
  },
  trendBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8'
  },
  heroDivider: {
    height: 1,
    backgroundColor: THEME.border,
    marginVertical: 14
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  heroMetaLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    marginRight: 4
  },
  heroMetaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textPrimary
  },
  heroCtaBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroCtaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary
  },
  wellnessSummaryText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20
  },
  insightSection: {
    marginTop: 12
  },
  insightSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.success,
    marginBottom: 6
  },
  insightBullet: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
    marginLeft: 4
  },
  disclaimerBox: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10
  },
  disclaimerText: {
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
    lineHeight: 16
  },
  cardEmpty: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border
  },
  cardEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6
  },
  cardEmptyDesc: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 18
  },
  surveyActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  surveyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary
  },
  surveySubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2
  },
  saveDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.accentLight,
    borderWidth: 1,
    borderColor: THEME.accent
  },
  saveDraftText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent
  },
  questionCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 14
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.accent
  },
  optionalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.15)'
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 12,
    lineHeight: 20
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  ratingChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.cardActive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border
  },
  ratingChipActive: {
    backgroundColor: THEME.accent,
    borderColor: THEME.accent
  },
  ratingChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary
  },
  ratingChipTextActive: {
    color: '#fff'
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.cardActive,
    borderWidth: 1,
    borderColor: THEME.border
  },
  optionChipActive: {
    backgroundColor: THEME.accentLight,
    borderColor: THEME.accent
  },
  optionChipText: {
    fontSize: 12,
    color: THEME.textSecondary
  },
  optionChipTextActive: {
    color: THEME.accent,
    fontWeight: '600'
  },
  textInput: {
    backgroundColor: THEME.cardActive,
    borderRadius: 8,
    padding: 10,
    color: THEME.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 64,
    textAlignVertical: 'top'
  },
  submitSurveyBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  submitSurveyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff'
  },
  skipBtn: {
    backgroundColor: THEME.cardActive,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMuted
  },
  followUpHeaderCard: {
    flexDirection: 'row',
    backgroundColor: THEME.cardActive,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 16
  },
  followUpHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textPrimary
  },
  followUpHeaderSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8
  },
  timelineMetricCard: {
    width: 140,
    backgroundColor: THEME.cardActive,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.border
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
    marginBottom: 6
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.textSecondary
  },
  historyCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
    overflow: 'hidden'
  },
  historyCardHeader: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center'
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4
  },
  historySummaryText: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16
  },
  historyExpandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14
  },
  historyQRow: {
    marginBottom: 8
  },
  historyQLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted
  },
  historyQAnswer: {
    fontSize: 13,
    color: THEME.textPrimary,
    marginTop: 2
  }
});
