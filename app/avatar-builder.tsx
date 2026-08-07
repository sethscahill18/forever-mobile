import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AvatarDisplay } from '../src/components/avatar/AvatarDisplay';
import { useAvatarDraftStore } from '../src/store/avatarDraft.store';
import { BodyType } from '../src/components/avatar/types';
import { COMPLETE_AVATARS, CANVAS_ASPECT, BODY_TYPE_SCALE } from '../src/components/avatar/avatarAssets';

const ALL_BODY_TYPES: BodyType[] = ['baby', 'child', 'teenager', 'adult'];

// Short labels so all four fit in a single row
const BODY_TYPE_SHORT: Record<BodyType, string> = {
  baby:     'Baby',
  child:    'Child',
  teenager: 'Teen',
  adult:    'Adult',
};

export default function AvatarBuilderScreen() {
  const { config, setField } = useAvatarDraftStore();
  const { gender } = useLocalSearchParams<{ gender?: string }>();

  // Filter to only avatars matching the profile's gender
  const visibleAvatars = COMPLETE_AVATARS.filter(
    (a) => !gender || a.gender === gender,
  );

  function hasAvatars(bt: BodyType) {
    return visibleAvatars.some((a) => a.bodyType === bt);
  }

  // Default active tab: the body type of the currently selected avatar,
  // or the first body type that has any avatars
  const initialTab: BodyType =
    (config.avatarId
      ? visibleAvatars.find((a) => a.id === config.avatarId)?.bodyType
      : undefined) ??
    ALL_BODY_TYPES.find(hasAvatars) ??
    'teenager';

  const [activeTab, setActiveTab] = useState<BodyType>(initialTab);

  const avatarsForTab = visibleAvatars.filter((a) => a.bodyType === activeTab);

  function selectAvatar(id: string) {
    setField('avatarId', id);
    // Keep bodyType in sync so profileFormToDb writes the correct value
    const found = visibleAvatars.find((a) => a.id === id);
    if (found) setField('bodyType', found.bodyType);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown:      true,
          title:            'Choose Avatar',
          headerBackTitle:  'Back',
          headerStyle:      { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', color: '#1A202C' },
          headerTintColor:  '#4A90D9',
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingRight: 4 }}>
              <Text style={styles.doneBtn}>Done</Text>
            </Pressable>
          ),
        }}
      />

      {/* Selected avatar preview */}
      <View style={styles.preview}>
        {config.avatarId ? (
          <AvatarDisplay config={config} size={180} />
        ) : (
          <View style={styles.previewEmpty}>
            <Ionicons name="person-outline" size={40} color="#CBD5E0" />
            <Text style={styles.previewEmptyText}>Select an avatar below</Text>
          </View>
        )}
      </View>

      {/* Body type selector — always shows all four; disables those with no avatars */}
      <View style={styles.bodyTypeRow}>
        {ALL_BODY_TYPES.map((bt) => {
          const available = hasAvatars(bt);
          const selected  = activeTab === bt;
          return (
            <Pressable
              key={bt}
              style={[
                styles.bodyTypeBtn,
                selected  && styles.bodyTypeBtnActive,
                !available && styles.bodyTypeBtnDisabled,
              ]}
              onPress={() => { if (available) setActiveTab(bt); }}
              disabled={!available}
            >
              <Text style={[
                styles.bodyTypeLabel,
                selected  && styles.bodyTypeLabelActive,
                !available && styles.bodyTypeLabelDisabled,
              ]}>
                {BODY_TYPE_SHORT[bt]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Avatar grid for the selected body type */}
      <ScrollView contentContainerStyle={styles.grid}>
        {avatarsForTab.length === 0 ? (
          <Text style={styles.emptyText}>No avatars yet for this age group.</Text>
        ) : (
          avatarsForTab.map((avatar) => {
            const selected    = config.avatarId === avatar.id;
            // All cells share the same container height; image is scaled + bottom-aligned
            // so characters of different ages appear to stand on a common floor.
            const CELL_H      = 220;
            const thumbH      = Math.round(CELL_H * (BODY_TYPE_SCALE[avatar.bodyType] ?? 1));
            const thumbW      = Math.round(thumbH * CANVAS_ASPECT);
            return (
              <Pressable
                key={avatar.id}
                style={[styles.gridItem, selected && styles.gridItemSelected]}
                onPress={() => selectAvatar(avatar.id)}
              >
                <View style={{ height: CELL_H, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Image
                    source={avatar.source}
                    style={{ width: thumbW, height: thumbH }}
                    resizeMode="contain"
                  />
                </View>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={30} color="#4A90D9" />
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  doneBtn:   { color: '#4A90D9', fontWeight: '700', fontSize: 16 },

  preview: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   24,
    backgroundColor:   '#EDF2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight:         220,
  },
  previewEmpty:     { alignItems: 'center', gap: 8 },
  previewEmptyText: { fontSize: 14, color: '#A0AEC0' },

  // Body type selector
  bodyTypeRow: {
    flexDirection:     'row',
    gap:               8,
    padding:           12,
    backgroundColor:   '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  bodyTypeBtn: {
    flex:            1,
    paddingVertical: 9,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     '#E2E8F0',
    backgroundColor: '#F7FAFC',
    alignItems:      'center',
  },
  bodyTypeBtnActive:   { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  bodyTypeBtnDisabled: { opacity: 0.35 },
  bodyTypeLabel:        { fontSize: 13, fontWeight: '600', color: '#4A5568' },
  bodyTypeLabelActive:  { color: '#fff' },
  bodyTypeLabelDisabled:{ color: '#A0AEC0' },

  // Avatar grid
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    padding:        16,
    gap:            12,
    justifyContent: 'center',
  },
  gridItem: {
    position:        'relative',
    backgroundColor: '#fff',
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     '#E2E8F0',
    padding:         12,
    alignItems:      'center',
    justifyContent:  'flex-end',
  },
  gridItemSelected: { borderColor: '#4A90D9', backgroundColor: '#EBF4FF' },
  checkBadge: {
    position:        'absolute',
    top:             8,
    right:           8,
    backgroundColor: '#fff',
    borderRadius:    15,
  },

  emptyText: { color: '#A0AEC0', fontSize: 14, paddingTop: 32, textAlign: 'center', width: '100%' },
});
