import type { Session } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// The access token lives in memory only. The refresh token is an HttpOnly cookie the browser
// sends to /api/auth/*, so page scripts can never read it.
let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

/** Exchanges the refresh cookie for a new session. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= fetch(`${API_URL}/api/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return null;
      const session = (await res.json()) as Session;
      accessToken = session.accessToken;
      return session;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
}

export async function api<T>(path: string, options: Options = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? "POST" : "GET"),
      headers,
      credentials: "include",
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check that the backend is running.");
  }

  if (res.status === 401 && options.auth !== false && retry) {
    const session = await refreshSession();
    if (session) return api<T>(path, options, false);
    onSessionLost?.();
    throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    const fallback = res.status === 429 ? "Too many requests. Please wait a moment." : `Request failed (${res.status})`;
    throw new ApiError(res.status, error?.code ?? "ERROR", error?.message ?? fallback);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Downloads a protected file with the bearer token and hands it to the browser. */
export async function download(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ApiError(res.status, "ERROR", "Download failed");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
