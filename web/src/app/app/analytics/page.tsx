"use client";

import { useState } from "react";
import { Columns, Donut, Rows, TrendLine } from "@/components/charts";
import { useAuth } from "@/components/Providers";
import { Badge, Card, ErrorNote, Loading, PageHeader, Select, Stat, Tabs, formatDateTime, percent, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Dashboard, Timing } from "@/lib/types";

const seconds = (ms: number | null) => (ms == null ? "–" : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);

function ActivityChart({ data }: { data: Dashboard["activity"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]">
        {data.map((day) => (
          <div key={day.date} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-sm bg-fg transition group-hover:opacity-70" style={{ height: `${Math.max(day.count ? 6 : 1.5, (day.count / max) * 100)}%`, opacity: day.count ? undefined : 0.15 }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-fg px-1.5 py-0.5 text-[10px] text-bg group-hover:block">
              {day.date.slice(5)}: {day.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function TimingRow({ label, timing }: { label: string; timing: Timing }) {
  const met = timing.averageMs != null && timing.averageMs <= timing.targetMs;
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        {seconds(timing.averageMs)} <span className="text-muted">/ target {seconds(timing.targetMs)}</span>
        {timing.samples > 0 && <Badge tone={met ? "success" : "warn"}>{met ? "on target" : "over target"}</Badge>}
      </span>
    </div>
  );
}

export default function AnalyticsPage() {
  const { hasRole } = useAuth();
  const canSeeTenant = hasRole("TEACHER", "ADMIN");
  const [scope, setScope] = useState<"me" | "tenant">("me");
  const [days, setDays] = useState("30");
  const { data, error, loading } = useLoad(() => api<Dashboard>(`/api/analytics/dashboard?scope=${scope}&days=${days}`), [scope, days]);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={scope === "tenant" ? "Activity across your institution." : "Your own learning activity."}
        action={
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-36">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        }
      />
      {canSeeTenant && (
        <div className="mb-5">
          <Tabs tabs={[{ id: "me", label: "Me" }, { id: "tenant", label: "Institution" }]} value={scope} onChange={setScope} />
        </div>
      )}
      <ErrorNote error={error} />
      {loading || !data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Documents" value={data.totals.documents} />
            <Stat label="Analyses" value={data.totals.analyses} />
            <Stat label="Learning paths" value={data.totals.curricula} />
            <Stat label="Quizzes taken" value={data.totals.assessments} hint={`Average score ${percent(data.averageScore)}`} />
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-medium text-muted">Learning activity per day</h2>
            <ActivityChart data={data.activity} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-medium text-muted">What the activity was</h2>
              <p className="mb-4 mt-1 text-xs text-muted">Share of each kind of work in this period.</p>
              <Donut
                unit="actions"
                slices={[
                  { label: "Documents uploaded", value: data.totals.documents },
                  { label: "Analyses run", value: data.totals.analyses },
                  { label: "Learning paths created", value: data.totals.curricula },
                  { label: "Quizzes taken", value: data.totals.assessments },
                ]}
              />
            </Card>
            <Card>
              <h2 className="text-sm font-medium text-muted">Path decisions</h2>
              <p className="mb-4 mt-1 text-xs text-muted">
                How quiz results changed the path. Divergence from the default path: <span className="font-medium text-fg">{percent(data.pathDivergence)}</span>
              </p>
              <Donut
                unit="decisions"
                slices={[
                  { label: "Advance", value: data.decisions.ADVANCE },
                  { label: "Practice detour", value: data.decisions.LATERAL },
                  { label: "Reinforcement", value: data.decisions.REMEDIAL },
                ]}
              />
            </Card>
            <Card>
              <h2 className="mb-4 text-sm font-medium text-muted">Quiz score over time</h2>
              <TrendLine label="Average quiz score" points={(data.scoreTrend ?? []).map((day) => ({ date: day.date, value: day.averageScore }))} />
            </Card>
            <Card>
              <h2 className="text-sm font-medium text-muted">Quiz score distribution</h2>
              <p className="mb-4 mt-1 text-xs text-muted">Number of quizzes in each score band.</p>
              <Columns unit="Quizzes per score band" bars={(data.scoreDistribution ?? []).map((band) => ({ label: band.label, value: band.count }))} />
            </Card>
            <Card>
              <h2 className="mb-4 text-sm font-medium text-muted">Analyses by type</h2>
              <Rows
                bars={[
                  { label: "Summary", value: data.analysesByType?.SUMMARY ?? 0 },
                  { label: "Mind map", value: data.analysesByType?.MIND_MAP ?? 0 },
                  { label: "Deep analysis", value: data.analysesByType?.DEEP_ANALYSIS ?? 0 },
                  { label: "Exam prep", value: data.analysesByType?.EXAM_PREP ?? 0 },
                ]}
              />
            </Card>
            <Card>
              <h2 className="text-sm font-medium text-muted">AI performance</h2>
              <div className="mt-2 divide-y divide-border">
                <TimingRow label="Document analysis" timing={data.analysisTiming} />
                <TimingRow label="Curriculum generation" timing={data.curriculumTiming} />
                <div className="flex items-center justify-between py-2 text-sm">
                  <span>Analysis grounding</span>
                  <span className="tabular-nums">{percent(data.averageConfidence)} <span className="text-muted">/ target 92%</span></span>
                </div>
              </div>
            </Card>
          </div>

          {scope === "tenant" && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Learners ({data.totals.activeLearners} active)</h2>
              {data.learners.length === 0 ? (
                <p className="text-sm text-muted">No learner activity in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr><th className="pb-2 font-normal">Learner</th><th className="pb-2 font-normal">Quizzes</th><th className="pb-2 font-normal">Average score</th><th className="pb-2 font-normal">Last active</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.learners.map((learner) => (
                        <tr key={learner.userId}>
                          <td className="py-2 font-medium">{learner.name}</td>
                          <td className="py-2 tabular-nums">{learner.assessments}</td>
                          <td className="py-2 tabular-nums">{percent(learner.averageScore)}</td>
                          <td className="py-2 text-muted">{formatDateTime(learner.lastActive)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
