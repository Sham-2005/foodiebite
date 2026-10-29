import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../UI';

/**
 * Responsive Bar Chart for Daily Counts
 */
export function AdminBarChart({ data = [], height = 180, barColor = C.orange, labelKey = 'date', valueKey = 'count' }) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <Text style={styles.emptyText}>No data points recorded for this period</Text>
      </View>
    );
  }

  const values = data.map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 5); // minimum ceiling of 5
  const chartWidth = Math.max(300, data.length * 32);
  const paddingBottom = 26;
  const paddingTop = 20;
  const usableHeight = height - paddingBottom - paddingTop;

  return (
    <View style={styles.chartWrapper}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + usableHeight * (1 - ratio);
          return (
            <Line
              key={idx}
              x1="0"
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="#1E293B"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const val = Number(item[valueKey]) || 0;
          const barHeight = Math.max(val > 0 ? 4 : 0, (val / maxVal) * usableHeight);
          const x = 12 + idx * ((chartWidth - 24) / data.length);
          const barW = Math.max(8, Math.min(22, (chartWidth - 24) / data.length - 8));
          const y = paddingTop + usableHeight - barHeight;
          const shortDate = item[labelKey] ? item[labelKey].slice(5) : ''; // MM-DD

          return (
            <React.Fragment key={idx}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barHeight}
                rx={3}
                fill={barColor}
                opacity={val > 0 ? 0.9 : 0.2}
              />
              {/* Value label on top of bar if count > 0 */}
              {val > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fill="#94A3B8"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {val}
                </SvgText>
              )}
              {/* Date label at bottom */}
              <SvgText
                x={x + barW / 2}
                y={height - 6}
                fill="#64748B"
                fontSize="9"
                textAnchor="middle"
              >
                {shortDate}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Smooth Line Growth Chart for Cumulative Totals
 */
export function AdminLineChart({ data = [], height = 180, lineColor = '#10B981', valueKey = 'cumulative' }) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <Text style={styles.emptyText}>No trend data available</Text>
      </View>
    );
  }

  const values = data.map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 5);
  const minVal = Math.min(...values, 0);
  const valRange = maxVal - minVal || 1;

  const chartWidth = Math.max(300, data.length * 28);
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 26;
  const usableW = chartWidth - paddingLeft - paddingRight;
  const usableH = height - paddingTop - paddingBottom;

  const points = data.map((item, idx) => {
    const val = Number(item[valueKey]) || 0;
    const x = paddingLeft + (idx / Math.max(1, data.length - 1)) * usableW;
    const y = paddingTop + usableH - ((val - minVal) / valRange) * usableH;
    return { x, y, val, date: item.date };
  });

  // Construct SVG path string
  let pathD = '';
  points.forEach((pt, idx) => {
    if (idx === 0) pathD += `M ${pt.x} ${pt.y}`;
    else pathD += ` L ${pt.x} ${pt.y}`;
  });

  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + usableH} L ${points[0].x} ${paddingTop + usableH} Z`;

  return (
    <View style={styles.chartWrapper}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaD} fill="url(#lineGrad)" />

        {/* Stroke Line */}
        <Path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" />

        {/* Data points */}
        {points.map((pt, idx) => {
          // Show label every few points or on endpoints
          const showLabel = idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 5) === 0;
          return (
            <React.Fragment key={idx}>
              <Circle cx={pt.x} cy={pt.y} r="3.5" fill="#0B0E14" stroke={lineColor} strokeWidth="2" />
              {showLabel && (
                <>
                  <SvgText
                    x={pt.x}
                    y={pt.y - 8}
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {pt.val}
                  </SvgText>
                  <SvgText
                    x={pt.x}
                    y={height - 6}
                    fill="#64748B"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {pt.date ? pt.date.slice(5) : ''}
                  </SvgText>
                </>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * Distribution Progress Bars for Dietary Preferences & Categories
 */
export function AdminDistributionBars({ items = [] }) {
  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>No distribution data recorded</Text>
      </View>
    );
  }

  const palette = ['#FF6B35', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
    <View style={styles.distWrapper}>
      {items.map((item, idx) => {
        const color = palette[idx % palette.length];
        return (
          <View key={idx} style={styles.distRow}>
            <View style={styles.distLabelRow}>
              <View style={styles.distLeft}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.distLabel}>{item.label}</Text>
              </View>
              <Text style={styles.distValue}>
                {item.count} users ({item.percentage}%)
              </Text>
            </View>
            <View style={styles.distTrack}>
              <View style={[styles.distFill, { width: `${Math.min(100, item.percentage || 0)}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  emptyChart: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  distWrapper: {
    gap: 12,
  },
  distRow: {
    gap: 6,
  },
  distLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  distLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  distValue: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  distTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    borderRadius: 4,
  },
});
