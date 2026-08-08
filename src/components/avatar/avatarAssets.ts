import { ImageSourcePropType } from 'react-native';
import { BodyType } from './types';

// ── Complete pre-rendered avatar PNGs ─────────────────────────────────────────
// Each entry is a full-body PNG (body + hair + clothing in one image).
// Add new entries here as PNGs are created; the picker shows them automatically.

// Filename convention: {gender}_{bodyType}_{topColour}.png
// gender:    'male' | 'female'
// bodyType:  'baby' | 'child' | 'teen' | 'adult'   (note: 'teen' in filenames, 'teenager' in code)
// topColour: 'blue' | 'red'

export type CompleteAvatar = {
  id:       string;      // filename stem, e.g. 'male_teen_blue'
  bodyType: BodyType;    // app body type — groups avatars into picker tabs
  gender:   'male' | 'female';
  source:   ImageSourcePropType;
};

export const COMPLETE_AVATARS: CompleteAvatar[] = [
  // ── Baby ─────────────────────────────────────────────────────────────────
  { id: 'male_baby_blue',   bodyType: 'baby',     gender: 'male',   source: require('../../../assets/avatar/complete/male_baby_blue.png') },
  { id: 'male_baby_red',    bodyType: 'baby',     gender: 'male',   source: require('../../../assets/avatar/complete/male_baby_red.png') },
  // ── Child ────────────────────────────────────────────────────────────────
  { id: 'male_child_blue',  bodyType: 'child',    gender: 'male',   source: require('../../../assets/avatar/complete/male_child_blue.png') },
  { id: 'male_child_red',   bodyType: 'child',    gender: 'male',   source: require('../../../assets/avatar/complete/male_child_red.png') },
  // ── Teenager ─────────────────────────────────────────────────────────────
  { id: 'male_teen_blue',   bodyType: 'teenager', gender: 'male',   source: require('../../../assets/avatar/complete/male_teen_blue.png') },
  { id: 'male_teen_red',    bodyType: 'teenager', gender: 'male',   source: require('../../../assets/avatar/complete/male_teen_red.png') },
  { id: 'female_teen_blue', bodyType: 'teenager', gender: 'female', source: require('../../../assets/avatar/complete/female_teen_blue.png') },
  { id: 'female_teen_red',  bodyType: 'teenager', gender: 'female', source: require('../../../assets/avatar/complete/female_teen_red.png') },
];

// ── Hex colour → PNG asset key mappings ──────────────────────────────────────
// The avatar builder stores hex strings; PNG files are named with descriptive keys.
// Two similar hex values may map to the same key (they share a PNG file).

export const SKIN_TONE_KEYS: Record<string, string> = {
  '#FDDBB4': 'light',
  '#F5CBA7': 'light',
  '#E59866': 'medium',
  '#CA6F1E': 'medium',
  '#935116': 'dark',
  '#4A2512': 'dark',
};

export const HAIR_COLOUR_KEYS: Record<string, string> = {
  '#1A1A1A': 'black',
  '#4A2C0A': 'brown',
  '#8B4513': 'brown',
  '#C0542A': 'auburn',
  '#D4AC0D': 'blonde',
  '#F5E642': 'blonde',
  '#C0392B': 'red',
  '#808080': 'grey',
};

export const CLOTHING_COLOUR_KEYS: Record<string, string> = {
  '#4A90D9': 'blue',
  '#E74C3C': 'red',
  '#27AE60': 'green',
  '#F39C12': 'yellow',
  '#9B59B6': 'purple',
  '#E67E22': 'orange',
  '#E91E63': 'pink',
  '#2C3E50': 'navy',
};

export function skinToneKey(hex: string): string {
  return SKIN_TONE_KEYS[hex] ?? 'medium';
}

export function hairColourKey(hex: string): string {
  return HAIR_COLOUR_KEYS[hex] ?? 'brown';
}

export function clothingColourKey(hex: string): string {
  return CLOTHING_COLOUR_KEYS[hex] ?? 'blue';
}

