import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Profile } from '../../db/schema';
import { CANVAS_ASPECT } from '../avatar/avatarAssets';

interface Props {
  profile: Profile;
}

export function AvatarSection({ profile: _profile }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const sectionWidth = screenWidth / 3;
  const imageH       = sectionWidth / CANVAS_ASPECT;

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/avatar/complete/male_baby_blue.png')}
        style={{ width: sectionWidth, height: imageH }}
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
