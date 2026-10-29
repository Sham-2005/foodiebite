// ─────────────────────────────────────────────────────────────
//  frontend/src/components/AdminIntelligenceSection.js
//  Feature 5: Advanced Admin Intelligence Dashboard
//  Sub-navigation and Interactive Intelligence Views:
//  1. Overview (Executive KPIs, DAU/WAU/MAU, Trending Categories)
//  2. Recommendation Performance (CTR, Conversions, Strategy Comparisons, CSV Export)
//  3. Food Trends (Zero-baseline classification, rankings, day-of-week heatmap)
//  4. User Segmentation (Python ML K-Means clustering, silhouette scores, segment profiles)
//  5. A/B Experiments (Deterministic assignment, exposure tracking, Two-Proportion Z-Tests)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform
} from 'react-native';
import {
  LayoutDashboard,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Users,
  FlaskConical,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Filter,
  Search,
  Heart,
  Eye,
  Sparkles,
  Layers,
  Award,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react-native';

import {
  apiGetAnalyticsOverview,
  apiGetRecommendationPerformance,
  apiGetFoodTrends,
  apiGetSegmentation,
  apiRefreshSegmentation,
  apiGetExperiments,
  apiCreateExperiment,
  apiUpdateExperimentStatus,
  apiGetExperimentResults,
  getRecommendationPerformanceCsvUrl
} from '../services/api';

const C = {
  bg: '#111318',
  card: '#1e1e1e',
  card2: '#252932',
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(255, 107, 53, 0.4)',
  orange: '#FF6B35',
  green: '#10B981',
  blue: '#38BDF8',
  purple: '#A855F7',
  amber: '#F59E0B',
  red: '#EF4444',
  muted: '#94a3b8',
  muted2: '#64748b',
  text: '#ffffff'
};

const SUB_TABS = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'recommendations', label: 'Recommendation Performance', icon: BarChart2 },
  { id: 'trends', label: 'Food Trends', icon: TrendingUp },
  { id: 'segmentation', label: 'User Segmentation (ML)', icon: Users },
  { id: 'experiments', label: 'A/B Experiments', icon: FlaskConical }
];

