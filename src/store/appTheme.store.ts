import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName } from '../theme/tokens';
import { PALETTES } from '../theme/palettes';

const KEY = 'app_active_theme';
const VALID: ThemeName[] = ['water', 'forest', 'space'];

type AppThemeState = {
  activeTheme: ThemeName;
  setActiveTheme: (theme: ThemeName) => void;
  loadActiveTheme: () => Promise<void>;
};

export const useAppThemeStore = create<AppThemeState>((set) => ({
  activeTheme: 'water',
  setActiveTheme: (theme) => {
    set({ activeTheme: theme });
    AsyncStorage.setItem(KEY, theme).catch(() => {});
  },
  loadActiveTheme: async () => {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved && VALID.includes(saved as ThemeName)) set({ activeTheme: saved as ThemeName });
  },
}));

export function useAppTheme() {
  const activeTheme = useAppThemeStore((s) => s.activeTheme);
  return { theme: activeTheme, colors: PALETTES[activeTheme] };
}
