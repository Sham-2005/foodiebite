// ─────────────────────────────────────────────────────────────
//  frontend/src/screens/MedicalReportsScreen.js
//  FoodieBite — Medical Report Persistent Cloud Storage & OCR
//  Features:
//    1. Upload Report: Drag & drop PDF, progress states, OCR scan
//    2. Saved Reports: Real-time Cloud Firestore sync across devices
//    3. [View Report]: Structured Patient Info, Medical Info, Test Results
//    4. [Open PDF]: Direct cloud PDF viewing/download from Firebase Storage
//    5. [Delete]: Safe deletion from Firestore & Storage
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Trash2,
  Calendar,
  User,
  ShieldAlert,
  FileCheck,
  Stethoscope,
  Activity,
  ExternalLink,
  Eye,
  Cloud,
  FileSpreadsheet
} from 'lucide-react-native';

import { launchImageLibrary } from '../services/filePicker';
import {
  uploadAndPersistMedicalReport,
  subscribeToUserMedicalReports,
  deleteCloudMedicalReport,
  validateMedicalPdf
} from '../services/medicalReportsService';
import { useApp } from '../context/AppContext';
import { auth } from '../services/firebase';
import { C } from '../components/UI';
import AppLayout from '../components/AppLayout';

// Color tokens
const D = {
  green:    '#22c55e',
  greenBg:  'rgba(34,197,94,0.12)',
  greenBr:  'rgba(34,197,94,0.25)',
  red:      '#f87171',
  redBg:    'rgba(248,113,113,0.12)',
  redBr:    'rgba(248,113,113,0.25)',
  yellow:   '#fbbf24',
  yellowBg: 'rgba(251,191,36,0.12)',
  yellowBr: 'rgba(251,191,36,0.25)',
  card:     '#171a20',
  card2:    '#1e2230',
  border:   'rgba(255,255,255,0.08)',
  border2:  'rgba(255,255,255,0.14)',
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch (_) {
    return iso;
  }
}

