import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { getProfiles, deleteProfile } from '../../src/services/profile.service';
import { Profile } from '../../src/db/schema';
import { Ionicons } from '@expo/vector-icons';

export default function ProfilesScreen() {
  const userId = useAuthStore((s) => s.userId);
  const [list, setList] = useState<Profile[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (userId) getProfiles(userId).then(setList);
    }, [userId]),
  );

  function handleDelete(profile: Profile) {
    Alert.alert(
      'Delete Profile',
      `Delete "${profile.name}" and all their measurements?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteProfile(profile.id);
            setList((prev) => prev.filter((p) => p.id !== profile.id));
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No profiles yet. Tap + to create one.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/profile-timeline', params: { id: item.id } })}
          >
            <View style={styles.rowLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/edit-profile', params: { id: item.id } })}
                hitSlop={12}
              >
                <Ionicons name="create-outline" size={20} color="#A0AEC0" />
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} hitSlop={12}>
                <Ionicons name="trash-outline" size={20} color="#FC8181" />
              </Pressable>
            </View>
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

  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '600', color: '#2D3748' },
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4A90D9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
