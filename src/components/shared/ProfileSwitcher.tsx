import { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useActiveProfileStore } from '../../store/activeProfile.store';
import { useAuthStore } from '../../store/auth.store';
import { getProfiles } from '../../services/profile.service';
import { Profile } from '../../db/schema';
import { useFocusEffect } from 'expo-router';

export function ProfileSwitcher() {
  const profile  = useActiveProfileStore((s) => s.profile);
  const setProfile = useActiveProfileStore((s) => s.setProfile);
  const userId   = useAuthStore((s) => s.userId);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const sheetRef = useRef<BottomSheet>(null);

  useFocusEffect(
    useCallback(() => {
      if (userId) getProfiles(userId).then(setAllProfiles);
    }, [userId]),
  );

  function open()  { sheetRef.current?.expand(); }
  function close() { sheetRef.current?.close(); }

  function select(p: Profile) {
    setProfile(p);
    close();
  }

  return (
    <>
      <Pressable style={styles.button} onPress={open}>
        <Text style={styles.name} numberOfLines={1}>
          {profile ? profile.name : 'Select profile'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['40%']}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetView style={styles.sheet}>
          <Text style={styles.sheetTitle}>Switch Profile</Text>
          <FlatList
            data={allProfiles}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, item.id === profile?.id && styles.rowActive]}
                onPress={() => select(item)}
              >
                <Text style={styles.rowText}>{item.name}</Text>
                {item.id === profile?.id && <Text style={styles.tick}>✓</Text>}
              </Pressable>
            )}
          />
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 16 },
  name:       { fontSize: 16, fontWeight: '600', color: '#1A202C', maxWidth: 120 },
  chevron:    { fontSize: 14, color: '#718096' },
  sheet:      { flex: 1, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#1A202C' },
  row:        { paddingVertical: 14, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between', borderRadius: 8 },
  rowActive:  { backgroundColor: '#EBF4FF' },
  rowText:    { fontSize: 16, color: '#2D3748' },
  tick:       { fontSize: 16, color: '#4A90D9' },
});
