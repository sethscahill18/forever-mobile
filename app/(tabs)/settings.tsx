import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../src/store/settings.store';
import { HeightUnit } from '../../src/utils/weight';
import { useAppTheme, useAppThemeStore } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';
import { useNfcScan } from '../../src/hooks/useNfcScan';
import { resolveThemeFromNdef } from '../../src/constants/nfcTagThemes';

const UNIT_OPTIONS: { label: string; value: HeightUnit }[] = [
  { label: 'Centimetres (cm)', value: 'cm' },
  { label: 'Feet & Inches',    value: 'ft' },
];

export default function SettingsScreen() {
  const primaryUnit    = useSettingsStore((s) => s.primaryUnit);
  const setPrimaryUnit = useSettingsStore((s) => s.setPrimaryUnit);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { status: nfcStatus, data: nfcData, error: nfcError, scan: scanNfcTag } = useNfcScan();

  useEffect(() => {
    if (nfcStatus === 'success' && nfcData) {
      const matchedTheme = resolveThemeFromNdef(nfcData.ndefTexts);

      if (matchedTheme) {
        useAppThemeStore.getState().setActiveTheme(matchedTheme);
      } else {
        const lines = ['No recognised tag detected.', '', `UID: ${nfcData.uid}`];
        lines.push('', nfcData.hasNdef
          ? (nfcData.ndefTexts.length > 0
              ? `NDEF text:\n${nfcData.ndefTexts.join('\n')}`
              : 'NDEF present but no decodable text records.')
          : 'No NDEF data on this tag.');
        Alert.alert('Unrecognised Tag', lines.join('\n'));
      }
    } else if (nfcStatus === 'error' && nfcError) {
      Alert.alert('Scan Failed', nfcError);
    }
  }, [nfcStatus, nfcData, nfcError]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>DEVICE</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Set the Theme</Text>
          <Text style={styles.rowDesc}>Scan the door to set the theme.</Text>
          <Pressable
            style={[styles.seg, styles.segActive, nfcStatus === 'scanning' && styles.segDisabled]}
            onPress={scanNfcTag}
            disabled={nfcStatus === 'scanning'}
          >
            <Text style={styles.segTextActive}>
              {nfcStatus === 'scanning' ? 'Scanning…' : 'Scan Tag'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
    segDisabled:      { opacity: 0.5 },
    segText:          { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
    segTextActive:    { color: colors.onPrimary },
  });
}
