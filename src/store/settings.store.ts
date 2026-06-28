import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeightUnit } from '../utils/weight';

const KEY = 'settings_primary_unit';

type SettingsState = {
  primaryUnit: HeightUnit;
  setPrimaryUnit: (unit: HeightUnit) => void;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  primaryUnit: 'cm',
  setPrimaryUnit: (unit) => {
    set({ primaryUnit: unit });
    AsyncStorage.setItem(KEY, unit).catch(() => {});
  },
  loadSettings: async () => {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved === 'cm' || saved === 'ft') set({ primaryUnit: saved });
  },
}));
