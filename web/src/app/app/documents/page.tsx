"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Empty, ErrorNote, Loading, PageHeader, Spinner, Tabs, formatDate, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Doc } from "@/lib/types";

type Scope = "mine" | "shared" | "all";

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default function DocumentsPage() {
  const { hasRole } = useAuth();
  const [scope, setScope] = useState<Scope>("mine");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, error, loading, reload } = useLoad(
    () => api<Doc[]>(`/api/documents?scope=${scope}`),
    [scope],
    (docs) => docs.some((d) => d.status === "PROCESSING"),
  );

  const tabs: { id: Scope; label: string }[] = [
    { id: "mine", label: "My documents" },
    { id: "shared", label: "Institution library" },
    ...(hasRole("LIBRARIAN", "ADMIN") ? [{ id: "all" as Scope, label: "All documents" }] : []),
  ];

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await api<Doc>("/api/documents", { form });
      setScope("mine");
      await reload();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Upload course material to get summaries, mind maps, deep analysis and exam preparation."
        action={
          <>
            <input ref={fileInput} type="file" hidden accept=".pdf,.docx,.pptx,.txt,.md,.rtf,.html,.epub" onChange={(e) => upload(e.target.files?.[0])} />
            <Button busy={uploading} onClick={() => fileInput.current?.click()}>Upload document</Button>
          </>
        }
      />
      <div className="mb-3"><ErrorNote error={uploadError} /></div>
      <div className="mb-5"><Tabs tabs={tabs} value={scope} onChange={setScope} /></div>
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title={scope === "mine" ? "No documents yet" : "Nothing here yet"}
          body={scope === "mine" ? "PDF, Word, PowerPoint, text and Markdown files up to 25 MB." : "Documents shared by teachers and librarians appear here."}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {data.map((doc) => (
            <li key={doc.id}>
              <Link href={`/app/documents/${doc.id}`} className="flex items-center justify-between gap-4 bg-card px-4 py-3 transition hover:bg-hover">
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="truncate text-xs text-muted">
                    {doc.filename} · {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                    {scope !== "mine" && ` · ${doc.ownerName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {doc.visibility === "SHARED" && <Badge>shared</Badge>}
                  {doc.status === "PROCESSING" && <Badge><Spinner small />&nbsp;processing</Badge>}
                  {doc.status === "FAILED" && <Badge tone="danger">failed</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
