"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Card, Empty, ErrorNote, Loading, PageHeader, Select, percent, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Curriculum, Graph, GraphNode } from "@/lib/types";

const ROW = 30;
const MODULE_X = 24;
const MODULE_W = 250;
const CONCEPT_X = 400;

const masteryColor = (m: number | null) => (m == null ? "var(--border)" : m >= 0.8 ? "var(--success)" : m >= 0.5 ? "var(--warn)" : "var(--danger)");
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Modules run down the left in path order; each links to the concepts it teaches, coloured by mastery. */
function GraphView({ graph }: { graph: Graph }) {
  const modules = graph.nodes.filter((n) => n.type === "MODULE");
  const concepts = graph.nodes.filter((n) => n.type === "CONCEPT");
  const conceptY = new Map(concepts.map((c, i) => [c.id, 28 + i * ROW]));
  const teaches = graph.edges.filter((e) => e.type === "TEACHES");

  // A module sits at the average height of its concepts, but never above the previous module.
  const moduleY = new Map<string, number>();
  let floor = 28;
  for (const m of modules) {
    const ys = teaches.filter((e) => e.from === m.id).map((e) => conceptY.get(e.to) ?? 0);
    const y = Math.max(floor, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : floor);
    moduleY.set(m.id, y);
    floor = y + 44;
  }
  const height = Math.max(floor, 28 + concepts.length * ROW) + 10;

  const moduleStyle = (m: GraphNode) =>
    m.status === "COMPLETED" ? { fill: "var(--fg)", text: "var(--bg)" } : { fill: "var(--card)", text: m.status === "LOCKED" ? "var(--muted)" : "var(--fg)" };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 760 ${height}`} width="760" height={height} role="img" aria-label={`Knowledge graph for ${graph.topic}`} className="text-xs">
        {modules.slice(1).map((m, i) => (
          <line key={m.id} x1={MODULE_X + 16} y1={moduleY.get(modules[i].id)! + 16} x2={MODULE_X + 16} y2={moduleY.get(m.id)! - 16} stroke="var(--border)" strokeWidth="2" />
        ))}
        {teaches.map((e, i) => (
          <path
            key={i}
            d={`M ${MODULE_X + MODULE_W} ${moduleY.get(e.from)} C ${CONCEPT_X - 60} ${moduleY.get(e.from)}, ${CONCEPT_X - 60} ${conceptY.get(e.to)}, ${CONCEPT_X - 8} ${conceptY.get(e.to)}`}
            fill="none"
            stroke="var(--border)"
          />
        ))}
        {modules.map((m) => {
          const style = moduleStyle(m);
          return (
            <g key={m.id}>
              <rect x={MODULE_X} y={moduleY.get(m.id)! - 16} width={MODULE_W} height={32} rx={8} fill={style.fill} stroke={m.status === "AVAILABLE" ? "var(--fg)" : "var(--border)"} strokeDasharray={m.kind !== "CORE" ? "4 3" : undefined} />
              <text x={MODULE_X + 12} y={moduleY.get(m.id)! + 4} fill={style.text}>
                {clip(m.label, 36)}
                <title>{m.label}</title>
              </text>
            </g>
          );
        })}
        {concepts.map((c) => (
          <g key={c.id}>
            <circle cx={CONCEPT_X} cy={conceptY.get(c.id)} r={6} fill={c.mastery == null ? "var(--bg)" : masteryColor(c.mastery)} stroke={masteryColor(c.mastery)} strokeWidth="2" />
            <text x={CONCEPT_X + 14} y={conceptY.get(c.id)! + 4} fill="var(--fg)">
              {clip(c.label, 40)}
              <tspan fill="var(--muted)">{c.mastery == null ? "" : `  ${percent(c.mastery)}`}</tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function KnowledgeContent() {
  const requested = useSearchParams().get("curriculum");
  const [selected, setSelected] = useState<string | null>(requested);
  const curricula = useLoad(async () => (await api<Curriculum[]>("/api/curricula")).filter((c) => c.status === "READY"), []);
  const current = selected ?? curricula.data?.[0]?.id ?? null;
  const graph = useLoad(() => (current ? api<Graph>(`/api/learning/knowledge-graph?curriculumId=${current}`) : Promise.resolve(null)), [current]);

  const concepts = graph.data?.nodes.filter((n) => n.type === "CONCEPT") ?? [];
  const assessed = concepts.filter((c) => c.mastery != null);

  return (
    <>
      <PageHeader
        title="Knowledge graph"
        subtitle="What you know, concept by concept. Mastery updates after every quiz."
        action={
          !!curricula.data?.length && (
            <Select value={current ?? ""} onChange={(e) => setSelected(e.target.value)} className="w-64">
              {curricula.data.map((c) => <option key={c.id} value={c.id}>{c.topic}</option>)}
            </Select>
          )
        }
      />
      <ErrorNote error={curricula.error ?? graph.error} />
      {curricula.loading || graph.loading ? (
        <Loading />
      ) : !graph.data ? (
        <Empty title="No knowledge graph yet" body="Create a learning path and take a quiz to start building your graph." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
            <span>{assessed.length} of {concepts.length} concepts assessed</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-success" /> mastered (80%+)</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-warn" /> developing</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-danger" /> needs work</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border-2 border-border" /> not assessed</span>
          </div>
          <Card><GraphView graph={graph.data} /></Card>
        </div>
      )}
    </>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<Loading />}>
      <KnowledgeContent />
    </Suspense>
  );
}