export default function AdminIntelligenceSection() {
  const [subTab, setSubTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [recPerfData, setRecPerfData] = useState(null);
  const [recDateRange, setRecDateRange] = useState('30');
  const [recCategoryFilter, setRecCategoryFilter] = useState('All');
  const [recStrategyFilter, setRecStrategyFilter] = useState('All');

  const [trendData, setTrendData] = useState(null);
  const [trendDays, setTrendDays] = useState(7);
  const [trendCategoryFilter, setTrendCategoryFilter] = useState('All');

  const [segmentationData, setSegmentationData] = useState(null);
  const [refreshingSeg, setRefreshingSeg] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  const [experimentsData, setExperimentsData] = useState([]);
  const [selectedExpResults, setSelectedExpResults] = useState(null);
  const [selectedExpId, setSelectedExpId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpTraffic, setNewExpTraffic] = useState('50');
  const [creatingExp, setCreatingExp] = useState(false);

  // Load section data based on active subTab
  useEffect(() => {
    loadSubTabData(subTab);
  }, [subTab]);

  const loadSubTabData = async (tab) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'overview') {
        const res = await apiGetAnalyticsOverview();
        if (res.success) setOverviewData(res);
      } else if (tab === 'recommendations') {
        const res = await apiGetRecommendationPerformance({
          foodCategory: recCategoryFilter,
          recommendationStrategy: recStrategyFilter
        });
        if (res.success) setRecPerfData(res);
      } else if (tab === 'trends') {
        const res = await apiGetFoodTrends({
          days: trendDays,
          category: trendCategoryFilter
        });
        if (res.success) setTrendData(res);
      } else if (tab === 'segmentation') {
        const res = await apiGetSegmentation();
        if (res.success) setSegmentationData(res.model);
      } else if (tab === 'experiments') {
        const res = await apiGetExperiments();
        if (res.success) {
          setExperimentsData(res.experiments || []);
          if (res.experiments && res.experiments.length > 0) {
            const firstId = res.experiments[0].id;
            setSelectedExpId(firstId);
            loadExperimentResults(firstId);
          }
        }
      }
    } catch (err) {
      console.error(`Error loading sub-tab ${tab}:`, err);
      setError(err.message || 'Failed to fetch analytics intelligence.');
    } finally {
      setLoading(false);
    }
  };

  const loadExperimentResults = async (id) => {
    try {
      const res = await apiGetExperimentResults(id);
      if (res.success) setSelectedExpResults(res);
    } catch (err) {
      console.warn('Load experiment results note:', err.message);
    }
  };

  const handleRefreshSegmentation = async () => {
    setShowRefreshConfirm(false);
    setRefreshingSeg(true);
    try {
      const res = await apiRefreshSegmentation();
      if (res.success && res.model) {
        setSegmentationData(res.model);
      }
    } catch (err) {
      alert(`Model refresh failed: ${err.message}`);
    } finally {
      setRefreshingSeg(false);
    }
  };

  const handleCreateExperimentSubmit = async () => {
    if (!newExpName.trim()) {
      alert('Please enter an experiment title.');
      return;
    }
    setCreatingExp(true);
    try {
      const res = await apiCreateExperiment({
        name: newExpName.trim(),
        description: newExpDesc.trim(),
        trafficAllocation: parseInt(newExpTraffic, 10) || 50
      });
      if (res.success) {
        setShowCreateModal(false);
        setNewExpName('');
        setNewExpDesc('');
        // Reload experiments
        loadSubTabData('experiments');
      }
    } catch (err) {
      alert(`Failed to create experiment: ${err.message}`);
    } finally {
      setCreatingExp(false);
    }
  };

  const handleExperimentStatusChange = async (id, status) => {
    try {
      await apiUpdateExperimentStatus(id, status);
      loadSubTabData('experiments');
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    const url = getRecommendationPerformanceCsvUrl({
      foodCategory: recCategoryFilter,
      recommendationStrategy: recStrategyFilter
    });
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Sub-Navigation Bar ───────────────────────────────── */}
      <View style={styles.subNavBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subNavScroll}>
          {SUB_TABS.map(tab => {
            const Icon = tab.icon;
            const isSel = subTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSubTab(tab.id)}
                style={[styles.subNavBtn, isSel && styles.subNavBtnActive]}
                activeOpacity={0.7}
              >
                <Icon size={14} color={isSel ? '#fff' : C.muted} />
                <Text style={[styles.subNavBtnText, isSel && styles.subNavBtnTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Main Content Area ───────────────────────────────── */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={C.orange} />
          <Text style={styles.loadingText}>Computing analytics intelligence...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <ShieldAlert size={36} color={C.red} />
          <Text style={styles.errorTitle}>Analytics Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadSubTabData(subTab)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry Load</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 18 }}>

          {/* ═══════════ SUB-TAB 1: OVERVIEW ═══════════ */}
          {subTab === 'overview' && overviewData && (
            <View style={{ gap: 18 }}>
              {/* Executive KPI Grid */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Users size={18} color={C.orange} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.totalUsers}</Text>
                  <Text style={styles.kpiLabel}>Total Registered Users</Text>
                  <Text style={styles.kpiSub}>Authoritative user accounts</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Sparkles size={18} color={C.green} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.dau}</Text>
                  <Text style={styles.kpiLabel}>Daily Active Users (DAU)</Text>
                  <Text style={styles.kpiSub}>Active within 24h</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Calendar size={18} color={C.blue} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.wau}</Text>
                  <Text style={styles.kpiLabel}>Weekly Active Users (WAU)</Text>
                  <Text style={styles.kpiSub}>Active within 7 days</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Award size={18} color={C.purple} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.mau}</Text>
                  <Text style={styles.kpiLabel}>Monthly Active Users (MAU)</Text>
                  <Text style={styles.kpiSub}>Active within 30 days</Text>
                </View>
              </View>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <BarChart2 size={18} color={C.amber} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.recommendationImpressions}</Text>
                  <Text style={styles.kpiLabel}>Recommendation Impressions</Text>
                  <Text style={styles.kpiSub}>Visible cards rendered</Text>
                </View>

                <View style={styles.kpiCard}>
                  <TrendingUp size={18} color={C.green} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.ctr}%</Text>
                  <Text style={styles.kpiLabel}>Recommendation CTR</Text>
                  <Text style={styles.kpiSub}>{overviewData.kpis.recommendationClicks} clicks</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Search size={18} color={C.blue} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.totalSearches}</Text>
                  <Text style={styles.kpiLabel}>Food Searches Executed</Text>
                  <Text style={styles.kpiSub}>Total discovery queries</Text>
                </View>

                <View style={styles.kpiCard}>
                  <FlaskConical size={18} color={C.orange} style={{ marginBottom: 6 }} />
                  <Text style={styles.kpiValue}>{overviewData.kpis.activeExperiments}</Text>
                  <Text style={styles.kpiLabel}>Active A/B Experiments</Text>
                  <Text style={styles.kpiSub}>Running live variants</Text>
                </View>
              </View>

              {/* Top Categories and Cuisines Row */}
              <View style={styles.twoColumnGrid}>
                <View style={styles.cardPanel}>
                  <Text style={styles.panelTitle}>Top Trending Food Categories</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {overviewData.topCategories.length === 0 ? (
                      <Text style={styles.emptyNote}>No category engagement recorded yet.</Text>
                    ) : (
                      overviewData.topCategories.map((c, i) => (
                        <View key={i} style={styles.rankedRow}>
                          <Text style={styles.rankBadge}>#{i + 1}</Text>
                          <Text style={styles.rankedName}>{c.category}</Text>
                          <Text style={styles.rankedCount}>{c.count} interactions</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.cardPanel}>
                  <Text style={styles.panelTitle}>Top Cuisines Discovered</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {overviewData.topCuisines.length === 0 ? (
                      <Text style={styles.emptyNote}>No cuisine engagement recorded yet.</Text>
                    ) : (
                      overviewData.topCuisines.map((c, i) => (
                        <View key={i} style={styles.rankedRow}>
                          <Text style={styles.rankBadge}>#{i + 1}</Text>
                          <Text style={styles.rankedName}>{c.cuisine}</Text>
                          <Text style={styles.rankedCount}>{c.count} interactions</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ═══════════ SUB-TAB 2: RECOMMENDATION PERFORMANCE ═══════════ */}
          {subTab === 'recommendations' && recPerfData && (
            <View style={{ gap: 18 }}>
              {/* Controls bar: Category filter, Strategy filter, CSV export */}
              <View style={styles.controlsBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                  <Text style={styles.controlsLabel}>Strategy:</Text>
                  {['All', 'general', 'preference_based', 'context_aware'].map(strat => (
                    <TouchableOpacity
                      key={strat}
                      onPress={() => {
                        setRecStrategyFilter(strat);
                        apiGetRecommendationPerformance({ recommendationStrategy: strat, foodCategory: recCategoryFilter }).then(setRecPerfData);
                      }}
                      style={[styles.filterChip, recStrategyFilter === strat && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, recStrategyFilter === strat && styles.filterChipTextActive]}>
                        {strat.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity onPress={handleExportCsv} style={styles.exportBtn}>
                  <Download size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.exportBtnText}>Export CSV</Text>
                </TouchableOpacity>
              </View>

              {/* Recommendation KPIs */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{recPerfData.kpis.ctr}%</Text>
                  <Text style={styles.kpiLabel}>Recommendation CTR</Text>
                  <Text style={styles.kpiSub}>{recPerfData.kpis.totalClicks} clicks / {recPerfData.kpis.totalImpressions} imps</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{recPerfData.kpis.favoriteConversionRate}%</Text>
                  <Text style={styles.kpiLabel}>Favorite Conversion Rate</Text>
                  <Text style={styles.kpiSub}>{recPerfData.kpis.totalFavorites} items favorited</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{recPerfData.kpis.searchSuccessRate}%</Text>
                  <Text style={styles.kpiLabel}>Search Success Rate</Text>
                  <Text style={styles.kpiSub}>Searches leading to click</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{recPerfData.kpis.catalogCoveragePercent}%</Text>
                  <Text style={styles.kpiLabel}>Catalog Coverage</Text>
                  <Text style={styles.kpiSub}>{recPerfData.kpis.distinctFoodsRecommended} distinct foods</Text>
                </View>
              </View>

              {/* Performance by Strategy Comparison Table */}
              <View style={styles.cardPanel}>
                <Text style={styles.panelTitle}>Performance by Recommendation Strategy</Text>
                <Text style={styles.panelSubtitle}>Comparative analysis of baseline, preference-based, and context-aware recommendation strategies.</Text>
                
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Strategy</Text>
                    <Text style={styles.tableHeaderCell}>Impressions</Text>
                    <Text style={styles.tableHeaderCell}>Clicks</Text>
                    <Text style={styles.tableHeaderCell}>Favorites</Text>
                    <Text style={[styles.tableHeaderCell, { color: C.orange }]}>CTR</Text>
                  </View>
                  {recPerfData.strategyBreakdown.map((s, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCellBold, { flex: 2 }]}>{s.label}</Text>
                      <Text style={styles.tableCell}>{s.impressions}</Text>
                      <Text style={styles.tableCell}>{s.clicks}</Text>
                      <Text style={styles.tableCell}>{s.favorites}</Text>
                      <Text style={[styles.tableCellBold, { color: C.green }]}>{s.ctr}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Feedback Distribution */}
              <View style={styles.cardPanel}>
                <Text style={styles.panelTitle}>Recommendation Feedback Rating Distribution</Text>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                  <View style={[styles.feedbackBox, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                    <Text style={[styles.feedbackValue, { color: C.green }]}>{recPerfData.feedbackDistribution.positive}</Text>
                    <Text style={styles.feedbackLabel}>Positive (4-5 ⭐)</Text>
                  </View>
                  <View style={[styles.feedbackBox, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                    <Text style={[styles.feedbackValue, { color: C.amber }]}>{recPerfData.feedbackDistribution.neutral}</Text>
                    <Text style={styles.feedbackLabel}>Neutral (3 ⭐)</Text>
                  </View>
                  <View style={[styles.feedbackBox, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <Text style={[styles.feedbackValue, { color: C.red }]}>{recPerfData.feedbackDistribution.negative}</Text>
                    <Text style={styles.feedbackLabel}>Negative (1-2 ⭐)</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ═══════════ SUB-TAB 3: FOOD TRENDS ═══════════ */}
          {subTab === 'trends' && trendData && (
            <View style={{ gap: 18 }}>
              {/* Time Window Buttons */}
              <View style={styles.controlsBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.controlsLabel}>Period Window:</Text>
                  {[7, 14, 30].map(d => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => {
                        setTrendDays(d);
                        apiGetFoodTrends({ days: d, category: trendCategoryFilter }).then(setTrendData);
                      }}
                      style={[styles.filterChip, trendDays === d && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, trendDays === d && styles.filterChipTextActive]}>
                        Last {d} Days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Trending Foods Table with Zero-Baseline Handling */}
              <View style={styles.cardPanel}>
                <Text style={styles.panelTitle}>Food Discovery & Popularity Trends</Text>
                <Text style={styles.panelSubtitle}>
                  Period-over-period comparison with zero-baseline handling and classification into Trending Up, Trending Down, Stable, and Newly Emerging.
                </Text>

                {trendData.trendingFoods.length === 0 ? (
                  <Text style={styles.emptyNote}>No food trends recorded in this period window yet.</Text>
                ) : (
                  <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Food Item</Text>
                      <Text style={styles.tableHeaderCell}>Category</Text>
                      <Text style={styles.tableHeaderCell}>Current Vol</Text>
                      <Text style={styles.tableHeaderCell}>Prev Vol</Text>
                      <Text style={styles.tableHeaderCell}>Change</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Trend Status</Text>
                    </View>

                    {trendData.trendingFoods.map((f, idx) => (
                      <View key={idx} style={styles.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.tableCellBold}>{f.foodName}</Text>
                          <Text style={styles.tableCellSub}>{f.cuisine}</Text>
                        </View>
                        <Text style={styles.tableCell}>{f.category}</Text>
                        <Text style={styles.tableCell}>{f.currentVolume}</Text>
                        <Text style={styles.tableCell}>{f.previousVolume}</Text>
                        <Text style={[
                          styles.tableCellBold,
                          f.absoluteChange > 0 ? { color: C.green } : (f.absoluteChange < 0 ? { color: C.red } : { color: C.muted })
                        ]}>
                          {f.absoluteChange > 0 ? `+${f.absoluteChange}` : f.absoluteChange}
                          {f.percentageChange !== null && f.percentageChange !== undefined && (
                            <Text style={{ fontSize: 10, color: C.muted }}> ({f.percentageChange > 0 ? `+${f.percentageChange}%` : `${f.percentageChange}%`})</Text>
                          )}
                        </Text>
                        <View style={{ flex: 1.5, alignItems: 'flex-start' }}>
                          <View style={[styles.statusBadge, { backgroundColor: `${f.badgeColor}20`, borderColor: f.badgeColor }]}>
                            <Text style={[styles.statusBadgeText, { color: f.badgeColor }]}>
                              {f.classification}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Day-of-Week Discovery Heatmap */}
              <View style={styles.cardPanel}>
                <Text style={styles.panelTitle}>Day-of-Week Discovery Activity</Text>
                <View style={styles.heatmapRow}>
                  {trendData.dayOfWeekActivity.map((d, i) => (
                    <View key={i} style={styles.heatmapColumn}>
                      <View style={[
                        styles.heatmapBar,
                        { height: Math.max(12, Math.min(100, (d.count / Math.max(1, ...trendData.dayOfWeekActivity.map(x => x.count))) * 100)) }
                      ]} />
                      <Text style={styles.heatmapDay}>{d.day}</Text>
                      <Text style={styles.heatmapCount}>{d.count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ═══════════ SUB-TAB 4: USER SEGMENTATION (ML) ═══════════ */}
          {subTab === 'segmentation' && (
            <View style={{ gap: 18 }}>
              {/* Header card with ML Model Evaluation Metrics */}
              <View style={styles.cardPanel}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <View>
                    <Text style={styles.panelTitle}>Machine Learning Behavioral Segmentation</Text>
                    <Text style={styles.panelSubtitle}>
                      Trained with scikit-learn K-Means and Silhouette Score analysis on privacy-conscious discovery features.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowRefreshConfirm(true)}
                    disabled={refreshingSeg}
                    style={styles.refreshModelBtn}
                  >
                    {refreshingSeg ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <RefreshCw size={13} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.refreshModelBtnText}>Retrain Model</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {segmentationData && segmentationData.status === 'ready' && (
                  <View style={styles.modelMetaGrid}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Model Version:</Text>
                      <Text style={styles.metaPillValue}>{segmentationData.modelVersion}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Algorithm:</Text>
                      <Text style={styles.metaPillValue}>{segmentationData.algorithm}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Silhouette Score:</Text>
                      <Text style={[styles.metaPillValue, { color: C.green }]}>{segmentationData.silhouetteScore}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillLabel}>Users Analyzed:</Text>
                      <Text style={styles.metaPillValue}>{segmentationData.eligibleUsersCount}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Insufficient Data State */}
              {segmentationData && segmentationData.status === 'insufficient_data' ? (
                <View style={styles.insufficientBox}>
                  <AlertCircle size={32} color={C.amber} style={{ marginBottom: 8 }} />
                  <Text style={styles.insufficientTitle}>Insufficient Data for ML Clustering</Text>
                  <Text style={styles.insufficientText}>{segmentationData.message}</Text>
                  <Text style={styles.insufficientSub}>
                    Clusters are not fabricated; real clustering will activate automatically once minimum profile threshold is reached.
                  </Text>
                </View>
              ) : segmentationData && segmentationData.clusters ? (
                /* Discovered Behavioral Clusters Grid */
                <View style={styles.clustersGrid}>
                  {segmentationData.clusters.map((c, idx) => (
                    <View key={idx} style={[styles.clusterCard, { borderTopColor: c.badgeColor, borderTopWidth: 3 }]}>
                      <View style={styles.clusterCardHeader}>
                        <View>
                          <Text style={styles.clusterLabel}>{c.label}</Text>
                          <Text style={styles.clusterSub}>{c.size} users ({c.percentage}% of cohort)</Text>
                        </View>
                        <View style={[styles.clusterBadge, { backgroundColor: `${c.badgeColor}20` }]}>
                          <Text style={[styles.clusterBadgeText, { color: c.badgeColor }]}>Cluster #{c.clusterId}</Text>
                        </View>
                      </View>

                      <Text style={styles.clusterDesc}>{c.description}</Text>

                      {c.centroid && (
                        <View style={styles.centroidMetrics}>
                          <View style={styles.centroidMetric}>
                            <Text style={styles.centroidVal}>{c.centroid.searchesCount || 0}</Text>
                            <Text style={styles.centroidLab}>Avg Searches</Text>
                          </View>
                          <View style={styles.centroidMetric}>
                            <Text style={styles.centroidVal}>{c.centroid.cuisineDiversity || 0}</Text>
                            <Text style={styles.centroidLab}>Cuisine Diversity</Text>
                          </View>
                          <View style={styles.centroidMetric}>
                            <Text style={styles.centroidVal}>{(c.centroid.recommendationCtr * 100).toFixed(0)}%</Text>
                            <Text style={styles.centroidLab}>Recommendation CTR</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Model Retraining Confirmation Modal */}
              <Modal visible={showRefreshConfirm} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalBox}>
                    <Text style={styles.modalTitle}>Confirm Clustering Retraining</Text>
                    <Text style={styles.modalDesc}>
                      Retraining invokes the Python scikit-learn K-Means model on the latest user interaction dataset. This recalculates cluster centroids and silhouette scores.
                    </Text>
                    <View style={styles.modalActions}>
                      <TouchableOpacity onPress={() => setShowRefreshConfirm(false)} style={styles.modalCancelBtn}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleRefreshSegmentation} style={styles.modalConfirmBtn}>
                        <Text style={styles.modalConfirmText}>Proceed Retraining</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          )}

          {/* ═══════════ SUB-TAB 5: A/B EXPERIMENTS ═══════════ */}
          {subTab === 'experiments' && (
            <View style={{ gap: 18 }}>
              {/* Header and Create Button */}
              <View style={styles.controlsBar}>
                <View>
                  <Text style={styles.panelTitle}>Recommendation A/B Experimentation</Text>
                  <Text style={styles.panelSubtitle}>Controlled experiments with deterministic variant hashing and Two-Proportion Z-Test statistics.</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createExpBtn}>
                  <Text style={styles.createExpBtnText}>+ New Experiment</Text>
                </TouchableOpacity>
              </View>

              {/* Experiments Selector Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {experimentsData.map(exp => (
                  <TouchableOpacity
                    key={exp.id}
                    onPress={() => {
                      setSelectedExpId(exp.id);
                      loadExperimentResults(exp.id);
                    }}
                    style={[
                      styles.expTabBtn,
                      selectedExpId === exp.id && styles.expTabBtnActive
                    ]}
                  >
                    <Text style={[styles.expTabBtnText, selectedExpId === exp.id && styles.expTabBtnTextActive]}>
                      {exp.name}
                    </Text>
                    <View style={[styles.expStatusBadge, exp.status === 'active' ? { backgroundColor: 'rgba(16,185,129,0.2)' } : { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <Text style={[styles.expStatusText, exp.status === 'active' ? { color: C.green } : { color: C.muted }]}>
                        {exp.status.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Selected Experiment Statistical Results */}
              {selectedExpResults && (
                <View style={{ gap: 16 }}>
                  {/* Experiment Status & Lifecycle Controls */}
                  <View style={styles.cardPanel}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <View>
                        <Text style={styles.expTitle}>{selectedExpResults.experiment.name}</Text>
                        <Text style={styles.expDesc}>{selectedExpResults.experiment.description}</Text>
                      </View>

                      {/* Lifecycle Buttons */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {selectedExpResults.experiment.status !== 'active' && (
                          <TouchableOpacity
                            onPress={() => handleExperimentStatusChange(selectedExpResults.experiment.id, 'active')}
                            style={[styles.lifecycleBtn, { backgroundColor: C.green }]}
                          >
                            <Text style={styles.lifecycleBtnText}>Activate</Text>
                          </TouchableOpacity>
                        )}
                        {selectedExpResults.experiment.status === 'active' && (
                          <TouchableOpacity
                            onPress={() => handleExperimentStatusChange(selectedExpResults.experiment.id, 'paused')}
                            style={[styles.lifecycleBtn, { backgroundColor: C.amber }]}
                          >
                            <Text style={styles.lifecycleBtnText}>Pause</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleExperimentStatusChange(selectedExpResults.experiment.id, 'completed')}
                          style={[styles.lifecycleBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                        >
                          <Text style={styles.lifecycleBtnText}>Complete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Variant Comparison Table */}
                    <View style={[styles.table, { marginTop: 14 }]}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Variant</Text>
                        <Text style={styles.tableHeaderCell}>Exposures (N)</Text>
                        <Text style={styles.tableHeaderCell}>Clicks (X)</Text>
                        <Text style={styles.tableHeaderCell}>Favorites</Text>
                        <Text style={[styles.tableHeaderCell, { color: C.orange }]}>CTR</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.tableCellBold}>Control</Text>
                          <Text style={styles.tableCellSub}>Standard Preferences</Text>
                        </View>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.control.exposures}</Text>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.control.clicks}</Text>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.control.favorites}</Text>
                        <Text style={[styles.tableCellBold, { color: C.blue }]}>{selectedExpResults.metrics.control.ctr}%</Text>
                      </View>
                      <View style={styles.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.tableCellBold}>Treatment</Text>
                          <Text style={styles.tableCellSub}>Context & Weather Boosted</Text>
                        </View>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.treatment.exposures}</Text>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.treatment.clicks}</Text>
                        <Text style={styles.tableCell}>{selectedExpResults.metrics.treatment.favorites}</Text>
                        <Text style={[styles.tableCellBold, { color: C.green }]}>{selectedExpResults.metrics.treatment.ctr}%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Two-Proportion Z-Test Statistical Evaluation Card */}
                  <View style={[styles.cardPanel, { borderColor: selectedExpResults.primaryAnalysis.badgeColor }]}>
                    <Text style={styles.panelTitle}>Two-Proportion Z-Test Hypothesis Testing</Text>
                    <Text style={styles.panelSubtitle}>
                      Evaluates whether the difference in click conversion between variants is statistically significant (α = 0.05).
                    </Text>

                    <View style={styles.statsGrid}>
                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>
                          {selectedExpResults.primaryAnalysis.absoluteDiff > 0 ? `+${selectedExpResults.primaryAnalysis.absoluteDiff}%` : `${selectedExpResults.primaryAnalysis.absoluteDiff}%`}
                        </Text>
                        <Text style={styles.statLab}>Absolute Difference (Δ)</Text>
                      </View>

                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>
                          {selectedExpResults.primaryAnalysis.relativeImprovement > 0 ? `+${selectedExpResults.primaryAnalysis.relativeImprovement}%` : `${selectedExpResults.primaryAnalysis.relativeImprovement}%`}
                        </Text>
                        <Text style={styles.statLab}>Relative Improvement</Text>
                      </View>

                      <View style={styles.statBox}>
                        <Text style={styles.statVal}>{selectedExpResults.primaryAnalysis.zScore}</Text>
                        <Text style={styles.statLab}>Z-Statistic</Text>
                      </View>

                      <View style={styles.statBox}>
                        <Text style={[styles.statVal, { color: selectedExpResults.primaryAnalysis.pValue < 0.05 ? C.green : C.amber }]}>
                          {selectedExpResults.primaryAnalysis.pValue}
                        </Text>
                        <Text style={styles.statLab}>p-Value (2-Tailed)</Text>
                      </View>
                    </View>

                    {/* Verdict Box */}
                    <View style={[styles.verdictBox, { backgroundColor: `${selectedExpResults.primaryAnalysis.badgeColor}15`, borderColor: selectedExpResults.primaryAnalysis.badgeColor }]}>
                      <Text style={[styles.verdictText, { color: selectedExpResults.primaryAnalysis.badgeColor }]}>
                        {selectedExpResults.primaryAnalysis.verdict}
                      </Text>
                      <Text style={styles.verdictSub}>
                        95% Confidence Interval for difference: [{selectedExpResults.primaryAnalysis.confidenceInterval95[0]}%, {selectedExpResults.primaryAnalysis.confidenceInterval95[1]}%]
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Create Experiment Modal */}
              <Modal visible={showCreateModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                  <View style={styles.modalBox}>
                    <Text style={styles.modalTitle}>Configure New A/B Experiment</Text>
                    <View style={{ gap: 12, marginTop: 12 }}>
                      <View>
                        <Text style={styles.inputLabel}>Experiment Name</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="e.g. Seasonal Weather Boost Test"
                          placeholderTextColor={C.muted2}
                          value={newExpName}
                          onChangeText={setNewExpName}
                        />
                      </View>
                      <View>
                        <Text style={styles.inputLabel}>Hypothesis / Description</Text>
                        <TextInput
                          style={[styles.modalInput, { height: 60 }]}
                          placeholder="Describe the variant strategy difference..."
                          placeholderTextColor={C.muted2}
                          multiline
                          value={newExpDesc}
                          onChangeText={setNewExpDesc}
                        />
                      </View>
                      <View>
                        <Text style={styles.inputLabel}>Traffic Allocation (% Treatment)</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="50"
                          keyboardType="numeric"
                          placeholderTextColor={C.muted2}
                          value={newExpTraffic}
                          onChangeText={setNewExpTraffic}
                        />
                      </View>
                    </View>

                    <View style={styles.modalActions}>
                      <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalCancelBtn}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleCreateExperimentSubmit}
                        disabled={creatingExp}
                        style={styles.modalConfirmBtn}
                      >
                        {creatingExp ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalConfirmText}>Save Draft</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          )}

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  subNavBar: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  subNavScroll: {
    gap: 6,
  },
  subNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  subNavBtnActive: {
    backgroundColor: C.orange,
  },
  subNavBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  subNavBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: C.muted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: C.orange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: C.muted2,
    marginTop: 2,
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  cardPanel: {
    flex: 1,
    minWidth: 280,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  panelSubtitle: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 8,
  },
  rankBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: C.orange,
    width: 24,
  },
  rankedName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  rankedCount: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '500',
  },
  emptyNote: {
    color: C.muted2,
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    flexWrap: 'wrap',
    gap: 10,
  },
  controlsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderColor: C.orange,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
  },
  filterChipTextActive: {
    color: C.orange,
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
    color: C.muted,
  },
  tableCellBold: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  tableCellSub: {
    fontSize: 10,
    color: C.muted2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  feedbackBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: C.card2,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  feedbackValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    marginTop: 4,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 30,
    paddingHorizontal: 8,
    height: 140,
  },
  heatmapColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  heatmapBar: {
    width: 24,
    backgroundColor: C.orange,
    borderRadius: 4,
  },
  heatmapDay: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  heatmapCount: {
    fontSize: 10,
    color: C.muted2,
  },
  refreshModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.orange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshModelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  modelMetaGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaPillLabel: {
    fontSize: 10,
    color: C.muted,
  },
  metaPillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  insufficientBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  insufficientTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.amber,
  },
  insufficientText: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  insufficientSub: {
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
  },
  clustersGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  clusterCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  clusterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clusterLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  clusterSub: {
    fontSize: 11,
    color: C.muted,
  },
  clusterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clusterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clusterDesc: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  centroidMetrics: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.card2,
    padding: 8,
    borderRadius: 8,
  },
  centroidMetric: {
    flex: 1,
    alignItems: 'center',
  },
  centroidVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  centroidLab: {
    fontSize: 9,
    color: C.muted,
  },
  createExpBtn: {
    backgroundColor: C.orange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createExpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  expTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expTabBtnActive: {
    borderColor: C.orange,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  expTabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
  },
  expTabBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  expStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  expTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  expDesc: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  lifecycleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  lifecycleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 110,
    backgroundColor: C.card2,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  statLab: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  verdictBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
  verdictText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verdictSub: {
    fontSize: 10,
    color: C.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1b1e27',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  modalDesc: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.orange,
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
