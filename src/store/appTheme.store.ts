import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from '../theme/tokens';
import { PALETTES } from '../theme/palettes';

const KEY = 'app_active_theme';
const VALID: ThemeName[] = ['princess', 'dinosaur', 'space'];
// Remaps values persisted under the old theme names (water/forest) to their renamed equivalents.
const LEGACY_REMAP: Record<string, ThemeName> = { water: 'princess', forest: 'dinosaur' };

type AppThemeState = {
  activeTheme: ThemeName;
  setActiveTheme: (theme: ThemeName) => void;
  loadActiveTheme: () => Promise<void>;
};

export const useAppThemeStore = create<AppThemeState>((set) => ({
  activeTheme: 'dinosaur',
  setActiveTheme: (theme) => {
    set({ activeTheme: theme });
    AsyncStorage.setItem(KEY, theme).catch(() => {});
  },
  loadActiveTheme: async () => {
    const saved = await AsyncStorage.getItem(KEY);
    if (!saved) return;
    if (VALID.includes(saved as ThemeName)) {
      set({ activeTheme: saved as ThemeName });
    } else if (LEGACY_REMAP[saved]) {
      set({ activeTheme: LEGACY_REMAP[saved] });
    }
  },
}));

export function useAppTheme() {
  const activeTheme = useAppThemeStore((s) => s.activeTheme);
  return { theme: activeTheme, colors: PALETTES[activeTheme] };
}
