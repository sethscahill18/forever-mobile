import { useMemo } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { Profile } from '../../db/schema';
import { useAppTheme } from '../../store/appTheme.store';
import { ThemeColors } from '../../theme/tokens';
import { COMPLETE_AVATARS, PROFILE_ICONS, CANVAS_ASPECT } from '../avatar/avatarAssets';
import { resolveDocUri } from '../../utils/imageStorage';
import { formatHeight } from '../../utils/weight';

export type LineupEntry = { profile: Profile; latestCm: number; color: string };

const LINEUP_MAX_H = 170;
const MIN_H        = 48;
const COL_W        = 84;
const BAR_W        = 40;

export function HeightLineup({ entries, unit }: { entries: LineupEntry[]; unit: 'cm' | 'ft' }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sorted = [...entries].sort((a, b) => b.latestCm - a.latestCm);
  if (sorted.length === 0) return null;
  const maxCm = sorted[0].latestCm;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {sorted.map(({ profile, latestCm, color }) => {
        const h = Math.max((latestCm / maxCm) * LINEUP_MAX_H, MIN_H);
        const full = profile.avatarId
          ? COMPLETE_AVATARS.find((a) => a.id === profile.avatarId)
          : undefined;
        const headshot = profile.profileImage
          ? { uri: resolveDocUri(profile.profileImage)! }
          : profile.avatarId && PROFILE_ICONS[profile.avatarId]
            ? PROFILE_ICONS[profile.avatarId]
            : null;

        return (
          <View key={profile.id} style={styles.col}>
            <View style={[styles.stage, { height: LINEUP_MAX_H }]}>
              {full ? (
                // Heights are true relative heights, so BODY_TYPE_SCALE is deliberately not applied.
                <Image
                  source={full.source}
                  style={{ width: h * CANVAS_ASPECT, height: h }}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.bar, { height: h, backgroundColor: color }]}>
                  {headshot ? (
                    <Image source={headshot} style={styles.barFace} />
                  ) : (
                    <View style={[styles.barFace, styles.barInitialWrap]}>
                      <Text style={styles.barInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.value} numberOfLines={1}>{formatHeight(latestCm, unit)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 14 },
    col: { width: COL_W, alignItems: 'center' },
    // Shared floor line the figures stand on.
    stage: {
      width: COL_W, justifyContent: 'flex-end', alignItems: 'center',
      borderBottomWidth: 2, borderBottomColor: colors.borderStrong,
    },
    bar: {
      width: BAR_W, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      alignItems: 'center', paddingTop: 4, opacity: 0.9,
    },
    barFace: { width: 32, height: 32, borderRadius: 16 },
    barInitialWrap: { backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
    barInitial: { color: '#fff', fontWeight: '700', fontSize: 15 },
    name:  { marginTop: 6, fontSize: 13, fontWeight: '600', color: colors.textSecondary, maxWidth: COL_W - 8 },
    value: { fontSize: 12, color: colors.textMuted, maxWidth: COL_W - 8 },
  });
}
