import { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ExpoCrypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Profile, NewProfile } from '../../db/schema';
import { AvatarConfig, AVATAR_DEFAULTS, buildAvatarConfig } from '../avatar/types';
import { AvatarDisplay } from '../avatar/AvatarDisplay';
import { useAvatarDraftStore } from '../../store/avatarDraft.store';
import { COMPLETE_AVATARS } from '../avatar/avatarAssets';

export type ProfileFormValues = {
  name:          string;
  gender:        'male' | 'female';
  avatarConfig:  AvatarConfig;
  theme:         'red' | 'blue' | 'green';
  doorStyle:     'style_1' | 'style_2' | 'style_3';
  doorColour:    'black' | 'brown' | 'red';
  handleStyle:   'handle_style_1' | 'handle_style_2' | 'handle_style_3';
  shelfItems:    'rocket_1' | 'flower_pot' | 'book';
  profileImage:  string | null;
};

/** Converts form values to the flat shape expected by createProfile / updateProfile. */
export function profileFormToDb(v: ProfileFormValues): Omit<NewProfile, 'id' | 'userId' | 'createdAt' | 'heightUnit'> {
  return {
    name:                v.name,
    gender:              v.gender,
    avatar:              v.avatarConfig.bodyType,
    avatarId:            v.avatarConfig.avatarId ?? null,
    avatarSkinTone:      v.avatarConfig.skinTone,
    avatarHairStyle:     v.avatarConfig.hairStyle,
    avatarHairColour:    v.avatarConfig.hairColour,
    avatarClothingStyle: v.avatarConfig.clothingStyle,
    avatarClothingColour: v.avatarConfig.clothingColour,
    theme:               v.theme,
    doorStyle:           v.doorStyle,
    doorColour:          v.doorColour,
    handleStyle:         v.handleStyle,
    shelfItems:          v.shelfItems,
    profileImage:        v.profileImage,
  };
}

