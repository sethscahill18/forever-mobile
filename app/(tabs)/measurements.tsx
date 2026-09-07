import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, Alert, TextInput, Keyboard, ScrollView,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { useBLEMeasure } from '../../src/hooks/useBLEMeasure';
import { saveMeasurement } from '../../src/services/measurement.service';
import { getProfiles } from '../../src/services/profile.service';
import { Profile } from '../../src/db/schema';
import { toCm, formatHeight } from '../../src/utils/weight';
import { useAppTheme } from '../../src/store/appTheme.store';
import { ThemeColors } from '../../src/theme/tokens';

type Mode = 'hidden' | 'pick-profile';

const PANEL_HEIGHT_PICK_PROFILE = 300;

type PendingMeasurement = {
  heightCm:   number;
  heightFt?:  number;
  heightIn?:  number;
  measuredAt: number;
  returnMode: 'hidden' | 'manual';
};

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MeasurementsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const unit   = useSettingsStore((s) => s.primaryUnit);

  const { status, valueCm, saveRequestedCm, clearSaveRequest, error, startScan, disconnect } = useBLEMeasure();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode,               setMode]               = useState<Mode>('hidden');
  const [saved,              setSaved]              = useState(false);
  const [profileList,        setProfileList]        = useState<Profile[]>([]);
  const [pending,            setPending]            = useState<PendingMeasurement | null>(null);
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const panelAnim    = useRef(new Animated.Value(0)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  // Manual entry state
  const [manualCm,       setManualCm]       = useState('');
  const [manualFt,       setManualFt]       = useState('');
  const [manualIn,       setManualIn]       = useState('');
  const [manualDate,     setManualDate]     = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load profiles and auto-start BLE scan whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      if (userId) getProfiles(userId).then(setProfileList);
      startScan();
      return () => {
        disconnect();
        setMode('hidden');
        setManualModalVisible(false);
      };
    }, [userId]),
  );

  // Lift pick-profile panel above keyboard (precautionary)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Animate pick-profile panel
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: mode === 'pick-profile' ? PANEL_HEIGHT_PICK_PROFILE : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [mode]);

  // Physical save button on device: "SAVE,17.5" → trigger profile picker
  useEffect(() => {
    if (saveRequestedCm == null) return;
    if (status !== 'connected') return;
    setPending({ heightCm: saveRequestedCm, measuredAt: Date.now(), returnMode: 'hidden' });
    setMode('pick-profile');
    clearSaveRequest();
  }, [saveRequestedCm]);

  // BLE: capture current reading and proceed to profile selection
  function handleBleRequest() {
    if (valueCm === null) return;
    setPending({ heightCm: valueCm, measuredAt: Date.now(), returnMode: 'hidden' });
    setMode('pick-profile');
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
  }

  // Manual: validate entry, close modal, and proceed to profile selection
  function handleManualRequest() {
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
    setPending({ heightCm, heightFt, heightIn, measuredAt: manualDate.getTime(), returnMode: 'manual' });
    setMode('pick-profile');
  }

  // Save pending measurement to the chosen profile
  function handleProfilePick(profile: Profile) {
    if (!pending) return;

    const valueLabel = pending.heightFt != null && pending.heightIn != null
      ? `${pending.heightFt} ft ${pending.heightIn} in`
      : formatHeight(pending.heightCm, unit);

    Alert.alert(
      'Confirm Measurement',
      `Save ${valueLabel} to ${profile.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await saveMeasurement(profile.id, pending.heightCm, pending.measuredAt, pending.heightFt, pending.heightIn);
              const returnMode = pending.returnMode;
              setPending(null);
              setSaved(true);
              setTimeout(() => {
                setSaved(false);
                setMode('hidden');
                if (returnMode === 'manual') {
                  setManualCm('');
                  setManualFt('');
                  setManualIn('');
                  setManualDate(new Date());
                  startScan(); // restart BLE scan after manual save
                }
              }, 1200);
            } catch (e) {
              Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  function closePanel() {
    setPending(null);
    setMode('hidden');
  }

  function backFromPickProfile() {
    setMode('hidden');
    if (pending?.returnMode === 'manual') {
      setManualModalVisible(true); // return to manual entry modal
    }
  }

  const hasProfiles = profileList.length > 0;

  return (
    <View style={styles.screen}>
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
        ) : (
          <>
            {/* Center: BLE status display */}
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

            {/* Bottom actions — hidden while pick-profile panel is open */}
            {mode === 'hidden' && (
              <View style={styles.bottomActions}>
                {status === 'connected' && (
                  <Pressable
                    style={[styles.btnPrimary, valueCm === null && styles.btnDisabled]}
                    onPress={handleBleRequest}
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
            )}
          </>
        )}
      </Pressable>

      {/* ── Profile picker panel ── */}
      <Animated.View
        style={[styles.panel, { height: panelAnim, bottom: keyboardAnim }]}
        pointerEvents={mode === 'hidden' ? 'none' : 'auto'}
      >
        {mode === 'pick-profile' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <Pressable onPress={backFromPickProfile} hitSlop={10} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Text style={styles.panelTitle}>Select Profile</Text>
              <Pressable onPress={closePanel} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {saved && <Text style={styles.savedBanner}>Saved!</Text>}
            <ScrollView style={styles.profileScroll} showsVerticalScrollIndicator={false}>
              {profileList.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.profilePickRow}
                  onPress={() => handleProfilePick(p)}
                >
                  <View style={styles.pickAvatar}>
                    <Text style={styles.pickAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.pickName}>{p.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

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
                <Pressable style={styles.btnPrimaryFlex} onPress={handleManualRequest}>
                  <Text style={styles.btnPrimaryText}>Next</Text>
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
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body:   { flex: 1 },

    noProfileBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
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

    // Pick-profile panel
    panel: {
      position: 'absolute', left: 0, right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.1, shadowRadius: 8, elevation: 12,
    },
    panelInner:  { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
    panelTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backText:    { color: colors.primary, fontSize: 15, fontWeight: '500' },
    profileScroll:  { flex: 1, marginTop: 4 },
    profilePickRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pickAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    pickAvatarText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
    pickName:       { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textSecondary },

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
