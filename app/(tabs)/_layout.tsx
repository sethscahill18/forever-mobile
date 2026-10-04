import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/store/appTheme.store';

export default function TabLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      initialRouteName="profiles"
      screenOptions={{
        headerStyle:      { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Profiles',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="measurements"
        options={{
          title: 'Add',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collaborative"
        options={{
          title: 'All',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="create-profile" options={{ href: null, title: 'Create a Profile' }} />
      <Tabs.Screen name="edit-profile"   options={{ href: null }} />
    </Tabs>
  );
}
