"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Bar, Button, Card, ErrorNote, Loading, Textarea, cx, masteryTone, percent } from "./ui";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/types";

const decisionCopy = {
  ADVANCE: { label: "Advance", tone: "success" as const },
  LATERAL: { label: "Practice detour added", tone: "warn" as const },
  REMEDIAL: { label: "Reinforcement added", tone: "danger" as const },
};

/** Quiz for one module: generate, answer, submit, then show per-concept results and the path decision. */
export function Quiz({ curriculumId, moduleId }: { curriculumId: string; moduleId: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selectedIndex?: number; text?: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Assessment>) {
    setBusy(true);
    setError(null);
    try {
      setAssessment(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(() => api<Assessment>("/api/assessments", { body: { curriculumId, moduleId } }));
  const submit = () =>
    run(() =>
      api<Assessment>(`/api/assessments/${assessment!.id}/submit`, {
        body: { answers: assessment!.questions.map((q) => ({ questionId: q.id, ...answers[q.id] })) },
      }),
    );

  if (!assessment) {
    return (
      <Card>
        <h2 className="font-medium">Check your understanding</h2>
        <p className="mt-1 text-sm text-muted">A short quiz and one written task. Your result decides what comes next on your path.</p>
        <div className="mt-4 space-y-3">
          <ErrorNote error={error} />
          {busy ? <Loading label="Writing your quiz" /> : <Button onClick={start}>Take the quiz</Button>}
        </div>
      </Card>
    );
  }

  const submitted = assessment.status === "SUBMITTED";
  const complete = assessment.questions.every((q) =>
    q.type === "MCQ" ? answers[q.id]?.selectedIndex !== undefined : (answers[q.id]?.text ?? "").trim().length > 0,
  );

  return (
    <div className="space-y-4">
      {submitted && assessment.decision && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Your score</p>
              <p className="text-3xl font-semibold tabular-nums">{percent(assessment.score)}</p>
            </div>
            <Badge tone={decisionCopy[assessment.decision].tone}>{decisionCopy[assessment.decision].label}</Badge>
          </div>
          <p className="mt-3 text-sm">{assessment.message}</p>
          <div className="mt-4 space-y-2">
            {assessment.conceptScores.map((concept) => (
              <div key={concept.concept} className="grid grid-cols-[1fr_120px_40px] items-center gap-3 text-sm">
                <span className="truncate">{concept.concept}</span>
                <Bar value={concept.score} tone={masteryTone(concept.score)} />
                <span className="text-right tabular-nums text-muted">{percent(concept.score)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {assessment.nextModuleId && (
              <Link href={`/app/learn/${curriculumId}/module/${assessment.nextModuleId}`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg">
                Next module
              </Link>
            )}
            <Link href={`/app/learn/${curriculumId}`} className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-hover">
              Back to path
            </Link>
          </div>
        </Card>
      )}

      {assessment.questions.map((question, index) => {
        const result = assessment.results.find((r) => r.questionId === question.id);
        const given = submitted ? assessment.answers.find((a) => a.questionId === question.id) : answers[question.id];
        return (
          <Card key={question.id}>
            <p className="text-xs text-muted">Question {index + 1} · {question.concept}</p>
            <p className="mt-1 whitespace-pre-line font-medium">{question.prompt}</p>
            {question.type === "MCQ" ? (
              <div className="mt-3 space-y-2">
                {question.options.map((option, optionIndex) => {
                  const selected = given?.selectedIndex === optionIndex;
                  const correct = submitted && question.correctIndex === optionIndex;
                  return (
                    <button
                      key={optionIndex}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [question.id]: { selectedIndex: optionIndex } }))}
                      className={cx(
                        "block w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                        !submitted && "cursor-pointer hover:border-fg",
                        correct ? "border-success text-success" : selected && submitted ? "border-danger text-danger" : selected ? "border-fg bg-hover" : "border-border",
                      )}
                    >
                      {option}
                      {correct && " ✓"}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Textarea
                className="mt-3"
                rows={5}
                disabled={submitted}
                value={given?.text ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [question.id]: { text: e.target.value } }))}
                placeholder="Write your answer"
              />
            )}
            {submitted && result && (
              <p className="mt-3 text-sm text-muted">
                {question.type === "SHORT" && <span className="mr-2 font-medium text-fg">{percent(result.score)}</span>}
                {result.feedback}
              </p>
            )}
          </Card>
        );
      })}

      {!submitted && (
        <div className="space-y-3">
          <ErrorNote error={error} />
          <Button onClick={submit} busy={busy} disabled={!complete}>Submit answers</Button>
          {assessment.fallbackUsed && <p className="text-xs text-muted">This quiz was generated without an AI model.</p>}
        </div>
      )}
    </div>
  );
}
