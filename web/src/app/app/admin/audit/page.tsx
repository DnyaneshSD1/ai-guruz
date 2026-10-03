"use client";

import { useState } from "react";
import { useAuth } from "@/components/Providers";
import { Button, Empty, ErrorNote, Loading, PageHeader, Select, formatDateTime, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { AuditPage } from "@/lib/types";

const types = [
  "LOGIN_SUCCESS", "LOGIN_FAILED", "USER_REGISTERED", "USER_CREATED", "ROLE_CHANGED", "USER_ACTIVATED", "USER_DEACTIVATED",
  "PASSWORD_CHANGED", "JOIN_CODE_REGENERATED", "DOCUMENT_UPLOADED", "DOCUMENT_SHARED", "DOCUMENT_UNSHARED", "DOCUMENT_DELETED",
];
const label = (type: string) => type.toLowerCase().replaceAll("_", " ");
const PAGE_SIZE = 25;

export default function AuditPageView() {
  const { hasRole } = useAuth();
  const [page, setPage] = useState(0);
  const [type, setType] = useState("");
  const { data, error, loading } = useLoad(() => api<AuditPage>(`/api/audit-logs?page=${page}&size=${PAGE_SIZE}&type=${type}`), [page, type]);

  if (!hasRole("ADMIN")) return <Empty title="Administrators only" body="You do not have access to the audit log." />;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Security-relevant actions in your institution, newest first."
        action={
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} className="w-56" aria-label="Filter by action">
            <option value="">All actions</option>
            {types.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
        }
      />
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="No audit events" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Who</th>
                  <th className="px-4 py-3 font-normal">Action</th>
                  <th className="px-4 py-3 font-normal">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(event.timestamp)}</td>
                    <td className="px-4 py-2.5 font-medium">{event.userName}</td>
                    <td className="px-4 py-2.5">{label(event.type)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {Object.entries(event.metadata ?? {}).map(([key, value]) => `${key}=${String(value)}`).join("  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.total} events · page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