function defaults(profile?: Profile): ProfileFormValues {
  return {
    name:         profile?.name ?? '',
    gender:       (profile?.gender as 'male' | 'female') ?? 'male',
    avatarConfig: profile ? buildAvatarConfig(profile) : { ...AVATAR_DEFAULTS },
    theme:        (profile?.theme       as ProfileFormValues['theme'])       ?? 'red',
    doorStyle:    (profile?.doorStyle   as ProfileFormValues['doorStyle'])   ?? 'style_1',
    doorColour:   (profile?.doorColour  as ProfileFormValues['doorColour'])  ?? 'black',
    handleStyle:  (profile?.handleStyle as ProfileFormValues['handleStyle']) ?? 'handle_style_1',
    shelfItems:   (profile?.shelfItems  as ProfileFormValues['shelfItems'])  ?? 'rocket_1',
    profileImage: profile?.profileImage ?? null,
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
  value, options, onChange,
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
  const hasVisitedBuilder = useRef(false);

  function set<K extends keyof ProfileFormValues>(key: K, val: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  // When the user returns from the avatar builder, sync the draft store config back
  useFocusEffect(
    useCallback(() => {
      if (hasVisitedBuilder.current) {
        hasVisitedBuilder.current = false;
        set('avatarConfig', useAvatarDraftStore.getState().config);
      }
    }, []),
  );

  function handleGenderChange(g: 'male' | 'female') {
    set('gender', g);
    // If the currently selected avatar is the wrong gender, clear it
    const currentId = values.avatarConfig.avatarId;
    if (currentId) {
      const found = COMPLETE_AVATARS.find((a) => a.id === currentId);
      if (found && found.gender !== g) {
        set('avatarConfig', { ...values.avatarConfig, avatarId: null });
      }
    }
  }

  function handleOpenAvatarBuilder() {
    hasVisitedBuilder.current = true;
    useAvatarDraftStore.getState().reset(values.avatarConfig);
    router.push({ pathname: '/avatar-builder', params: { gender: values.gender } });
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri  = result.assets[0].uri;
    const dir  = FileSystem.documentDirectory + 'profiles/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext  = uri.split('.').pop() ?? 'jpg';
    const dest = dir + ExpoCrypto.randomUUID() + '.' + ext;
    await FileSystem.copyAsync({ from: uri, to: dest });
    set('profileImage', dest);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── Name ─────────────────────────────────────────────────────── */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mum, Dad, Jake"
          value={values.name}
          onChangeText={(v) => set('name', v)}
          autoCapitalize="words"
        />

        {/* ── Gender ───────────────────────────────────────────────────── */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {(['male', 'female'] as const).map((g) => (
            <Pressable
              key={g}
              style={[styles.genderBtn, values.gender === g && styles.genderBtnActive]}
              onPress={() => handleGenderChange(g)}
            >
              <Text style={[styles.genderText, values.gender === g && styles.genderTextActive]}>
                {g === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Create Avatar card ───────────────────────────────────────── */}
        <Text style={styles.label}>Avatar</Text>
        <Pressable style={styles.avatarCard} onPress={handleOpenAvatarBuilder}>
          <View style={styles.avatarPreviewCircle}>
            <AvatarDisplay config={values.avatarConfig} size={56} compact />
          </View>
          <View style={styles.avatarCardText}>
            <Text style={styles.avatarCardTitle}>Customise Avatar</Text>
            <Text style={styles.avatarCardSub}>Tap to change look</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
        </Pressable>

        {/* ── Room settings ────────────────────────────────────────────── */}
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

        {/* ── Profile photo (bottom) ───────────────────────────────────── */}
        <Text style={styles.label}>Profile Photo</Text>
        <View style={styles.photoSection}>
          <Pressable style={styles.photoRing} onPress={handlePickImage}>
            {values.profileImage ? (
              <Image source={{ uri: values.profileImage }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={32} color="#A0AEC0" />
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.photoMeta}>
            <Text style={styles.photoHint}>
              {values.profileImage ? 'Tap to change photo' : 'Add a profile photo (optional)'}
            </Text>
            {values.profileImage && (
              <Pressable onPress={() => set('profileImage', null)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Actions ──────────────────────────────────────────────────── */}
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

  label: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 13, fontSize: 16 },

  // Gender picker
  genderRow:        { flexDirection: 'row', gap: 10 },
  genderBtn:        { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', alignItems: 'center' },
  genderBtnActive:  { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  genderText:       { fontSize: 15, fontWeight: '600', color: '#4A5568' },
  genderTextActive: { color: '#fff' },

  // Avatar card
  avatarCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#fff',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     '#E2E8F0',
    padding:         12,
    gap:             12,
  },
  avatarPreviewCircle: {
    width: 56, height: 56, borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#EDF2F7',
  },
  avatarCardText:  { flex: 1 },
  avatarCardTitle: { fontSize: 15, fontWeight: '600', color: '#1A202C' },
  avatarCardSub:   { fontSize: 12, color: '#718096', marginTop: 2 },

  // Option rows
  optionRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionBtn:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  optionBtnActive:  { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  optionText:       { color: '#4A5568', fontWeight: '500', fontSize: 13 },
  optionTextActive: { color: '#fff' },

  // Profile photo
  photoSection:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoRing:        { position: 'relative', width: 80, height: 80 },
  photoImage:       { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EDF2F7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#4A90D9',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F7FAFC',
  },
  photoMeta:  { flex: 1 },
  photoHint:  { fontSize: 13, color: '#718096' },
  removeBtn:  { marginTop: 6 },
  removeText: { fontSize: 13, color: '#FC8181', fontWeight: '500' },

  actions:         { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn:       { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#fff' },
  cancelText:      { color: '#4A5568', fontWeight: '600' },
  saveBtn:         { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#4A90D9', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText:        { color: '#fff', fontWeight: '600', fontSize: 16 },
});
