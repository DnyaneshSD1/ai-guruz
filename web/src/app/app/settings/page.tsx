"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";

export default function SettingsPage() {
  const { user, hasRole, logout } = useAuth();
  const tenant = useLoad(() => api<Tenant>("/api/tenants/me"), []);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", { body: { currentPassword, newPassword } });
      // Changing the password ends every session, including this one.
      await logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function regenerateCode() {
    if (!window.confirm("Generate a new code? The current code stops working.")) return;
    tenant.setData(await api<Tenant>("/api/tenants/me/join-code", { method: "POST" }));
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-2xl space-y-4">
        <Card>
          <h2 className="font-medium">Profile</h2>
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt><dd>{user?.name}</dd>
            <dt className="text-muted">Email</dt><dd>{user?.email}</dd>
            <dt className="text-muted">Role</dt><dd><Badge>{user?.role.toLowerCase()}</Badge></dd>
          </dl>
        </Card>

        <Card>
          <h2 className="font-medium">Appearance</h2>
          <p className="mt-1 text-sm text-muted">System follows your device setting.</p>
          <div className="mt-3"><ThemeToggle /></div>
        </Card>

        <Card>
          <h2 className="font-medium">{tenant.data?.personal ? "Workspace" : "Institution"}</h2>
          <ErrorNote error={tenant.error} />
          {tenant.data && (
            <>
              <p className="mt-1 text-sm text-muted">{tenant.data.name} · {tenant.data.members} member{tenant.data.members === 1 ? "" : "s"}</p>
              {tenant.data.joinCode && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-xs text-muted">Join code (share with people who should join)</p>
                    <p className="font-mono text-lg tracking-[0.3em]">{tenant.data.joinCode}</p>
                  </div>
                  {hasRole("ADMIN") && <Button variant="secondary" size="sm" onClick={regenerateCode}>New code</Button>}
                </div>
              )}
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-medium">Change password</h2>
          <p className="mt-1 text-sm text-muted">You will be signed out on all devices.</p>
          <form onSubmit={changePassword} className="mt-4 space-y-4">
            <Field label="Current password">
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            <Field label="New password" hint="At least 8 characters, with a letter and a digit.">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" busy={busy}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
