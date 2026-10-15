import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, TextInput, Keyboard, ScrollView,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { useBLEMeasure } from '../../src/hooks/useBLEMeasure';
import { saveMeasurement } from '../../src/services/measurement.service';
import { getProfiles } from '../../src/services/profile.service';
import { Profile } from '../../src/db/schema';
import { toCm, formatHeight } from '../../src/utils/weight';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';
import { ProfileAvatar } from '../../src/components/all/ProfileAvatar';

type PendingMeasurement = {
  heightCm:   number;
  heightFt?:  number;
  heightIn?:  number;
  measuredAt: number;
  source:     'ble' | 'manual';
};

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Flow: 1) choose the profile  →  2) BLE reading or manual entry  →  3) confirm & save.
export default function MeasurementsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { profileId: presetParam } = useLocalSearchParams<{ profileId?: string }>();
  // Ref so clearing the param below doesn't re-run (and reset) the focus effect.
  const presetRef = useRef(presetParam);
  presetRef.current = presetParam;
  const unit   = useSettingsStore((s) => s.primaryUnit);

  const { status, valueCm, saveRequestedCm, clearSaveRequest, error, startScan, disconnect } = useBLEMeasure();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [saved,              setSaved]              = useState(false);
  const [profileList,        setProfileList]        = useState<Profile[]>([]);
  const [selectedProfile,    setSelectedProfile]    = useState<Profile | null>(null);
  const [manualModalVisible, setManualModalVisible] = useState(false);

  // Manual entry state
  const [manualCm,       setManualCm]       = useState('');
  const [manualFt,       setManualFt]       = useState('');
  const [manualIn,       setManualIn]       = useState('');
  const [manualDate,     setManualDate]     = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Each visit starts at profile selection; the BLE scan only begins once a profile is chosen.
  useFocusEffect(
    useCallback(() => {
      setSelectedProfile(null);
      const presetProfileId = presetRef.current;
      if (userId) {
        getProfiles(userId).then((list) => {
          setProfileList(list);
          // Launched from a profile page: the profile is already known, so skip selection.
          const preset = presetProfileId ? list.find((p) => p.id === presetProfileId) : undefined;
          if (preset) {
            setSelectedProfile(preset);
            startScan();
          }
          // Consume the param so later visits via the tab bar start at profile selection.
          if (presetProfileId) router.setParams({ profileId: undefined });
        });
      }
      return () => {
        disconnect();
        setSelectedProfile(null);
        setManualModalVisible(false);
      };
    }, [userId]),
  );

  function chooseProfile(profile: Profile) {
    setSelectedProfile(profile);
    startScan();
  }

  function changeProfile() {
    disconnect();
    setSelectedProfile(null);
  }

  // Confirm, then save the measurement to the chosen profile
  function confirmAndSave(m: PendingMeasurement) {
    if (!selectedProfile) return;
    const profile = selectedProfile;

    const valueLabel = m.heightFt != null && m.heightIn != null
      ? `${m.heightFt} ft ${m.heightIn} in`
      : formatHeight(m.heightCm, unit);

    Alert.alert(
      'Confirm Measurement',
      `Save ${valueLabel} to ${profile.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => { if (m.source === 'manual') setManualModalVisible(true); },
        },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await saveMeasurement(profile.id, m.heightCm, m.measuredAt, m.heightFt, m.heightIn);
              setSaved(true);
              setTimeout(() => setSaved(false), 1200);
              if (m.source === 'manual') {
                setManualCm('');
                setManualFt('');
                setManualIn('');
                setManualDate(new Date());
                startScan(); // resume BLE scan after a manual save
              }
            } catch (e) {
              if (m.source === 'manual') setManualModalVisible(true);
              Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  // Physical save button on device: "SAVE,17.5" → confirm for the chosen profile
  useEffect(() => {
    if (saveRequestedCm == null) return;
    if (status !== 'connected' || !selectedProfile) return;
    confirmAndSave({ heightCm: saveRequestedCm, measuredAt: Date.now(), source: 'ble' });
    clearSaveRequest();
  }, [saveRequestedCm]);

  // BLE: use the current reading
  function handleBleSave() {
    if (valueCm === null) return;
    confirmAndSave({ heightCm: valueCm, measuredAt: Date.now(), source: 'ble' });
  }

  // Manual: open modal, stopping any BLE scan in progress
  function openManual() {
    disconnect();
    setManualDate(new Date());
    setManualModalVisible(true);
  }

  function closeManualModal() {
    Keyboard.dismiss();
    setManualModalVisible(false);
    if (selectedProfile) startScan();
  }

  // Manual: validate entry, close modal, then confirm
  function handleManualSave() {
    Keyboard.dismiss();
    let heightCm: number;
    let heightFt: number | undefined;
    let heightIn: number | undefined;

    if (unit === 'cm') {
      heightCm = parseFloat(manualCm);
      if (isNaN(heightCm) || heightCm <= 0) {
        return Alert.alert('Invalid height', 'Please enter a valid height in cm.');
      }
    } else {
      const feet   = parseFloat(manualFt) || 0;
      const inches = parseFloat(manualIn) || 0;
      if (feet < 0 || inches < 0 || inches >= 12) {
        return Alert.alert('Invalid height', 'Feet must be ≥ 0 and inches must be 0–11.');
      }
      if (feet === 0 && inches === 0) {
        return Alert.alert('Invalid height', 'Please enter a height greater than zero.');
      }
      heightCm = toCm(feet, 'ft', inches);
      heightFt = Math.floor(feet);
      heightIn = inches;
    }

    setManualModalVisible(false);
    confirmAndSave({ heightCm, heightFt, heightIn, measuredAt: manualDate.getTime(), source: 'manual' });
  }

  const hasProfiles = profileList.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Pressable style={styles.body} onPress={() => Keyboard.dismiss()} accessible={false}>
        {!hasProfiles ? (
          <View style={styles.noProfileBox}>
            <Ionicons name="person-outline" size={48} color={colors.borderStrong} />
            <Text style={styles.noProfileTitle}>No profiles yet</Text>
            <Text style={styles.noProfileDesc}>
              Create a profile first so measurements can be saved against it.
            </Text>
            <Pressable style={styles.noProfileBtn} onPress={() => router.push('/(tabs)/profiles')}>
              <Text style={styles.noProfileBtnText}>Go to Profiles</Text>
            </Pressable>
          </View>
        ) : !selectedProfile ? (
          /* ── Step 1: choose the profile ── */
          <View style={styles.pickWrap}>
            <Text style={styles.pickTitle}>Who are you measuring?</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pickList}>
              {profileList.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.profilePickRow, pressed && styles.profilePickRowPressed]}
                  onPress={() => chooseProfile(p)}
                >
                  <ProfileAvatar profile={p} color={colors.primary} size={44} />
                  <Text style={styles.pickName}>{p.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          /* ── Step 2: BLE reading or manual entry ── */
          <>
            <View style={styles.selectedBar}>
              <ProfileAvatar profile={selectedProfile} color={colors.primary} size={36} />
              <View style={styles.selectedText}>
                <Text style={styles.selectedLabel}>Measuring</Text>
                <Text style={styles.selectedName}>{selectedProfile.name}</Text>
              </View>
              <Pressable onPress={changeProfile} hitSlop={10} style={styles.changeBtn}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>

            <View style={styles.bleContent}>
              {(status === 'scanning' || status === 'connecting') && (
                <>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.scanLabel}>
                    {status === 'scanning' ? 'Searching for ForeverMeasure…' : 'Connecting…'}
                  </Text>
                </>
              )}
              {status === 'connected' && (
                <>
                  <View style={styles.connectedHeader}>
                    <View style={styles.dot} />
                    <Text style={styles.deviceName}>ForeverMeasure</Text>
                  </View>
                  <Text style={styles.readingPrimary}>
                    {valueCm !== null ? formatHeight(valueCm, unit) : '—'}
                  </Text>
                  <Text style={styles.readingSecondary}>
                    {valueCm !== null ? formatHeight(valueCm, unit === 'cm' ? 'ft' : 'cm') : '—'}
                  </Text>
                </>
              )}
              {(status === 'error' || status === 'idle') && (
                <>
                  <Ionicons name="bluetooth-outline" size={48} color={colors.danger} />
                  {status === 'error' && <Text style={styles.errorText}>{error}</Text>}
                  <Pressable style={styles.retryBtn} onPress={startScan}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </>
              )}
              {saved && <Text style={styles.savedBanner}>Saved!</Text>}
            </View>

            <View style={styles.bottomActions}>
              {status === 'connected' && (
                <Pressable
                  style={[styles.btnPrimary, valueCm === null && styles.btnDisabled]}
                  onPress={handleBleSave}
                  disabled={valueCm === null}
                >
                  <Text style={styles.btnPrimaryText}>Save Measurement</Text>
                </Pressable>
              )}
              <Pressable style={styles.btnSecondary} onPress={openManual}>
                <Text style={styles.btnSecondaryText}>Enter manually</Text>
              </Pressable>
              {status === 'connected' && (
                <Pressable style={styles.disconnectLink} onPress={disconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </Pressable>

      {/* ── Manual entry modal ── */}
      <Modal
        visible={manualModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeManualModal}
      >
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView
            style={styles.modalFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalInner}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Manual Entry</Text>
                <Pressable onPress={closeManualModal} hitSlop={10}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Height</Text>
              {unit === 'cm' ? (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="e.g. 120.5"
                    keyboardType="decimal-pad"
                    value={manualCm}
                    onChangeText={setManualCm}
                  />
                  <Text style={styles.unitLabel}>cm</Text>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    placeholder="0"
                    keyboardType="number-pad"
                    value={manualFt}
                    onChangeText={setManualFt}
                  />
                  <Text style={styles.unitLabel}>ft</Text>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={manualIn}
                    onChangeText={setManualIn}
                  />
                  <Text style={styles.unitLabel}>in</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Date</Text>
              <Pressable
                style={styles.dateBtn}
                onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
              >
                <Text style={styles.dateBtnText}>{formatDateLabel(manualDate)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              <View style={styles.modalActions}>
                <Pressable style={styles.btnSecondaryFlex} onPress={closeManualModal}>
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimaryFlex} onPress={handleManualSave}>
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          date={manualDate}
          maximumDate={new Date()}
          onConfirm={(d) => { setManualDate(d); setShowDatePicker(false); }}
          onCancel={() => setShowDatePicker(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body:   { flex: 1 },

    noProfileBox:     { alignItems: 'center', marginTop: 80, paddingHorizontal: 40, gap: 10 },
    noProfileTitle:   { fontSize: 18, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
    noProfileDesc:    { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
    noProfileBtn:     { marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    noProfileBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },

    // BLE status display
    bleContent: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      gap: 16, paddingHorizontal: 32,
    },
    connectedHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scanLabel:        { fontSize: 16, color: colors.primary, fontWeight: '500', textAlign: 'center' },
    errorText:        { fontSize: 14, color: colors.danger, textAlign: 'center', lineHeight: 20 },
    retryBtn:         { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary },
    retryText:        { color: colors.primary, fontWeight: '600', fontSize: 15 },
    deviceName:       { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
    dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: '#48BB78' },
    readingPrimary:   { fontSize: 48, fontWeight: '700', color: colors.primary, textAlign: 'center' },
    readingSecondary: { fontSize: 18, fontWeight: '500', color: colors.textFaint, textAlign: 'center' },
    savedBanner:      { textAlign: 'center', color: '#48BB78', fontWeight: '600' },

    // Bottom actions
    bottomActions:  { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
    disconnectLink: { alignItems: 'center', paddingVertical: 8 },
    disconnectText: { color: colors.textFaint, fontSize: 14 },

    // Step 1: profile selection
    pickWrap:  { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    pickTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
    pickList:  { paddingBottom: 32, gap: 10 },
    profilePickRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 14, borderRadius: 14,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    profilePickRowPressed: { borderColor: colors.primary },
    pickName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textSecondary },

    // Step 2: selected-profile bar
    selectedBar: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 24, marginTop: 16, padding: 12, borderRadius: 14,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    selectedText:  { flex: 1 },
    selectedLabel: { fontSize: 12, color: colors.textMuted },
    selectedName:  { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    changeBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.primary },
    changeText:    { fontSize: 13, fontWeight: '600', color: colors.primary },

    // Manual entry modal
    modalSafe:    { flex: 1, backgroundColor: colors.background },
    modalFlex:    { flex: 1 },
    modalInner:   { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
    modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 'auto', paddingTop: 16 },

    // Shared form styles
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 20 },
    inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.textPrimary,
    },
    inputFlex:  { flex: 1 },
    inputSmall: { width: 70 },
    unitLabel:  { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
    dateBtn: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    },
    dateBtnText: { fontSize: 15, color: colors.textSecondary },

    btnSecondary:     { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    btnSecondaryFlex: { flex: 1, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
    btnSecondaryText: { fontSize: 15, color: colors.textSecondary, fontWeight: '500' },
    btnPrimary:       { height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    btnPrimaryFlex:   { flex: 1, height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    btnPrimaryText:   { fontSize: 16, color: colors.onPrimary, fontWeight: '600' },
    btnDisabled:      { opacity: 0.4 },
  });
}
