import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { api, clearSession, refreshSession, setSessionLostHandler, storeSession } from './api';
import type { Role, Session, User } from './types';

// ---------- Theme (same tokens as the web app) ----------

export const palettes = {
  light: {
    bg: '#ffffff', fg: '#0a0a0a', muted: '#6b6b6b', border: '#e6e6e6', card: '#fafafa', hover: '#f2f2f2',
    primary: '#0a0a0a', primaryFg: '#ffffff', success: '#15803d', warn: '#b45309', danger: '#b91c1c',
    // Chart series colours, in a fixed order validated for colour-blind separation (same as the web app).
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  },
  dark: {
    bg: '#000000', fg: '#f5f5f5', muted: '#9a9a9a', border: '#242424', card: '#0c0c0c', hover: '#161616',
    primary: '#ffffff', primaryFg: '#000000', success: '#4ade80', warn: '#fbbf24', danger: '#f87171',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
  },
};

export type Palette = typeof palettes.light;
export type ThemeChoice = 'light' | 'dark' | 'system';

const THEME_KEY = 'aiguruz_theme';

const ThemeContext = createContext<{ colors: Palette; dark: boolean; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void }>({
  colors: palettes.light,
  dark: false,
  choice: 'system',
  setChoice: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// ---------- Auth ----------

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  institutionName?: string;
  joinCode?: string;
  role?: Role;
}

interface AuthValue {
  user: User | null;
  /** True until the stored session has been checked. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <Providers>');
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setChoiceState(saved);
    });
    setSessionLostHandler(() => setUser(null));
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const dark = choice === 'dark' || (choice === 'system' && system === 'dark');
  const theme = useMemo(() => ({ colors: dark ? palettes.dark : palettes.light, dark, choice, setChoice }), [dark, choice, setChoice]);

  const auth = useMemo<AuthValue>(() => {
    const start = async (session: Session) => {
      await storeSession(session);
      setUser(session.user);
    };
    return {
      user,
      loading,
      login: async (email, password) => start(await api<Session>('/api/auth/login', { body: { email, password }, auth: false })),
      register: async (input) => start(await api<Session>('/api/auth/register', { body: input, auth: false })),
      logout: async () => {
        const refreshToken = await clearSession();
        if (refreshToken) await api('/api/auth/logout', { body: { refreshToken }, auth: false }).catch(() => {});
        setUser(null);
      },
      hasRole: (...roles) => !!user && roles.includes(user.role),
    };
  }, [user, loading]);

  return (
    <ThemeContext.Provider value={theme}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
