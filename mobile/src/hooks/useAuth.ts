import { create } from 'zustand';
import { AuthUser, authService } from '../services/auth.service';

type AuthState = {
  user: AuthUser | null;
  status: 'unauthenticated' | 'authenticated' | 'loading';
  signIn: (user: AuthUser) => void;
  signOut: () => Promise<void>;
};

/**
 * Phase A: in-memory state only. Phase B wires keychain hydration on boot,
 * the OTP verify flow, and the refresh-token rotation.
 */
export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'unauthenticated',
  signIn: (user) => set({ user, status: 'authenticated' }),
  signOut: async () => {
    await authService.signOut();
    set({ user: null, status: 'unauthenticated' });
  },
}));
