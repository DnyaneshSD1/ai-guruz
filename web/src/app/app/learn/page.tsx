"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Bar, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Spinner, Tabs, formatDate, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Curriculum } from "@/lib/types";

function LearnContent() {
  const router = useRouter();
  const { hasRole } = useAuth();
  const canSeeLearners = hasRole("TEACHER", "ADMIN");
  const [scope, setScope] = useState<"mine" | "tenant">("mine");
  const [topic, setTopic] = useState(useSearchParams().get("topic") ?? "");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("BEGINNER");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, error, loading } = useLoad(
    () => api<Curriculum[]>(`/api/curricula${scope === "tenant" ? "?scope=tenant" : ""}`),
    [scope],
    (list) => list.some((c) => c.status === "GENERATING"),
  );

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const created = await api<Curriculum>("/api/curricula", { body: { topic, goal: goal || undefined, level } });
      router.push(`/app/learn/${created.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Learn" subtitle="Name a topic. AI Guruz researches it and plans your path from beginner to expert." />

      <Card className="mb-8">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-[2fr_2fr_1fr_auto] md:items-end">
          <Field label="Topic">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Machine learning" required maxLength={200} />
          </Field>
          <Field label="Goal (optional)">
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Pass my final exam" maxLength={500} />
          </Field>
          <Field label="Start at">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </Select>
          </Field>
          <Button type="submit" busy={busy}>Create path</Button>
        </form>
        <div className="mt-3"><ErrorNote error={formError} /></div>
      </Card>

      {canSeeLearners && (
        <div className="mb-5">
          <Tabs tabs={[{ id: "mine", label: "My paths" }, { id: "tenant", label: "All learners" }]} value={scope} onChange={setScope} />
        </div>
      )}
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No learning paths yet" body="Create your first path with the form above." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((curriculum) => {
            const done = curriculum.modules.filter((m) => m.status === "COMPLETED").length;
            return (
              <Link key={curriculum.id} href={`/app/learn/${curriculum.id}`}>
                <Card className="h-full transition hover:border-fg">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{curriculum.topic}</p>
                    {curriculum.status === "GENERATING" && <Badge><Spinner small />&nbsp;planning</Badge>}
                    {curriculum.status === "FAILED" && <Badge tone="danger">failed</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {scope === "tenant" && `${curriculum.userName} · `}
                    {curriculum.status === "READY" ? `${done} of ${curriculum.modules.length} modules` : "Researching and planning"} · {formatDate(curriculum.createdAt)}
                  </p>
                  {curriculum.status === "READY" && (
                    <div className="mt-4"><Bar value={curriculum.modules.length ? done / curriculum.modules.length : 0} /></div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LearnContent />
    </Suspense>
  );
}
