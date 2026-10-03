import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Bar, Button, Card, ErrorNote, Field, Loading, T, errorMessage, masteryTone, percent } from './ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/providers';
import type { Assessment } from '@/lib/types';

const decisionCopy = {
  ADVANCE: { label: 'Advance', tone: 'success' as const },
  LATERAL: { label: 'Practice detour added', tone: 'warn' as const },
  REMEDIAL: { label: 'Reinforcement added', tone: 'danger' as const },
};

/** Quiz for one module: generate, answer, submit, then show per-concept results and the path decision. */
export function Quiz({ curriculumId, moduleId }: { curriculumId: string; moduleId: string }) {
  const { colors } = useTheme();
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
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(() => api<Assessment>('/api/assessments', { body: { curriculumId, moduleId } }));
  const submit = () =>
    run(() =>
      api<Assessment>(`/api/assessments/${assessment!.id}/submit`, {
        body: { answers: assessment!.questions.map((q) => ({ questionId: q.id, ...answers[q.id] })) },
      }),
    );

  if (!assessment) {
    return (
      <Card style={{ gap: 10 }}>
        <T variant="heading">Check your understanding</T>
        <T muted>A short quiz and one written task. Your result decides what comes next on your path.</T>
        <ErrorNote error={error} />
        {busy ? <Loading label="Writing your quiz" /> : <Button title="Take the quiz" onPress={start} />}
      </Card>
    );
  }

  const submitted = assessment.status === 'SUBMITTED';
  const complete = assessment.questions.every((q) =>
    q.type === 'MCQ' ? answers[q.id]?.selectedIndex !== undefined : (answers[q.id]?.text ?? '').trim().length > 0,
  );

  return (
    <View style={{ gap: 14 }}>
      {submitted && assessment.decision && (
        <Card style={{ gap: 10 }}>
          <T variant="small" muted>Your score</T>
          <T variant="title">{percent(assessment.score)}</T>
          <Badge label={decisionCopy[assessment.decision].label} tone={decisionCopy[assessment.decision].tone} />
          <T>{assessment.message}</T>
          {assessment.conceptScores.map((concept) => (
            <View key={concept.concept} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T variant="small" style={{ flex: 1 }}>{concept.concept}</T>
                <T variant="small" muted>{percent(concept.score)}</T>
              </View>
              <Bar value={concept.score} tone={masteryTone(concept.score)} />
            </View>
          ))}
          {assessment.nextModuleId && (
            <Button title="Next module" onPress={() => router.replace(`/module/${curriculumId}/${assessment.nextModuleId}`)} />
          )}
          <Button title="Back to path" variant="secondary" onPress={() => router.back()} />
        </Card>
      )}

      {assessment.questions.map((question, index) => {
        const result = assessment.results.find((r) => r.questionId === question.id);
        const given = submitted ? assessment.answers.find((a) => a.questionId === question.id) : answers[question.id];
        return (
          <Card key={question.id} style={{ gap: 10 }}>
            <T variant="small" muted>Question {index + 1} · {question.concept}</T>
            <T variant="label" style={{ fontSize: 15 }}>{question.prompt}</T>
            {question.type === 'MCQ' ? (
              question.options.map((option, optionIndex) => {
                const selected = given?.selectedIndex === optionIndex;
                const correct = submitted && question.correctIndex === optionIndex;
                const color = correct ? colors.success : selected && submitted ? colors.danger : selected ? colors.fg : colors.border;
                return (
                  <Pressable
                    key={optionIndex}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    disabled={submitted}
                    onPress={() => setAnswers((a) => ({ ...a, [question.id]: { selectedIndex: optionIndex } }))}
                    style={{ borderWidth: 1, borderColor: color, borderRadius: 10, padding: 12, backgroundColor: selected && !submitted ? colors.hover : 'transparent' }}
                  >
                    <T color={correct || (selected && submitted) ? color : undefined}>{option}{correct ? ' ✓' : ''}</T>
                  </Pressable>
                );
              })
            ) : (
              <Field
                label="Your answer"
                multiline
                numberOfLines={5}
                editable={!submitted}
                value={given?.text ?? ''}
                onChangeText={(text) => setAnswers((a) => ({ ...a, [question.id]: { text } }))}
                style={{ minHeight: 110 }}
              />
            )}
            {submitted && result && (
              <T variant="small" muted>{question.type === 'SHORT' ? `${percent(result.score)} · ` : ''}{result.feedback}</T>
            )}
          </Card>
        );
      })}

      {!submitted && (
        <>
          <ErrorNote error={error} />
          <Button title="Submit answers" onPress={submit} busy={busy} disabled={!complete} />
        </>
      )}
    </View>
  );
}
