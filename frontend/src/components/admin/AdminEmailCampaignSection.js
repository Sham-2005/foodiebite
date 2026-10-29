import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal
} from 'react-native';
import {
  Mail,
  Send,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  Save,
  Filter,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  Inbox,
  FileText,
  ChevronDown,
  Info,
  X,
  Calendar
} from 'lucide-react-native';
import { C } from '../UI';
import {
  apiGetEmailStatus,
  apiSendTestEmail,
  apiEvaluateRecipients,
  apiGetEmailCampaigns,
  apiCreateEmailCampaign,
  apiStartEmailCampaign,
  apiGetExistingUserWelcomeDraft,
  apiRetryCampaign,
  apiGetDailyRecommendationsStatus,
  apiUpdateDailyRecommendationsConfig,
  apiTriggerDailyRecommendations,
  apiSendTestDailyRecommendation,
  apiRetryDailyRecommendations,
  apiGetDailyRecommendationsPreview
} from '../../services/api';

const DEFAULT_TEMPLATES = {
  existingUserWelcome: {
    name: '🎉 Welcome Back (Existing Users)',
    subject: 'Welcome to FoodieBite – Discover Food That Fits You!',
    html: `
<h2 style="color: #ffffff; margin-top: 0; font-size: 18px;">Welcome to FoodieBite! 🍽️</h2>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  Thank you for being part of the <strong>FoodieBite</strong> community! We are excited to help you discover food that fits your lifestyle, dietary goals, and flavor cravings.
</p>
<div style="background-color: rgba(255, 107, 53, 0.08); border-left: 3px solid #FF6B35; padding: 14px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0; color: #FF6B35; font-weight: bold; font-size: 14px;">Here is what FoodieBite offers you:</p>
  <ul style="margin: 0; padding-left: 18px; color: #e2e8f0; font-size: 13px; line-height: 1.7;">
    <li><strong>Personalized Meal Recommendations:</strong> Smart dish suggestions tailored directly to your unique taste.</li>
    <li><strong>Dietary Preferences:</strong> Vegetarian, Vegan, Keto, Eggetarian, and Non-Vegetarian filtering made effortless.</li>
    <li><strong>Seasonal & Fresh Suggestions:</strong> Timely culinary inspirations matching the best seasonal ingredients.</li>
    <li><strong>Spice Preferences:</strong> Find dishes precisely matched to your preferred heat level, from Mild to Extra Spicy.</li>
    <li><strong>Health & Wellness Goals:</strong> Balance calories, macros, and nutrition effortlessly toward your fitness targets.</li>
  </ul>
</div>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
  Log in now to update your profile preferences, explore trending nearby restaurants, or discover your next favorite healthy meal!
</p>
    `,
    text: `Welcome to FoodieBite – Discover Food That Fits You!

Thank you for being part of the FoodieBite community! We are excited to help you discover food that fits your lifestyle.

Here is what FoodieBite offers you:
- Personalized Meal Recommendations: Smart dish suggestions tailored directly to your unique taste.
- Dietary Preferences: Vegetarian, Vegan, Keto, Eggetarian, and Non-Vegetarian filtering made effortless.
- Seasonal & Fresh Suggestions: Timely culinary inspirations matching the best seasonal ingredients.
- Spice Preferences: Find dishes precisely matched to your preferred heat level.
- Health & Wellness Goals: Balance calories, macros, and nutrition effortlessly toward your fitness targets.

Visit FoodieBite today to update your preferences and explore delicious meals!`
  },
  announcement: {
    name: '🌟 New Feature Announcement',
    subject: '🍏 Introducing New Healthy Dining Features on FoodieBite',

    html: `
<h2 style="color: #ffffff; margin-top: 0; font-size: 18px;">Exciting New Features are Here! 🚀</h2>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  We are thrilled to roll out significant updates to your <strong>FoodieBite</strong> dashboard! Our mission is to make mindful eating seamless, delicious, and tailored directly to your lifestyle.
</p>
<div style="background-color: rgba(255, 107, 53, 0.08); border-left: 3px solid #FF6B35; padding: 14px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 6px 0; color: #FF6B35; font-weight: bold; font-size: 14px;">What's New in this Release:</p>
  <ul style="margin: 0; padding-left: 18px; color: #e2e8f0; font-size: 13px; line-height: 1.6;">
    <li><strong>Smart Nearby Discovery:</strong> Find health-conscious restaurants around you mapped to your exact dietary lifestyle.</li>
    <li><strong>Biomarker Lab Insights:</strong> Receive biomarker-aligned nutritional guidance straight from your lab tests.</li>
    <li><strong>Expanded Dish Nutrition Scanner:</strong> Instant macronutrient breakdown for over 100,000 foods.</li>
  </ul>
</div>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
  Log in to your account today to experience the updated recommendations. We can't wait to hear your feedback!
</p>
    `,
    text: 'Exciting new features are here on FoodieBite! Smart Nearby Discovery, Biomarker Lab Insights, and Expanded Dish Nutrition Scanner. Visit FoodieBite today!'
  },
  nutrition: {
    name: '🥗 Seasonal Nutrition & Wellness Tip',
    subject: '🌿 Your Seasonal Wellness Guide: Balancing Nutrients Effortlessly',
    html: `
<h2 style="color: #ffffff; margin-top: 0; font-size: 18px;">Fuel Your Body with Balanced Nutrition 🥗</h2>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  Eating healthy doesn't mean restricting your favorite meals. It's all about balancing micronutrients, fiber, and clean protein sources tailored to your personal goals.
</p>
<div style="background-color: rgba(16, 185, 129, 0.08); border-left: 3px solid #10B981; padding: 14px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0 0 6px 0; color: #10B981; font-weight: bold; font-size: 14px;">Nutritionist Tip of the Week:</p>
  <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.6;">
    Incorporate colorful seasonal greens and whole grains into your lunch to maintain stable energy levels and curb afternoon sugar cravings.
  </p>
</div>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
  Check your FoodieBite meal feed for healthy swaps customized to your dietary profile!
</p>
    `,
    text: 'Fuel your body with balanced nutrition! Check your FoodieBite meal feed for healthy swaps customized to your dietary profile.'
  },
  community: {
    name: '🍎 Community & Health Milestone',
    subject: '🎉 Celebrating Your Healthy Journey with FoodieBite',
    html: `
<h2 style="color: #ffffff; margin-top: 0; font-size: 18px;">Thank You for Being Part of Our Community! 💚</h2>
<p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
  Every healthy choice you make is a milestone worth celebrating. Together, our community has explored thousands of nutritious meals, logged wellness goals, and built lifelong healthy habits.
</p>
<div style="background-color: rgba(56, 189, 248, 0.08); border-left: 3px solid #38BDF8; padding: 14px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.6;">
    "Small daily improvements over time lead to stunning results." Keep exploring, stay curious, and nourish your potential!
  </p>
</div>
<p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
  Have suggestions or ideas for new recipes? Reply to this email or drop us a note in the feedback tab.
</p>
    `,
    text: 'Thank you for being part of the FoodieBite community! Keep exploring, stay curious, and nourish your potential.'
  }
};

