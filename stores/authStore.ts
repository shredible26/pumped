import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { Profile } from '@/types/user';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
  profileStatus: 'idle' | 'loading' | 'loaded' | 'missing' | 'error';
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setInitialized: (initialized: boolean) => void;
  setProfileStatus: (status: AuthState['profileStatus']) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  initialized: false,
  profileStatus: 'idle',
  loading: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setInitialized: (initialized) => set({ initialized }),
  setProfileStatus: (profileStatus) => set({ profileStatus }),
  setLoading: (loading) => set({ loading }),
  reset: () =>
    set({
      session: null,
      profile: null,
      initialized: true,
      profileStatus: 'idle',
      loading: false,
    }),
}));
