import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { toGraphValue, formatHeight } from '../../src/utils/weight';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';
import { GrowthChart, ChartSeries } from '../../src/components/all/GrowthChart';
import { HeightLineup, LineupEntry } from '../../src/components/all/HeightLineup';
import { HeightAtAge } from '../../src/components/all/HeightAtAge';
import { InsightSections, InsightProfile } from '../../src/components/all/InsightSections';

// Categorical colours for telling profiles apart (not part of the app theme).
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

type ProfileData = {
  profile: Profile;
  color: string;
  measurements: Measurement[]; // valid (>0 cm), oldest → newest
};

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CollaborativeScreen() {
  const userId = useAuthStore((s) => s.userId);
  const unit   = useSettingsStore((s) => s.primaryUnit);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data,    setData]    = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      getProfiles(userId).then(async (allProfiles) => {
        const built = await Promise.all(
          allProfiles.map(async (profile, i) => {
            const all = await getMeasurements(profile.id);
            const measurements = [...all]
              .filter((m) => m.heightCm > 0)
              .sort((a, b) => a.measuredAt - b.measuredAt);
            return { profile, color: COLORS[i % COLORS.length], measurements };
          }),
        );
        setData(built);
        setLoading(false);
      });
    }, [userId]),
  );

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const chartSeries: ChartSeries[] = useMemo(
    () => data.map((d) => ({
      id: d.profile.id,
      name: d.profile.name,
      color: d.color,
      points: d.measurements.map((m) => ({
        x: m.measuredAt,
        y: toGraphValue(m.heightCm, unit),
        cm: m.heightCm,
      })),
    })),
    [data, unit],
  );

  const insightItems: InsightProfile[] = useMemo(
    () => data.map((d) => ({
      profile: d.profile,
      color: d.color,
      milestoneCount: d.measurements.filter((m) => m.isMilestone === 1).length,
      stats: {
        id: d.profile.id,
        name: d.profile.name,
        points: d.measurements.map((m) => ({ t: m.measuredAt, cm: m.heightCm })),
      },
    })),
    [data],
  );

  const lineupEntries: LineupEntry[] = useMemo(
    () => data
      .filter((d) => d.measurements.length > 0)
      .map((d) => ({
        profile: d.profile,
        color: d.color,
        latestCm: d.measurements[d.measurements.length - 1].heightCm,
      })),
    [data],
  );

  const hasData = chartSeries.some((s) => s.points.length > 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (data.length === 0) {
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
            <GrowthChart series={chartSeries} hiddenIds={hiddenIds} unit={unit} />
          ) : (
            <Text style={styles.emptyChart}>Add measurements to profiles to see the chart.</Text>
          )}
        </View>

        {/* Overview, nudges, lineup, leaderboard, catch-ups */}
        <InsightSections
          items={insightItems}
          unit={unit}
          afterNudges={
            <>
              {lineupEntries.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.legendHeading}>Height lineup</Text>
                  <HeightLineup entries={lineupEntries} unit={unit} />
                </View>
              )}
              <HeightAtAge items={insightItems} unit={unit} />
            </>
          }
        />

        {/* Legend */}
        <View style={styles.card}>
          <Text style={styles.legendHeading}>Profiles</Text>
          {data.map((d) => {
            const latest = d.measurements.length > 0
              ? d.measurements[d.measurements.length - 1]
              : null;
            const hidden = hiddenIds.has(d.profile.id);
            return (
              <View key={d.profile.id} style={[styles.legendRow, hidden && styles.legendRowHidden]}>
                <Pressable
                  onPress={() => toggleHidden(d.profile.id)}
                  hitSlop={8}
                  style={styles.toggle}
                  accessibilityLabel={hidden ? `Show ${d.profile.name} on chart` : `Hide ${d.profile.name} from chart`}
                >
                  <Ionicons
                    name={hidden ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={hidden ? colors.textFaint : d.color}
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.legendMain, pressed && styles.legendRowPressed]}
                  onPress={() => router.push({ pathname: '/profile-timeline', params: { id: d.profile.id } })}
                >
                  <View style={[styles.swatch, { backgroundColor: d.color }]} />
                  <Text style={[styles.legendName, !latest && styles.legendNameFaded]}>
                    {d.profile.name}
                  </Text>
                  <Text style={styles.legendValue}>
                    {latest ? formatMeasurement(latest, unit) : 'No measurements'}
                  </Text>
                </Pressable>
              </View>
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
      paddingLeft:       16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap:               10,
    },
    legendRowHidden:  { opacity: 0.5 },
    toggle:           { paddingVertical: 12 },
    legendMain: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingRight: 16, paddingVertical: 12,
    },
    legendRowPressed: { backgroundColor: colors.background },
    swatch:           { width: 28, height: 4, borderRadius: 2 },
    legendName:      { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    legendNameFaded: { color: colors.textFaint },
    legendValue:     { fontSize: 14, color: colors.textMuted },
  });
}
