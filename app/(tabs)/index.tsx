import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { formatHeight } from '../../src/utils/weight';
import { AvatarDisplay } from '../../src/components/avatar/AvatarDisplay';
import { buildAvatarConfig } from '../../src/components/avatar/types';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';

type MilestoneFeedItem = { profile: Profile; measurement: Measurement };

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft'): string {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function MilestoneCard({ item, primaryUnit, colors, styles }: {
  item: MilestoneFeedItem; primaryUnit: 'cm' | 'ft'; colors: ThemeColors; styles: Styles;
}) {
  const { profile, measurement } = item;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {profile.profileImage ? (
            <Image source={{ uri: profile.profileImage }} style={styles.avatarImg} />
          ) : (
            <AvatarDisplay config={buildAvatarConfig(profile)} size={44} compact />
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.profileName}>{profile.name}</Text>
          <View style={styles.milestoneRow}>
            <Ionicons name="star" size={13} color={colors.accentGold} style={styles.starIcon} />
            <Text style={styles.milestoneName}>{measurement.milestoneName}</Text>
          </View>
        </View>
      </View>

      {measurement.milestoneImage ? (
        <Image
          source={{ uri: measurement.milestoneImage }}
          style={styles.milestoneImage}
          resizeMode="cover"
        />
      ) : null}

      <Text style={styles.footerText}>
        {formatMeasurement(measurement, primaryUnit)}
        <Text style={styles.dot}> · </Text>
        {formatDate(measurement.measuredAt)}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const userId      = useAuthStore((s) => s.userId);
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);
  const [feed, setFeed] = useState<MilestoneFeedItem[]>([]);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getProfiles(userId).then(async (profiles) => {
        const items: MilestoneFeedItem[] = [];
        for (const profile of profiles) {
          const all = await getMeasurements(profile.id);
          for (const m of all) {
            if (m.isMilestone === 1) items.push({ profile, measurement: m });
          }
        }
        items.sort((a, b) => b.measurement.measuredAt - a.measurement.measuredAt);
        setFeed(items);
      });
    }, [userId]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.measurement.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={48} color={colors.borderStrong} />
            <Text style={styles.emptyTitle}>No milestones yet</Text>
            <Text style={styles.emptySub}>
              Open a measurement and mark it as a milestone to see it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MilestoneCard item={item} primaryUnit={primaryUnit} colors={colors} styles={styles} />
        )}
      />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list:      { padding: 16, paddingBottom: 32 },

    card: {
      backgroundColor: colors.surface,
      borderRadius:    16,
      marginBottom:    14,
      overflow:        'hidden',
      shadowColor:     '#000',
      shadowOpacity:   0.05,
      shadowRadius:    8,
      elevation:       2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           12,
      padding:       14,
      paddingBottom: 10,
    },

    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },

    headerText: { flex: 1 },
    profileName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center' },
    starIcon: { marginRight: 4 },
    milestoneName: { fontSize: 13, color: colors.accentGoldDark, fontWeight: '600' },

    milestoneImage: {
      width: '100%',
      height: 200,
    },

    footerText: {
      fontSize: 13,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    dot: { color: colors.borderStrong },

    emptyContainer: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: 32,
      gap: 10,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textSecondary, marginTop: 8 },
    emptySub:   { fontSize: 14, color: colors.textFaint, textAlign: 'center', lineHeight: 20 },
  });
}
