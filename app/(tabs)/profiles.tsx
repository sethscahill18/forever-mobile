import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { getProfiles } from '../../src/services/profile.service';
import { getMeasurements } from '../../src/services/measurement.service';
import { Profile, Measurement } from '../../src/db/schema';
import { Ionicons } from '@expo/vector-icons';
import { formatHeight } from '../../src/utils/weight';
import { AvatarDisplay } from '../../src/components/avatar/AvatarDisplay';
import { buildAvatarConfig } from '../../src/components/avatar/types';

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
  const userId      = useAuthStore((s) => s.userId);
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);
  const [cards, setCards] = useState<ProfileCard[]>([]);

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
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No profiles yet. Tap + to create one.</Text>
        }
        renderItem={({ item: { profile, latest } }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: '/profile-timeline', params: { id: profile.id } })}
          >
            <View style={styles.avatar}>
              {profile.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={styles.avatarImg} />
              ) : (
                <AvatarDisplay config={buildAvatarConfig(profile)} size={56} compact />
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{profile.name}</Text>
              {latest ? (
                <Text style={styles.sub}>
                  {formatMeasurement(latest, primaryUnit)}
                  <Text style={styles.dot}> · </Text>
                  {timeAgo(latest.measuredAt)}
                </Text>
              ) : (
                <Text style={styles.subFaded}>No measurements yet</Text>
              )}
            </View>

            <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
          </Pressable>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/create-profile')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  list:      { padding: 16, paddingBottom: 100 },
  empty:     { textAlign: 'center', color: '#A0AEC0', marginTop: 60, fontSize: 15 },

  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#fff',
    borderRadius:    16,
    padding:         16,
    marginBottom:    12,
    gap:             14,
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  cardPressed: { opacity: 0.85 },

  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EDF2F7',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },

  info:     { flex: 1 },
  name:     { fontSize: 17, fontWeight: '700', color: '#1A202C', marginBottom: 4 },
  sub:      { fontSize: 14, color: '#4A5568' },
  subFaded: { fontSize: 14, color: '#A0AEC0' },
  dot:      { color: '#CBD5E0' },

  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4A90D9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
