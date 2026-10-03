"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/Providers";
import { Badge, Bar, Button, Card, ErrorNote, Loading, PageHeader, cx, percent, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Curriculum, Module } from "@/lib/types";

const kindLabel = { CORE: null, REMEDIAL: "reinforcement", LATERAL: "practice detour" };

function ModuleRow({ curriculumId, module, index, canOpen }: { curriculumId: string; module: Module; index: number; canOpen: boolean }) {
  const locked = module.status === "LOCKED";
  const body = (
    <div
      className={cx(
        "flex items-start gap-4 rounded-xl border p-4 transition",
        locked ? "border-dashed border-border opacity-55" : "border-border bg-card",
        !locked && canOpen && "hover:border-fg",
        module.kind !== "CORE" && "ml-6",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
          module.status === "COMPLETED" ? "border-fg bg-fg text-bg" : "border-border text-muted",
        )}
      >
        {module.status === "COMPLETED" ? "✓" : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{module.title}</p>
          {kindLabel[module.kind] && <Badge tone="warn">{kindLabel[module.kind]}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {module.level.toLowerCase()} · {module.estimatedMinutes} min · {module.concepts.join(", ")}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm">
        {module.status === "COMPLETED" && <span className="tabular-nums">{percent(module.score)}</span>}
        {module.status === "AVAILABLE" && <Badge tone="solid">start</Badge>}
        {locked && <span className="text-xs text-muted">locked</span>}
      </div>
    </div>
  );
  return locked || !canOpen ? body : <Link href={`/app/learn/${curriculumId}/module/${module.id}`}>{body}</Link>;
}

export default function CurriculumPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: curriculum, error, loading } = useLoad(
    () => api<Curriculum>(`/api/curricula/${id}`),
    [id],
    (c) => c.status === "GENERATING",
  );

  if (loading) return <Loading />;
  if (!curriculum) return <ErrorNote error={error ?? "Not found"} />;

  const mine = curriculum.userId === user?.id;
  const done = curriculum.modules.filter((m) => m.status === "COMPLETED").length;

  async function remove() {
    if (!window.confirm("Delete this learning path and its progress?")) return;
    await api(`/api/curricula/${id}`, { method: "DELETE" });
    router.replace("/app/learn");
  }

  return (
    <>
      <PageHeader
        title={curriculum.topic}
        subtitle={mine ? curriculum.goal ?? undefined : `Learner: ${curriculum.userName} (read only)`}
        action={
          <div className="flex gap-2">
            {curriculum.status === "READY" && (
              <Link href={`/app/knowledge?curriculum=${curriculum.id}`} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-hover">
                Knowledge graph
              </Link>
            )}
            {mine && <Button variant="danger" size="sm" onClick={remove}>Delete</Button>}
          </div>
        }
      />

      {curriculum.status === "GENERATING" && (
        <Card>
          <Loading label="Researching the topic and planning your path. This can take a few minutes on a local model." />
        </Card>
      )}
      {curriculum.status === "FAILED" && <ErrorNote error={curriculum.error ?? "Generation failed"} />}

      {curriculum.status === "READY" && (
        <div className="space-y-8">
          <Card>
            <p className="text-sm leading-relaxed">{curriculum.summary}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1"><Bar value={curriculum.modules.length ? done / curriculum.modules.length : 0} /></div>
              <span className="text-xs tabular-nums text-muted">{done}/{curriculum.modules.length}</span>
            </div>
            {curriculum.fallbackUsed && (
              <p className="mt-3 text-xs text-warn">Planned without an AI model, so the outline is generic. Start Ollama or configure Claude for a tailored path.</p>
            )}
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Your path</h2>
            <div className="space-y-2">
              {curriculum.modules.map((module, index) => (
                <ModuleRow key={module.id} curriculumId={curriculum.id} module={module} index={index} canOpen={mine} />
              ))}
            </div>
          </section>

          {curriculum.sources.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted">Researched sources</h2>
              <ul className="space-y-1 text-sm">
                {curriculum.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{source.title}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
