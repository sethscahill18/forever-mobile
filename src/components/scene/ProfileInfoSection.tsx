import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Profile } from '../../db/schema';
import { buildAvatarConfig } from '../avatar/types';
import { AvatarDisplay } from '../avatar/AvatarDisplay';

interface Props {
  profile: Profile;
}

const ICON_SIZE = 68;

export function ProfileInfoSection({ profile }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const avatarConfig = buildAvatarConfig(profile);

  // Mirror RulerSection's TICK_X so the icon centre aligns with the spine.
  const rulerPaneW = screenWidth / 3;
  const TICK_X     = Math.round(rulerPaneW * 0.48);
  const iconLeft   = TICK_X - ICON_SIZE / 2;

  return (
    <View style={styles.root}>
      {/* Icon: centre aligned with ruler spine */}
      <View style={[styles.iconFrame, { left: iconLeft }]}>
        <AvatarDisplay config={avatarConfig} size={ICON_SIZE} compact />
      </View>
      {/* Name: starts to the right of the icon */}
      <Text style={[styles.name, { left: TICK_X + ICON_SIZE / 2 + 10 }]} numberOfLines={2}>
        {profile.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  iconFrame: {
    position:     'absolute',
    top:          '50%',
    marginTop:    -(ICON_SIZE / 2),
    width:        ICON_SIZE,
    height:       ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth:  6,
    borderColor:  '#8B6914',
    overflow:     'hidden',
  },
  name: {
    position:   'absolute',
    top:        0,
    bottom:     0,
    right:      8,
    fontSize:   18,
    fontWeight: '700',
    color:      '#2D1B0E',
    textAlignVertical: 'center',
  },
});