export default function MedicalReportsScreen() {
  const navigation = useNavigation();
  const { user } = useApp();
  const { width: windowWidth } = useWindowDimensions();

  // Active user ID (Firebase Auth UID or local session fallback)
  const userId = auth?.currentUser?.uid || user?.uid || user?.id || 'guest_user';

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [reportsList, setReportsList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [rawTextExpanded, setRawTextExpanded] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const detailsRef = useRef(null);

  // ── 1. Real-time Cloud Synchronization ────────────────────────
  useEffect(() => {
    if (!userId) {
      setLoadingReports(false);
      return;
    }

    setLoadingReports(true);
    const unsubscribe = subscribeToUserMedicalReports(
      userId,
      (reports) => {
        setReportsList(reports);
        setLoadingReports(false);

        // If no active report is selected, select the newest one by default
        setActiveReport((prev) => {
          if (!prev && reports.length > 0) return reports[0];
          if (prev) {
            const updated = reports.find(r => (r.id || r._id) === (prev.id || prev._id));
            return updated || prev;
          }
          return null;
        });
      },
      (err) => {
        console.warn('Real-time sync status notice:', err.message);
        setLoadingReports(false);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [userId]);

  // ── 2. File Selection Handlers ────────────────────────────────
  const handleSelectFile = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const result = await launchImageLibrary({
        mediaType: 'document',
        accept: 'application/pdf',
      });

      if (result.didCancel) return;

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const validation = validateMedicalPdf(asset);
        if (!validation.valid) {
          setErrorMsg(validation.error);
          return;
        }

        const fileObj = asset.file || {
          uri: asset.uri,
          name: asset.fileName || 'medical_report.pdf',
          type: 'application/pdf',
          size: asset.fileSize || 0
        };
        if (!fileObj.name) fileObj.name = asset.fileName || 'medical_report.pdf';

        setSelectedFile(fileObj);
      }
    } catch (err) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateMedicalPdf(file);
    if (!validation.valid) {
      setErrorMsg(validation.error);
      e.target.value = '';
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const validation = validateMedicalPdf(file);
    if (!validation.valid) {
      setErrorMsg(validation.error);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSelectedFile(file);
  };

  // ── 3. Upload & Cloud Persistence ────────────────────────────
  const handleScanReport = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a PDF file first.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setUploading(true);
    setScanStep('Uploading report to Cloud Storage...');

    const safetyTimer = setTimeout(() => {
      setUploading(false);
      setScanStep('');
      setErrorMsg('Processing took longer than expected. Please check the Saved Reports section below or try again.');
    }, 25000);

    try {
      const savedReport = await uploadAndPersistMedicalReport(
        selectedFile,
        '',
        (progressMessage) => setScanStep(progressMessage)
      );

      clearTimeout(safetyTimer);
      setActiveReport(savedReport);
      setReportsList(prev => {
        const sId = savedReport.id || savedReport._id;
        const exists = prev.some(r => (r.id || r._id) === sId);
        return exists ? prev.map(r => (r.id || r._id) === sId ? savedReport : r) : [savedReport, ...prev];
      });
      setSuccessMsg('Report saved successfully to your cloud account.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Smooth scroll to the extracted details
      setTimeout(() => {
        if (detailsRef.current && typeof detailsRef.current.scrollIntoView === 'function') {
          detailsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 350);
    } catch (err) {
      clearTimeout(safetyTimer);
      setErrorMsg(err.message || 'Unable to upload the report. Please try again.');
    } finally {
      clearTimeout(safetyTimer);
      setUploading(false);
      setScanStep('');
    }
  };

  // ── 4. Open Original PDF from Cloud Storage ───────────────────
  const handleOpenPdf = (url) => {
    if (!url) {
      setErrorMsg('PDF file URL is not available.');
      return;
    }

    let finalUrl = url;
    if (typeof url === 'string' && (url.startsWith('/uploads') || url.startsWith('uploads/'))) {
      const backendBase = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
        ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')
        : 'http://localhost:5000';
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      finalUrl = `${backendBase}${cleanPath}`;
    }

    if (Platform.OS === 'web') {
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(finalUrl).catch(err => {
        setErrorMsg('Unable to open PDF document: ' + err.message);
      });
    }
  };

  // ── 5. Delete Report ─────────────────────────────────────────
  const handleDeleteReport = async (report) => {
    if (!report) return;
    const reportId = report.id || report._id;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${report.reportName || report.fileName || 'this report'}"?\nThis will remove the document and its extracted data from your cloud account.`
      );
      if (!confirmed) return;
    }

    try {
      await deleteCloudMedicalReport(reportId, report.storagePath, userId);
      setReportsList(prev => prev.filter(r => (r.id || r._id) !== reportId));
      if (activeReport && (activeReport.id === reportId || activeReport._id === reportId)) {
        const remaining = reportsList.filter(r => (r.id || r._id) !== reportId);
        setActiveReport(remaining.length > 0 ? remaining[0] : null);
      }
      setSuccessMsg('Report deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Failed to delete report: ' + err.message);
    }
  };

  // ── 6. Copy Raw OCR Text ─────────────────────────────────────
  const handleCopyRawText = (text) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedRawText(true);
      setTimeout(() => setCopiedRawText(false), 2000);
    }
  };

  // Data mapping for active report view
  const analysis = activeReport?.analysis || {};
  const extracted = activeReport?.extractedData || {};

  const patientInfo = extracted.patientInformation || analysis.patientInfo || {};
  const medicalInfo = extracted.medicalInformation || analysis.medicalInfo || {};
  const testResults = extracted.testResults || analysis.testResults || analysis.extractedTable || [];
  const rawOcrText  = activeReport?.rawOcrText || analysis.rawOcrText || '';

  const isWide = windowWidth >= 768;

  return (
    <AppLayout>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Medical Reports</Text>
          <Text style={styles.headerSubtitle}>Persistent Cloud Storage &amp; OCR Synchronization</Text>
        </View>
        <View style={styles.syncBadge}>
          <Cloud size={14} color="#38bdf8" style={{ marginRight: 5 }} />
          <Text style={styles.syncBadgeText}>Cloud Synced</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hidden HTML5 File Input for Web */}
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleWebFileChange}
            style={{ display: 'none' }}
          />
        )}

        {/* ─────────────────────────────────────────────────────────────
            SECTION 1: UPLOAD REPORT
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.uploadCard}>
          <View style={styles.uploadCardHeader}>
            <View style={styles.iconCircle}>
              <UploadCloud size={20} color={C.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadCardTitle}>Upload a new medical report</Text>
              <Text style={styles.uploadCardSubtitle}>
                Select a laboratory test report or clinical PDF to store in the cloud and extract key information.
              </Text>
            </View>
          </View>

          {/* Dropzone Container */}
          <div
            className="medical-dropzone"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={!selectedFile && !uploading ? handleSelectFile : undefined}
            style={{
              border: isDragOver ? `2px dashed ${C.orange}` : '2px dashed rgba(255,255,255,0.15)',
              borderRadius: 14,
              padding: '24px 16px',
              backgroundColor: isDragOver ? 'rgba(255,107,53,0.06)' : '#14171f',
              cursor: selectedFile || uploading ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              transition: 'all 0.2s ease',
            }}
          >
            {!selectedFile ? (
              <>
                <FileText size={40} color={isDragOver ? C.orange : '#6f7785'} style={{ marginBottom: 12 }} />
                <Text style={styles.dropzonePrompt}>
                  Click to select or drag and drop your PDF here
                </Text>
                <View style={styles.badgeRow}>
                  <View style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>Supported format: PDF</Text>
                  </View>
                  <Text style={styles.maxSizeText}>Max size: 20 MB</Text>
                </View>
                <TouchableOpacity
                  onPress={handleSelectFile}
                  style={styles.browseButton}
                  activeOpacity={0.8}
                >
                  <UploadCloud size={15} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.browseButtonText}>Upload PDF</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.selectedFileContainer}>
                <View style={styles.fileIconBox}>
                  <FileCheck size={28} color={D.green} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {selectedFile.name || 'medical_report.pdf'}
                  </Text>
                  <Text style={styles.selectedFileSize}>
                    {formatFileSize(selectedFile.size)} · PDF ready to scan &amp; sync
                  </Text>
                </View>
                {!uploading && (
                  <TouchableOpacity
                    onPress={() => setSelectedFile(null)}
                    style={styles.removeFileBtn}
                  >
                    <X size={16} color="#888" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </div>

          {/* Action Button & Loading Progress */}
          {selectedFile && !uploading && (
            <TouchableOpacity
              onPress={handleScanReport}
              style={styles.scanButton}
              activeOpacity={0.85}
            >
              <UploadCloud size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.scanButtonText}>Scan Medical Report (OCR)</Text>
            </TouchableOpacity>
          )}

          {uploading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={C.orange} style={{ marginRight: 10 }} />
              <Text style={styles.progressText}>{scanStep || 'Processing OCR & Cloud Storage...'}</Text>
            </View>
          )}

          {/* Alerts / Error State */}
          {errorMsg ? (
            <View style={styles.errorAlert}>
              <AlertCircle size={16} color={D.red} style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.errorAlertText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successAlert}>
              <CheckCircle2 size={16} color={D.green} style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.successAlertText}>{successMsg}</Text>
            </View>
          ) : null}
        </View>

        {/* ─────────────────────────────────────────────────────────────
            SECTION 2: SAVED REPORTS (Persistent Cloud Storage)
            ───────────────────────────────────────────────────────────── */}
        <View style={styles.savedSection}>
          <View style={styles.savedSectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FileSpreadsheet size={18} color={C.orange} style={{ marginRight: 8 }} />
              <Text style={styles.savedSectionTitle}>Saved Medical Reports</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{reportsList.length} Saved</Text>
            </View>
          </View>

          {loadingReports ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={C.orange} style={{ marginBottom: 8 }} />
              <Text style={styles.loadingText}>Syncing medical reports from Cloud Firestore...</Text>
            </View>
          ) : reportsList.length === 0 ? (
            <View style={styles.emptySavedBox}>
              <FileText size={32} color="#4b5563" style={{ marginBottom: 8 }} />
              <Text style={styles.emptySavedTitle}>No medical reports saved yet</Text>
              <Text style={styles.emptySavedSubtitle}>
                Upload your first medical report PDF above. It will be persistently saved to your account and synced across all your devices.
              </Text>
            </View>
          ) : (
            <View style={styles.savedListContainer}>
              {reportsList.map((r) => {
                const reportId = r.id || r._id;
                const isSelected = activeReport && (activeReport.id === reportId || activeReport._id === reportId);
                const isCompleted = r.processingStatus === 'completed' || (!r.processingStatus && !r.analysis?.analysisFailed);
                const statusLabel = isCompleted ? 'Processed' : 'OCR Failed';

                return (
                  <View
                    key={reportId}
                    style={[
                      styles.savedCard,
                      isSelected && styles.savedCardSelected
                    ]}
                  >
                    <View style={styles.savedCardTop}>
                      <View style={styles.savedCardIconWrap}>
                        <FileText size={20} color={isSelected ? C.orange : '#94a3b8'} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.savedCardName} numberOfLines={1}>
                          {r.reportName || r.fileName || 'Blood Test Report'}
                        </Text>
                        <View style={styles.savedCardMetaRow}>
                          <Calendar size={12} color="#64748b" style={{ marginRight: 4 }} />
                          <Text style={styles.savedCardMeta}>
                            Uploaded: {formatDate(r.uploadedAt || r.uploadDate)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteReport(r)}
                        style={styles.cardDeleteBtn}
                        title="Delete report"
                      >
                        <Trash2 size={15} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.savedCardMiddle}>
                      <View
                        style={[
                          styles.statusBadge,
                          isCompleted ? styles.statusBadgeProcessed : styles.statusBadgeFailed
                        ]}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={12} color={D.green} style={{ marginRight: 4 }} />
                        ) : (
                          <AlertCircle size={12} color={D.yellow} style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isCompleted ? { color: D.green } : { color: D.yellow }
                          ]}
                        >
                          Status: {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.savedCardActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setActiveReport(r);
                          if (detailsRef.current && typeof detailsRef.current.scrollIntoView === 'function') {
                            detailsRef.current.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        style={[
                          styles.actionBtn,
                          isSelected ? styles.actionBtnActive : styles.actionBtnDefault
                        ]}
                        activeOpacity={0.8}
                      >
                        <Eye size={13} color={isSelected ? '#fff' : '#cbd5e1'} style={{ marginRight: 5 }} />
                        <Text
                          style={[
                            styles.actionBtnText,
                            isSelected && { color: '#fff', fontWeight: '700' }
                          ]}
                        >
                          {isSelected ? 'Viewing Report' : 'View Report'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOpenPdf(r.fileUrl || r.downloadUrl)}
                        style={[styles.actionBtn, styles.actionBtnOutline]}
                        activeOpacity={0.8}
                      >
                        <ExternalLink size={13} color="#38bdf8" style={{ marginRight: 5 }} />
                        <Text style={[styles.actionBtnText, { color: '#38bdf8' }]}>
                          Open PDF
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ─────────────────────────────────────────────────────────────
            ACTIVE REPORT DETAILS VIEW
            ───────────────────────────────────────────────────────────── */}
        {activeReport && (
          <div ref={detailsRef}>
            <View style={styles.detailsContainer}>
              {/* Report Header Bar */}
              <View style={styles.detailsBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailsBannerTitle}>Scanned Report Details</Text>
                  <Text style={styles.detailsBannerMeta}>
                    {activeReport.reportName || activeReport.fileName || 'Medical Report'} · Uploaded on {formatDate(activeReport.uploadedAt || activeReport.uploadDate)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleOpenPdf(activeReport.fileUrl || activeReport.downloadUrl)}
                  style={styles.openPdfBannerBtn}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={13} color="#fff" style={{ marginRight: 5 }} />
                  <Text style={styles.openPdfBannerBtnText}>Open Original PDF</Text>
                </TouchableOpacity>
              </View>

              {/* Grid for Patient & Medical Info */}
              <View style={[styles.infoGrid, isWide && styles.infoGridWide]}>
                {/* Card 1: Patient Information */}
                <View style={[styles.infoCard, isWide && { flex: 1 }]}>
                  <View style={styles.cardTitleRow}>
                    <User size={15} color={C.orange} style={{ marginRight: 6 }} />
                    <Text style={styles.cardTitle}>Patient Information</Text>
                  </View>

                  <View style={styles.fieldList}>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Patient Name</Text>
                      <Text style={[styles.fieldValue, patientInfo.name === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.name || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Age</Text>
                      <Text style={[styles.fieldValue, patientInfo.age === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.age && patientInfo.age !== 'Not detected' ? `${patientInfo.age} years` : 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Gender / Sex</Text>
                      <Text style={[styles.fieldValue, patientInfo.gender === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.gender || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Patient ID</Text>
                      <Text style={[styles.fieldValue, patientInfo.patientId === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.patientId || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Date of Birth</Text>
                      <Text style={[styles.fieldValue, patientInfo.dob === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.dob || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Report Date</Text>
                      <Text style={[styles.fieldValue, patientInfo.reportDate === 'Not detected' && styles.fieldNotDetected]}>
                        {patientInfo.reportDate || 'Not detected'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card 2: Medical Information */}
                <View style={[styles.infoCard, isWide && { flex: 1 }]}>
                  <View style={styles.cardTitleRow}>
                    <Stethoscope size={15} color={C.orange} style={{ marginRight: 6 }} />
                    <Text style={styles.cardTitle}>Medical Information</Text>
                  </View>

                  <View style={styles.fieldList}>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Diagnosis</Text>
                      <Text style={[styles.fieldValue, medicalInfo.diagnosis === 'Not detected' && styles.fieldNotDetected]}>
                        {medicalInfo.diagnosis || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Symptoms</Text>
                      <Text style={[styles.fieldValue, medicalInfo.symptoms === 'Not detected' && styles.fieldNotDetected]}>
                        {medicalInfo.symptoms || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Conditions</Text>
                      <Text style={[styles.fieldValue, medicalInfo.conditions === 'Not detected' && styles.fieldNotDetected]}>
                        {medicalInfo.conditions || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Allergies</Text>
                      <Text style={[styles.fieldValue, (!medicalInfo.allergies || medicalInfo.allergies === 'Not detected' || (Array.isArray(medicalInfo.allergies) && medicalInfo.allergies.length === 0)) && styles.fieldNotDetected]}>
                        {Array.isArray(medicalInfo.allergies) ? (medicalInfo.allergies.length > 0 ? medicalInfo.allergies.join(', ') : 'Not detected') : (medicalInfo.allergies || 'Not detected')}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Medications</Text>
                      <Text style={[styles.fieldValue, (!medicalInfo.medications || medicalInfo.medications === 'Not detected' || (Array.isArray(medicalInfo.medications) && medicalInfo.medications.length === 0)) && styles.fieldNotDetected]}>
                        {Array.isArray(medicalInfo.medications) ? (medicalInfo.medications.length > 0 ? medicalInfo.medications.join(', ') : 'Not detected') : (medicalInfo.medications || 'Not detected')}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Physician / Doctor</Text>
                      <Text style={[styles.fieldValue, medicalInfo.doctorName === 'Not detected' && styles.fieldNotDetected]}>
                        {medicalInfo.doctorName || 'Not detected'}
                      </Text>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Laboratory / Clinic</Text>
                      <Text style={[styles.fieldValue, medicalInfo.hospitalName === 'Not detected' && styles.fieldNotDetected]}>
                        {medicalInfo.hospitalName || 'Not detected'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Card 3: Test Results Table */}
              <View style={styles.tableCard}>
                <View style={styles.cardTitleRow}>
                  <Activity size={16} color={C.orange} style={{ marginRight: 6 }} />
                  <Text style={styles.cardTitle}>Test Results</Text>
                  <Text style={styles.tableCountBadge}>
                    {testResults.length} parameters detected
                  </Text>
                </View>

                {testResults.length === 0 ? (
                  <View style={styles.emptyTableBox}>
                    <Text style={styles.emptyTableText}>
                      No individual numeric laboratory test rows were recognized in this report.
                    </Text>
                  </View>
                ) : (
                  <div style={{ overflowX: 'auto', width: '100%', marginTop: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#8f97a6' }}>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Test Name</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Result</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Unit</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600 }}>Reference Range</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.map((t, idx) => {
                          const statusLower = (t.status || '').toLowerCase();
                          const isHigh = statusLower === 'high' || statusLower === 'critical';
                          const isLow  = statusLower === 'low';
                          const isNormal = statusLower === 'normal';

                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '12px 8px', fontWeight: 600, color: '#f8fafc' }}>
                                {t.testName || t.test || t.name || 'Parameter'}
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: isHigh ? D.red : isLow ? D.yellow : '#fff' }}>
                                {t.result || t.value || '—'}
                              </td>
                              <td style={{ padding: '12px 8px', color: '#8f97a6' }}>
                                {t.unit && t.unit !== 'Not detected' ? t.unit : '—'}
                              </td>
                              <td style={{ padding: '12px 8px', color: '#8f97a6' }}>
                                {t.referenceRange && t.referenceRange !== 'Not detected' ? t.referenceRange : '—'}
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    backgroundColor: isHigh ? D.redBg : isLow ? D.yellowBg : isNormal ? D.greenBg : 'rgba(255,255,255,0.06)',
                                    color: isHigh ? D.red : isLow ? D.yellow : isNormal ? D.green : '#94a3b8',
                                    border: `1px solid ${isHigh ? D.redBr : isLow ? D.yellowBr : isNormal ? D.greenBr : 'rgba(255,255,255,0.1)'}`
                                  }}
                                >
                                  {t.status || 'Not detected'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </View>

              {/* Card 4: View Raw OCR Text */}
              <View style={styles.rawTextCard}>
                <TouchableOpacity
                  onPress={() => setRawTextExpanded(v => !v)}
                  style={styles.rawTextHeader}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FileText size={15} color={C.orange} style={{ marginRight: 6 }} />
                    <Text style={styles.rawTextTitle}>View Raw OCR Text</Text>
                  </View>
                  {rawTextExpanded ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
                </TouchableOpacity>

                {rawTextExpanded && (
                  <View style={styles.rawTextBody}>
                    <View style={styles.rawTextActions}>
                      <Text style={styles.rawTextPrompt}>Exact text recognized from the PDF document:</Text>
                      <TouchableOpacity
                        onPress={() => handleCopyRawText(rawOcrText)}
                        style={styles.copyBtn}
                      >
                        {copiedRawText ? (
                          <>
                            <Check size={12} color={D.green} style={{ marginRight: 4 }} />
                            <Text style={[styles.copyBtnText, { color: D.green }]}>Copied</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={12} color="#aaa" style={{ marginRight: 4 }} />
                            <Text style={styles.copyBtnText}>Copy Text</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <div
                      className="ocr-raw-text"
                      style={{
                        backgroundColor: '#0c0e12',
                        padding: 14,
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#cbd5e1',
                        maxHeight: 280,
                        overflowY: 'auto'
                      }}
                    >
                      {rawOcrText || 'No text recognized.'}
                    </div>
                  </View>
                )}
              </View>

              {/* Card 5: Medical Information Safety Disclaimer */}
              <View style={styles.safetyCard}>
                <ShieldAlert size={16} color={C.orange} style={{ marginRight: 8, flexShrink: 0, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.safetyTitle}>Medical Information Safety</Text>
                  <Text style={styles.safetyText}>
                    This system securely extracts and organizes clinical parameters directly from your uploaded report for dietary and nutritional insights. It does not provide clinical diagnoses or replace professional medical assessment. Always consult a licensed healthcare practitioner.
                  </Text>
                </View>
              </View>
            </View>
          </div>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1b1e26',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8f97a6',
    marginTop: 1,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
  },

  // 1. Upload Card
  uploadCard: {
    backgroundColor: D.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: D.border,
    padding: 18,
    marginTop: 16,
  },
  uploadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,107,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  uploadCardSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    lineHeight: 18,
  },
  dropzonePrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  formatBadge: {
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
  },
  maxSizeText: {
    fontSize: 11,
    color: '#71717a',
  },
  browseButton: {
    backgroundColor: '#262933',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  browseButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 8,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: D.greenBg,
    borderWidth: 1,
    borderColor: D.greenBr,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  selectedFileSize: {
    fontSize: 11,
    color: '#8f97a6',
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  scanButton: {
    backgroundColor: C.orange,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,53,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.18)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.orange,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.redBg,
    borderWidth: 1,
    borderColor: D.redBr,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorAlertText: {
    fontSize: 12,
    color: D.red,
    flex: 1,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.greenBg,
    borderWidth: 1,
    borderColor: D.greenBr,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  successAlertText: {
    fontSize: 12,
    color: D.green,
    fontWeight: '600',
    flex: 1,
  },

  // 2. Saved Reports Section
  savedSection: {
    marginTop: 24,
  },
  savedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  savedSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  loadingBox: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#8f97a6',
  },
  emptySavedBox: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptySavedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 4,
  },
  emptySavedSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 380,
  },
  savedListContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  savedCard: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 14,
    transition: 'border-color 0.2s ease',
  },
  savedCardSelected: {
    borderColor: C.orange,
    backgroundColor: '#191d26',
  },
  savedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#20242f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  savedCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  savedCardMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  cardDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  savedCardMiddle: {
    marginVertical: 10,
    flexDirection: 'row',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeProcessed: {
    backgroundColor: D.greenBg,
    borderColor: D.greenBr,
  },
  statusBadgeFailed: {
    backgroundColor: D.yellowBg,
    borderColor: D.yellowBr,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  savedCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDefault: {
    backgroundColor: '#242833',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionBtnActive: {
    backgroundColor: C.orange,
    borderWidth: 1,
    borderColor: C.orange,
  },
  actionBtnOutline: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },

  // 3. Details Section
  detailsContainer: {
    marginTop: 28,
  },
  detailsBanner: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  detailsBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  detailsBannerMeta: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  openPdfBannerBtn: {
    backgroundColor: C.orange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  openPdfBannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  infoGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  infoGridWide: {
    flexDirection: 'row',
  },
  infoCard: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  fieldList: {
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#8f97a6',
  },
  fieldValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  fieldNotDetected: {
    color: '#6b7280',
    fontStyle: 'italic',
    fontWeight: '400',
  },

  // Test Results Table Card
  tableCard: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 14,
    marginBottom: 12,
  },
  tableCountBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: C.orange,
    backgroundColor: 'rgba(255,107,53,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  emptyTableBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },

  // Raw OCR Text
  rawTextCard: {
    backgroundColor: D.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: D.border,
    padding: 14,
    marginBottom: 12,
  },
  rawTextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rawTextTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  rawTextBody: {
    marginTop: 12,
  },
  rawTextActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rawTextPrompt: {
    fontSize: 11,
    color: '#888',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20242e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    color: '#ccc',
    fontWeight: '600',
  },

  // Safety Card
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,107,53,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.orange,
    marginBottom: 3,
  },
  safetyText: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
});
