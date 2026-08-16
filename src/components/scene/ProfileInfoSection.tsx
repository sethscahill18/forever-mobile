import { View, Text, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFonts, Delius_400Regular } from '@expo-google-fonts/delius';
import { Nunito_400Regular } from '@expo-google-fonts/nunito';
import { Profile } from '../../db/schema';

interface Props {
  profile: Profile;
}

const FRAME_SIZE = 69;
const CLIP_SIZE  = 52;  // inner avatar circle

export function ProfileInfoSection({ profile }: Props) {
  const [fontsLoaded] = useFonts({ Delius_400Regular, Nunito_400Regular });

  return (
    <View style={styles.root}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Liquid Glass frame */}
        <BlurView intensity={70} tint="light" style={styles.glassFrame}>
          <View style={styles.specular} />
          <View style={styles.avatarClip}>
            <Image
              source={require('../../../assets/avatar/complete/profile_icons/male_teen_blue_profile_pic.png')}
              style={{ width: CLIP_SIZE, height: CLIP_SIZE }}
              resizeMode="cover"
            />
          </View>
        </BlurView>
        <View style={{ marginLeft: 12, justifyContent: 'center' }}>
          <Text
            style={[styles.name, fontsLoaded ? { fontFamily: 'Delius_400Regular' } : null]}
            numberOfLines={1}
          >
            {profile.name}
          </Text>
          <Text style={{ fontSize: 13, color: '#374151', marginTop: 1, fontFamily: fontsLoaded ? 'Nunito_400Regular' : undefined }}>12 years, 3 months</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'flex-start',
    paddingTop:      50,
  },
  glassFrame: {
    width:           FRAME_SIZE,
    height:          FRAME_SIZE,
    borderRadius:    FRAME_SIZE / 2,
    overflow:        'hidden',
    borderWidth:     0.5,
    borderColor:     'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       10,
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
    fontSize:   24,
    color:      '#2D1B0E',
  },
});
