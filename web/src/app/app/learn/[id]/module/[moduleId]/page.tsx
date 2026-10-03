"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Quiz } from "@/components/Quiz";
import { Badge, Card, ErrorNote, Loading, Markdown, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Module } from "@/lib/types";

export default function ModulePage() {
  const { id, moduleId } = useParams<{ id: string; moduleId: string }>();
  // The lesson is written by the model the first time the module is opened, so this request can be slow.
  const { data: module, error, loading } = useLoad(() => api<Module>(`/api/curricula/${id}/modules/${moduleId}`), [id, moduleId]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/app/learn/${id}`} className="text-sm text-muted hover:text-fg">← Back to path</Link>
      {loading ? (
        <Loading label="Preparing your lesson" />
      ) : !module ? (
        <div className="mt-4"><ErrorNote error={error ?? "Not found"} /></div>
      ) : (
        <div className="mt-4 space-y-8">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{module.level.toLowerCase()}</Badge>
              {module.kind === "REMEDIAL" && <Badge tone="warn">reinforcement</Badge>}
              {module.kind === "LATERAL" && <Badge tone="warn">practice detour</Badge>}
              <span className="text-xs text-muted">{module.estimatedMinutes} min</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{module.title}</h1>
          </header>

          <Card>
            <p className="text-xs uppercase tracking-wider text-muted">You will be able to</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {module.objectives.map((objective) => <li key={objective}>{objective}</li>)}
            </ul>
          </Card>

          <article>
            <Markdown>{module.content ?? ""}</Markdown>
          </article>

          <Quiz key={module.id} curriculumId={id} moduleId={module.id} />
        </div>
      )}
    </div>
  );
}
