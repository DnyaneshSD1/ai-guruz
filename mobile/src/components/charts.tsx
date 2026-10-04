import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { T } from './ui';
import { useTheme } from '@/lib/providers';

export interface Slice {
  label: string;
  value: number;
}

export function NoData() {
  return <T muted style={{ paddingVertical: 28, textAlign: 'center' }}>No data in this period yet.</T>;
}

/**
 * Part-to-whole at a glance, for a handful of segments. Every value is also written in the legend,
 * so nothing depends on telling colours apart.
 */
export function Donut({ slices, unit }: { slices: Slice[]; unit: string }) {
  const { colors } = useTheme();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <NoData />;

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.filter((slice) => slice.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={128} height={128} viewBox="0 0 120 120" accessibilityLabel={`${unit}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        <G rotation={-90} origin="60, 60">
          {slices.map((slice, index) => {
            const length = (slice.value / total) * circumference;
            const start = offset;
            offset += length;
            if (slice.value === 0) return null;
            const visible = Math.max(0, length - gap);
            return (
              <Circle
                key={slice.label}
                cx={60} cy={60} r={radius} fill="none"
                stroke={colors.series[index]}
                strokeWidth={14}
                strokeDasharray={[visible, circumference - visible]}
                strokeDashoffset={-start}
              />
            );
          })}
        </G>
        <SvgText x={60} y={59} textAnchor="middle" fill={colors.fg} fontSize={20} fontWeight="600">{total}</SvgText>
        <SvgText x={60} y={73} textAnchor="middle" fill={colors.muted} fontSize={8}>{unit}</SvgText>
      </Svg>
      <View style={{ flex: 1, gap: 6 }}>
        {slices.map((slice, index) => (
          <View key={slice.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.series[index] }} />
            <T variant="small" style={{ flex: 1 }}>{slice.label}</T>
            <T variant="small">{slice.value}</T>
            <T variant="small" muted style={{ width: 34, textAlign: 'right' }}>{Math.round((slice.value / total) * 100)}%</T>
          </View>
        ))}
      </View>
    </View>
  );
}

const PLOT = { top: 10, right: 12, bottom: 20, left: 34, height: 160 };

/** One series over time on a 0-100% scale. The latest value is written above the chart. */
export function TrendLine({ points, label }: { points: { date: string; value: number }[]; label: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  if (points.length === 0) return <NoData />;

  const innerWidth = Math.max(0, width - PLOT.left - PLOT.right);
  const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const last = points.length - 1;
  const x = (index: number) => PLOT.left + (points.length === 1 ? innerWidth / 2 : (index / last) * innerWidth);
  const y = (value: number) => PLOT.top + (1 - value) * innerHeight;
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <T variant="small" muted>
        {label}: <T variant="small">{Math.round(points[last].value * 100)}%</T> on {points[last].date}
      </T>
      {width > 0 && (
        <Svg width={width} height={PLOT.height}>
          {[0, 0.5, 1].map((tick) => (
            <G key={tick}>
              <Line x1={PLOT.left} x2={width - PLOT.right} y1={y(tick)} y2={y(tick)} stroke={colors.border} />
              <SvgText x={PLOT.left - 8} y={y(tick) + 3} textAnchor="end" fontSize={10} fill={colors.muted}>{`${tick * 100}%`}</SvgText>
            </G>
          ))}
          {points.length > 1 && (
            <>
              <Path d={`${line} L${x(last)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={colors.series[0]} opacity={0.1} />
              <Path d={line} fill="none" stroke={colors.series[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          <Circle cx={x(last)} cy={y(points[last].value)} r={4} fill={colors.series[0]} stroke={colors.card} strokeWidth={2} />
          <SvgText x={PLOT.left} y={PLOT.height - 5} fontSize={10} fill={colors.muted}>{points[0].date}</SvgText>
          {points.length > 1 && (
            <SvgText x={width - PLOT.right} y={PLOT.height - 5} textAnchor="end" fontSize={10} fill={colors.muted}>{points[last].date}</SvgText>
          )}
        </Svg>
      )}
    </View>
  );
}

/** Magnitude per category: thin columns from one baseline, the count written on each cap. */
export function Columns({ bars }: { bars: Slice[] }) {
  const { colors } = useTheme();
  const max = Math.max(...bars.map((bar) => bar.value));
  if (max === 0) return <NoData />;
  return (
    <View>
      <View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {bars.map((bar) => (
          <View key={bar.label} accessibilityLabel={`${bar.label}: ${bar.value}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <T variant="small">{bar.value}</T>
            <View style={{ width: 22, height: Math.max(bar.value ? 3 : 0, (bar.value / max) * 100), backgroundColor: colors.series[0], borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        {bars.map((bar) => <T key={bar.label} variant="small" muted style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>{bar.label}</T>)}
      </View>
    </View>
  );
}

/** Magnitude per category with long names: horizontal bars, the count at the tip. */
export function Rows({ bars }: { bars: Slice[] }) {
  const { colors } = useTheme();
  const max = Math.max(...bars.map((bar) => bar.value));
  if (max === 0) return <NoData />;
  return (
    <View style={{ gap: 10 }}>
      {bars.map((bar) => (
        <View key={bar.label} style={{ gap: 3 }}>
          <T variant="small">{bar.label}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ height: 10, width: `${(bar.value / max) * 85}%`, minWidth: bar.value ? 3 : 0, backgroundColor: colors.series[0], borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
            <T variant="small" muted>{bar.value}</T>
          </View>
        </View>
      ))}
    </View>
  );
}
