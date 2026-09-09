import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image, Modal, SafeAreaView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { Ionicons } from '@expo/vector-icons';
import { formatHeight, HeightUnit } from '../../src/utils/weight';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts as useDeliusFonts, Delius_400Regular } from '@expo-google-fonts/delius';
import { AvatarDisplay } from '../../src/components/avatar/AvatarDisplay';
import { buildAvatarConfig } from '../../src/components/avatar/types';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors, ThemeName } from '../../src/theme/tokens';
import { PALETTES } from '../../src/theme/palettes';
import { withAlpha } from '../../src/theme/withAlpha';

const PROFILE_ICONS: Record<string, ReturnType<typeof require>> = {
  male_teen_blue: require('../../assets/avatar/complete/profile_icons/male_teen_blue_profile_pic.png'),
};

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
  const setPrimaryUnit = useSettingsStore((s) => s.setPrimaryUnit);
  const insets         = useSafeAreaInsets();
  const [cards, setCards]           = useState<ProfileCard[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [nunitoLoaded]  = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold });
  const [deliusLoaded]  = useDeliusFonts({ Delius_400Regular });
  const { colors, theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const glassTint = theme === 'space' ? 'dark' : 'light';
  const glassIconStrong = theme === 'space' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)';
  const glassIconSoft   = theme === 'space' ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.3)';

  const UNIT_OPTIONS: { label: string; value: HeightUnit }[] = [
    { label: 'Centimetres (cm)', value: 'cm' },
    { label: 'Feet & Inches',    value: 'ft' },
  ];

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
          <Text style={styles.empty}>No profiles yet. Tap + to create one.</Text>
        }
        renderItem={({ item: { profile, latest } }) => {
          const cardPalette = PALETTES[(profile.colourPalette as ThemeName)] ?? PALETTES.water;
          return (
          <Pressable
            style={({ pressed }) => [styles.cardWrapper, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: '/profile-timeline', params: { id: profile.id } })}
          >
            <BlurView intensity={70} tint={glassTint} style={styles.card}>
              {/* Theme wash — reflects this profile's own colour palette */}
              <View style={[styles.themeWash, { backgroundColor: withAlpha(cardPalette.sceneWall, 0.6) }]} />
              {/* Specular highlight */}
              <View style={styles.specular} />

              <View style={styles.avatar}>
                {profile.profileImage ? (
                  <Image source={{ uri: profile.profileImage }} style={styles.avatarImg} />
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
          );
        }}
      />

      {/* Cog button — top right */}
      <Pressable
        style={[styles.cogBtn, { top: insets.top + 12 }]}
        onPress={() => setSettingsVisible(true)}
        hitSlop={12}
      >
        <BlurView intensity={70} tint={glassTint} style={styles.cogInner}>
          <View style={styles.specular} />
          <Ionicons name="settings-outline" size={26} color={glassIconStrong} />
        </BlurView>
      </Pressable>

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

      {/* Settings modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={() => setSettingsVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionHeader}>MEASUREMENTS</Text>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsRowLabel}>Primary Unit</Text>
              <Text style={styles.settingsRowDesc}>Display and enter measurements in:</Text>
              <View style={styles.segmented}>
                {UNIT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.seg, primaryUnit === opt.value && styles.segActive]}
                    onPress={() => setPrimaryUnit(opt.value)}
                  >
                    <Text style={[styles.segText, primaryUnit === opt.value && styles.segTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundPaper },
    list:      { padding: 16, paddingBottom: 100 },
    empty:     { textAlign: 'center', color: colors.onPrimary, marginTop: 60, fontSize: 15 },

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
    themeWash: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
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

    cogBtn: {
      position: 'absolute', right: 16,
      width: 38, height: 38, borderRadius: 19,
      overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
    },
    cogInner: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.6)',
    },

    modalSafe:    { flex: 1, backgroundColor: colors.backgroundPaper },
    modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Nunito_800ExtraBold' },

    settingsSection:       { marginTop: 24, paddingHorizontal: 16 },
    settingsSectionHeader: { fontSize: 12, color: colors.textFaint, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase', fontFamily: 'Nunito_800ExtraBold' },
    settingsCard: {
      backgroundColor: colors.surface, borderRadius: 12, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    settingsRowLabel: { fontSize: 16, color: colors.textPrimary, marginBottom: 4, fontFamily: 'Nunito_600SemiBold' },
    settingsRowDesc:  { fontSize: 13, color: colors.textMuted, marginBottom: 14, fontFamily: 'Nunito_400Regular' },
    segmented:  { flexDirection: 'column', gap: 8 },
    seg:        { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center' },
    segActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
    segText:    { fontSize: 15, color: colors.textSecondary, fontFamily: 'Nunito_400Regular' },
    segTextActive: { color: colors.onPrimary },
  });
}
