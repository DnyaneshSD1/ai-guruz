import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Quiz } from '@/components/Quiz';
import { Badge, Card, ErrorNote, Loading, Markdown, Screen, T, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import type { Module } from '@/lib/types';

export default function ModuleScreen() {
  const { curriculumId, moduleId } = useLocalSearchParams<{ curriculumId: string; moduleId: string }>();
  // The lesson is written by the model the first time the module is opened, so this request can be slow.
  const { data: lesson, error, loading } = useLoad(() => api<Module>(`/api/curricula/${curriculumId}/modules/${moduleId}`), [curriculumId, moduleId]);

  return (
    <Screen edges={[]}>
      {loading ? (
        <Loading label="Preparing your lesson" />
      ) : !lesson ? (
        <ErrorNote error={error ?? 'Not found'} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Badge label={lesson.level.toLowerCase()} />
            {lesson.kind === 'REMEDIAL' && <Badge label="reinforcement" tone="warn" />}
            {lesson.kind === 'LATERAL' && <Badge label="practice detour" tone="warn" />}
          </View>
          <T variant="title">{lesson.title}</T>
          <Card>
            <T variant="small" muted>You will be able to</T>
            {lesson.objectives.map((objective) => <T key={objective}>• {objective}</T>)}
          </Card>
          <Markdown>{lesson.content ?? ''}</Markdown>
          <Quiz key={lesson.id} curriculumId={curriculumId} moduleId={lesson.id} />
        </>
      )}
    </Screen>
  );
}
