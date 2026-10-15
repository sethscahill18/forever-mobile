import { ThemeName } from '../theme/tokens';

export type Rgb = [number, number, number];

// LED colour the measurement device's illuminated button should show for each
// theme. Kept separate from the on-screen palette because LEDs look different
// from screens — tune these by eye. Values are 0–255.
export const THEME_LED_RGB: Record<ThemeName, Rgb> = {
  princess: [214, 51, 108],
  dinosaur: [63, 122, 46],
  space:    [111, 90, 224],
};

/** The exact text the app sends to the device, without the trailing newline. */
export function rgbCommand([r, g, b]: Rgb): string {
  return `rgb ${r} ${g} ${b}`;
}