// ── Body-type scale factors ───────────────────────────────────────────────────
// Applied to the `size` prop in full-body (non-compact) display so characters
// appear at realistic relative heights. Compact/circular thumbnails are unaffected
// — the face always fills the circle regardless of age.
export const BODY_TYPE_SCALE: Record<BodyType, number> = {
  baby:     0.55,   // ~55 % of adult — visibly smaller without being tiny
  child:    0.75,
  teenager: 0.92,
  adult:    1.00,
};

// ── Canvas constants ──────────────────────────────────────────────────────────
// Every PNG layer must be exactly 400 × 700 px with transparent background.
// See AVATAR_PNG_BRIEF.md for the full specification.
export const CANVAS_WIDTH  = 400;
export const CANVAS_HEIGHT = 700;
export const CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT; // ≈ 0.571

// Head centre sits approximately 16% from the top of the canvas.
// This constant drives the compact-mode vertical crop so the face is centred
// in the circular thumbnail regardless of the container size.
export const HEAD_CENTER_FRACTION = 0.16;

// ── Asset manifest ────────────────────────────────────────────────────────────
// Workflow: create the PNG → place it in assets/avatar/ → uncomment its line here.
// Do NOT uncomment a line until the file exists — Metro will fail to bundle if the
// referenced path does not exist on disk.
//
// Key format:
//   body      →  '{bodyType}_{skinTone}'      e.g. 'teenager_medium'
//   hair      →  '{hairStyle}_{hairColour}'   e.g. 'short_straight_brown'
//   clothing  →  '{clothingStyle}_{colour}'   e.g. 'tshirt_navy'

export const BODY_LAYERS: Record<string, ImageSourcePropType> = {
  // ── assets/avatar/body/{bodyType}_{skinTone}.png ─────────────────────────
  // Recommended first: teenager_medium (matches designer's reference image)
  //
  // 'baby_light':      require('../../../assets/avatar/body/baby_light.png'),
  // 'baby_medium':     require('../../../assets/avatar/body/baby_medium.png'),
  // 'baby_dark':       require('../../../assets/avatar/body/baby_dark.png'),
  // 'child_light':     require('../../../assets/avatar/body/child_light.png'),
  // 'child_medium':    require('../../../assets/avatar/body/child_medium.png'),
  // 'child_dark':      require('../../../assets/avatar/body/child_dark.png'),
  // 'teenager_light':  require('../../../assets/avatar/body/teenager_light.png'),
  // 'teenager_medium': require('../../../assets/avatar/body/teenager_medium.png'),
  // 'teenager_dark':   require('../../../assets/avatar/body/teenager_dark.png'),
  // 'adult_light':     require('../../../assets/avatar/body/adult_light.png'),
  // 'adult_medium':    require('../../../assets/avatar/body/adult_medium.png'),
  // 'adult_dark':      require('../../../assets/avatar/body/adult_dark.png'),
};

