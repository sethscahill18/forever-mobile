import { ReactNode, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '../../db/schema';
import { useAppTheme } from '../../store/appTheme.store';
import { ThemeColors } from '../../theme/tokens';
import { ProfileAvatar } from './ProfileAvatar';
import { formatDelta, formatHeight } from '../../utils/weight';
import {
  SeriesStats, OVERDUE_DAYS, daysSince, growthOverWindow, catchUps,
} from '../../utils/growthStats';

export type InsightProfile = {
  profile: Profile;
  color: string;
  stats: SeriesStats;
  milestoneCount: number;
};

const GROWTH_WINDOW_DAYS = 90;

export function InsightSections({ items, unit, afterNudges }: {
  items: InsightProfile[]; unit: 'cm' | 'ft'; afterNudges?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const now = Date.now();

  const totalMeasurements = items.reduce((n, i) => n + i.stats.points.length, 0);
  const totalMilestones   = items.reduce((n, i) => n + i.milestoneCount, 0);

  const overdue = items
    .map((i) => {
      const last = i.stats.points[i.stats.points.length - 1];
      return { item: i, days: last ? daysSince(last.t, now) : null };
    })
    .filter((o) => o.days === null || o.days >= OVERDUE_DAYS)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));

  const ranked = items
    .map((i) => ({ item: i, growth: growthOverWindow(i.stats.points, GROWTH_WINDOW_DAYS, now) }))
    .sort((a, b) => {
      if (a.growth && b.growth) return b.growth.deltaCm - a.growth.deltaCm;
      if (a.growth) return -1;
      if (b.growth) return 1;
      return 0;
    });
  const anyGrowth = ranked.some((r) => r.growth);

  const predictions = catchUps(items.map((i) => i.stats), now);

  return (
    <>
      {/* Overview tiles */}
      <View style={styles.tiles}>
        {[
          { label: 'Profiles',     value: items.length },
          { label: 'Measurements', value: totalMeasurements },
          { label: 'Milestones',   value: totalMilestones },
        ].map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </View>
        ))}
      </View>

      {/* Measuring nudges */}
      {overdue.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Due for a measurement</Text>
          {overdue.map(({ item, days }) => (
            <View key={item.profile.id} style={styles.row}>
              <ProfileAvatar profile={item.profile} color={item.color} size={34} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.profile.name}</Text>
                <Text style={styles.rowSub}>
                  {days === null ? 'Not measured yet' : `Last measured ${days} day${days === 1 ? '' : 's'} ago`}
                </Text>
              </View>
              <Pressable style={styles.measureBtn} onPress={() => router.push({ pathname: '/(tabs)/measurements', params: { profileId: item.profile.id } })}>
                <Text style={styles.measureBtnText}>Measure</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {afterNudges}

      {/* Growth leaderboard */}
      {anyGrowth && (
        <View style={styles.card}>
          <Text style={styles.heading}>Growth over the last 3 months</Text>
          {ranked.map(({ item, growth }, idx) => (
            <View key={item.profile.id} style={styles.row}>
              <View style={styles.rank}>
                {growth && idx === 0 ? (
                  <Ionicons name="trophy" size={20} color={colors.accentGold} />
                ) : (
                  <Text style={styles.rankText}>{idx + 1}</Text>
                )}
              </View>
              <ProfileAvatar profile={item.profile} color={item.color} size={34} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.profile.name}</Text>
                <Text style={styles.rowSub}>
                  {growth ? `${formatDelta(growth.perMonthCm, unit)} per month` : 'Not enough data yet'}
                </Text>
              </View>
              {growth && <Text style={styles.delta}>{formatDelta(growth.deltaCm, unit)}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Catch-up predictions */}
      {predictions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.heading}>Catch-up watch</Text>
          {predictions.map((p) => {
            const m = Math.max(1, Math.round(p.months));
            const taller = p.taller.points[p.taller.points.length - 1].cm;
            const shorter = p.shorter.points[p.shorter.points.length - 1].cm;
            return (
              <View key={`${p.shorter.id}-${p.taller.id}`} style={styles.row}>
                <Ionicons name="trending-up" size={22} color={colors.primary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>
                    {p.shorter.name} could pass {p.taller.name} in about {m} month{m === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {formatHeight(taller - shorter, unit)} apart now · based on recent growth
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tiles: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    tile: {
      flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
      backgroundColor: colors.surface,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    tileValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
    tileLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    card: {
      backgroundColor: colors.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    heading: {
      fontSize: 14, fontWeight: '700', color: colors.textSecondary,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowText: { flex: 1 },
    rowName: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    rowSub:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rank:     { width: 22, alignItems: 'center' },
    rankText: { fontSize: 15, fontWeight: '700', color: colors.textFaint },
    delta:    { fontSize: 15, fontWeight: '700', color: colors.primary },
    measureBtn: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.primary,
    },
    measureBtnText: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  });
}
