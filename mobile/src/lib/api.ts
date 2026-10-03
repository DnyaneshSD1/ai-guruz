import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Session } from './types';

// Android emulators reach the host machine at 10.0.2.2. On a physical device set
// EXPO_PUBLIC_API_URL to your computer's LAN address (see README).
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const REFRESH_KEY = 'lm_refresh_token';

// The refresh token is kept in the device keychain/keystore. (Expo's web target has no secure store.)
const tokenStore = {
  get: () => (Platform.OS === 'web' ? AsyncStorage.getItem(REFRESH_KEY) : SecureStore.getItemAsync(REFRESH_KEY)),
  set: (value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(REFRESH_KEY, value) : SecureStore.setItemAsync(REFRESH_KEY, value),
  clear: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(REFRESH_KEY) : SecureStore.deleteItemAsync(REFRESH_KEY)),
};

let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

export async function storeSession(session: Session) {
  accessToken = session.accessToken;
  if (session.refreshToken) await tokenStore.set(session.refreshToken);
}

export async function clearSession() {
  const refreshToken = await tokenStore.get();
  accessToken = null;
  await tokenStore.clear();
  return refreshToken;
}

/** Trades the stored refresh token for a new session. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await tokenStore.get();
      if (!refreshToken) return null;
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Only a definite rejection ends the session; a server error keeps the token for a later retry.
        if (res.status === 401) await tokenStore.clear();
        return null;
      }
      const session = (await res.json()) as Session;
      await storeSession(session);
      return session;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
}

export async function api<T>(path: string, options: Options = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'X-Client': 'mobile' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', `Cannot reach the server at ${API_URL}.`);
  }

  if (res.status === 401 && options.auth !== false && retry) {
    const session = await refreshSession();
    if (session) return api<T>(path, options, false);
    onSessionLost?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    const fallback = res.status === 429 ? 'Too many requests. Please wait a moment.' : `Request failed (${res.status})`;
    throw new ApiError(res.status, error?.code ?? 'ERROR', error?.message ?? fallback);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