export default function AdminEmailCampaignSection({ users = [], onRefreshUsers }) {
  // Sub-tabs: 'dashboard' | 'compose'
  const [subTab, setSubTab] = useState('dashboard');

  // Live Brevo Status & Quota
  const [emailStatus, setEmailStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Campaign History
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Form Compose States
  const [campaignName, setCampaignName] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [senderName, setSenderName] = useState('FoodieBite');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('announcement');
  const [htmlContent, setHtmlContent] = useState(DEFAULT_TEMPLATES.announcement.html);
  const [textContent, setTextContent] = useState(DEFAULT_TEMPLATES.announcement.text);

  // Recipient Selection States
  const [recipientType, setRecipientType] = useState('all'); // 'all', 'dietType', 'spiceLevel', 'healthGoals', 'selected'
  const [selectedDiet, setSelectedDiet] = useState('Vegetarian');
  const [selectedSpice, setSelectedSpice] = useState('Medium');
  const [selectedGoal, setSelectedGoal] = useState('Healthy Eating');
  const [selectedUserEmails, setSelectedUserEmails] = useState([]);
  const [userSearchText, setUserSearchText] = useState('');

  // Evaluation & Recipient Counts
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);

  // Test Email States
  const [testEmailAddress, setTestEmailAddress] = useState('foodiebite881@gmail.com');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Modal Dialogs
  const [previewVisible, setPreviewVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [dispatchingCampaign, setDispatchingCampaign] = useState(false);

  const [welcomeCampaignDraft, setWelcomeCampaignDraft] = useState(null);
  const [retryingCampaignId, setRetryingCampaignId] = useState(null);

  // ── Daily Personalized Recommendations Automation States ────
  const [dailyStatus, setDailyStatus] = useState(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyTestEmail, setDailyTestEmail] = useState('foodiebite881@gmail.com');
  const [sendingDailyTest, setSendingDailyTest] = useState(false);
  const [triggeringDaily, setTriggeringDaily] = useState(false);
  const [customCronInput, setCustomCronInput] = useState('0 9 * * *');
  const [savingDailySchedule, setSavingDailySchedule] = useState(false);
  const [retryingDailyRunId, setRetryingDailyRunId] = useState(null);
  const [dailyPreviewModalVisible, setDailyPreviewModalVisible] = useState(false);
  const [dailyPreviewData, setDailyPreviewData] = useState(null);
  const [loadingDailyPreview, setLoadingDailyPreview] = useState(false);

  // Load Status, Draft, and Campaign History on Mount
  const loadEmailData = async () => {
    setLoadingStatus(true);
    setLoadingCampaigns(true);
    setLoadingDaily(true);
    try {
      const [st, camps, draftRes, dailyRes] = await Promise.all([
        apiGetEmailStatus().catch(e => ({ success: false, error: e.message })),
        apiGetEmailCampaigns({ limit: 50 }).catch(e => ({ success: true, campaigns: [] })),
        apiGetExistingUserWelcomeDraft().catch(e => ({ success: false, error: e.message })),
        apiGetDailyRecommendationsStatus().catch(e => ({ success: false, error: e.message }))
      ]);
      if (st) setEmailStatus(st);
      if (dailyRes && dailyRes.success) {
        setDailyStatus(dailyRes);
        if (dailyRes.cron) setCustomCronInput(dailyRes.cron);
      }
      let campList = camps?.campaigns || [];
      if (draftRes?.campaign) {
        setWelcomeCampaignDraft(draftRes.campaign);
        if (!campList.some(c => c.campaignId === draftRes.campaign.campaignId)) {
          campList = [draftRes.campaign, ...campList];
        }
      }
      setCampaigns(campList);
    } catch (err) {
      console.warn('Error loading email status:', err.message);
    } finally {
      setLoadingStatus(false);
      setLoadingCampaigns(false);
      setLoadingDaily(false);
    }
  };

  const handleToggleDailyAutomation = async () => {
    const nextState = !dailyStatus?.enabled;
    setSavingDailySchedule(true);
    try {
      const res = await apiUpdateDailyRecommendationsConfig({
        enabled: nextState,
        cron: dailyStatus?.cron || '0 9 * * *',
        timezone: 'Asia/Kolkata'
      });
      setDailyStatus(prev => ({ ...prev, enabled: nextState }));
      Alert.alert(
        'Automation Updated',
        nextState ? 'Daily recommendation email automation has been ENABLED.' : 'Daily recommendation email automation has been PAUSED.'
      );
    } catch (err) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setSavingDailySchedule(false);
    }
  };

  const handleSaveDailySchedule = async (cronToSave = customCronInput) => {
    setSavingDailySchedule(true);
    try {
      const res = await apiUpdateDailyRecommendationsConfig({
        cron: cronToSave.trim(),
        enabled: dailyStatus?.enabled !== false,
        timezone: 'Asia/Kolkata'
      });
      setDailyStatus(prev => ({
        ...prev,
        cron: cronToSave.trim(),
        nextExecution: res.nextExecution || prev?.nextExecution
      }));
      setCustomCronInput(cronToSave.trim());
      Alert.alert('Schedule Saved', `Daily job schedule updated to "${cronToSave.trim()}" (Asia/Kolkata).`);
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSavingDailySchedule(false);
    }
  };

  const handleTriggerDailyNow = () => {
    Alert.alert(
      'Trigger Daily Recommendations',
      'This will immediately run the daily personalized recommendation email job for all eligible users for today (Asia/Kolkata). Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Daily Job Now',
          onPress: async () => {
            setTriggeringDaily(true);
            try {
              const res = await apiTriggerDailyRecommendations(true);
              if (res && res.success) {
                Alert.alert(
                  'Job Execution Finished',
                  `Daily run completed successfully!\nSubmitted: ${res.runDoc?.submittedCount || 0}\nSkipped: ${res.runDoc?.skippedCount || 0}\nFailed: ${res.runDoc?.failedCount || 0}`
                );
              } else {
                Alert.alert('Job Notice', res?.reason || 'Job execution started in background.');
              }
              loadEmailData();
            } catch (err) {
              Alert.alert('Execution Error', err.message);
            } finally {
              setTriggeringDaily(false);
            }
          }
        }
      ]
    );
  };

  const handleSendDailyTest = async () => {
    if (!dailyTestEmail.trim()) {
      Alert.alert('Required', 'Please enter a test email address.');
      return;
    }
    setSendingDailyTest(true);
    try {
      const res = await apiSendTestDailyRecommendation({
        to: dailyTestEmail.trim(),
        dietType: 'Vegetarian',
        allergies: [],
        spiceLevel: 'Medium'
      });
      Alert.alert('Test Email Dispatched', `Test daily recommendation email sent to ${dailyTestEmail.trim()}! Message ID: ${res.messageId || 'OK'}`);
    } catch (err) {
      Alert.alert('Test Send Failed', err.message);
    } finally {
      setSendingDailyTest(false);
    }
  };

  const handlePreviewDailyEmail = async () => {
    setLoadingDailyPreview(true);
    setDailyPreviewModalVisible(true);
    try {
      const res = await apiGetDailyRecommendationsPreview({
        dietType: 'Vegetarian',
        allergies: 'peanuts',
        spiceLevel: 'Medium'
      });
      setDailyPreviewData(res);
    } catch (err) {
      console.warn('Preview error:', err.message);
    } finally {
      setLoadingDailyPreview(false);
    }
  };

  const handleRetryDailyFailures = async (runId) => {
    setRetryingDailyRunId(runId);
    try {
      const res = await apiRetryDailyRecommendations(runId);
      Alert.alert('Retry Finished', `Retried ${res.retriedCount || 0} failed recipients for run ${runId}.`);
      loadEmailData();
    } catch (err) {
      Alert.alert('Retry Failed', err.message);
    } finally {
      setRetryingDailyRunId(null);
    }
  };

  const handleLoadExistingUserWelcome = (targetDraft) => {
    const d = targetDraft || welcomeCampaignDraft || {};
    setCampaignName(d.campaignName || 'FoodieBite Existing User Welcome Campaign');
    setEmailSubject(d.subject || DEFAULT_TEMPLATES.existingUserWelcome.subject);
    setSenderName(d.senderName || 'FoodieBite');
    setSelectedTemplateKey('existingUserWelcome');
    setHtmlContent(d.htmlContent || DEFAULT_TEMPLATES.existingUserWelcome.html);
    setTextContent(d.textContent || DEFAULT_TEMPLATES.existingUserWelcome.text);
    setRecipientType('all');
    setSubTab('compose');
  };

  const handleRetryCampaign = async (campaignId) => {
    setRetryingCampaignId(campaignId);
    try {
      const res = await apiRetryCampaign(campaignId);
      Alert.alert('Campaign Retry Started', res.message || 'Queued pending recipients for dispatch.');
      loadEmailData();
    } catch (err) {
      Alert.alert('Retry Failed', err.message);
    } finally {
      setRetryingCampaignId(null);
    }
  };

  useEffect(() => {
    loadEmailData();
  }, []);


  // Re-evaluate recipient count whenever selection criteria changes
  const evaluateCurrentRecipients = async () => {
    setEvaluating(true);
    try {
      const filterCriteria = {};
      if (recipientType === 'dietType') filterCriteria.dietType = selectedDiet;
      if (recipientType === 'spiceLevel') filterCriteria.spiceLevel = selectedSpice;
      if (recipientType === 'healthGoals') filterCriteria.healthGoal = selectedGoal;

      const evalRes = await apiEvaluateRecipients({
        recipientType,
        filterCriteria,
        selectedEmails: selectedUserEmails
      });

      if (evalRes?.success) {
        setEvaluation(evalRes);
      }
    } catch (err) {
      console.warn('Recipient evaluation error:', err.message);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    evaluateCurrentRecipients();
  }, [recipientType, selectedDiet, selectedSpice, selectedGoal, selectedUserEmails, users]);

  // Handle Template Switching
  const handleSelectTemplate = (key) => {
    setSelectedTemplateKey(key);
    if (key !== 'custom' && DEFAULT_TEMPLATES[key]) {
      setEmailSubject(DEFAULT_TEMPLATES[key].subject);
      setHtmlContent(DEFAULT_TEMPLATES[key].html);
      setTextContent(DEFAULT_TEMPLATES[key].text);
    }
  };

  // Dispatch Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      Alert.alert('Required', 'Please enter a recipient test email address.');
      return;
    }

    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await apiSendTestEmail({
        to: testEmailAddress.trim(),
        subject: emailSubject || 'FoodieBite Email Test',
        message: textContent,
        html: htmlContent
      });

      setTestResult({
        success: true,
        message: res.message || 'Test email dispatched successfully via Brevo!',
        id: res.details?.messageId || res.details?.id
      });
      loadEmailData();
      Alert.alert('Success', `Test email sent to ${testEmailAddress.trim()} via Brevo!`);
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to dispatch test email'
      });
      Alert.alert('Send Error', err.message);
    } finally {
      setSendingTest(false);
    }
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!campaignName.trim() || !emailSubject.trim()) {
      Alert.alert('Required', 'Please provide a campaign name and subject.');
      return;
    }

    try {
      const filterCriteria = {};
      if (recipientType === 'dietType') filterCriteria.dietType = selectedDiet;
      if (recipientType === 'spiceLevel') filterCriteria.spiceLevel = selectedSpice;
      if (recipientType === 'healthGoals') filterCriteria.healthGoal = selectedGoal;

      const res = await apiCreateEmailCampaign({
        campaignName: campaignName.trim(),
        subject: emailSubject.trim(),
        senderName: senderName.trim() || 'FoodieBite',
        htmlContent,
        textContent,
        recipientType,
        filterCriteria,
        selectedEmails: selectedUserEmails
      });

      Alert.alert('Draft Saved', `Campaign "${campaignName}" saved to drafts.`);
      loadEmailData();
      setSubTab('dashboard');
    } catch (err) {
      Alert.alert('Error Saving Draft', err.message);
    }
  };

  // Open Launch Confirmation Modal
  const handleOpenConfirmModal = () => {
    if (!campaignName.trim()) {
      Alert.alert('Required', 'Please enter a campaign name.');
      return;
    }
    if (!emailSubject.trim()) {
      Alert.alert('Required', 'Please enter an email subject.');
      return;
    }
    if (!htmlContent.trim()) {
      Alert.alert('Required', 'Email content cannot be empty.');
      return;
    }
    if (!evaluation || evaluation.eligibleCount === 0) {
      Alert.alert('No Eligible Recipients', 'No eligible recipients matched your filter criteria.');
      return;
    }

    setConfirmCheckbox(false);
    setConfirmModalVisible(true);
  };

  // Confirm & Dispatch Campaign
  const handleConfirmAndSend = async () => {
    if (!confirmCheckbox) {
      Alert.alert('Confirmation Required', 'Please check the box to confirm sending to all eligible recipients.');
      return;
    }

    setDispatchingCampaign(true);
    try {
      const filterCriteria = {};
      if (recipientType === 'dietType') filterCriteria.dietType = selectedDiet;
      if (recipientType === 'spiceLevel') filterCriteria.spiceLevel = selectedSpice;
      if (recipientType === 'healthGoals') filterCriteria.healthGoal = selectedGoal;

      // 1. Create or synchronize campaign record
      const isExistingWelcome = campaignName.trim() === 'FoodieBite Existing User Welcome Campaign' ||
        campaignName.trim().toLowerCase().includes('existing user');
      const dedicatedCampaignId = isExistingWelcome ? 'camp_existing_users_welcome' : undefined;

      const camp = await apiCreateEmailCampaign({
        campaignId: dedicatedCampaignId,
        campaignName: campaignName.trim(),
        subject: emailSubject.trim(),
        senderName: senderName.trim() || 'FoodieBite',
        htmlContent,
        textContent,
        recipientType,
        filterCriteria,
        selectedEmails: selectedUserEmails
      });

      // 2. Start campaign execution
      const launchId = camp.campaign?.campaignId || camp.campaignId || dedicatedCampaignId;
      const startRes = await apiStartEmailCampaign(launchId);


      setConfirmModalVisible(false);
      Alert.alert(
        'Campaign Launched! 🚀',
        `Batch delivery started for ${startRes.recipientCount || evaluation.eligibleCount} recipients. Check the Campaign History table below to track progress.`
      );

      // Reset form
      setCampaignName('');
      loadEmailData();
      setSubTab('dashboard');

    } catch (err) {
      Alert.alert('Campaign Launch Failed', err.message);
    } finally {
      setDispatchingCampaign(false);
    }
  };

  // Toggle user selection in multi-select list
  const toggleUserSelection = (email) => {
    const clean = email.toLowerCase().trim();
    if (selectedUserEmails.includes(clean)) {
      setSelectedUserEmails(selectedUserEmails.filter(e => e !== clean));
    } else {
      setSelectedUserEmails([...selectedUserEmails, clean]);
    }
  };

  // Metrics Calculations
  const totalCampaigns = campaigns.length;
  const totalSubmitted = campaigns.reduce((acc, c) => acc + (c.submittedCount || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
  const totalBouncedOrFailed = campaigns.reduce((acc, c) => acc + (c.bouncedCount || 0) + (c.failedCount || 0), 0);
  const totalEligibleRecipients = evaluation?.eligibleCount ?? users.length;
  const remainingCredits = emailStatus?.creditsRemainingToday ?? 300;
  const dailyLimit = emailStatus?.dailyQuotaLimit || 300;
  const quotaPercent = Math.min(100, Math.round((remainingCredits / dailyLimit) * 100));

  return (
    <View style={styles.container}>
      {/* ── Section Header ──────────────────────── */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Mail size={22} color={C.orange} style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>Brevo Email Campaigns</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Brevo REST API v3 Active</Text>
          </View>
          <TouchableOpacity onPress={loadEmailData} style={styles.refreshBtn}>
            <RefreshCw size={14} color={C.orange} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>
          Send secure transactional announcements, tailored dietary newsletters, and automated emails to registered FoodieBite users while strictly respecting recipient consent.
        </Text>
      </View>

      {/* ── Sub-navigation Pills ─────────────────── */}
      <View style={styles.subNavRow}>
        <TouchableOpacity
          onPress={() => setSubTab('dashboard')}
          style={[styles.subNavBtn, subTab === 'dashboard' && styles.subNavBtnActive]}
        >
          <Inbox size={15} color={subTab === 'dashboard' ? '#fff' : C.muted} style={{ marginRight: 6 }} />
          <Text style={[styles.subNavText, subTab === 'dashboard' && styles.subNavTextActive]}>
            Campaign Dashboard & History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSubTab('daily')}
          style={[styles.subNavBtn, subTab === 'daily' && styles.subNavBtnActive]}
        >
          <Sparkles size={15} color={subTab === 'daily' ? '#fff' : C.muted} style={{ marginRight: 6 }} />
          <Text style={[styles.subNavText, subTab === 'daily' && styles.subNavTextActive]}>
            Daily Recommendations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSubTab('compose')}
          style={[styles.subNavBtn, subTab === 'compose' && styles.subNavBtnActive]}
        >
          <Send size={15} color={subTab === 'compose' ? '#fff' : C.muted} style={{ marginRight: 6 }} />
          <Text style={[styles.subNavText, subTab === 'compose' && styles.subNavTextActive]}>
            Compose New Campaign
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════
          SUB-TAB 1: CAMPAIGN DASHBOARD & METRICS
          ══════════════════════════════════════════════ */}
      {subTab === 'dashboard' && (
        <View style={{ gap: 16 }}>
          {/* Live Quota Card */}
          <View style={styles.quotaCard}>
            <View style={styles.quotaHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#10B981" />
                <Text style={styles.quotaTitle}>Brevo Account Daily Quota</Text>
              </View>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>Free Plan &bull; 300 Daily Emails</Text>
              </View>
            </View>

            <View style={styles.quotaMetricsRow}>
              <View>
                <Text style={styles.quotaRemainingNum}>{remainingCredits} / {dailyLimit}</Text>
                <Text style={styles.quotaSubText}>Verified Daily Credits Remaining Today</Text>
              </View>
              <View style={styles.senderPill}>
                <Text style={styles.senderPillLabel}>Sender: </Text>
                <Text style={styles.senderPillVal}>
                  {emailStatus?.sender?.email || 'foodiebite881@gmail.com'}
                </Text>
                <View style={styles.verifiedDot} />
              </View>
            </View>

            {/* Quota Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${quotaPercent}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: C.muted }}>0 used</Text>
              <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>{quotaPercent}% Quota Available</Text>
              <Text style={{ fontSize: 10, color: C.muted }}>{dailyLimit} limit</Text>
            </View>
          </View>

          {/* Metric Cards Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Users size={18} color={C.orange} style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{users.length}</Text>
              <Text style={styles.metricLabel}>Total Registered Users</Text>
            </View>
            <View style={styles.metricCard}>
              <CheckCircle size={18} color="#10B981" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{totalEligibleRecipients}</Text>
              <Text style={styles.metricLabel}>Eligible Recipients</Text>
            </View>
            <View style={styles.metricCard}>
              <Send size={18} color="#38BDF8" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{totalCampaigns}</Text>
              <Text style={styles.metricLabel}>Campaigns Created</Text>
            </View>
            <View style={styles.metricCard}>
              <Inbox size={18} color="#A855F7" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{totalSubmitted}</Text>
              <Text style={styles.metricLabel}>Emails Submitted</Text>
            </View>
            <View style={styles.metricCard}>
              <ShieldCheck size={18} color="#10B981" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{totalDelivered}</Text>
              <Text style={styles.metricLabel}>Confirmed Delivered</Text>
            </View>
            <View style={styles.metricCard}>
              <AlertTriangle size={18} color="#F59E0B" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{totalBouncedOrFailed}</Text>
              <Text style={styles.metricLabel}>Bounced / Failed</Text>
            </View>
          </View>

          {/* Dedicated One-Time Welcome Campaign Card for Existing Users */}
          <View style={styles.existingWelcomeBanner}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <Sparkles size={18} color={C.orange} />
                <Text style={styles.existingWelcomeTitle}>
                  FoodieBite Existing User Welcome Campaign
                </Text>
                <View style={[styles.statusBadgeBase, (welcomeCampaignDraft?.status === 'completed' ? styles.badgeSuccess : welcomeCampaignDraft?.status === 'partially_completed' ? styles.badgePartial : styles.badgeDraft)]}>
                  <Text style={[styles.statusBadgeTextBase, (welcomeCampaignDraft?.status === 'completed' ? styles.badgeTextSuccess : welcomeCampaignDraft?.status === 'partially_completed' ? styles.badgeTextPartial : styles.badgeTextDraft)]}>
                    {(welcomeCampaignDraft?.status || 'READY DRAFT').toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.existingWelcomeSub}>
                Send the one-time welcome email to all existing registered users with personalized greetings, dietary highlights, and anti-spam compliance. Future registrations remain handled by the automated welcome service.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleLoadExistingUserWelcome()}
              style={styles.existingWelcomeBtn}
            >
              <Sparkles size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.existingWelcomeBtnText}>
                {welcomeCampaignDraft?.status === 'completed' ? 'View Welcome Campaign' : 'Review & Send'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action: Start New Campaign */}
          <View style={styles.quickLaunchCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLaunchTitle}>Ready to reach your users?</Text>
              <Text style={styles.quickLaunchSub}>
                Launch personalized announcements, diet newsletters, or segment-specific health updates in seconds.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSubTab('compose')} style={styles.quickLaunchBtn}>
              <Send size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.quickLaunchBtnText}>Compose Campaign</Text>
            </TouchableOpacity>
          </View>

          {/* Campaign History Table */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <FileText size={16} color={C.orange} style={{ marginRight: 8 }} />
              <Text style={styles.tableTitle}>Campaign History & Delivery Results</Text>
            </View>

            {loadingCampaigns ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.orange} />
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Loading campaigns...</Text>
              </View>
            ) : campaigns.length === 0 ? (
              <View style={styles.emptyTableBox}>
                <Inbox size={32} color="#334155" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Email Campaigns Created Yet</Text>
                <Text style={styles.emptySub}>
                  Draft and send your first Brevo campaign using the "Compose New Campaign" tab above.
                </Text>
              </View>
            ) : (
              <View style={{ overflow: 'hidden' }}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.thText, { flex: 2.2 }]}>Campaign Name & Subject</Text>
                  <Text style={[styles.thText, { flex: 1 }]}>Status</Text>
                  <Text style={[styles.thText, { flex: 0.8, textAlign: 'center' }]}>Recipients</Text>
                  <Text style={[styles.thText, { flex: 0.8, textAlign: 'center' }]}>Submitted</Text>
                  <Text style={[styles.thText, { flex: 0.8, textAlign: 'center' }]}>Delivered</Text>
                  <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>Created</Text>
                  <Text style={[styles.thText, { flex: 1.2, textAlign: 'right' }]}>Actions</Text>
                </View>

                {campaigns.map((camp, idx) => {
                  const status = (camp.status || 'draft').toLowerCase();
                  let statusBadgeStyle = styles.badgeDraft;
                  let statusBadgeText = styles.badgeTextDraft;
                  if (status === 'completed') {
                    statusBadgeStyle = styles.badgeSuccess;
                    statusBadgeText = styles.badgeTextSuccess;
                  } else if (status === 'sending') {
                    statusBadgeStyle = styles.badgeSending;
                    statusBadgeText = styles.badgeTextSending;
                  } else if (status === 'partially_completed') {
                    statusBadgeStyle = styles.badgePartial;
                    statusBadgeText = styles.badgeTextPartial;
                  } else if (status === 'failed') {
                    statusBadgeStyle = styles.badgeFailed;
                    statusBadgeText = styles.badgeTextFailed;
                  }

                  const createdDate = camp.createdAt ? new Date(camp.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A';

                  return (
                    <View key={camp.campaignId || idx} style={styles.tableRowItem}>
                      <View style={{ flex: 2.2 }}>
                        <Text style={styles.tdCampaignName} numberOfLines={1}>{camp.campaignName}</Text>
                        <Text style={styles.tdSubject} numberOfLines={1}>{camp.subject}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.statusBadgeBase, statusBadgeStyle]}>
                          <Text style={[styles.statusBadgeTextBase, statusBadgeText]}>
                            {status === 'partially_completed' ? 'PARTIAL' : status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tdNumber, { flex: 0.8, textAlign: 'center' }]}>
                        {camp.recipientCount || 0}
                      </Text>
                      <Text style={[styles.tdNumber, { flex: 0.8, textAlign: 'center', color: '#38BDF8' }]}>
                        {camp.submittedCount || 0}
                      </Text>
                      <Text style={[styles.tdNumber, { flex: 0.8, textAlign: 'center', color: '#10B981' }]}>
                        {camp.deliveredCount || 0}
                      </Text>
                      <Text style={[styles.tdDate, { flex: 1, textAlign: 'center' }]}>
                        {createdDate}
                      </Text>
                      <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {status === 'draft' && (
                          <TouchableOpacity
                            onPress={() => handleLoadExistingUserWelcome(camp)}
                            style={styles.tableActionBtnLaunch}
                          >
                            <Text style={styles.tableActionTextLaunch}>Review</Text>
                          </TouchableOpacity>
                        )}
                        {(status === 'partially_completed' || ((camp.failedCount || 0) > 0 && status !== 'sending')) && (
                          <TouchableOpacity
                            onPress={() => handleRetryCampaign(camp.campaignId)}
                            disabled={retryingCampaignId === camp.campaignId}
                            style={styles.tableActionBtnRetry}
                          >
                            {retryingCampaignId === camp.campaignId ? (
                              <ActivityIndicator size="small" color="#F59E0B" />
                            ) : (
                              <Text style={styles.tableActionTextRetry}>Retry</Text>
                            )}
                          </TouchableOpacity>
                        )}
                        {status === 'completed' && (!camp.failedCount || camp.failedCount === 0) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} color="#10B981" />
                            <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>Done</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

        </View>
      )}

      {/* ══════════════════════════════════════════════
          SUB-TAB 3: DAILY PERSONALIZED RECOMMENDATIONS AUTOMATION
          ══════════════════════════════════════════════ */}
      {subTab === 'daily' && (
        <View style={{ gap: 16 }}>
          {/* Main Automation Card */}
          <View style={[styles.quotaCard, { borderLeftColor: dailyStatus?.enabled ? '#10B981' : '#F59E0B', borderLeftWidth: 4 }]}>
            <View style={styles.quotaHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Sparkles size={20} color={C.orange} />
                <View>
                  <Text style={styles.quotaTitle}>Daily Food Recommendations Automation</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    Recurring background digest sent once daily in Asia/Kolkata timezone with zero-allergen safety guarantees.
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[
                  styles.planBadge,
                  dailyStatus?.enabled
                    ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }
                    : { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#F59E0B' }
                ]}>
                  <View style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: dailyStatus?.enabled ? '#10B981' : '#F59E0B',
                    marginRight: 6
                  }} />
                  <Text style={[
                    styles.planBadgeText,
                    { color: dailyStatus?.enabled ? '#10B981' : '#F59E0B' }
                  ]}>
                    {dailyStatus?.enabled ? 'AUTOMATION ACTIVE' : 'AUTOMATION PAUSED'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleToggleDailyAutomation}
                  disabled={savingDailySchedule}
                  style={[
                    styles.quickLaunchBtn,
                    dailyStatus?.enabled
                      ? { backgroundColor: '#272d3b' }
                      : { backgroundColor: '#10B981' }
                  ]}
                >
                  {savingDailySchedule ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {dailyStatus?.enabled ? 'Pause Automation' : 'Enable Automation'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Timezone and Next Run Notice */}
            <View style={{
              backgroundColor: '#0f1217',
              borderWidth: 1,
              borderColor: '#272d3b',
              borderRadius: 10,
              padding: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#FF6B35" />
                <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
                  Configured Schedule: <Text style={{ color: '#fff', fontWeight: '700' }}>{dailyStatus?.cron || '0 9 * * *'}</Text> ({dailyStatus?.timezone || 'Asia/Kolkata'})
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color="#38BDF8" />
                <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
                  Next Scheduled Run: <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                    {dailyStatus?.nextExecution
                      ? new Date(dailyStatus.nextExecution).toLocaleString('en-US', {
                          timeZone: 'Asia/Kolkata',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) + ' IST'
                      : 'Disabled'}
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          {/* ── DAILY METRICS SUMMARY GRID ── */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Users size={18} color="#FF6B35" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{dailyStatus?.eligibleRecipientsCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Eligible Opted-In Users</Text>
            </View>

            <View style={styles.metricCard}>
              <Inbox size={18} color="#A855F7" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{dailyStatus?.lastRun?.queuedCount || 0}</Text>
              <Text style={styles.metricLabel}>Emails Queued</Text>
            </View>

            <View style={styles.metricCard}>
              <Send size={18} color="#38BDF8" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{dailyStatus?.lastRun?.submittedCount || 0}</Text>
              <Text style={styles.metricLabel}>Emails Submitted</Text>
            </View>

            <View style={styles.metricCard}>
              <CheckCircle size={18} color="#10B981" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{dailyStatus?.lastRun?.deliveredCount || dailyStatus?.lastRun?.submittedCount || 0}</Text>
              <Text style={styles.metricLabel}>Confirmed Deliveries</Text>
            </View>

            <View style={styles.metricCard}>
              <AlertTriangle size={18} color="#EF4444" style={{ marginBottom: 6 }} />
              <Text style={[styles.metricNum, (dailyStatus?.lastRun?.failedCount || 0) > 0 && { color: '#EF4444' }]}>
                {dailyStatus?.lastRun?.failedCount || 0}
              </Text>
              <Text style={styles.metricLabel}>Failures & Bounces</Text>
            </View>

            <View style={styles.metricCard}>
              <XCircle size={18} color="#64748b" style={{ marginBottom: 6 }} />
              <Text style={styles.metricNum}>{dailyStatus?.lastRun?.skippedCount || 0}</Text>
              <Text style={styles.metricLabel}>Skipped / Opted Out</Text>
            </View>
          </View>

          {/* ── CONTROLS ROW: SCHEDULE SETTINGS & IMMEDIATE ACTIONS ── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {/* Schedule Selector Card */}
            <View style={[styles.composeCard, { flex: 1, minWidth: 320 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={16} color="#FF6B35" />
                <Text style={styles.composeHeading}>Schedule Configuration</Text>
              </View>

              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                Select a standard delivery time or enter a custom 5-field cron expression (Asia/Kolkata timezone):
              </Text>

              {/* Preset Buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[
                  { label: '9:00 AM Daily (Default)', cron: '0 9 * * *' },
                  { label: '8:00 AM Daily', cron: '0 8 * * *' },
                  { label: '12:00 PM Lunch', cron: '0 12 * * *' },
                  { label: '7:00 PM Dinner', cron: '0 19 * * *' }
                ].map(p => (
                  <TouchableOpacity
                    key={p.cron}
                    onPress={() => {
                      setCustomCronInput(p.cron);
                      handleSaveDailySchedule(p.cron);
                    }}
                    style={[
                      styles.templatePill,
                      dailyStatus?.cron === p.cron && styles.templatePillActive
                    ]}
                  >
                    <Text style={[
                      styles.templatePillText,
                      dailyStatus?.cron === p.cron && styles.templatePillTextActive
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Custom Cron Pattern</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={customCronInput}
                    onChangeText={setCustomCronInput}
                    placeholder="e.g. 0 9 * * *"
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity
                    onPress={() => handleSaveDailySchedule(customCronInput)}
                    disabled={savingDailySchedule}
                    style={styles.saveDraftBtn}
                  >
                    {savingDailySchedule ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Save size={13} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.saveDraftText}>Save Schedule</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Immediate Operations Card */}
            <View style={[styles.composeCard, { flex: 1, minWidth: 320 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Send size={16} color="#10B981" />
                <Text style={styles.composeHeading}>Testing & Execution Controls</Text>
              </View>

              <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>
                Verify email appearance, dispatch test recommendations, or trigger a full daily batch run:
              </Text>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={handlePreviewDailyEmail}
                  style={[styles.previewEmailBtn, { flex: 1, justifyContent: 'center' }]}
                >
                  <Eye size={14} color="#FF6B35" style={{ marginRight: 6 }} />
                  <Text style={styles.previewEmailBtnText}>Preview Daily Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleTriggerDailyNow}
                  disabled={triggeringDaily}
                  style={[styles.quickLaunchBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#FF6B35' }]}
                >
                  {triggeringDaily ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Run Daily Job Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Send Test Email Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Send Test Recommendation Email</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={dailyTestEmail}
                    onChangeText={setDailyTestEmail}
                    placeholder="Enter recipient email..."
                    placeholderTextColor="#64748b"
                  />
                  <TouchableOpacity
                    onPress={handleSendDailyTest}
                    disabled={sendingDailyTest}
                    style={styles.sendTestBtn}
                  >
                    {sendingDailyTest ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Send size={13} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.sendTestBtnText}>Send Test</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ── EXECUTION HISTORY TABLE ── */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color={C.orange} />
                <Text style={styles.tableTitle}>Daily Recommendation Execution History</Text>
              </View>
              <Text style={{ color: '#64748b', fontSize: 12 }}>
                Persistent runs in Asia/Kolkata timezone
              </Text>
            </View>

            {(!dailyStatus?.recentRuns || dailyStatus.recentRuns.length === 0) ? (
              <View style={styles.emptyTable}>
                <Sparkles size={28} color="#475569" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTableText}>No daily recommendation runs executed yet</Text>
                <Text style={styles.emptyTableSub}>
                  The scheduler will automatically execute daily at the configured cron time (or use "Run Daily Job Now").
                </Text>
              </View>
            ) : (
              <View style={styles.historyTableWrap}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.colHeader, { flex: 2 }]}>RUN ID / DATE</Text>
                  <Text style={[styles.colHeader, { flex: 1 }]}>STATUS</Text>
                  <Text style={[styles.colHeader, { flex: 1 }]}>TRIGGER</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>ELIGIBLE</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>SUBMITTED</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>FAILED</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>SKIPPED</Text>
                  <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>ACTIONS</Text>
                </View>

                {dailyStatus.recentRuns.map(run => {
                  const isRunFailed = run.status === 'failed' || (run.failedCount || 0) > 0;
                  return (
                    <View key={run.runId} style={styles.tableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.cellRunId}>{run.runId}</Text>
                        <Text style={styles.cellTime}>
                          {run.startedAt ? new Date(run.startedAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST' : 'N/A'}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={[
                          styles.statusBadgeSmall,
                          run.status === 'completed'
                            ? { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10B981' }
                            : run.status === 'processing'
                            ? { backgroundColor: 'rgba(56,189,248,0.15)', borderColor: '#38BDF8' }
                            : { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#EF4444' }
                        ]}>
                          <Text style={[
                            styles.statusBadgeSmallText,
                            run.status === 'completed'
                              ? { color: '#10B981' }
                              : run.status === 'processing'
                              ? { color: '#38BDF8' }
                              : { color: '#EF4444' }
                          ]}>
                            {(run.status || 'unknown').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.cellSub}>{(run.triggerType || 'scheduled').toUpperCase()}</Text>
                      </View>

                      <Text style={[styles.cellNum, { flex: 1 }]}>{run.eligibleCount || 0}</Text>
                      <Text style={[styles.cellNum, { flex: 1, color: '#10B981' }]}>{run.submittedCount || 0}</Text>
                      <Text style={[styles.cellNum, { flex: 1, color: (run.failedCount || 0) > 0 ? '#EF4444' : '#94a3b8' }]}>
                        {run.failedCount || 0}
                      </Text>
                      <Text style={[styles.cellNum, { flex: 1, color: '#64748b' }]}>{run.skippedCount || 0}</Text>

                      <View style={{ flex: 1, alignItems: 'center' }}>
                        {isRunFailed ? (
                          <TouchableOpacity
                            onPress={() => handleRetryDailyFailures(run.runId)}
                            disabled={retryingDailyRunId === run.runId}
                            style={styles.tableActionBtnRetry}
                          >
                            {retryingDailyRunId === run.runId ? (
                              <ActivityIndicator size="small" color="#F59E0B" />
                            ) : (
                              <Text style={styles.tableActionTextRetry}>Retry</Text>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} color="#10B981" />
                            <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>Done</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════
          SUB-TAB 2: COMPOSE NEW EMAIL CAMPAIGN
          ══════════════════════════════════════════════ */}
      {subTab === 'compose' && (
        <View style={{ gap: 16 }}>
          {/* Compose Form Card */}
          <View style={styles.composeCard}>
            <Text style={styles.composeHeading}>Compose Email Campaign</Text>

            {/* Campaign Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Campaign Name (Internal Admin Identifier)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. October Healthy Dining Feature Announcement"
                placeholderTextColor="#64748b"
                value={campaignName}
                onChangeText={setCampaignName}
              />
            </View>

            {/* Email Subject */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Subject Line</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 🍏 Exciting Healthy Meal Recommendations for You"
                placeholderTextColor="#64748b"
                value={emailSubject}
                onChangeText={setEmailSubject}
              />
            </View>

            {/* Sender Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sender Display Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="FoodieBite"
                placeholderTextColor="#64748b"
                value={senderName}
                onChangeText={setSenderName}
              />
              <Text style={styles.fieldHint}>
                Dispatched from verified Brevo sender: <Text style={{ color: '#FF6B35' }}>{emailStatus?.sender?.email || 'foodiebite881@gmail.com'}</Text>
              </Text>
            </View>

            {/* Recipient Selection Segment */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Recipient Targeting</Text>
              <View style={styles.segmentRow}>
                {[
                  { id: 'all', label: 'All Eligible Users' },
                  { id: 'dietType', label: 'Diet Type' },
                  { id: 'spiceLevel', label: 'Spice Level' },
                  { id: 'healthGoals', label: 'Health Goals' },
                  { id: 'selected', label: 'Select Users' }
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setRecipientType(opt.id)}
                    style={[
                      styles.segmentBtn,
                      recipientType === opt.id && styles.segmentBtnActive
                    ]}
                  >
                    <Text style={[styles.segmentBtnText, recipientType === opt.id && styles.segmentBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Conditional Filter Options */}
              {recipientType === 'dietType' && (
                <View style={styles.filterSubCard}>
                  <Text style={styles.filterSubLabel}>Select Target Dietary Category:</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {['Vegetarian', 'Vegan', 'Non-Vegetarian', 'Eggetarian', 'Keto'].map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setSelectedDiet(d)}
                        style={[styles.chipBtn, selectedDiet === d && styles.chipBtnActive]}
                      >
                        <Text style={[styles.chipText, selectedDiet === d && styles.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {recipientType === 'spiceLevel' && (
                <View style={styles.filterSubCard}>
                  <Text style={styles.filterSubLabel}>Select Target Spice Preference:</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {['Mild', 'Medium', 'Spicy', 'Extra Spicy'].map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setSelectedSpice(s)}
                        style={[styles.chipBtn, selectedSpice === s && styles.chipBtnActive]}
                      >
                        <Text style={[styles.chipText, selectedSpice === s && styles.chipTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {recipientType === 'healthGoals' && (
                <View style={styles.filterSubCard}>
                  <Text style={styles.filterSubLabel}>Select Health Goal:</Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {['Healthy Eating', 'Weight Loss', 'Muscle Gain', 'Heart Health', 'Keto'].map(g => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setSelectedGoal(g)}
                        style={[styles.chipBtn, selectedGoal === g && styles.chipBtnActive]}
                      >
                        <Text style={[styles.chipText, selectedGoal === g && styles.chipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {recipientType === 'selected' && (
                <View style={styles.filterSubCard}>
                  <Text style={styles.filterSubLabel}>
                    Choose Specific Users ({selectedUserEmails.length} selected):
                  </Text>
                  <TextInput
                    style={[styles.textInput, { marginBottom: 8, height: 36, fontSize: 12 }]}
                    placeholder="Search users by name or email..."
                    placeholderTextColor="#64748b"
                    value={userSearchText}
                    onChangeText={setUserSearchText}
                  />
                  <ScrollView style={{ maxHeight: 150 }}>
                    {users
                      .filter(u => !userSearchText || (u.name || '').toLowerCase().includes(userSearchText.toLowerCase()) || (u.email || '').toLowerCase().includes(userSearchText.toLowerCase()))
                      .map(u => {
                        const isSelected = selectedUserEmails.includes((u.email || '').toLowerCase());
                        return (
                          <TouchableOpacity
                            key={u.id || u.uid}
                            onPress={() => toggleUserSelection(u.email)}
                            style={[styles.userSelectRow, isSelected && styles.userSelectRowActive]}
                          >
                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                              {isSelected && <Check size={12} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.userSelectName}>{u.name || 'User'}</Text>
                              <Text style={styles.userSelectEmail}>{u.email}</Text>
                            </View>
                            <Text style={styles.userSelectDiet}>{u.dietType || 'Vegetarian'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              {/* Recipient Evaluation Banner */}
              <View style={styles.evalBanner}>
                {evaluating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={C.orange} />
                    <Text style={styles.evalText}>Calculating eligible recipients and consent preferences...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Users size={16} color={C.orange} />
                      <Text style={styles.evalText}>
                        <Text style={{ fontWeight: 'bold', color: '#10B981' }}>{evaluation?.eligibleCount ?? 0} Eligible Recipients</Text>
                        {' '}&bull; {evaluation?.excludedCount ?? 0} Unsubscribed/Excluded
                      </Text>
                    </View>
                    {evaluation && evaluation.eligibleCount > remainingCredits ? (
                      <View style={styles.quotaWarningBadge}>
                        <AlertTriangle size={13} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.quotaWarningText}>Exceeds Remaining Daily Quota ({remainingCredits})</Text>
                      </View>
                    ) : (
                      <View style={styles.quotaOkBadge}>
                        <CheckCircle size={13} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={styles.quotaOkText}>Within Brevo Quota</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Template Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Pre-configured Template</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(DEFAULT_TEMPLATES).map(([k, t]) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => handleSelectTemplate(k)}
                    style={[
                      styles.templateChip,
                      selectedTemplateKey === k && styles.templateChipActive
                    ]}
                  >
                    <Text style={[styles.templateChipText, selectedTemplateKey === k && styles.templateChipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* HTML Email Content */}
            <View style={styles.fieldGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>HTML Email Body Content</Text>
                <TouchableOpacity onPress={() => setPreviewVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Eye size={13} color={C.orange} />
                  <Text style={{ fontSize: 11, color: C.orange, fontWeight: '600' }}>Live Preview</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                multiline
                numberOfLines={8}
                value={htmlContent}
                onChangeText={setHtmlContent}
              />
              <Text style={styles.fieldHint}>
                FoodieBite automatically attaches responsive branding header, user greeting, and compliant one-click List-Unsubscribe footer to every dispatch.
              </Text>
            </View>

            {/* Plain text alternative */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Plain-Text Alternative (Optional Fallback)</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Plain text alternative..."
                placeholderTextColor="#64748b"
                value={textContent}
                onChangeText={setTextContent}
              />
            </View>

            {/* ── Test Email Action Bar ──────────────────── */}
            <View style={styles.testEmailBox}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={styles.testEmailLabel}>Send a Test Email to Verify Layout:</Text>
                <TextInput
                  style={[styles.textInput, { height: 38, fontSize: 12 }]}
                  placeholder="e.g. foodiebite881@gmail.com"
                  placeholderTextColor="#64748b"
                  value={testEmailAddress}
                  onChangeText={setTestEmailAddress}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <TouchableOpacity
                onPress={handleSendTestEmail}
                disabled={sendingTest}
                style={[styles.testSendBtn, sendingTest && { opacity: 0.7 }]}
              >
                {sendingTest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={13} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.testSendBtnText}>Send Test</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {testResult && (
              <View style={[styles.testResultBox, testResult.success ? styles.testSuccess : styles.testError]}>
                {testResult.success ? (
                  <CheckCircle size={15} color="#10B981" style={{ marginRight: 6 }} />
                ) : (
                  <XCircle size={15} color="#EF4444" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.testResultText}>{testResult.message}</Text>
              </View>
            )}

            {/* ── Main Action Buttons ────────────────────── */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.previewBtn}>
                <Eye size={15} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.previewBtnText}>Preview Email</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSaveDraft} style={styles.draftBtn}>
                <Save size={15} color={C.muted} style={{ marginRight: 6 }} />
                <Text style={styles.draftBtnText}>Save Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleOpenConfirmModal} style={styles.launchBtn}>
                <Send size={15} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.launchBtnText}>Review & Launch Campaign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════
          MODAL 1: PREVIEW EMAIL MODAL
          ══════════════════════════════════════════════ */}
      <Modal visible={previewVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Eye size={18} color={C.orange} />
                <Text style={styles.modalTitle}>Email Client Preview</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Fake Email Client Header */}
              <View style={styles.fakeEmailClientMeta}>
                <Text style={styles.metaLine}><Text style={styles.metaBold}>From:</Text> {senderName} &lt;{emailStatus?.sender?.email || 'foodiebite881@gmail.com'}&gt;</Text>
                <Text style={styles.metaLine}><Text style={styles.metaBold}>To:</Text> John Doe &lt;john.doe@example.com&gt;</Text>
                <Text style={styles.metaLine}><Text style={styles.metaBold}>Subject:</Text> {emailSubject || 'FoodieBite Announcement'}</Text>
              </View>

              {/* Rendered Email Mock Container */}
              <View style={styles.renderedEmailBox}>
                <View style={styles.renderedBanner}>
                  <Text style={{ fontSize: 28 }}>🍏</Text>
                  <Text style={styles.renderedLogoText}>FoodieBite</Text>
                  <Text style={styles.renderedTagline}>Personalized Nutrition & Dining</Text>
                </View>
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Hello John Doe,</Text>
                  {/* Clean text preview of html content */}
                  <Text style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 22 }}>
                    {htmlContent.replace(/<[^>]+>/g, ' ')}
                  </Text>
                </View>
                <View style={styles.renderedFooter}>
                  <Text style={{ color: '#64748b', fontSize: 10, textAlign: 'center' }}>
                    You received this email because you are a registered user of FoodieBite.
                  </Text>
                  <Text style={{ color: '#FF6B35', fontSize: 10, textAlign: 'center', marginTop: 4, textDecorationLine: 'underline' }}>
                    Unsubscribe from marketing emails &bull; Privacy Policy
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════
          MODAL 2: CONFIRMATION BEFORE SENDING MODAL
          ══════════════════════════════════════════════ */}
      <Modal visible={confirmModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color={C.orange} />
                <Text style={styles.modalTitle}>Confirm Email Campaign Send</Text>
              </View>
              <TouchableOpacity onPress={() => setConfirmModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 14 }}>
              <Text style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 18 }}>
                Please review the campaign details carefully before initiating mass delivery. Batches will be dispatched directly through your verified Brevo REST API connection.
              </Text>

              {/* Summary Details Box */}
              <View style={styles.confirmSummaryBox}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Campaign Name:</Text>
                  <Text style={styles.confirmVal}>{campaignName}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Subject:</Text>
                  <Text style={styles.confirmVal}>{emailSubject}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Target Segment:</Text>
                  <Text style={styles.confirmVal}>{recipientType === 'all' ? 'All Eligible Users' : `${recipientType}`}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Eligible Recipients:</Text>
                  <Text style={[styles.confirmVal, { color: '#10B981', fontWeight: 'bold' }]}>
                    {evaluation?.eligibleCount ?? 0} Users
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Excluded Users:</Text>
                  <Text style={[styles.confirmVal, { color: '#94a3b8' }]}>
                    {evaluation?.excludedCount ?? 0} ({evaluation?.unsubscribedCount ?? 0} unsubscribed, {evaluation?.invalidEmailCount ?? 0} invalid, {evaluation?.alreadySentCount ?? 0} previously sent)
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Brevo Daily Quota:</Text>
                  <Text style={styles.confirmVal}>{remainingCredits} / 300 credits</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Processable Now:</Text>
                  <Text style={[styles.confirmVal, { color: '#38BDF8', fontWeight: '700' }]}>
                    {Math.min(evaluation?.eligibleCount || 0, remainingCredits)} Recipients
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Queued for Subsequent Reset:</Text>
                  <Text style={[styles.confirmVal, { color: (evaluation?.eligibleCount || 0) > remainingCredits ? '#F59E0B' : '#94a3b8' }]}>
                    {Math.max(0, (evaluation?.eligibleCount || 0) - remainingCredits)} Recipients
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Estimated Duration:</Text>
                  <Text style={styles.confirmVal}>
                    ~{Math.max(1, Math.ceil(Math.min(evaluation?.eligibleCount || 1, remainingCredits) / 10))} second(s) (controlled 10-per-batch)
                  </Text>
                </View>
              </View>

              {/* Quota Check Notice */}
              {evaluation && evaluation.eligibleCount > remainingCredits && (
                <View style={[styles.quotaExceededBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <AlertTriangle size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={[styles.quotaExceededText, { color: '#FCD34D' }]}>
                    Notice: Campaign requires {evaluation.eligibleCount} emails. Brevo daily limit allows {remainingCredits} today. The system will dispatch {remainingCredits} now and queue the remaining {evaluation.eligibleCount - remainingCredits} safely without failing the campaign.
                  </Text>
                </View>
              )}

              {/* Confirmation Checkbox */}
              <TouchableOpacity
                onPress={() => setConfirmCheckbox(!confirmCheckbox)}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkbox, confirmCheckbox && styles.checkboxActive]}>
                  {confirmCheckbox && <Check size={12} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I confirm that this campaign complies with CAN-SPAM and GDPR anti-spam standards, targets authorized FoodieBite users, and includes compliant one-click unsubscribe links.
                </Text>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setConfirmModalVisible(false)}
                  style={styles.cancelModalBtn}
                >
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmAndSend}
                  disabled={dispatchingCampaign || !confirmCheckbox || (evaluation && evaluation.eligibleCount === 0)}
                  style={[
                    styles.confirmModalSendBtn,
                    (!confirmCheckbox || dispatchingCampaign || (evaluation && evaluation.eligibleCount === 0)) && { opacity: 0.5 }
                  ]}
                >
                  {dispatchingCampaign ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Send size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmModalSendText}>Confirm & Launch Campaign</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: DAILY RECOMMENDATIONS PREVIEW MODAL ── */}
      <Modal
        visible={dailyPreviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDailyPreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 560, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color={C.orange} />
                <Text style={styles.modalTitle}>Daily Food Recommendations Preview</Text>
              </View>
              <TouchableOpacity onPress={() => setDailyPreviewModalVisible(false)}>
                <X size={18} color={C.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }}>
              {loadingDailyPreview ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={C.orange} />
                  <Text style={{ color: '#94a3b8', marginTop: 10 }}>Generating personalized food preview...</Text>
                </View>
              ) : dailyPreviewData ? (
                <View style={{ gap: 12 }}>
                  <View style={{ backgroundColor: '#0f1217', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#272d3b' }}>
                    <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700' }}>SUBJECT LINE:</Text>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 }}>{dailyPreviewData.subject}</Text>
                  </View>

                  <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                    Hello <Text style={{ color: '#fff', fontWeight: '700' }}>FoodieBite User</Text>,
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17 }}>
                    Ready to discover something delicious today? FoodieBite has selected fresh food recommendations tailored to your preferences.
                  </Text>

                  <Text style={{ color: '#FF6B35', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 4 }}>
                    TODAY'S FOOD PICKS:
                  </Text>

                  {(dailyPreviewData.picks || []).map((p, idx) => (
                    <View key={p.id || idx} style={{ backgroundColor: '#1a1f29', borderWidth: 1, borderColor: '#272d3b', borderRadius: 10, padding: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                          <Text style={{ color: '#FF6B35' }}>{idx + 1}.</Text> {p.name}
                        </Text>
                        {p.calories && (
                          <View style={{ backgroundColor: 'rgba(255,107,53,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: '#FF8C5A', fontSize: 10, fontWeight: '700' }}>{p.calories} kcal</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                        {p.description || `${p.name} - high in vitality and nutrition.`}
                      </Text>
                    </View>
                  ))}

                  <View style={{ backgroundColor: 'rgba(255,107,53,0.08)', borderLeftWidth: 3, borderLeftColor: '#FF6B35', padding: 12, borderRadius: 6 }}>
                    <Text style={{ color: '#FF6B35', fontSize: 10, fontWeight: '800' }}>WHY THESE PICKS?</Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>{dailyPreviewData.personalizationReason}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setDailyPreviewModalVisible(false)} style={styles.cancelModalBtn}>
                <Text style={styles.cancelModalBtnText}>Close Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.orange,
  },
  headerSub: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
  },
  subNavRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  subNavBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: C.orange,
  },
  subNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  subNavTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  quotaCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  quotaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  planBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  quotaMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  quotaRemainingNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  quotaSubText: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  senderPillLabel: {
    fontSize: 11,
    color: C.muted,
  },
  senderPillVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  metricNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: C.muted,
  },
  quickLaunchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLaunchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  quickLaunchSub: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
  },
  quickLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  quickLaunchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  tableCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  emptyTableBox: {
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  tableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
  },
  thText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
  },
  tableRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  tdCampaignName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  tdSubject: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  tdNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tdDate: {
    fontSize: 10,
    color: C.muted,
  },
  statusBadgeBase: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeTextBase: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeTextSuccess: {
    color: '#10B981',
  },
  badgeSending: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  badgeTextSending: {
    color: '#38BDF8',
  },
  badgeDraft: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  badgeTextDraft: {
    color: '#94a3b8',
  },
  badgeFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  badgeTextFailed: {
    color: '#EF4444',
  },
  badgePartial: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeTextPartial: {
    color: '#F59E0B',
  },
  existingWelcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  existingWelcomeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  existingWelcomeSub: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginTop: 2,
  },
  existingWelcomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  existingWelcomeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  tableActionBtnLaunch: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tableActionTextLaunch: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  tableActionBtnRetry: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tableActionTextRetry: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  composeCard: {

    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 14,
  },
  composeHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: C.card2,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  textAreaInput: {
    height: 120,
    textAlignVertical: 'top',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  fieldHint: {
    fontSize: 10,
    color: C.muted,
    lineHeight: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: C.orange,
  },
  segmentBtnText: {
    fontSize: 11,
    color: C.muted,
  },
  segmentBtnTextActive: {
    color: C.orange,
    fontWeight: '700',
  },
  filterSubCard: {
    backgroundColor: C.card2,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 8,
    marginTop: 4,
  },
  filterSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  chipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  chipText: {
    fontSize: 11,
    color: C.muted,
  },
  chipTextActive: {
    color: '#10B981',
    fontWeight: '700',
  },
  userSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  userSelectRowActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  userSelectName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  userSelectEmail: {
    fontSize: 10,
    color: C.muted,
  },
  userSelectDiet: {
    fontSize: 10,
    color: C.orange,
  },
  evalBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
  },
  evalText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  quotaWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  quotaWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  quotaOkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  quotaOkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  templateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
  },
  templateChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  templateChipText: {
    fontSize: 11,
    color: C.muted,
  },
  templateChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  testEmailBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    flexWrap: 'wrap',
  },
  testEmailLabel: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 4,
  },
  testSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  testSendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  testSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  testError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  testResultText: {
    fontSize: 11,
    color: '#fff',
    flex: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  draftBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  launchBtn: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  launchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '85%',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 16,
  },
  fakeEmailClientMeta: {
    backgroundColor: C.card2,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    gap: 4,
  },
  metaLine: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  metaBold: {
    fontWeight: '700',
    color: C.muted,
  },
  renderedEmailBox: {
    backgroundColor: '#0f1217',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#272d3b',
    overflow: 'hidden',
  },
  renderedBanner: {
    backgroundColor: '#FF6B35',
    padding: 20,
    alignItems: 'center',
  },
  renderedLogoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  renderedTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
  },
  renderedFooter: {
    backgroundColor: '#0a0d12',
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#1f2532',
  },
  confirmSummaryBox: {
    backgroundColor: C.card2,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmLabel: {
    fontSize: 11,
    color: C.muted,
  },
  confirmVal: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    maxWidth: 260,
    textAlign: 'right',
  },
  quotaExceededBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  quotaExceededText: {
    fontSize: 11,
    color: '#EF4444',
    flex: 1,
    lineHeight: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  checkboxLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 16,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  confirmModalSendBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.orange,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmModalSendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  cellRunId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'monospace',
  },
  cellTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  cellSub: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  cellNum: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
    textAlign: 'right',
  },
  statusBadgeSmall: {
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  previewEmailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.orange,
  },
  tableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1217',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
});
