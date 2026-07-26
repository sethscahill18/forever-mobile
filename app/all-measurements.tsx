import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMeasurements } from '../src/services/measurement.service';
import { Measurement } from '../src/db/schema';
import { useSettingsStore } from '../src/store/settings.store';
import { formatHeight } from '../src/utils/weight';

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function AllMeasurementsScreen() {
  const { profileId, profileName } = useLocalSearchParams<{ profileId: string; profileName: string }>();
  const primaryUnit   = useSettingsStore((s) => s.primaryUnit);

  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (profileId) getMeasurements(profileId).then(setMeasurements);
    }, [profileId]),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown:      true,
          title:            'All Measurements',
          headerBackTitle:  'Back',
          headerStyle:      { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', color: '#1A202C' },
          headerTintColor:  '#4A90D9',
        }}
      />

      <FlatList
        data={measurements}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No measurements yet for this profile.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/measurement-detail',
                params: { id: item.id, profileName: profileName ?? '' },
              })
            }
          >
            <Text style={styles.value}>{formatMeasurement(item, primaryUnit)}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.date}>{shortDate(item.measuredAt)}</Text>
              {item.isMilestone === 1 && (
                <Ionicons name="star" size={14} color="#D69E2E" style={styles.star} />
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FAFC' },
  list:   { padding: 16, paddingBottom: 40 },
  empty:  { textAlign: 'center', color: '#A0AEC0', marginTop: 60, fontSize: 15 },

  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    backgroundColor:   '#fff',
    borderRadius:      12,
    padding:           14,
    marginBottom:      8,
    shadowColor:       '#000',
    shadowOpacity:     0.05,
    shadowRadius:      4,
    elevation:         2,
  },
  value:    { fontSize: 16, fontWeight: '700', color: '#2D3748' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date:     { fontSize: 14, color: '#718096' },
  star:     { marginLeft: 2 },
});
