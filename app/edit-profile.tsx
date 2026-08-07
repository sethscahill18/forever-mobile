import { useCallback, useState } from 'react';
import { Alert, View, StyleSheet, Pressable } from 'react-native';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProfileForm, ProfileFormValues, profileFormToDb } from '../src/components/shared/ProfileForm';
import { updateProfile, deleteProfile } from '../src/services/profile.service';
import { db } from '../src/db/database';
import { profiles, Profile } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default function EditProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        db.select().from(profiles).where(eq(profiles.id, id)).then(([p]) => {
          if (p) setProfile(p);
        });
      }
    }, [id]),
  );

  async function handleSave(values: ProfileFormValues) {
    if (!values.name.trim()) return Alert.alert('Name is required');
    if (!id) return;
    setLoading(true);
    try {
      await updateProfile(id, profileFormToDb(values));
      router.back();
    } catch {
      Alert.alert('Error', 'Could not update profile');
    } finally {
      setLoading(false);
    }
  }

  function handleDeletePress() {
    Alert.alert(
      'Delete Profile',
      `Delete "${profile?.name}" and all their measurements? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(id!);
              router.dismissAll();
            } catch {
              Alert.alert('Error', 'Could not delete profile');
            }
          },
        },
      ],
    );
  }

  function handleMenuPress() {
    Alert.alert('Profile Options', undefined, [
      { text: 'Delete Profile', style: 'destructive', onPress: handleDeletePress },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown:      true,
          title:            'Edit Profile',
          headerBackTitle:  'Back',
          headerStyle:      { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', color: '#1A202C' },
          headerTintColor:  '#4A90D9',
          headerRight: () => (
            <Pressable onPress={handleMenuPress} hitSlop={12} style={{ paddingRight: 4 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#4A5568" />
            </Pressable>
          ),
        }}
      />
      <ProfileForm
        initial={profile}
        onSave={handleSave}
        onCancel={() => router.back()}
        submitLabel="Save Changes"
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
});
