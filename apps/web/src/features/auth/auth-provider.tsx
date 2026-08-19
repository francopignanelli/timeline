import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  autoSignIn,
  confirmResetPassword,
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import type { Locale } from '@timeline/shared';
import '../../lib/amplify';
import i18n from '../../lib/i18n';

/**
 * Real Cognito authentication (Phase 4, DECISIONS #8/#18) via aws-amplify's
 * auth category (SRP, no Hosted UI). `username`/`displayName` live as Cognito
 * attributes until Phase 5's DynamoDB profile exists to own them.
 */

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  locale: Locale;
}

interface PendingRegistration {
  email: string;
  username: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  pending: PendingRegistration | null;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: PendingRegistration & { password: string }) => Promise<void>;
  verify: (code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PENDING_KEY = 'timeline.auth.pending';

function currentLocale(): Locale {
  return i18n.language === 'es' ? 'es' : 'en';
}

function readPending(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingRegistration) : null;
  } catch {
    return null;
  }
}

async function loadCurrentUser(): Promise<AuthUser | null> {
  try {
    const { userId } = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    return {
      id: userId,
      email: attrs.email ?? '',
      username: attrs['custom:username'] ?? '',
      displayName: attrs.name ?? '',
      locale: currentLocale(),
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pending, setPendingState] = useState<PendingRegistration | null>(() => readPending());
  const setPending = useCallback((next: PendingRegistration | null) => {
    if (next) sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(PENDING_KEY);
    setPendingState(next);
  }, []);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadCurrentUser().then((next) => {
      if (!cancelled) {
        setUser(next);
        setIsInitializing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signIn({ username: email, password });
    setUser(await loadCurrentUser());
  }, []);

  const register = useCallback(
    async ({ email, username, displayName, password }: PendingRegistration & { password: string }) => {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email, name: displayName, 'custom:username': username },
          autoSignIn: true,
        },
      });
      setPending({ email, username, displayName });
    },
    [setPending],
  );

  const verify = useCallback(
    async (code: string) => {
      if (!pending) throw new Error('noPendingRegistration');
      await confirmSignUp({ username: pending.email, confirmationCode: code });
      await autoSignIn();
      setPending(null);
      setUser(await loadCurrentUser());
    },
    [pending, setPending],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    await resetPassword({ username: email });
  }, []);

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      pending,
      isInitializing,
      login,
      register,
      verify,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
    }),
    [user, pending, isInitializing, login, register, verify, requestPasswordReset, confirmPasswordReset, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
