import { View, Text, StyleSheet } from 'react-native';

export default function MeasurementsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Measurements — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFC' },
  text:      { fontSize: 16, color: '#4A5568' },
});
