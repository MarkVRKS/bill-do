import { create } from 'zustand';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  onboardingDone: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  onboardingDone: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  login: async (email, password) => {
    try {
      set({ error: null });
      const { user } = await api.login(email, password);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  register: async (email, password) => {
    try {
      set({ error: null });
      const res = await api.register(email, password) as any;
      // Auto-login: set user from response
      if (res.user) {
        set({ user: res.user, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  logout: async () => {
    await api.logout();
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      set({ loading: true });
      const { user } = await api.me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),

  onboardingDone: async () => {
    await api.onboardingDone();
    set((state) => ({
      user: state.user ? { ...state.user, onboardingDone: true } : null,
    }));
  },
}));