export const HAIR_LAYERS: Record<string, ImageSourcePropType> = {
  // ── assets/avatar/hair/{hairStyle}_{hairColour}.png ──────────────────────
  // Recommended first: short_straight_brown (matches designer's reference image)
  //
  // 'buzz_black':            require('../../../assets/avatar/hair/buzz_black.png'),
  // 'buzz_brown':            require('../../../assets/avatar/hair/buzz_brown.png'),
  // 'buzz_auburn':           require('../../../assets/avatar/hair/buzz_auburn.png'),
  // 'buzz_blonde':           require('../../../assets/avatar/hair/buzz_blonde.png'),
  // 'buzz_red':              require('../../../assets/avatar/hair/buzz_red.png'),
  // 'buzz_grey':             require('../../../assets/avatar/hair/buzz_grey.png'),
  // 'short_straight_black':  require('../../../assets/avatar/hair/short_straight_black.png'),
  // 'short_straight_brown':  require('../../../assets/avatar/hair/short_straight_brown.png'),
  // 'short_straight_auburn': require('../../../assets/avatar/hair/short_straight_auburn.png'),
  // 'short_straight_blonde': require('../../../assets/avatar/hair/short_straight_blonde.png'),
  // 'short_straight_red':    require('../../../assets/avatar/hair/short_straight_red.png'),
  // 'short_straight_grey':   require('../../../assets/avatar/hair/short_straight_grey.png'),
  // 'short_wavy_black':      require('../../../assets/avatar/hair/short_wavy_black.png'),
  // 'short_wavy_brown':      require('../../../assets/avatar/hair/short_wavy_brown.png'),
  // 'short_wavy_auburn':     require('../../../assets/avatar/hair/short_wavy_auburn.png'),
  // 'short_wavy_blonde':     require('../../../assets/avatar/hair/short_wavy_blonde.png'),
  // 'long_straight_black':   require('../../../assets/avatar/hair/long_straight_black.png'),
  // 'long_straight_brown':   require('../../../assets/avatar/hair/long_straight_brown.png'),
  // 'long_straight_auburn':  require('../../../assets/avatar/hair/long_straight_auburn.png'),
  // 'long_straight_blonde':  require('../../../assets/avatar/hair/long_straight_blonde.png'),
  // 'long_straight_red':     require('../../../assets/avatar/hair/long_straight_red.png'),
  // 'curly_black':           require('../../../assets/avatar/hair/curly_black.png'),
  // 'curly_brown':           require('../../../assets/avatar/hair/curly_brown.png'),
  // 'curly_auburn':          require('../../../assets/avatar/hair/curly_auburn.png'),
  // 'curly_blonde':          require('../../../assets/avatar/hair/curly_blonde.png'),
  // 'ponytail_black':        require('../../../assets/avatar/hair/ponytail_black.png'),
  // 'ponytail_brown':        require('../../../assets/avatar/hair/ponytail_brown.png'),
  // 'ponytail_auburn':       require('../../../assets/avatar/hair/ponytail_auburn.png'),
  // 'ponytail_blonde':       require('../../../assets/avatar/hair/ponytail_blonde.png'),
  // 'ponytail_red':          require('../../../assets/avatar/hair/ponytail_red.png'),
};

export const CLOTHING_LAYERS: Record<string, ImageSourcePropType> = {
  // ── assets/avatar/clothing/{clothingStyle}_{colour}.png ──────────────────
  // Recommended first: tshirt_navy (matches designer's reference image)
  //
  // 'tshirt_navy':   require('../../../assets/avatar/clothing/tshirt_navy.png'),
  // 'tshirt_blue':   require('../../../assets/avatar/clothing/tshirt_blue.png'),
  // 'tshirt_red':    require('../../../assets/avatar/clothing/tshirt_red.png'),
  // 'tshirt_green':  require('../../../assets/avatar/clothing/tshirt_green.png'),
  // 'tshirt_yellow': require('../../../assets/avatar/clothing/tshirt_yellow.png'),
  // 'tshirt_purple': require('../../../assets/avatar/clothing/tshirt_purple.png'),
  // 'tshirt_orange': require('../../../assets/avatar/clothing/tshirt_orange.png'),
  // 'tshirt_pink':   require('../../../assets/avatar/clothing/tshirt_pink.png'),
  // 'hoodie_navy':   require('../../../assets/avatar/clothing/hoodie_navy.png'),
  // 'hoodie_blue':   require('../../../assets/avatar/clothing/hoodie_blue.png'),
  // 'hoodie_red':    require('../../../assets/avatar/clothing/hoodie_red.png'),
  // 'hoodie_green':  require('../../../assets/avatar/clothing/hoodie_green.png'),
  // 'hoodie_purple': require('../../../assets/avatar/clothing/hoodie_purple.png'),
  // 'dress_red':     require('../../../assets/avatar/clothing/dress_red.png'),
  // 'dress_purple':  require('../../../assets/avatar/clothing/dress_purple.png'),
  // 'dress_blue':    require('../../../assets/avatar/clothing/dress_blue.png'),
  // 'dress_pink':    require('../../../assets/avatar/clothing/dress_pink.png'),
  // 'shirt_navy':    require('../../../assets/avatar/clothing/shirt_navy.png'),
  // 'shirt_blue':    require('../../../assets/avatar/clothing/shirt_blue.png'),
  // 'shirt_white':   require('../../../assets/avatar/clothing/shirt_white.png'),
};
