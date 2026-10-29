import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { BackHeader, C } from '../components/UI';
import { apiGetAnalyticsSummary } from '../services/api';
import { BarChart3, TrendingUp, Droplet, Dumbbell } from 'lucide-react-native';
import Svg, { Line, Rect, Text as SvgText, G } from 'react-native-svg';
import AppLayout from '../components/AppLayout';

export default function AnalyticsScreen() {
  const [range, setRange] = useState('7');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchSummary() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetAnalyticsSummary(range);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load analytics summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, [range]);

  // SVG Chart builders
  function renderCalorieChart(chartData) {
    if (!chartData || chartData.length === 0) return null;
    const maxVal = Math.max(...chartData.map(d => d.calories || 1000), 2000);
    const height = 120;
    const width = 300;
    const padding = 20;

    const barWidth = (width - padding * 2) / chartData.length - 6;

    return (
      <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 160 }}>
        {/* Draw grid lines */}
        <Line x1="0" y1={height - 20} x2={width} y2={height - 20} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <Line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {chartData.map((d, index) => {
          const val = d.calories || 0;
          const pct = val / maxVal;
          const barHeight = Math.max(5, pct * (height - 35));
          const x = padding + index * (barWidth + 6);
          const y = height - 20 - barHeight;
          const dateLabel = d.date.split('-')[2]; // Day number

          return (
            <G key={d.date}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill={C.orange}
                opacity={pct > 0.8 ? 0.9 : 0.6}
              />
              <SvgText x={x + barWidth / 2} y={height - 5} fontSize="8" fill={C.muted} textAnchor="middle">
                {dateLabel}
              </SvgText>
              {val > 0 && (
                <SvgText x={x + barWidth / 2} y={y - 4} fontSize="7" fill="#fff" fontWeight="700" textAnchor="middle">
                  {val}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    );
  }

  return (
    <AppLayout noPadding>
      <BackHeader title="Nutrition Insights" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* Selector pills */}
        <View style={styles.selectorRow}>
          <TouchableOpacity 
            onPress={() => setRange('7')} 
            style={[styles.selectorBtn, range === '7' ? { backgroundColor: C.orange, borderColor: C.orange } : { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Text style={styles.selectorBtnText}>Last 7 Days</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setRange('30')} 
            style={[styles.selectorBtn, range === '30' ? { backgroundColor: C.orange, borderColor: C.orange } : { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Text style={styles.selectorBtnText}>Last 30 Days</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.orange} />
            <Text style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>Loading nutritional charts...</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {data && !loading && (
          <View style={{ gap: 16 }}>
            {/* KPI Cards Grid using Flexbox */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <BarChart3 size={15} color={C.orange} />
                  <Text style={styles.kpiTitle}>Daily Calories</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {data.summary.avgDailyCalories} <Text style={styles.kpiUnit}>kcal</Text>
                </Text>
                <Text style={styles.kpiSub}>Average daily intake</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Dumbbell size={15} color="#10B981" />
                  <Text style={styles.kpiTitle}>Daily Protein</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {data.summary.avgDailyProtein} <Text style={styles.kpiUnit}>g</Text>
                </Text>
                <Text style={styles.kpiSub}>Target: 60g - 80g</Text>
              </View>
            </View>

            {/* Calories Chart Container */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Calorie Adherence Logs</Text>
              {data.chartData && data.chartData.length > 0 ? (
                renderCalorieChart(data.chartData)
              ) : (
                <Text style={styles.emptyChartText}>No logs recorded in this period.</Text>
              )}
            </View>

            {/* Macro Details Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Average Macronutrients</Text>
              <View style={{ gap: 10 }}>
                {/* Protein */}
                <View>
                  <View style={styles.macroHeader}>
                    <Text style={{ fontSize: 12, color: C.muted }}>Protein</Text>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: '#fff' }}>{data.summary.avgDailyProtein}g</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { backgroundColor: '#10B981', width: `${Math.min(100, (data.summary.avgDailyProtein / 70) * 100)}%` }]} />
                  </View>
                </View>

                {/* Carbs */}
                <View>
                  <View style={styles.macroHeader}>
                    <Text style={{ fontSize: 12, color: C.muted }}>Carbohydrates</Text>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: '#fff' }}>{data.summary.avgDailyCarbs}g</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { backgroundColor: C.orange, width: `${Math.min(100, (data.summary.avgDailyCarbs / 250) * 100)}%` }]} />
                  </View>
                </View>

                {/* Fat */}
                <View>
                  <View style={styles.macroHeader}>
                    <Text style={{ fontSize: 12, color: C.muted }}>Fats</Text>
                    <Text style={{ fontWeight: '700', fontSize: 12, color: '#fff' }}>{data.summary.avgDailyFat}g</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { backgroundColor: '#3b82f6', width: `${Math.min(100, (data.summary.avgDailyFat / 75) * 100)}%` }]} />
                  </View>
                </View>
              </View>
            </View>

            {/* Hydration Alert */}
            <View style={styles.hydrationCard}>
              <View style={styles.dropletIconBg}>
                <Droplet size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hydrationTitle}>Water Target Goal</Text>
                <Text style={styles.hydrationText}>
                  Your profile recommends drinking at least <Text style={{ fontWeight: '700', color: '#fff' }}>{(data.summary.waterTargetMl / 1000).toFixed(1)} Liters</Text> of clean water daily.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  errorText: {
    color: '#ff4d6d',
    fontSize: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  kpiUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: C.muted,
  },
  kpiSub: {
    fontSize: 10,
    color: C.muted2,
    marginTop: 2,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  emptyChartText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: C.muted,
    fontSize: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  hydrationCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropletIconBg: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hydrationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  hydrationText: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
  },
});
