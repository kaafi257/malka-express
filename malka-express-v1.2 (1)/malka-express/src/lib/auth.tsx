import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadProfile, signOut as apiSignOut } from './api';
import { supabase, supabaseReady } from './supabase';
import type { Profile } from './types';

interface AuthValue {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  problem: 'inactive' | 'no_profile' | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionLoaded, setSessionLoaded] = useState(!supabaseReady);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [problem, setProblem] = useState<AuthValue['problem']>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // 1) Track the auth session. The callback only stores the id — no awaits inside it.
  useEffect(() => {
    if (!supabaseReady) return;
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setSessionLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 2) Load the profile whenever the signed-in user changes.
  useEffect(() => {
    if (!sessionLoaded) return;
    if (!userId) {
      setProfile(null);
      setProblem(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    loadProfile(userId)
      .then((result) => {
        if (cancelled) return;
        if ('profile' in result) {
          setProfile(result.profile);
          setProblem(null);
        } else {
          setProfile(null);
          setProblem(result.problem);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setProblem('no_profile');
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionLoaded, userId]);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setProfile(null);
    setProblem(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ loading: !sessionLoaded || profileLoading, userId, profile, problem, signOut }),
    [sessionLoaded, profileLoading, userId, profile, problem, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
