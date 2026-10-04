import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { Ionicons } from '@expo/vector-icons';
import { formatHeight } from '../../src/utils/weight';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts as useDeliusFonts, Delius_400Regular } from '@expo-google-fonts/delius';
import { AvatarDisplay } from '../../src/components/avatar/AvatarDisplay';
import { buildAvatarConfig } from '../../src/components/avatar/types';
import { PROFILE_ICONS } from '../../src/components/avatar/avatarAssets';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';
import { resolveDocUri } from '../../src/utils/imageStorage';

type ProfileCard = { profile: Profile; latest: Measurement | null };

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft'): string {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

export default function ProfilesScreen() {
  const userId         = useAuthStore((s) => s.userId);
  const primaryUnit    = useSettingsStore((s) => s.primaryUnit);
  const insets         = useSafeAreaInsets();
  const [cards, setCards]           = useState<ProfileCard[]>([]);
  const [nunitoLoaded]  = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold });
  const [deliusLoaded]  = useDeliusFonts({ Delius_400Regular });
  const { colors, theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const glassTint = theme === 'space' ? 'dark' : 'light';
  const glassIconStrong = theme === 'space' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';
  const glassIconSoft   = theme === 'space' ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.3)';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getProfiles(userId).then(async (profiles) => {
        const built = await Promise.all(
          profiles.map(async (profile) => {
            const measurements = await getMeasurements(profile.id);
            return { profile, latest: measurements[0] ?? null };
          }),
        );
        setCards(built);
      });
    }, [userId]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.profile.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 66 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptyDesc}>
              Tap the + button in the bottom right corner to create your first profile.
            </Text>
          </View>
        }
        renderItem={({ item: { profile, latest } }) => (
          <Pressable
            style={({ pressed }) => [styles.cardWrapper, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: '/profile-timeline', params: { id: profile.id } })}
          >
            <BlurView intensity={70} tint={glassTint} style={styles.card}>
              {/* Specular highlight */}
              <View style={styles.specular} />

              <View style={styles.avatar}>
                {profile.profileImage ? (
                  <Image source={{ uri: resolveDocUri(profile.profileImage)! }} style={styles.avatarImg} />
                ) : profile.avatarId && PROFILE_ICONS[profile.avatarId] ? (
                  <Image source={PROFILE_ICONS[profile.avatarId]} style={styles.avatarImg} />
                ) : (
                  <AvatarDisplay config={buildAvatarConfig(profile)} size={56} compact />
                )}
              </View>

              <View style={styles.info}>
                <Text style={{ fontSize: 17, color: colors.textPrimary, marginBottom: 4, fontFamily: deliusLoaded ? 'Delius_400Regular' : undefined }}>{profile.name}</Text>
                {latest ? (
                  <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: nunitoLoaded ? 'Nunito_400Regular' : undefined }}>
                    {formatMeasurement(latest, primaryUnit)}
                    <Text style={styles.dot}> · </Text>
                    {timeAgo(latest.measuredAt)}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 14, color: glassIconSoft, fontFamily: nunitoLoaded ? 'Nunito_400Regular' : undefined }}>No measurements yet</Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={18} color={glassIconSoft} />
            </BlurView>
          </Pressable>
        )}
      />

      {/* FAB — add profile */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/create-profile')}
      >
        <BlurView intensity={70} tint={glassTint} style={styles.fabInner}>
          <View style={styles.specular} />
          <Ionicons name="add" size={36} color={glassIconStrong} />
        </BlurView>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    list:      { padding: 16, paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40, gap: 10 },
    emptyTitle:      { fontSize: 18, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    emptyDesc:       { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

    cardWrapper: { marginBottom: 12 },
    cardPressed: { opacity: 0.85 },

    card: {
      flexDirection:  'row',
      alignItems:     'center',
      borderRadius:   20,
      overflow:       'hidden',
      padding:        16,
      gap:            14,
      borderWidth:    0.5,
      borderColor:    'rgba(255,255,255,0.6)',
    },
    specular: {
      position:        'absolute',
      top:             0,
      left:            0,
      right:           0,
      height:          '50%',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },

    avatar: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 56, height: 56, borderRadius: 28 },

    info:     { flex: 1 },
    dot:      { color: colors.textFaint },

    fab: {
      position: 'absolute', bottom: 28, right: 24,
      width: 56, height: 56, borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
    },
    fabInner: {
      width: 56, height: 56,
      borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.6)',
    },

  });
}
