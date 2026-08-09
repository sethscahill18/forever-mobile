import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Profile } from '../../db/schema';
import { buildAvatarConfig } from '../avatar/types';
import { COMPLETE_AVATARS, CANVAS_ASPECT } from '../avatar/avatarAssets';

interface Props {
  profile:         Profile;
  latestHeightCm?: number;
}

// At scale=1 the avatar visually reaches this many cm on the ruler spine.
const SCALE_REF_CM = 87;

export function AvatarSection({ profile, latestHeightCm }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const config = buildAvatarConfig(profile);
  const found  = config.avatarId
    ? COMPLETE_AVATARS.find((a) => a.id === config.avatarId)
    : null;

  if (!found) return null;

  const sectionWidth = screenWidth / 3;
  const scale        = latestHeightCm && latestHeightCm > 0
    ? latestHeightCm / SCALE_REF_CM
    : 1;
  const imgW = sectionWidth * scale;
  const imgH = imgW / CANVAS_ASPECT;

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
