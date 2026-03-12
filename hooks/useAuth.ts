import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { Profile } from '@/types/user';

WebBrowser.maybeCompleteAuthSession();

const AUTH_INIT_TIMEOUT_MS = 12000;

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Failed to fetch profile:', error.message);
  }
  return data as Profile | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function useAuth() {
  const { session, profile, loading, setSession, setProfile, setInitialized, setLoading, reset } =
    useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const sessionPromise = supabase.auth
          .getSession()
          .then(({ data: { session } }) => session)
          .catch(() => null);
        const session = await withTimeout(sessionPromise, AUTH_INIT_TIMEOUT_MS, null);
        if (cancelled) return;
        setSession(session);
        if (session?.user) {
          const p = await withTimeout(
            fetchProfile(session.user.id).catch(() => null),
            AUTH_INIT_TIMEOUT_MS,
            null
          );
          if (cancelled) return;
          setProfile(p);
        }
      } catch (e) {
        if (!cancelled) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setInitialized(true);
      }
    };

    init();

    const timeout = setTimeout(() => {
      if (!cancelled) setInitialized(true);
    }, Math.min(4000, AUTH_INIT_TIMEOUT_MS));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: email.split('@')[0] } },
      });
      if (error) throw error;
      // With "Confirm email" OFF in Supabase (Auth → Providers → Email), users get a session immediately and don't need to verify via link.
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useWorkoutStore.getState().reset();
    reset();
  };

  return { session, profile, loading, signUp, signIn, signInWithApple, signOut };
}
