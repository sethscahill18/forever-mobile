import { Profile } from '../../db/schema';

export type BodyType = 'baby' | 'child' | 'teenager' | 'adult';

export interface AvatarConfig {
  /** When set, a complete pre-rendered PNG is shown instead of the SVG system. */
  avatarId?:      string | null;
  bodyType:       BodyType;
  skinTone:       string;
  hairStyle:      string;
  hairColour:     string;
  clothingStyle:  string;
  clothingColour: string;
}

export const AVATAR_DEFAULTS: AvatarConfig = {
  avatarId:       null,
  bodyType:       'child',
  skinTone:       '#F5CBA7',
  hairStyle:      'short_straight',
  hairColour:     '#4A2C0A',
  clothingStyle:  'tshirt',
  clothingColour: '#4A90D9',
};

export const SKIN_TONES = ['#FDDBB4', '#F5CBA7', '#E59866', '#CA6F1E', '#935116', '#4A2512'];

export const HAIR_COLOURS = [
  '#1A1A1A', '#4A2C0A', '#8B4513', '#C0542A',
  '#D4AC0D', '#F5E642', '#C0392B', '#808080',
];

export const CLOTHING_COLOURS = [
  '#4A90D9', '#E74C3C', '#27AE60', '#F39C12',
  '#9B59B6', '#E67E22', '#E91E63', '#2C3E50',
];

export const HAIR_STYLES = ['buzz', 'short_straight', 'short_wavy', 'long_straight', 'curly', 'ponytail'] as const;
export const CLOTHING_STYLES = ['tshirt', 'hoodie', 'dress', 'shirt'] as const;
export const BODY_TYPES: BodyType[] = ['baby', 'child', 'teenager', 'adult'];

export const HAIR_STYLE_LABELS: Record<string, string> = {
  buzz:           'Buzz',
  short_straight: 'Short',
  short_wavy:     'Wavy',
  long_straight:  'Long',
  curly:          'Curly',
  ponytail:       'Ponytail',
};

export const CLOTHING_STYLE_LABELS: Record<string, string> = {
  tshirt:  'T-Shirt',
  hoodie:  'Hoodie',
  dress:   'Dress',
  shirt:   'Shirt',
};

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  baby:     'Baby',
  child:    'Child',
  teenager: 'Teenager',
  adult:    'Adult',
};

export function buildAvatarConfig(profile: Pick<
  Profile,
  'avatar' | 'avatarSkinTone' | 'avatarHairStyle' | 'avatarHairColour' |
  'avatarClothingStyle' | 'avatarClothingColour' | 'avatarId'
>): AvatarConfig {
  return {
    avatarId:       profile.avatarId ?? null,
    bodyType:       (profile.avatar as BodyType) ?? AVATAR_DEFAULTS.bodyType,
    skinTone:       profile.avatarSkinTone    ?? AVATAR_DEFAULTS.skinTone,
    hairStyle:      profile.avatarHairStyle   ?? AVATAR_DEFAULTS.hairStyle,
    hairColour:     profile.avatarHairColour  ?? AVATAR_DEFAULTS.hairColour,
    clothingStyle:  profile.avatarClothingStyle  ?? AVATAR_DEFAULTS.clothingStyle,
    clothingColour: profile.avatarClothingColour ?? AVATAR_DEFAULTS.clothingColour,
  };
}
