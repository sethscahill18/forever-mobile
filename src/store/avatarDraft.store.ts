import { create } from 'zustand';
import { AvatarConfig, AVATAR_DEFAULTS } from '../components/avatar/types';

interface AvatarDraftStore {
  config: AvatarConfig;
  setField: <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => void;
  reset: (initial: AvatarConfig) => void;
}

export const useAvatarDraftStore = create<AvatarDraftStore>((set) => ({
  config: { ...AVATAR_DEFAULTS },
  setField: (key, value) =>
    set((s) => ({ config: { ...s.config, [key]: value } })),
  reset: (initial) => set({ config: { ...initial } }),
}));
