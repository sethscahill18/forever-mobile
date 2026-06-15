import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDatabase } from '../src/db/database';
import { hasAccount } from '../src/services/auth.service';
import { useAuthStore } from '../src/store/auth.store';
import { initActiveProfile } from '../src/services/profile.service';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    async function init() {
      await initDatabase();
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
      hasAccount().then((exists) => {
        router.replace(exists ? '/(auth)/login' : '/(auth)/create-account');
      });
    }
  }, [ready, userId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
