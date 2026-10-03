"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshSession, setAccessToken, setSessionLostHandler } from "@/lib/api";
import type { Role, Session, User } from "@/lib/types";

// ---------- Theme ----------

export type ThemeChoice = "light" | "dark" | "system";

const ThemeContext = createContext<{ theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }>({
  theme: "system",
  setTheme: () => {},
});

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

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
  /** True until the first silent session restore has finished. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <Providers>");
  return value;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = (localStorage.getItem("lm-theme") as ThemeChoice | null) ?? "system";
    setThemeState(saved);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme((localStorage.getItem("lm-theme") as ThemeChoice | null) ?? "system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((choice: ThemeChoice) => {
    localStorage.setItem("lm-theme", choice);
    setThemeState(choice);
    applyTheme(choice);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const auth = useMemo<AuthValue>(() => {
    const start = (session: Session) => {
      setAccessToken(session.accessToken);
      setUser(session.user);
    };
    return {
      user,
      loading,
      login: async (email, password) =>
        start(await api<Session>("/api/auth/login", { body: { email, password }, auth: false })),
      register: async (input) => start(await api<Session>("/api/auth/register", { body: input, auth: false })),
      logout: async () => {
        await api("/api/auth/logout", { method: "POST", auth: false }).catch(() => {});
        setAccessToken(null);
        setUser(null);
      },
      hasRole: (...roles) => !!user && roles.includes(user.role),
    };
  }, [user, loading]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
