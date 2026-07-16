import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Profile } from '../../db/schema';

export type ProfileFormValues = {
  name:        string;
  theme:       'red' | 'blue' | 'green';
  doorStyle:   'style_1' | 'style_2' | 'style_3';
  doorColour:  'black' | 'brown' | 'red';
  handleStyle: 'handle_style_1' | 'handle_style_2' | 'handle_style_3';
  shelfItems:  'rocket_1' | 'flower_pot' | 'book';
};

function defaults(profile?: Profile): ProfileFormValues {
  return {
    name:        profile?.name        ?? '',
    theme:       (profile?.theme       as ProfileFormValues['theme'])       ?? 'red',
    doorStyle:   (profile?.doorStyle   as ProfileFormValues['doorStyle'])   ?? 'style_1',
    doorColour:  (profile?.doorColour  as ProfileFormValues['doorColour'])  ?? 'black',
    handleStyle: (profile?.handleStyle as ProfileFormValues['handleStyle']) ?? 'handle_style_1',
    shelfItems:  (profile?.shelfItems  as ProfileFormValues['shelfItems'])  ?? 'rocket_1',
  };
}

type Props = {
  initial?:    Profile;
  onSave:      (values: ProfileFormValues) => void;
  onCancel:    () => void;
  submitLabel: string;
  loading:     boolean;
};

const THEME_OPTIONS: { value: ProfileFormValues['theme']; label: string }[] = [
  { value: 'red',   label: 'Red'   },
  { value: 'blue',  label: 'Blue'  },
  { value: 'green', label: 'Green' },
];

const DOOR_STYLE_OPTIONS: { value: ProfileFormValues['doorStyle']; label: string }[] = [
  { value: 'style_1', label: 'Style 1' },
  { value: 'style_2', label: 'Style 2' },
  { value: 'style_3', label: 'Style 3' },
];

const DOOR_COLOUR_OPTIONS: { value: ProfileFormValues['doorColour']; label: string }[] = [
  { value: 'black', label: 'Black' },
  { value: 'brown', label: 'Brown' },
  { value: 'red',   label: 'Red'   },
];

const HANDLE_STYLE_OPTIONS: { value: ProfileFormValues['handleStyle']; label: string }[] = [
  { value: 'handle_style_1', label: 'Handle 1' },
  { value: 'handle_style_2', label: 'Handle 2' },
  { value: 'handle_style_3', label: 'Handle 3' },
];

const SHELF_ITEMS_OPTIONS: { value: ProfileFormValues['shelfItems']; label: string }[] = [
  { value: 'rocket_1',   label: 'Rocket'     },
  { value: 'flower_pot', label: 'Flower Pot' },
  { value: 'book',       label: 'Book'       },
];

function OptionRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.optionBtn, value === opt.value && styles.optionBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, value === opt.value && styles.optionTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

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
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mum, Dad, Jake"
          value={values.name}
          onChangeText={(v) => set('name', v)}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Theme</Text>
        <OptionRow value={values.theme} options={THEME_OPTIONS} onChange={(v) => set('theme', v)} />

        <Text style={styles.label}>Door Style</Text>
        <OptionRow value={values.doorStyle} options={DOOR_STYLE_OPTIONS} onChange={(v) => set('doorStyle', v)} />

        <Text style={styles.label}>Door Colour</Text>
        <OptionRow value={values.doorColour} options={DOOR_COLOUR_OPTIONS} onChange={(v) => set('doorColour', v)} />

        <Text style={styles.label}>Handle Style</Text>
        <OptionRow value={values.handleStyle} options={HANDLE_STYLE_OPTIONS} onChange={(v) => set('handleStyle', v)} />

        <Text style={styles.label}>Shelf Items</Text>
        <OptionRow value={values.shelfItems} options={SHELF_ITEMS_OPTIONS} onChange={(v) => set('shelfItems', v)} />

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
  scroll:           { flex: 1, backgroundColor: '#F7FAFC' },
  content:          { padding: 20, paddingBottom: 48 },
  label:            { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 8, marginTop: 16 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 13, fontSize: 16 },
  optionRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  optionBtnActive:  { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  optionText:       { color: '#4A5568', fontWeight: '500', fontSize: 13 },
  optionTextActive: { color: '#fff' },
  actions:          { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn:        { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
  cancelText:       { color: '#4A5568', fontWeight: '600' },
  saveBtn:          { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#4A90D9', alignItems: 'center' },
  saveBtnDisabled:  { opacity: 0.6 },
  saveText:         { color: '#fff', fontWeight: '600', fontSize: 16 },
});
