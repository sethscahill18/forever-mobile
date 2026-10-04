import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Svg, Polyline, Circle,
} from 'react-native-svg';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { toGraphValue, formatHeight } from '../../src/utils/weight';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';
import { withAlpha } from '../../src/theme/withAlpha';

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

// ─── Chart constants — matches the minimal sparkline style used in the
// profile-timeline bottom sheet's Growth Progress graph (no axes/gridlines).
const SVG_H = 160;
const PAD_X = 16;
const PAD_Y = 16;

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartPoint = { x: number; y: number; measurement: Measurement };
type ProfileSeries = { profile: Profile; color: string; points: ChartPoint[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

// ─── Chart component ──────────────────────────────────────────────────────────
function MultiProfileChart({
  series,
  styles,
}: {
  series: ProfileSeries[];
  styles: Styles;
}) {
  const [w, setW] = useState(0);

  const allPoints = series.flatMap((s) => s.points);

  if (allPoints.length === 0) {
    return <Text style={styles.emptyChart}>No measurements to display yet.</Text>;
  }

  const cW = Math.max(w - 2 * PAD_X, 1);
  const cH = SVG_H - 2 * PAD_Y;

  const ys     = allPoints.map((p) => p.y);
  const yMin   = Math.min(...ys);
  const yMax   = Math.max(...ys);
  const yRange = yMax - yMin || 10;
  const yPad   = Math.max(yRange * 0.15, 2);
  const yLow   = yMin - yPad;
  const yHigh  = yMax + yPad;

  const xs     = allPoints.map((p) => p.x);
  const xMin   = Math.min(...xs);
  const xMax   = Math.max(...xs);
  const xRange = xMax - xMin || 1;

  const px = (ts: number) => PAD_X + ((ts - xMin) / xRange) * cW;
  const py = (v: number)  => PAD_Y + (1 - (v - yLow) / (yHigh - yLow)) * cH;

  return (
    <View style={styles.chartOuter} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={SVG_H}>
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
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Dots — every point, styled like the Growth Progress sparkline */}
          {series.flatMap((s) =>
            s.points.map((p, i) => (
              <Circle
                key={`${s.profile.id}-${i}`}
                cx={px(p.x)} cy={py(p.y)}
                r={4}
                fill={withAlpha(s.color, 0.35)}
                stroke={s.color}
                strokeWidth={1.5}
              />
            )),
          )}
        </Svg>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CollaborativeScreen() {
  const userId = useAuthStore((s) => s.userId);
  const unit   = useSettingsStore((s) => s.primaryUnit);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (series.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="grid-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>No profiles yet</Text>
          <Text style={styles.emptyDesc}>Create profiles and add measurements to see them here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

      {/* Chart */}
      <View style={styles.card}>
        {hasData ? (
          <MultiProfileChart series={activeSeries} styles={styles} />
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
    </SafeAreaView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },
    center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.background },
    emptyContainer: { alignItems: 'center', marginTop: 146, paddingHorizontal: 40, gap: 10 },

    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
    emptyDesc:  { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

    card: {
      backgroundColor:  colors.surface,
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
      textAlign: 'center', color: colors.textFaint,
      fontSize: 14, paddingVertical: 40, paddingHorizontal: 24,
    },

    // Legend
    legendHeading: {
      fontSize: 14, fontWeight: '700', color: colors.textSecondary,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    legendRow: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: 16,
      paddingVertical:   12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap:               10,
    },
    legendRowPressed: { backgroundColor: colors.background },
    swatch:           { width: 28, height: 4, borderRadius: 2 },
    legendName:      { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    legendNameFaded: { color: colors.textFaint },
    legendValue:     { fontSize: 14, color: colors.textMuted },
  });
}
