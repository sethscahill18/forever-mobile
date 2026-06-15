import { View, Text, StyleSheet } from 'react-native';

export default function CollaborativeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Collaborative — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFC' },
  text:      { fontSize: 16, color: '#4A5568' },
});
