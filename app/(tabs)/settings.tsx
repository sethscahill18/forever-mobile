import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../../src/store/settings.store';
import { HeightUnit } from '../../src/utils/weight';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';

const UNIT_OPTIONS: { label: string; value: HeightUnit }[] = [
  { label: 'Centimetres (cm)', value: 'cm' },
  { label: 'Feet & Inches',    value: 'ft' },
];

export default function SettingsScreen() {
  const primaryUnit    = useSettingsStore((s) => s.primaryUnit);
  const setPrimaryUnit = useSettingsStore((s) => s.setPrimaryUnit);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MEASUREMENTS</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Primary Unit</Text>
          <Text style={styles.rowDesc}>Display and enter measurements in:</Text>
          <View style={styles.segmented}>
            {UNIT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.seg, primaryUnit === opt.value && styles.segActive]}
                onPress={() => setPrimaryUnit(opt.value)}
              >
                <Text style={[styles.segText, primaryUnit === opt.value && styles.segTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen:        { flex: 1, backgroundColor: colors.background },
    section:       { marginTop: 24, paddingHorizontal: 16 },
    sectionHeader: { fontSize: 12, fontWeight: '600', color: colors.textFaint, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    rowLabel:    { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
    rowDesc:     { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
    segmented:   { flexDirection: 'column', gap: 8 },
    seg: {
      padding: 12, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background, alignItems: 'center',
    },
    segActive:        { backgroundColor: colors.primary, borderColor: colors.primary },
    segText:          { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
    segTextActive:    { color: colors.onPrimary },
  });
}
