import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '@timeline/shared';
import i18n from '../../lib/i18n';

/**
 * Phase 1 mock authentication. The context shape mirrors what Phase 4 wires to
 * Cognito (via aws-amplify's auth category) — only the internals change then.
 * Nothing here is security; backend authorization arrives with the real API.
 */

export interface MockUser {
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
  user: MockUser | null;
  pending: PendingRegistration | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: PendingRegistration & { password: string }) => Promise<void>;
  verify: (code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => void;
}

const USER_KEY = 'timeline.mock.user';
const PENDING_KEY = 'timeline.mock.pending';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function currentLocale(): Locale {
  return i18n.language === 'es' ? 'es' : 'en';
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => readJson<MockUser>(USER_KEY));
  const [pending, setPending] = useState<PendingRegistration | null>(() =>
    readJson<PendingRegistration>(PENDING_KEY),
  );

  const login = useCallback(async (email: string, _password: string) => {
    await delay(400);
    const name = email.split('@')[0] ?? 'user';
    const next: MockUser = {
      id: 'mock-user',
      email,
      username: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      displayName: name,
      locale: currentLocale(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const register = useCallback(
    async ({ email, username, displayName }: PendingRegistration & { password: string }) => {
      await delay(400);
      const next: PendingRegistration = { email, username, displayName };
      localStorage.setItem(PENDING_KEY, JSON.stringify(next));
      setPending(next);
    },
    [],
  );

  const verify = useCallback(
    async (code: string) => {
      await delay(400);
      if (!pending || !/^\d{6}$/.test(code)) {
        throw new Error('codeInvalid');
      }
      const next: MockUser = {
        id: 'mock-user',
        email: pending.email,
        username: pending.username,
        displayName: pending.displayName,
        locale: currentLocale(),
      };
      localStorage.removeItem(PENDING_KEY);
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      setPending(null);
      setUser(next);
    },
    [pending],
  );

  const requestPasswordReset = useCallback(async (_email: string) => {
    await delay(400);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, pending, login, register, verify, requestPasswordReset, logout }),
    [user, pending, login, register, verify, requestPasswordReset, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
