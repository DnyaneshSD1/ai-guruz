"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, formatDate, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Role, User } from "@/lib/types";

const roles: Role[] = ["STUDENT", "RESEARCHER", "TEACHER", "LIBRARIAN", "ADMIN"];
const emptyForm = { name: "", email: "", password: "", role: "STUDENT" as Role };

export default function UsersPage() {
  const { user: me, hasRole } = useAuth();
  const { data: users, error, loading, reload } = useLoad(() => api<User[]>("/api/users"), []);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!hasRole("ADMIN")) return <Empty title="Administrators only" body="You do not have access to user management." />;

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (await act(() => api("/api/users", { body: form }))) {
      setForm(emptyForm);
      setShowForm(false);
    }
  }

  const update = (id: string, body: { role?: Role; active?: boolean }) => act(() => api(`/api/users/${id}`, { method: "PATCH", body }));

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`Everyone in ${me?.tenantName}. Role changes take effect at the user's next sign-in.`}
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "Add user"}</Button>}
      />
      {showForm && (
        <Card className="mb-6">
          <form onSubmit={create} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_160px_auto] md:items-end">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Temporary password"><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {roles.map((role) => <option key={role} value={role}>{role.toLowerCase()}</option>)}
              </Select>
            </Field>
            <Button type="submit" busy={busy}>Create</Button>
          </form>
        </Card>
      )}
      <div className="mb-3"><ErrorNote error={actionError ?? error} /></div>
      {loading ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">User</th>
                <th className="px-4 py-3 font-normal">Role</th>
                <th className="px-4 py-3 font-normal">Joined</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((user) => {
                const self = user.id === me?.id;
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name}{self && <span className="ml-2 text-xs font-normal text-muted">you</span>}</p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={user.role} disabled={self || busy} onChange={(e) => update(user.id, { role: e.target.value as Role })} className="h-8 w-36" aria-label={`Role of ${user.name}`}>
                        {roles.map((role) => <option key={role} value={role}>{role.toLowerCase()}</option>)}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{user.active ? <Badge tone="success">active</Badge> : <Badge tone="danger">deactivated</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      {!self && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => update(user.id, { active: !user.active })}>
                          {user.active ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
