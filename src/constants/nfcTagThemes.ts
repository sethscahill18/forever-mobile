import { ThemeName } from '../theme/tokens';

// Exact NDEF text → theme. Matching is on the full string, not a parsed suffix,
// since only tags 001/002 physically exist today and the "FM|1|ART" prefix's
// meaning (if any) isn't confirmed — add new rows here as more tags are made.
export const TAG_THEME_MAP: Record<string, ThemeName> = {
  'FM|1|ART|001': 'space',
  'FM|1|ART|002': 'dinosaur',
  'FM|1|ART|003': 'princess',
};

export const THEME_LABELS: Record<ThemeName, string> = {
  princess: 'Princess',
  dinosaur: 'Dinosaur',
  space:    'Space',
};

/** Returns the theme linked to any of the tag's decoded NDEF text records, or null if none match. */
export function resolveThemeFromNdef(ndefTexts: string[]): ThemeName | null {
  for (const text of ndefTexts) {
    const theme = TAG_THEME_MAP[text];
    if (theme) return theme;
  }
  return null;
}
