import { View, Text, Image } from 'react-native';
import { Profile } from '../../db/schema';
import { PROFILE_ICONS } from '../avatar/avatarAssets';
import { resolveDocUri } from '../../utils/imageStorage';

/** Round profile picture → avatar icon → coloured initial, in that order. */
export function ProfileAvatar({ profile, color, size }: { profile: Profile; color: string; size: number }) {
  const src = profile.profileImage
    ? { uri: resolveDocUri(profile.profileImage)! }
    : profile.avatarId && PROFILE_ICONS[profile.avatarId]
      ? PROFILE_ICONS[profile.avatarId]
      : null;
  if (src) {
    return <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
        {profile.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
