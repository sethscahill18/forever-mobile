import { create } from 'zustand';

type AuthState = {
  userId: string | null;
  displayName: string | null;
  setAuth: (userId: string, displayName: string) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  userId:      null,
  displayName: null,
  setAuth:  (userId, displayName) => set({ userId, displayName }),
  clearAuth: () => set({ userId: null, displayName: null }),
}));
