import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { db, initDatabase } from '../src/db/database';
import { hasAccount, clearCredentials } from '../src/services/auth.service';
import { useAuthStore } from '../src/store/auth.store';
import { users } from '../src/db/schema';
import { initActiveProfile } from '../src/services/profile.service';
import { useSettingsStore } from '../src/store/settings.store';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    async function init() {
      await initDatabase();
      await loadSettings();
      setReady(true);
    }
    init().catch(console.error);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (userId) {
      initActiveProfile(userId).catch(console.error);
      router.replace('/(tabs)');
    } else {
      (async () => {
        const exists = await hasAccount();
        if (exists) {
          // Keychain survives app deletion — verify the DB still has the user row.
          // If it doesn't (fresh install), the credentials are stale; clear them.
          const rows = await db.select().from(users);
          if (rows.length === 0) await clearCredentials();
        }
        const stillExists = exists && (await hasAccount());
        router.replace(stillExists ? '/(auth)/login' : '/(auth)/create-account');
      })();
    }
  }, [ready, userId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
