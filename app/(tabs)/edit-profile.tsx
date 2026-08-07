import { useCallback, useState } from 'react';
import { Alert, View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ProfileForm, ProfileFormValues, profileFormToDb } from '../../src/components/shared/ProfileForm';
import { updateProfile } from '../../src/services/profile.service';
import { db } from '../../src/db/database';
import { profiles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { Profile } from '../../src/db/schema';

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

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Edit Profile</Text>
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
  header:    { fontSize: 22, fontWeight: '700', color: '#1A202C', padding: 20, paddingBottom: 0 },
});
