import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '../db/schema';

const STORAGE_KEY = 'activeProfileId';

type ActiveProfileState = {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  clearProfile: () => void;
};

export const useActiveProfileStore = create<ActiveProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => {
    set({ profile });
    AsyncStorage.setItem(STORAGE_KEY, profile.id).catch(() => {});
  },
  clearProfile: () => {
    set({ profile: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

export async function getSavedProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}
