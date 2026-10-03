"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./Providers";
import { Logo } from "./Logo";
import { ThemeMenu } from "./TopBarMenus";
import { Button, ErrorNote, Field, Input, Select, cx } from "./ui";
import type { Role } from "@/lib/types";

type Mode = "login" | "register";
type Workspace = "personal" | "create" | "join";

const workspaces: { id: Workspace; label: string }[] = [
  { id: "personal", label: "Just me" },
  { id: "join", label: "Join institution" },
  { id: "create", label: "New institution" },
];

export function AuthForm({ mode }: { mode: Mode }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState<Workspace>("personal");
  const [institutionName, setInstitutionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [loading, user, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({
          name,
          email,
          password,
          institutionName: workspace === "create" ? institutionName : undefined,
          joinCode: workspace === "join" ? joinCode : undefined,
          role: workspace === "join" ? role : undefined,
        });
      }
      router.replace("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-5">
        <Logo />
        <ThemeMenu />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "login" ? "Sign in to continue learning." : "Start with a personal workspace or your institution."}
            </p>
          </div>

          {mode === "register" && (
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password" hint={mode === "register" ? "At least 8 characters, with a letter and a digit." : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>

          {mode === "register" && (
            <>
              <div>
                <span className="mb-1.5 block text-sm font-medium">Workspace</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
                  {workspaces.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWorkspace(option.id)}
                      className={cx(
                        "cursor-pointer rounded-md px-2 py-1.5 text-xs transition",
                        workspace === option.id ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {workspace === "create" && (
                <Field label="Institution name" hint="You become its administrator.">
                  <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required maxLength={120} />
                </Field>
              )}
              {workspace === "join" && (
                <>
                  <Field label="Institution code" hint="Ask your administrator or teacher for the 8-character code.">
                    <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} required maxLength={8} className="font-mono tracking-widest" />
                  </Field>
                  <Field label="I am a" hint="Teacher, librarian and admin roles are granted by an administrator.">
                    <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                      <option value="STUDENT">Student</option>
                      <option value="RESEARCHER">Researcher</option>
                    </Select>
                  </Field>
                </>
              )}
            </>
          )}

          <ErrorNote error={error} />
          <Button type="submit" busy={busy} className="w-full">
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted">
            {mode === "login" ? (
              <>New here? <Link href="/register" className="text-fg underline underline-offset-4">Create an account</Link></>
            ) : (
              <>Already have an account? <Link href="/login" className="text-fg underline underline-offset-4">Sign in</Link></>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}
