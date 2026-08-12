import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Profile } from '../../db/schema';
import { buildAvatarConfig } from '../avatar/types';
import { AvatarDisplay } from '../avatar/AvatarDisplay';

interface Props {
  profile: Profile;
}

const FRAME_SIZE = 100;
const CLIP_SIZE  = 60;  // inner avatar circle

export function ProfileInfoSection({ profile }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const avatarConfig = buildAvatarConfig(profile);

  const rulerPaneW = screenWidth / 3;
  const TICK_X     = Math.round(rulerPaneW * 0.48);
  const frameLeft  = TICK_X - FRAME_SIZE / 2;

  return (
    <View style={styles.root}>
      {/* Liquid Glass frame */}
      <BlurView intensity={70} tint="light" style={[styles.glassFrame, { left: frameLeft }]}>
        <View style={styles.specular} />
        {/* Avatar clipped to circle */}
        <View style={styles.avatarClip}>
          <AvatarDisplay config={avatarConfig} size={CLIP_SIZE} compact />
        </View>
      </BlurView>

      {/* Name + age: vertically centred on icon */}
      <View style={{ position: 'absolute', left: frameLeft + FRAME_SIZE + 12, top: '70%', marginTop: -(FRAME_SIZE / 2), height: FRAME_SIZE, justifyContent: 'center' }}>
        <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
        <Text style={{ fontSize: 16, color: '#374151', marginTop: 2 }}>12 years, 3 months</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glassFrame: {
    position:        'absolute',
    top:             '70%',
    marginTop:       -(FRAME_SIZE / 2),
    width:           FRAME_SIZE,
    height:          FRAME_SIZE,
    borderRadius:    FRAME_SIZE / 2,
    overflow:        'hidden',
    borderWidth:     0.5,
    borderColor:     'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '50%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  avatarClip: {
    width:           CLIP_SIZE,
    height:          CLIP_SIZE,
    borderRadius:    CLIP_SIZE / 2,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  },
  name: {
    fontSize:   36,
    fontWeight: '700',
    color:      '#2D1B0E',
  },
});
