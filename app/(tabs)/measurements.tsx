import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, Alert, TextInput, Keyboard, ScrollView,
} from 'react-native';
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

type Mode = 'idle' | 'chooser' | 'manual' | 'ble' | 'pick-profile';

const PANEL_HEIGHTS: Record<Exclude<Mode, 'idle'>, number> = {
  chooser:          190,
  manual:           310,
  ble:              260,
  'pick-profile':   300,
};

type PendingMeasurement = {
  heightCm:   number;
  heightFt?:  number;
  heightIn?:  number;
  measuredAt: number;
  returnMode: 'ble' | 'manual';
};

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MeasurementsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const unit   = useSettingsStore((s) => s.primaryUnit);

  const { status, valueCm, saveRequestedCm, clearSaveRequest, error, startScan, disconnect } = useBLEMeasure();
  const bleConnected = status === 'connected';
  const bleScanning  = status === 'scanning' || status === 'connecting';

  const [mode,        setMode]        = useState<Mode>('idle');
  const [saved,       setSaved]       = useState(false);
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [pending,     setPending]     = useState<PendingMeasurement | null>(null);

  const panelAnim    = useRef(new Animated.Value(0)).current;
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  // Manual entry state
  const [manualCm,       setManualCm]       = useState('');
  const [manualFt,       setManualFt]       = useState('');
  const [manualIn,       setManualIn]       = useState('');
  const [manualDate,     setManualDate]     = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Refresh profile list whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (userId) getProfiles(userId).then(setProfileList);
    }, [userId]),
  );

  // Lift panel above keyboard
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

  // Sync BLE connection state into mode
  useEffect(() => {
    if (bleConnected && mode !== 'ble') setMode('ble');
    if (!bleConnected && mode === 'ble') setMode('idle');
  }, [bleConnected]);

  // Animate panel height
  useEffect(() => {
    const targetHeight = mode === 'idle' ? 0 : PANEL_HEIGHTS[mode as Exclude<Mode, 'idle'>];
    Animated.spring(panelAnim, {
      toValue: targetHeight,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [mode]);

  // Surface BLE errors
  useEffect(() => {
    if (error) {
      Alert.alert('Bluetooth error', error);
      setMode('idle');
    }
  }, [error]);

  // Physical save button on device: "SAVE,17.5" → trigger profile picker, same as tapping Save on screen
  useEffect(() => {
    if (saveRequestedCm == null) return;
    Alert.alert('Save received', `Device sent SAVE with value: ${saveRequestedCm} cm (mode: ${mode})`);
    if (mode !== 'ble') return;
    setPending({ heightCm: saveRequestedCm, measuredAt: Date.now(), returnMode: 'ble' });
    setMode('pick-profile');
    clearSaveRequest();
  }, [saveRequestedCm]);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // BLE: capture current reading and proceed to profile selection
  function handleBleRequest() {
    if (valueCm === null) return;
    setPending({ heightCm: valueCm, measuredAt: Date.now(), returnMode: 'ble' });
    setMode('pick-profile');
  }

  // Manual: validate entry and proceed to profile selection
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
                if (returnMode === 'manual') {
                  setManualCm('');
                  setManualFt('');
                  setManualIn('');
                  setManualDate(new Date());
                }
                setMode(returnMode);
              }, 1200);
            } catch (e) {
              Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  }

  function handleFAB() {
    if (bleScanning || mode !== 'idle') return;
    setMode('chooser');
  }

  function chooseDevice() {
    setMode('ble');
    startScan();
  }

  function chooseManual() {
    setMode('manual');
    setManualDate(new Date());
  }

  function closePanel() {
    Keyboard.dismiss();
    if (mode === 'ble') disconnect();
    setPending(null);
    setMode('idle');
  }

  function backFromPickProfile() {
    setMode(pending?.returnMode ?? 'idle');
  }

  const hasProfiles = profileList.length > 0;
  const showFAB     = mode === 'idle' && !bleScanning;

  return (
    <View style={styles.screen}>
      <Pressable style={styles.body} onPress={() => Keyboard.dismiss()} accessible={false}>
        {!hasProfiles ? (
          <View style={styles.noProfileBox}>
            <Ionicons name="person-outline" size={48} color="#CBD5E0" />
            <Text style={styles.noProfileTitle}>No profiles yet</Text>
            <Text style={styles.noProfileDesc}>
              Create a profile first so measurements can be saved against it.
            </Text>
            <Pressable style={styles.noProfileBtn} onPress={() => router.push('/(tabs)/profiles')}>
              <Text style={styles.noProfileBtnText}>Go to Profiles</Text>
            </Pressable>
          </View>
        ) : bleScanning ? (
          <View style={styles.fabRing}>
            <View style={styles.fabCircle}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          </View>
        ) : showFAB ? (
          <View style={styles.fabWrapper}>
            <View style={styles.fabRing}>
              <Pressable style={styles.fabCircle} onPress={handleFAB} accessibilityLabel="Add measurement">
                <Ionicons name="add" size={72} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.fabLabel}>Add Measurement</Text>
          </View>
        ) : null}
      </Pressable>

      <Animated.View
        style={[styles.panel, { height: panelAnim, bottom: keyboardAnim }]}
        pointerEvents={mode === 'idle' ? 'none' : 'auto'}
      >

        {/* ── Chooser ── */}
        {mode === 'chooser' && (
          <View style={styles.panelInner}>
            <Text style={styles.panelTitle}>Add Measurement</Text>
            <Pressable style={styles.choiceRow} onPress={chooseDevice}>
              <View style={styles.choiceIcon}>
                <Ionicons name="bluetooth-outline" size={22} color="#2B6CB0" />
              </View>
              <View>
                <Text style={styles.choiceLabel}>Connect to Device</Text>
                <Text style={styles.choiceDesc}>Take a live reading</Text>
              </View>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.choiceRow} onPress={chooseManual}>
              <View style={styles.choiceIcon}>
                <Ionicons name="create-outline" size={22} color="#2B6CB0" />
              </View>
              <View>
                <Text style={styles.choiceLabel}>Enter Manually</Text>
                <Text style={styles.choiceDesc}>Add a historical reading</Text>
              </View>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={closePanel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ── BLE connected ── */}
        {mode === 'ble' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <Text style={styles.deviceName}>ForeverMeasure</Text>
              <View style={styles.connectedRow}>
                <View style={styles.dot} />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            </View>
            <View style={styles.readingBlock}>
              <Text style={styles.readingPrimary}>
                {valueCm !== null ? formatHeight(valueCm, unit) : '—'}
              </Text>
              <Text style={styles.readingSecondary}>
                {valueCm !== null ? formatHeight(valueCm, unit === 'cm' ? 'ft' : 'cm') : '—'}
              </Text>
            </View>
            {saved && <Text style={styles.savedBanner}>Saved!</Text>}
            <View style={styles.panelActions}>
              <Pressable style={styles.btnSecondary} onPress={closePanel}>
                <Text style={styles.btnSecondaryText}>Disconnect</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, valueCm === null && styles.btnDisabled]}
                onPress={handleBleRequest}
                disabled={valueCm === null}
              >
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Manual entry ── */}
        {mode === 'manual' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Manual Entry</Text>
              <Pressable onPress={closePanel} hitSlop={10}>
                <Ionicons name="close" size={22} color="#718096" />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Height</Text>
            {unit === 'cm' ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="e.g. 17.5"
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
            <Pressable style={styles.dateBtn} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
              <Text style={styles.dateBtnText}>{formatDateLabel(manualDate)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#718096" />
            </Pressable>

            <View style={styles.panelActions}>
              <Pressable style={styles.btnSecondary} onPress={closePanel}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleManualRequest}>
                <Text style={styles.btnPrimaryText}>Next</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Profile picker ── */}
        {mode === 'pick-profile' && (
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <Pressable onPress={backFromPickProfile} hitSlop={10} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color="#2B6CB0" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Text style={styles.panelTitle2}>Select Profile</Text>
              <Pressable onPress={closePanel} hitSlop={10}>
                <Ionicons name="close" size={22} color="#718096" />
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
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E0" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={manualDate}
        maximumDate={new Date()}
        onConfirm={(d) => { setManualDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7FAFC' },
  body:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  noProfileBox:     { alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  noProfileTitle:   { fontSize: 18, fontWeight: '700', color: '#2D3748', textAlign: 'center' },
  noProfileDesc:    { fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 20 },
  noProfileBtn:     { marginTop: 8, backgroundColor: '#4A90D9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  noProfileBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  fabWrapper: { alignItems: 'center', gap: 20 },
  fabRing: {
    width: 176, height: 176, borderRadius: 88,
    borderWidth: 2, borderColor: 'rgba(74, 144, 217, 0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  fabCircle: {
    width: 156, height: 156, borderRadius: 78,
    backgroundColor: '#2B6CB0',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2B6CB0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  fabLabel: {
    fontSize: 17, fontWeight: '600',
    color: '#4A90D9', letterSpacing: 0.3,
  },

  panel: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 12,
  },
  panelInner: {
    flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20,
  },
  panelTitle:  { fontSize: 17, fontWeight: '700', color: '#1A202C', marginBottom: 16 },
  panelTitle2: { fontSize: 17, fontWeight: '700', color: '#1A202C' },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },

  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  choiceIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center',
  },
  choiceLabel: { fontSize: 15, fontWeight: '600', color: '#2D3748' },
  choiceDesc:  { fontSize: 12, color: '#A0AEC0', marginTop: 1 },
  divider:     { height: 1, backgroundColor: '#EDF2F7', marginVertical: 4 },
  cancelBtn:   { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  cancelText:  { color: '#718096', fontWeight: '500', fontSize: 15 },

  deviceName:    { fontSize: 16, fontWeight: '600', color: '#2D3748' },
  connectedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:           { width: 8, height: 8, borderRadius: 4, backgroundColor: '#48BB78' },
  connectedText: { fontSize: 13, color: '#48BB78', fontWeight: '500' },
  readingBlock:    { alignItems: 'center', marginVertical: 8 },
  readingPrimary:  { fontSize: 48, fontWeight: '700', color: '#2B6CB0', textAlign: 'center' },
  readingSecondary: { fontSize: 18, fontWeight: '500', color: '#A0AEC0', textAlign: 'center', marginTop: 2 },
  savedBanner: { textAlign: 'center', color: '#48BB78', fontWeight: '600', marginBottom: 4 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 6, marginTop: 12 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
  },
  inputFlex:  { flex: 1 },
  inputSmall: { width: 70 },
  unitLabel:  { fontSize: 15, color: '#4A5568', fontWeight: '500' },
  dateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
  },
  dateBtnText: { fontSize: 15, color: '#2D3748' },

  panelActions:     { flexDirection: 'row', gap: 12, marginTop: 'auto', paddingTop: 12 },
  btnSecondary:     { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E0', alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { fontSize: 15, color: '#4A5568', fontWeight: '500' },
  btnPrimary:       { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#2B6CB0', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText:   { fontSize: 15, color: '#fff', fontWeight: '600' },
  btnDisabled:      { opacity: 0.4 },

  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText:       { color: '#2B6CB0', fontSize: 15, fontWeight: '500' },
  profileScroll:  { flex: 1, marginTop: 4 },
  profilePickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7',
  },
  pickAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center',
  },
  pickAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pickName:       { flex: 1, fontSize: 15, fontWeight: '500', color: '#2D3748' },
});
