import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Badge, Bar, Button, Card, Empty, ErrorNote, Field, Loading, Screen, Segmented, T, errorMessage, formatDate, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Curriculum } from '@/lib/types';

type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export default function Learn() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const { hasRole } = useAuth();
  const [scope, setScope] = useState<'mine' | 'tenant'>('mine');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState<Level>('BEGINNER');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (params.topic) setTopic(params.topic);
  }, [params.topic]);

  const { data, error, loading, reload } = useLoad(
    () => api<Curriculum[]>(`/api/curricula${scope === 'tenant' ? '?scope=tenant' : ''}`),
    [scope],
    (list) => list.some((c) => c.status === 'GENERATING'),
  );

  async function create() {
    setBusy(true);
    setFormError(null);
    try {
      const created = await api<Curriculum>('/api/curricula', { body: { topic: topic.trim(), goal: goal.trim() || undefined, level } });
      setTopic('');
      setGoal('');
      reload();
      router.push(`/curriculum/${created.id}`);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen onRefresh={reload}>
      <T variant="title">Learn</T>
      <T muted>Name a topic. AI Guruz researches it and plans your path from beginner to expert.</T>

      <Card style={{ gap: 12 }}>
        <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Machine learning" maxLength={200} />
        <Field label="Goal (optional)" value={goal} onChangeText={setGoal} placeholder="e.g. Pass my final exam" maxLength={500} />
        <View style={{ gap: 6 }}>
          <T variant="label">Start at</T>
          <Segmented
            value={level}
            onChange={setLevel}
            options={[{ id: 'BEGINNER', label: 'Beginner' }, { id: 'INTERMEDIATE', label: 'Intermediate' }, { id: 'ADVANCED', label: 'Advanced' }]}
          />
        </View>
        <ErrorNote error={formError} />
        <Button title="Create path" onPress={create} busy={busy} disabled={!topic.trim()} />
      </Card>

      {hasRole('TEACHER', 'ADMIN') && (
        <Segmented value={scope} onChange={setScope} options={[{ id: 'mine', label: 'My paths' }, { id: 'tenant', label: 'All learners' }]} />
      )}
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No learning paths yet" body="Create your first path above." />
      ) : (
        data.map((curriculum) => {
          const done = curriculum.modules.filter((m) => m.status === 'COMPLETED').length;
          return (
            <Card key={curriculum.id} onPress={() => router.push(`/curriculum/${curriculum.id}`)}>
              <T variant="heading">{curriculum.topic}</T>
              {curriculum.status === 'GENERATING' && <Badge label="planning" />}
              {curriculum.status === 'FAILED' && <Badge label="failed" tone="danger" />}
              <T muted>
                {scope === 'tenant' ? `${curriculum.userName} · ` : ''}
                {curriculum.status === 'READY' ? `${done} of ${curriculum.modules.length} modules` : 'Researching and planning'} · {formatDate(curriculum.createdAt)}
              </T>
              {curriculum.status === 'READY' && <Bar value={curriculum.modules.length ? done / curriculum.modules.length : 0} />}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
