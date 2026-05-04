import { create } from 'zustand';
import { loadTokens } from '../services/api';
import { AuthUser, authService } from '../services/auth.service';

type AuthState = {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  hydrate: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  /** Read tokens from keychain at app boot, then GET /users/me. */
  async hydrate() {
    const tokens = await loadTokens();
    if (!tokens) {
      set({ status: 'unauthenticated', user: null });
      return;
    }
    try {
      const user = await authService.fetchMe();
      set({ status: 'authenticated', user });
    } catch {
      // token rejected; treat as signed out
      await authService.signOut();
      set({ status: 'unauthenticated', user: null });
    }
  },

  setUser: (user) => set({ status: 'authenticated', user }),

  async signOut() {
    await authService.signOut();
    set({ status: 'unauthenticated', user: null });
  },
}));
