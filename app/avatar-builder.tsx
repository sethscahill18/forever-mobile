import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AvatarDisplay } from '../src/components/avatar/AvatarDisplay';
import { useAvatarDraftStore } from '../src/store/avatarDraft.store';
import { BodyType } from '../src/components/avatar/types';
import { COMPLETE_AVATARS, CANVAS_ASPECT, BODY_TYPE_SCALE } from '../src/components/avatar/avatarAssets';
import { useAppTheme } from '../src/store/appTheme.store';
import { ThemeColors } from '../src/theme/tokens';

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
          headerStyle:      { backgroundColor: colors.surface },
          headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
          headerTintColor:  colors.primary,
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
            <Ionicons name="person-outline" size={40} color={colors.borderStrong} />
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
                    <Ionicons name="checkmark-circle" size={30} color={colors.primary} />
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    doneBtn:   { color: colors.primary, fontWeight: '700', fontSize: 16 },

    preview: {
      alignItems:        'center',
      justifyContent:    'center',
      paddingVertical:   24,
      backgroundColor:   colors.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight:         220,
    },
    previewEmpty:     { alignItems: 'center', gap: 8 },
    previewEmptyText: { fontSize: 14, color: colors.textFaint },

    // Body type selector
    bodyTypeRow: {
      flexDirection:     'row',
      gap:               8,
      padding:           12,
      backgroundColor:   colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bodyTypeBtn: {
      flex:            1,
      paddingVertical: 9,
      borderRadius:    10,
      borderWidth:     1,
      borderColor:     colors.border,
      backgroundColor: colors.background,
      alignItems:      'center',
    },
    bodyTypeBtnActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
    bodyTypeBtnDisabled: { opacity: 0.35 },
    bodyTypeLabel:        { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    bodyTypeLabelActive:  { color: colors.onPrimary },
    bodyTypeLabelDisabled:{ color: colors.textFaint },

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
      backgroundColor: colors.surface,
      borderRadius:    16,
      borderWidth:     2,
      borderColor:     colors.border,
      padding:         12,
      alignItems:      'center',
      justifyContent:  'flex-end',
    },
    gridItemSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    checkBadge: {
      position:        'absolute',
      top:             8,
      right:           8,
      backgroundColor: colors.surface,
      borderRadius:    15,
    },

    emptyText: { color: colors.textFaint, fontSize: 14, paddingTop: 32, textAlign: 'center', width: '100%' },
  });
}
