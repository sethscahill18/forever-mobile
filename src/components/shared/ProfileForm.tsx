import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Profile } from '../../db/schema';
import { WeightUnit } from '../../utils/weight';

export type ProfileFormValues = {
  name:            string;
  weightUnit:      WeightUnit;
  avatarGender:    'male' | 'female';
  avatarWidth:     number;
  avatarSkinTone:  number;
  avatarHairStyle: number;
  tableVariant:    number;
  bowlVariant:     number;
  plantpotVariant: number;
  wallVariant:     number;
};

function defaults(profile?: Profile): ProfileFormValues {
  return {
    name:            profile?.name            ?? '',
    weightUnit:      (profile?.weightUnit as WeightUnit) ?? 'kg',
    avatarGender:    (profile?.avatarGender as 'male' | 'female') ?? 'male',
    avatarWidth:     profile?.avatarWidth     ?? 0,
    avatarSkinTone:  profile?.avatarSkinTone  ?? 0,
    avatarHairStyle: profile?.avatarHairStyle ?? 0,
    tableVariant:    profile?.tableVariant    ?? 0,
    bowlVariant:     profile?.bowlVariant     ?? 0,
    plantpotVariant: profile?.plantpotVariant ?? 0,
    wallVariant:     profile?.wallVariant     ?? 0,
  };
}

type Props = {
  initial?:   Profile;
  onSave:     (values: ProfileFormValues) => void;
  onCancel:   () => void;
  submitLabel: string;
  loading:    boolean;
};

const UNIT_OPTIONS: { label: string; value: WeightUnit }[] = [
  { label: 'kg',     value: 'kg' },
  { label: 'lbs',    value: 'lbs' },
  { label: 'stones', value: 'st' },
];

const SKIN_TONES = ['#FDDBB4', '#D4956A', '#A0522D', '#4A2912'];
const WIDTH_LABELS = ['Slim', 'Regular', 'Athletic', 'Larger'];
const HAIR_LABELS  = ['Short', 'Long', 'Curly', 'Shaved/Bun'];

export function ProfileForm({ initial, onSave, onCancel, submitLabel, loading }: Props) {
  const [values, setValues] = useState<ProfileFormValues>(() => defaults(initial));

  function set<K extends keyof ProfileFormValues>(key: K, val: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mum, Dad, Jake"
          value={values.name}
          onChangeText={(v) => set('name', v)}
          autoCapitalize="words"
        />

        {/* Weight unit */}
        <Text style={styles.label}>Weight Unit</Text>
        <View style={styles.segmented}>
          {UNIT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.seg, values.weightUnit === opt.value && styles.segActive]}
              onPress={() => set('weightUnit', opt.value)}
            >
              <Text style={[styles.segText, values.weightUnit === opt.value && styles.segTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Gender */}
        <Text style={styles.label}>Avatar Gender</Text>
        <View style={styles.segmented}>
          {(['male', 'female'] as const).map((g) => (
            <Pressable
              key={g}
              style={[styles.seg, values.avatarGender === g && styles.segActive]}
              onPress={() => set('avatarGender', g)}
            >
              <Text style={[styles.segText, values.avatarGender === g && styles.segTextActive]}>
                {g === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Body width */}
        <Text style={styles.label}>Body Width</Text>
        <View style={styles.optionRow}>
          {WIDTH_LABELS.map((lbl, i) => (
            <Pressable
              key={i}
              style={[styles.optionBtn, values.avatarWidth === i && styles.optionBtnActive]}
              onPress={() => set('avatarWidth', i)}
            >
              <Text style={[styles.optionText, values.avatarWidth === i && styles.optionTextActive]}>
                {lbl}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Skin tone */}
        <Text style={styles.label}>Skin Tone</Text>
        <View style={styles.swatchRow}>
          {SKIN_TONES.map((colour, i) => (
            <Pressable
              key={i}
              style={[
                styles.swatch,
                { backgroundColor: colour },
                values.avatarSkinTone === i && styles.swatchActive,
              ]}
              onPress={() => set('avatarSkinTone', i)}
            />
          ))}
        </View>

        {/* Hair style */}
        <Text style={styles.label}>Hair Style</Text>
        <View style={styles.optionRow}>
          {HAIR_LABELS.map((lbl, i) => (
            <Pressable
              key={i}
              style={[styles.optionBtn, values.avatarHairStyle === i && styles.optionBtnActive]}
              onPress={() => set('avatarHairStyle', i)}
            >
              <Text style={[styles.optionText, values.avatarHairStyle === i && styles.optionTextActive]}>
                {lbl}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={() => onSave(values)}
            disabled={loading}
          >
            <Text style={styles.saveText}>{loading ? 'Saving…' : submitLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: '#F7FAFC' },
  content:  { padding: 20, paddingBottom: 48 },
  label:    { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 13, fontSize: 16,
  },
  segmented:       { flexDirection: 'row', gap: 8 },
  seg:             { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', alignItems: 'center' },
  segActive:       { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  segText:         { color: '#4A5568', fontWeight: '500' },
  segTextActive:   { color: '#fff' },
  optionRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  optionBtnActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  optionText:      { color: '#4A5568', fontWeight: '500', fontSize: 13 },
  optionTextActive:{ color: '#fff' },
  swatchRow:       { flexDirection: 'row', gap: 12 },
  swatch:          { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchActive:    { borderColor: '#4A90D9' },
  actions:         { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn:       { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
  cancelText:      { color: '#4A5568', fontWeight: '600' },
  saveBtn:         { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#4A90D9', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText:        { color: '#fff', fontWeight: '600', fontSize: 16 },
});
