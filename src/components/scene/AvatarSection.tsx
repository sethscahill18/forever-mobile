import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Profile } from '../../db/schema';
import { buildAvatarConfig } from '../avatar/types';
import { COMPLETE_AVATARS, CANVAS_ASPECT } from '../avatar/avatarAssets';

interface Props {
  profile: Profile;
}

export function AvatarSection({ profile }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const config = buildAvatarConfig(profile);
  const found  = config.avatarId
    ? COMPLETE_AVATARS.find((a) => a.id === config.avatarId)
    : null;

  if (!found) return null;

  const SCENE_SCALE: Record<string, number> = {
    baby:     1.00,
    child:    1.50,
    teenager: 1.84,
    adult:    2.00,
  };

  const sectionWidth = screenWidth / 3;
  const scale        = SCENE_SCALE[found.bodyType] ?? 1;
  const imgW         = sectionWidth * scale;
  const imgH         = imgW / CANVAS_ASPECT;

  return (
    <View style={styles.container}>
      <Image
        source={found.source}
        style={{ width: imgW, height: imgH }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
});
