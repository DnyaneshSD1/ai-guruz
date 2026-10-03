import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Bar, Button, Card, ErrorNote, Loading, Screen, Segmented, T, percent, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/lib/providers';
import type { Dashboard, Timing } from '@/lib/types';

const seconds = (ms: number | null) => (ms == null ? '–' : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card style={{ flexBasis: '47%', flexGrow: 1 }}>
      <T variant="small" muted>{label}</T>
      <T variant="title">{value}</T>
    </Card>
  );
}

function ActivityChart({ data }: { data: Dashboard['activity'] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View>
      <View style={{ height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {data.map((day) => (
          <View
            key={day.date}
            accessibilityLabel={`${day.date}: ${day.count}`}
            style={{ flex: 1, borderRadius: 2, backgroundColor: colors.fg, opacity: day.count ? 1 : 0.15, height: Math.max(2, (day.count / max) * 96) }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <T variant="small" muted>{data[0]?.date}</T>
        <T variant="small" muted>{data[data.length - 1]?.date}</T>
      </View>
    </View>
  );
}

function TimingRow({ label, timing }: { label: string; timing: Timing }) {
  const met = timing.averageMs != null && timing.averageMs <= timing.targetMs;
  return (
    <View style={{ gap: 4 }}>
      <T>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="small" muted>{seconds(timing.averageMs)} / target {seconds(timing.targetMs)}</T>
        {timing.samples > 0 && <Badge label={met ? 'on target' : 'over target'} tone={met ? 'success' : 'warn'} />}
      </View>
    </View>
  );
}

export default function Insights() {
  const { hasRole } = useAuth();
  const [scope, setScope] = useState<'me' | 'tenant'>('me');
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, error, loading, reload } = useLoad(() => api<Dashboard>(`/api/analytics/dashboard?scope=${scope}&days=${days}`), [scope, days]);
  const decisionTotal = data ? data.decisions.ADVANCE + data.decisions.LATERAL + data.decisions.REMEDIAL : 0;

  return (
    <Screen onRefresh={reload}>
      <T variant="title">Insights</T>
      <Button title="Open knowledge graph" variant="secondary" onPress={() => router.push('/knowledge')} />
      {hasRole('TEACHER', 'ADMIN') && (
        <Segmented value={scope} onChange={setScope} options={[{ id: 'me', label: 'Me' }, { id: 'tenant', label: 'Institution' }]} />
      )}
      <Segmented value={days} onChange={setDays} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />
      <ErrorNote error={error} />
      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Stat label="Documents" value={data.totals.documents} />
            <Stat label="Analyses" value={data.totals.analyses} />
            <Stat label="Learning paths" value={data.totals.curricula} />
            <Stat label="Quizzes" value={data.totals.assessments} />
          </View>
          <Card>
            <T variant="label" muted>Average quiz score</T>
            <T variant="title">{percent(data.averageScore)}</T>
          </Card>
          <Card style={{ gap: 12 }}>
            <T variant="label" muted>Learning activity per day</T>
            <ActivityChart data={data.activity} />
          </Card>
          <Card style={{ gap: 12 }}>
            <T variant="label" muted>Path decisions · divergence {percent(data.pathDivergence)}</T>
            {([['ADVANCE', 'Advance', 'success'], ['LATERAL', 'Practice detour', 'warn'], ['REMEDIAL', 'Reinforcement', 'danger']] as const).map(([key, label, tone]) => (
              <View key={key} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T>{label}</T>
                  <T muted>{data.decisions[key]}</T>
                </View>
                <Bar value={decisionTotal ? data.decisions[key] / decisionTotal : 0} tone={tone} />
              </View>
            ))}
          </Card>
          <Card style={{ gap: 12 }}>
            <T variant="label" muted>AI performance</T>
            <TimingRow label="Document analysis" timing={data.analysisTiming} />
            <TimingRow label="Curriculum generation" timing={data.curriculumTiming} />
            <T>Analysis grounding: {percent(data.averageConfidence)} <T muted>/ target 92%</T></T>
          </Card>
          {scope === 'tenant' && (
            <Card style={{ gap: 10 }}>
              <T variant="label" muted>Learners ({data.totals.activeLearners} active)</T>
              {data.learners.length === 0 && <T muted>No learner activity in this period.</T>}
              {data.learners.map((learner) => (
                <View key={learner.userId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T style={{ flex: 1 }}>{learner.name}</T>
                  <T muted>{learner.assessments} quizzes · {percent(learner.averageScore)}</T>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
