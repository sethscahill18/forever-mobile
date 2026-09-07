import { useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProfileForm, ProfileFormValues, profileFormToDb } from '../../src/components/shared/ProfileForm';
import { createProfile } from '../../src/services/profile.service';
import { useAuthStore } from '../../src/store/auth.store';
import { useActiveProfileStore } from '../../src/store/activeProfile.store';
import { useAppTheme, useAppThemeStore } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';

export default function CreateProfileScreen() {
  const userId     = useAuthStore((s) => s.userId);
  const setProfile = useActiveProfileStore((s) => s.setProfile);
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleSave(values: ProfileFormValues) {
    if (!values.name.trim()) return Alert.alert('Name is required');
    if (!userId) return;
    setLoading(true);
    try {
      const profile = await createProfile(userId, profileFormToDb(values));
      if (values.setAsActiveTheme) {
        useAppThemeStore.getState().setActiveTheme(values.colourPalette);
      }
      setProfile(profile);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not create profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>New Profile</Text>
      <ProfileForm
        onSave={handleSave}
        onCancel={() => router.back()}
        submitLabel="Create Profile"
        loading={loading}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header:    { fontSize: 22, fontWeight: '700', color: colors.textPrimary, padding: 20, paddingBottom: 0 },
  });
}
