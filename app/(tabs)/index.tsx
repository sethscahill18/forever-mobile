import { View, Text, StyleSheet } from 'react-native';
import { useActiveProfileStore } from '../../src/store/activeProfile.store';

export default function HomeScreen() {
  const profile = useActiveProfileStore((s) => s.profile);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {profile ? `Home — ${profile.name}'s kitchen` : 'No profile selected'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFC' },
  text:      { fontSize: 16, color: '#4A5568' },
});
