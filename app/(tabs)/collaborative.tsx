import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Svg, Polyline, Circle, Line as SvgLine,
  Text as SvgText, G, Rect,
} from 'react-native-svg';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { toGraphValue, formatHeight } from '../../src/utils/weight';

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = [
  '#4A90D9', // blue
  '#E53E3E', // red
  '#38A169', // green
  '#D69E2E', // amber
  '#805AD5', // purple
  '#DD6B20', // orange
  '#00B5D8', // teal
  '#D53F8C', // pink
];

// ─── Chart constants ──────────────────────────────────────────────────────────
const SVG_H  = 280;
const PAD_L  = 60;
const PAD_R  = 20;
const PAD_T  = 28;
const PAD_B  = 44;
const N_YTKS = 5;
const N_XTKS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartPoint = { x: number; y: number; measurement: Measurement };
type ProfileSeries = { profile: Profile; color: string; points: ChartPoint[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function yTickLabel(value: number, unit: 'cm' | 'ft') {
  if (unit === 'cm') return `${Math.round(value)}`;
  return `${Math.floor(value / 12)}'${Math.round(value % 12)}"`;
}

function xTickLabel(ts: number, spansYears: boolean) {
  const d     = new Date(ts);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (spansYears) return `${month} '${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${month}`;
}

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

// ─── Chart component ──────────────────────────────────────────────────────────
function MultiProfileChart({
  series,
  unit,
}: {
  series: ProfileSeries[];
  unit: 'cm' | 'ft';
}) {
  const [w, setW] = useState(0);

  const allPoints = series.flatMap((s) => s.points);

  if (allPoints.length === 0) {
    return <Text style={styles.emptyChart}>No measurements to display yet.</Text>;
  }

  const cW = Math.max(w - PAD_L - PAD_R, 1);
  const cH = SVG_H - PAD_T - PAD_B;

  const ys     = allPoints.map((p) => p.y);
  const yMin   = Math.min(...ys);
  const yMax   = Math.max(...ys);
  const yRange = yMax - yMin || 10;
  const yPad   = Math.max(yRange * 0.15, 2);
  const yLow   = yMin - yPad;
  const yHigh  = yMax + yPad;

  const xs         = allPoints.map((p) => p.x);
  const xMin       = Math.min(...xs);
  const xMax       = Math.max(...xs);
  const xRange     = xMax - xMin || 1;
  const spansYears = new Date(xMin).getFullYear() !== new Date(xMax).getFullYear();

  const px = (ts: number) => PAD_L + ((ts - xMin) / xRange) * cW;
  const py = (v: number)  => PAD_T  + (1 - (v - yLow) / (yHigh - yLow)) * cH;

  const yTicks = Array.from({ length: N_YTKS }, (_, i) =>
    yLow + (i / (N_YTKS - 1)) * (yHigh - yLow),
  );
  const xTicks = Array.from({ length: N_XTKS }, (_, i) =>
    xMin + (i / (N_XTKS - 1)) * xRange,
  );
  const bottomY = PAD_T + cH;

  return (
    <View style={styles.chartOuter} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <View style={{ height: SVG_H }}>
          <Svg width={w} height={SVG_H}>
            <Rect x={PAD_L} y={PAD_T} width={cW} height={cH} fill="#fff" />

            {/* Y-axis grid + labels */}
            {yTicks.map((tick, i) => (
              <G key={i}>
                <SvgLine
                  x1={PAD_L} y1={py(tick)} x2={PAD_L + cW} y2={py(tick)}
                  stroke={i === 0 ? '#CBD5E0' : '#EDF2F7'}
                  strokeWidth={i === 0 ? 1.5 : 1}
                />
                <SvgText
                  x={PAD_L - 6} y={py(tick) + 4}
                  fontSize={11} fill="#4A5568" textAnchor="end" fontWeight="500"
                >
                  {yTickLabel(tick, unit)}
                </SvgText>
              </G>
            ))}

            {/* Y-axis unit label + border */}
            <SvgText x={PAD_L - 6} y={PAD_T - 9} fontSize={10} fill="#A0AEC0" textAnchor="end">
              {unit === 'cm' ? 'cm' : 'ft & in'}
            </SvgText>
            <SvgLine x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={bottomY}
              stroke="#CBD5E0" strokeWidth={1.5} />

            {/* X-axis labels */}
            {xTicks.map((ts, i) => (
              <SvgText key={i} x={px(ts)} y={bottomY + 16}
                fontSize={10} fill="#718096" textAnchor="middle">
                {xTickLabel(ts, spansYears)}
              </SvgText>
            ))}

            {/* Profile lines */}
            {series.map((s) => {
              if (s.points.length < 2) return null;
              const pts = s.points
                .map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`)
                .join(' ');
              return (
                <Polyline
                  key={s.profile.id}
                  points={pts}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Single-measurement dots */}
            {series.map((s) => {
              if (s.points.length !== 1) return null;
              return (
                <Circle
                  key={s.profile.id}
                  cx={px(s.points[0].x)}
                  cy={py(s.points[0].y)}
                  r={5}
                  fill={s.color}
                />
              );
            })}
          </Svg>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CollaborativeScreen() {
  const userId = useAuthStore((s) => s.userId);
  const unit   = useSettingsStore((s) => s.primaryUnit);

  const [series,  setSeries]  = useState<ProfileSeries[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      getProfiles(userId).then(async (allProfiles) => {
        const built = await Promise.all(
          allProfiles.map(async (profile, i) => {
            const measurements = await getMeasurements(profile.id);
            const points: ChartPoint[] = [...measurements]
              .filter((m) => m.heightCm > 0)
              .sort((a, b) => a.measuredAt - b.measuredAt)
              .map((m) => ({
                x:           m.measuredAt,
                y:           toGraphValue(m.heightCm, unit),
                measurement: m,
              }));
            return { profile, color: COLORS[i % COLORS.length], points };
          }),
        );
        setSeries(built);
        setLoading(false);
      });
    }, [userId, unit]),
  );

  const activeSeries = series.filter((s) => s.points.length > 0);
  const hasData      = activeSeries.length > 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4A90D9" size="large" />
      </View>
    );
  }

  if (series.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No profiles yet</Text>
        <Text style={styles.emptyDesc}>Create profiles and add measurements to see them here.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      {/* Chart */}
      <View style={styles.card}>
        {hasData ? (
          <MultiProfileChart series={activeSeries} unit={unit} />
        ) : (
          <Text style={styles.emptyChart}>Add measurements to profiles to see the chart.</Text>
        )}
      </View>

      {/* Legend */}
      <View style={styles.card}>
        <Text style={styles.legendHeading}>Profiles</Text>
        {series.map((s) => {
          const latest = s.points.length > 0
            ? s.points[s.points.length - 1].measurement
            : null;
          return (
            <Pressable
              key={s.profile.id}
              style={({ pressed }) => [styles.legendRow, pressed && styles.legendRowPressed]}
              onPress={() => router.push({ pathname: '/profile-timeline', params: { id: s.profile.id } })}
            >
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={[styles.legendName, !latest && styles.legendNameFaded]}>
                {s.profile.name}
              </Text>
              <Text style={styles.legendValue}>
                {latest ? formatMeasurement(latest, unit) : 'No measurements'}
              </Text>
            </Pressable>
          );
        })}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#F7FAFC' },
  content: { padding: 16, paddingBottom: 40 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#F7FAFC' },

  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2D3748', textAlign: 'center', marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor:  '#fff',
    borderRadius:     16,
    marginBottom:     16,
    shadowColor:      '#000',
    shadowOpacity:    0.05,
    shadowRadius:     8,
    elevation:        2,
    overflow:         'hidden',
  },

  // Chart
  chartOuter: { paddingVertical: 12 },
  emptyChart: {
    textAlign: 'center', color: '#A0AEC0',
    fontSize: 14, paddingVertical: 40, paddingHorizontal: 24,
  },

  // Legend
  legendHeading: {
    fontSize: 14, fontWeight: '700', color: '#4A5568',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#EDF2F7',
  },
  legendRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    gap:               10,
  },
  legendRowPressed: { backgroundColor: '#F7FAFC' },
  swatch:           { width: 28, height: 4, borderRadius: 2 },
  legendName:      { flex: 1, fontSize: 15, fontWeight: '600', color: '#2D3748' },
  legendNameFaded: { color: '#A0AEC0' },
  legendValue:     { fontSize: 14, color: '#718096' },
});
