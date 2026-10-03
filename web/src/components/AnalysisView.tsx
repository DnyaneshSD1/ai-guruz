"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorNote, Loading, percent, useLoad } from "./ui";
import { api } from "@/lib/api";
import type { Analysis, AnalysisType, MindNode } from "@/lib/types";

const descriptions: Record<AnalysisType, string> = {
  SUMMARY: "An overview, the key points and the key terms of the document.",
  MIND_MAP: "The document's structure as a map of topics and sub-topics.",
  DEEP_ANALYSIS: "Themes, insights, gaps and questions for further study.",
  EXAM_PREP: "Flashcards, exam-style questions with model answers, and study tips.",
};

function MindBranch({ node, depth = 0 }: { node: MindNode; depth?: number }) {
  return (
    <li>
      <span className={depth === 0 ? "inline-block rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg" : depth === 1 ? "inline-block rounded-lg border border-fg px-3 py-1 text-sm font-medium" : "text-sm"}>
        {node.label}
      </span>
      {!!node.children?.length && (
        <ul className="ml-4 mt-2 space-y-2 border-l border-border pl-4">
          {node.children.map((child, index) => <MindBranch key={index} node={child} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>
  );
}

function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button onClick={() => setFlipped((f) => !f)} className="min-h-28 cursor-pointer rounded-xl border border-border bg-bg p-4 text-left transition hover:border-fg">
      <p className="text-xs uppercase tracking-wider text-muted">{flipped ? "Answer" : "Card"}</p>
      <p className={flipped ? "mt-2 text-sm" : "mt-2 font-medium"}>{flipped ? back : front}</p>
    </button>
  );
}

function Result({ analysis }: { analysis: Analysis }) {
  const r = analysis.result;
  switch (analysis.type) {
    case "SUMMARY":
      return (
        <div className="space-y-6">
          <p className="leading-relaxed">{r.overview}</p>
          <List title="Key points" items={r.keyPoints} />
          {!!r.keywords?.length && (
            <div className="flex flex-wrap gap-1.5">{r.keywords.map((k: string) => <Badge key={k}>{k}</Badge>)}</div>
          )}
        </div>
      );
    case "MIND_MAP":
      return <ul className="overflow-x-auto"><MindBranch node={r.root} /></ul>;
    case "DEEP_ANALYSIS":
      return (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {r.themes?.map((theme: { title: string; explanation: string }, index: number) => (
              <div key={index} className="rounded-xl border border-border bg-bg p-4">
                <p className="font-medium">{theme.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{theme.explanation}</p>
              </div>
            ))}
          </div>
          <List title="Insights" items={r.insights} />
          <List title="Gaps and limitations" items={r.gaps} />
          <List title="Questions for further study" items={r.questions} />
        </div>
      );
    case "EXAM_PREP":
      return (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Flashcards (click to flip)</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {r.flashcards?.map((card: { front: string; back: string }, index: number) => <Flashcard key={index} {...card} />)}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Practice questions</h3>
            <div className="space-y-2">
              {r.questions?.map((q: { question: string; answer: string; difficulty: string }, index: number) => (
                <details key={index} className="rounded-xl border border-border bg-bg p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {q.question} {q.difficulty && <span className="ml-1 text-xs font-normal text-muted">({q.difficulty})</span>}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{q.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <List title="Study tips" items={r.studyTips} />
        </div>
      );
  }
}

/** One analysis product for a document: generate on demand, poll while pending, render, allow regeneration. */
export function AnalysisView({ documentId, type }: { documentId: string; type: AnalysisType }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    async () => (await api<Analysis[]>(`/api/analyses?documentId=${documentId}`)).find((a) => a.type === type) ?? null,
    [documentId, type],
    (analysis) => analysis?.status === "PENDING",
  );

  async function generate(regenerate: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      await api<Analysis>("/api/analyses", { body: { documentId, type, regenerate } });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!data || data.status === "FAILED") {
    return (
      <Card>
        <p className="text-sm text-muted">{descriptions[type]}</p>
        <div className="mt-4 space-y-3">
          <ErrorNote error={actionError ?? error ?? data?.error} />
          <Button busy={busy} onClick={() => generate(true)}>{data ? "Try again" : "Generate"}</Button>
        </div>
      </Card>
    );
  }
  if (data.status === "PENDING") {
    return <Card><Loading label="Analysing the document" /></Card>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data.confidence >= 0.8 ? "success" : "warn"}>grounding {percent(data.confidence)}</Badge>
          <span>{data.provider} · {(data.durationMs / 1000).toFixed(1)}s</span>
          {data.fallbackUsed && <Badge tone="warn">no AI model: extractive result</Badge>}
          {data.sourceTruncated && <Badge tone="warn">only the first part of the document was analysed</Badge>}
        </div>
        <Button variant="ghost" size="sm" busy={busy} onClick={() => generate(true)}>Regenerate</Button>
      </div>
      <ErrorNote error={actionError} />
      <Card><Result analysis={data} /></Card>
    </div>
  );
}
