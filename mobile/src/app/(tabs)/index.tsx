import { router } from 'expo-router';

import { Badge, Bar, Card, Empty, ErrorNote, Loading, Screen, T, percent, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Progress, Recommendation } from '@/lib/types';

const labels = { CONTINUE: 'Continue', REVIEW: 'Review', EXPLORE: 'Explore', START: 'Start' };

function open(item: Recommendation) {
  if (item.curriculumId && item.moduleId) router.push(`/module/${item.curriculumId}/${item.moduleId}`);
  else if (item.curriculumId) router.push({ pathname: '/knowledge', params: { curriculum: item.curriculumId } });
  else router.push({ pathname: '/(tabs)/learn', params: item.topic ? { topic: item.topic } : {} });
}

export default function Home() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(
    () => Promise.all([api<Recommendation[]>('/api/learning/recommendations'), api<Progress[]>('/api/learning/progress')]),
    [],
  );
  const [recommendations, progress] = data ?? [[], []];

  return (
    <Screen onRefresh={reload}>
      <T variant="title">Hello, {user?.name.split(' ')[0]}</T>
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <T variant="label" muted>Recommended for you</T>
          {recommendations.map((item, index) => (
            <Card key={index} onPress={() => open(item)}>
              <Badge label={labels[item.type]} tone={item.type === 'CONTINUE' ? 'solid' : 'neutral'} />
              <T variant="heading">{item.title}</T>
              <T muted>{item.detail}</T>
            </Card>
          ))}

          <T variant="label" muted style={{ marginTop: 8 }}>Your learning paths</T>
          {progress.length === 0 ? (
            <Empty title="No learning paths yet" body="Open the Learn tab and name any topic to start." />
          ) : (
            progress.map((path) => (
              <Card key={path.curriculumId} onPress={() => router.push(`/curriculum/${path.curriculumId}`)}>
                <T variant="heading">{path.topic}</T>
                <T muted>{path.completedModules} of {path.totalModules} modules · average score {percent(path.averageScore)}</T>
                <Bar value={path.totalModules ? path.completedModules / path.totalModules : 0} />
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}
