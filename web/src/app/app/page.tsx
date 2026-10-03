"use client";

import Link from "next/link";
import { useAuth } from "@/components/Providers";
import { Badge, Bar, Card, Empty, ErrorNote, Loading, PageHeader, percent, useLoad } from "@/components/ui";
import { api } from "@/lib/api";
import type { Progress, Recommendation } from "@/lib/types";

const recommendationLabel = { CONTINUE: "Continue", REVIEW: "Review", EXPLORE: "Explore", START: "Start" };

function recommendationHref(item: Recommendation) {
  if (item.curriculumId && item.moduleId) return `/app/learn/${item.curriculumId}/module/${item.moduleId}`;
  if (item.curriculumId) return `/app/knowledge?curriculum=${item.curriculumId}`;
  return item.topic ? `/app/learn?topic=${encodeURIComponent(item.topic)}` : "/app/learn";
}

export default function HomePage() {
  const { user } = useAuth();
  const { data, error, loading } = useLoad(
    () => Promise.all([api<Recommendation[]>("/api/learning/recommendations"), api<Progress[]>("/api/learning/progress")]),
    [],
  );
  const [recommendations, progress] = data ?? [[], []];

  return (
    <>
      <PageHeader title={`Hello, ${user?.name.split(" ")[0]}`} subtitle="Here is what to do next." />
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Recommended for you</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommendations.map((item, index) => (
                <Link key={index} href={recommendationHref(item)} className="group rounded-xl border border-border bg-card p-5 transition hover:border-fg">
                  <Badge tone={item.type === "CONTINUE" ? "solid" : "neutral"}>{recommendationLabel[item.type]}</Badge>
                  <p className="mt-3 font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted">Your learning paths</h2>
            {progress.length === 0 ? (
              <Empty
                title="No learning paths yet"
                body="Name any topic and AI Guruz will research it and plan a path from beginner to expert."
                action={<Link href="/app/learn" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg">Start a path</Link>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {progress.map((path) => (
                  <Link key={path.curriculumId} href={`/app/learn/${path.curriculumId}`}>
                    <Card className="h-full transition hover:border-fg">
                      <p className="font-medium">{path.topic}</p>
                      <p className="mt-1 text-sm text-muted">
                        {path.completedModules} of {path.totalModules} modules · average score {percent(path.averageScore)}
                      </p>
                      <div className="mt-4">
                        <Bar value={path.totalModules ? path.completedModules / path.totalModules : 0} />
                      </div>
                      {path.nextModuleTitle && <p className="mt-3 truncate text-xs text-muted">Next: {path.nextModuleTitle}</p>}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
