"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AnalysisView } from "@/components/AnalysisView";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, ErrorNote, Loading, PageHeader, Tabs, formatDate, useLoad } from "@/components/ui";
import { api, download } from "@/lib/api";
import type { AnalysisType, Doc } from "@/lib/types";

const tabs: { id: AnalysisType; label: string }[] = [
  { id: "SUMMARY", label: "Summary" },
  { id: "MIND_MAP", label: "Mind map" },
  { id: "DEEP_ANALYSIS", label: "Deep analysis" },
  { id: "EXAM_PREP", label: "Exam prep" },
];

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState<AnalysisType>("SUMMARY");
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: doc, error, loading, setData } = useLoad(() => api<Doc>(`/api/documents/${id}`), [id], (d) => d.status === "PROCESSING");

  if (loading) return <Loading />;
  if (!doc) return <ErrorNote error={error ?? "Not found"} />;

  const canManage = doc.ownerId === user?.id || hasRole("LIBRARIAN", "ADMIN");
  const canShare = canManage && hasRole("TEACHER", "LIBRARIAN", "ADMIN");

  async function act(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const toggleShare = () =>
    act(async () => setData(await api<Doc>(`/api/documents/${id}`, { method: "PATCH", body: { visibility: doc.visibility === "SHARED" ? "PRIVATE" : "SHARED" } })));
  const remove = () =>
    act(async () => {
      if (!window.confirm("Delete this document?")) return;
      await api(`/api/documents/${id}`, { method: "DELETE" });
      router.replace("/app/documents");
    });

  return (
    <>
      <Link href="/app/documents" className="text-sm text-muted hover:text-fg">← Documents</Link>
      <div className="mt-3">
        <PageHeader
          title={doc.title}
          subtitle={`${doc.filename} · uploaded by ${doc.ownerName} on ${formatDate(doc.createdAt)}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {doc.visibility === "SHARED" && <Badge>shared with institution</Badge>}
              <Button variant="secondary" size="sm" onClick={() => act(() => download(`/api/documents/${id}/download`, doc.filename))}>Download</Button>
              {canShare && <Button variant="secondary" size="sm" onClick={toggleShare}>{doc.visibility === "SHARED" ? "Unshare" : "Share"}</Button>}
              {canManage && <Button variant="danger" size="sm" onClick={remove}>Delete</Button>}
            </div>
          }
        />
      </div>
      <div className="mb-4"><ErrorNote error={actionError} /></div>

      {doc.status === "PROCESSING" && <Card><Loading label="Extracting text from the document" /></Card>}
      {doc.status === "FAILED" && <ErrorNote error={doc.error ?? "The document could not be processed"} />}
      {doc.status === "READY" && (
        <>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="mt-5">
            <AnalysisView key={tab} documentId={doc.id} type={tab} />
          </div>
        </>
      )}
    </>
  );
}
