import { useEffect } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { Profile } from '@/types/user';

WebBrowser.maybeCompleteAuthSession();

const PROFILE_RETRY_DELAY_MS = 1500;

type ProfileFetchResult = {
  profile: Profile | null;
  status: 'loaded' | 'missing' | 'error';
};

let profileRetryTimer: ReturnType<typeof setTimeout> | null = null;

function clearProfileRetryTimer() {
  if (profileRetryTimer) {
    clearTimeout(profileRetryTimer);
    profileRetryTimer = null;
  }
}

async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { profile: null, status: 'missing' };
    }

    console.warn('Failed to fetch profile:', error.message);
    return { profile: null, status: 'error' };
  }

  return { profile: data as Profile, status: 'loaded' };
}

async function syncProfile(userId: string): Promise<ProfileFetchResult['status']> {
  const result = await fetchProfile(userId);
  const state = useAuthStore.getState();

  if (state.session?.user?.id !== userId) {
    return result.status;
  }

  if (result.status === 'loaded') {
    state.setProfile(result.profile);
    state.setProfileStatus('loaded');
    clearProfileRetryTimer();
    return 'loaded';
  }

  if (result.status === 'missing') {
    state.setProfile(null);
    state.setProfileStatus('missing');
    clearProfileRetryTimer();
    return 'missing';
  }

  state.setProfileStatus('error');
  return 'error';
}

function scheduleProfileRetry(userId: string) {
  clearProfileRetryTimer();
  profileRetryTimer = setTimeout(() => {
    profileRetryTimer = null;

    const state = useAuthStore.getState();
    if (state.session?.user?.id !== userId) {
      return;
    }

    state.setProfileStatus('loading');
    void syncProfile(userId).then((status) => {
      if (status === 'error') {
        scheduleProfileRetry(userId);
      }
    });
  }, PROFILE_RETRY_DELAY_MS);
}

async function applySession(session: Session | null) {
  const state = useAuthStore.getState();
  const currentUserId = state.session?.user?.id ?? null;
  const nextUserId = session?.user?.id ?? null;
  const sameUser = currentUserId != null && currentUserId === nextUserId;

  state.setSession(session);

  if (!session?.user) {
    clearProfileRetryTimer();
    state.setProfile(null);
    state.setProfileStatus('idle');
    return;
  }

  if (sameUser && state.profileStatus === 'loaded' && state.profile?.id === session.user.id) {
    return;
  }

  state.setProfileStatus('loading');

  const status = await syncProfile(session.user.id);
  if (status === 'error') {
    scheduleProfileRetry(session.user.id);
  }
}

export function useAuthBootstrap() {
  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        await applySession(session);
      } catch (error) {
        if (!mounted) return;
        console.warn('Failed to bootstrap auth session:', error);
        clearProfileRetryTimer();
        const state = useAuthStore.getState();
        state.setSession(null);
        state.setProfile(null);
        state.setProfileStatus('idle');
      } finally {
        if (mounted) {
          useAuthStore.getState().setInitialized(true);
        }
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session).finally(() => {
        if (mounted) {
          useAuthStore.getState().setInitialized(true);
        }
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearProfileRetryTimer();
    };
  }, []);
}

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: email.split('@')[0] } },
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    setLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Apple Sign In', err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    clearProfileRetryTimer();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useWorkoutStore.getState().reset();
    reset();
  };

  return { session, profile, loading, signUp, signIn, signInWithApple, signOut };
}
