import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Switch, TextInput, Pressable, StyleSheet,
  ScrollView, Alert, Image, ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ExpoCrypto from 'expo-crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/database';
import { measurements, Measurement } from '../src/db/schema';
import { updateMeasurement } from '../src/services/measurement.service';
import { useSettingsStore } from '../src/store/settings.store';
import { formatHeight } from '../src/utils/weight';
import { useAppTheme } from '../src/store/appTheme.store';
import { ThemeColors } from '../src/theme/tokens';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

export default function MeasurementDetailScreen() {
  const { id, profileName } = useLocalSearchParams<{ id: string; profileName: string }>();
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [isMilestone, setIsMilestone]   = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneImage, setMilestoneImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load measurement on mount
  useEffect(() => {
    if (!id) return;
    db.select().from(measurements).where(eq(measurements.id, id)).then(([m]) => {
      if (!m) return;
      setMeasurement(m);
      setIsMilestone(m.isMilestone === 1);
      setMilestoneName(m.milestoneName ?? '');
      setMilestoneImage(m.milestoneImage ?? null);
    });
  }, [id]);

  function handleToggleMilestone(value: boolean) {
    setIsMilestone(value);
  }

  function handleNameChange(text: string) {
    setMilestoneName(text);
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const dir = FileSystem.documentDirectory + 'milestones/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = uri.split('.').pop() ?? 'jpg';
    const dest = dir + ExpoCrypto.randomUUID() + '.' + ext;
    await FileSystem.copyAsync({ from: uri, to: dest });
    setMilestoneImage(dest);
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      // If un-ticking milestone, delete any previously stored image file
      if (!isMilestone && measurement?.milestoneImage) {
        await FileSystem.deleteAsync(measurement.milestoneImage, { idempotent: true });
      }
      await updateMeasurement(id, {
        isMilestone:    isMilestone ? 1 : 0,
        milestoneName:  isMilestone ? milestoneName.trim() || null : null,
        milestoneImage: isMilestone ? milestoneImage : null,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (!measurement) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: true, title: 'Measurement', headerTintColor: colors.primary }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerShown:      true,
          title:            'Measurement',
          headerBackTitle:  'Back',
          headerStyle:      { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
          headerTintColor:  colors.primary,
        }}
      />

      {/* ── Read-only info ── */}
      <View style={styles.card}>
        <InfoRow label="Profile" value={profileName ?? '—'} styles={styles} />
        <InfoRow label="Height"  value={formatMeasurement(measurement, primaryUnit)} styles={styles} />
        <InfoRow label="Date"    value={formatDate(measurement.measuredAt)} last styles={styles} />
      </View>

      {/* ── Milestone editor ── */}
      <View style={styles.card}>
        <View style={styles.milestoneToggleRow}>
          <Text style={styles.fieldLabel}>Milestone</Text>
          <Switch
            value={isMilestone}
            onValueChange={handleToggleMilestone}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {isMilestone && (
          <>
            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Milestone Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. First steps, School start…"
              value={milestoneName}
              onChangeText={handleNameChange}
              autoCapitalize="sentences"
            />

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Image</Text>
            {milestoneImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: milestoneImage }} style={styles.thumbnail} />
                <Pressable
                  style={styles.changeImageBtn}
                  onPress={handlePickImage}
                >
                  <Text style={styles.changeImageText}>Change Image</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.imagePicker} onPress={handlePickImage}>
                <Text style={styles.imagePickerText}>Choose from Library</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* ── Save ── */}
      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value, last, styles }: { label: string; value: string; last?: boolean; styles: Styles }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 48 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
      backgroundColor:  colors.surface,
      borderRadius:     14,
      marginBottom:     16,
      shadowColor:      '#000',
      shadowOpacity:    0.05,
      shadowRadius:     6,
      elevation:        2,
      overflow:         'hidden',
    },

    // Info rows
    infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    infoLabel:     { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
    infoValue:     { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },

    // Milestone toggle
    milestoneToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    fieldLabel:         { fontSize: 15, color: colors.textSecondary, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
    divider:            { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

    // Text input
    textInput: {
      marginHorizontal: 16,
      marginBottom:     14,
      borderWidth:      1,
      borderColor:      colors.border,
      borderRadius:     10,
      padding:          12,
      fontSize:         15,
      backgroundColor:  colors.background,
      color:            colors.textPrimary,
    },

    // Image picker
    imagePicker: {
      marginHorizontal: 16,
      marginBottom:     14,
      borderWidth:      1,
      borderColor:      colors.primary,
      borderRadius:     10,
      borderStyle:      'dashed',
      padding:          16,
      alignItems:       'center',
    },
    imagePickerText: { color: colors.primary, fontWeight: '600', fontSize: 15 },

    imageContainer: { marginHorizontal: 16, marginBottom: 14, gap: 10 },
    thumbnail:      { width: '100%', height: 200, borderRadius: 10, backgroundColor: colors.surfaceAlt },
    changeImageBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    changeImageText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },

    // Save button
    saveBtn:         { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveText:        { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  });
}
