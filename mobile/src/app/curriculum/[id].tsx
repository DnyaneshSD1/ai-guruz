import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Pressable, View } from 'react-native';

import { Badge, Bar, Button, Card, ErrorNote, Loading, Screen, T, percent, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/lib/providers';
import type { Curriculum, Module } from '@/lib/types';

const kindLabel = { CORE: null, REMEDIAL: 'reinforcement', LATERAL: 'practice detour' };

function ModuleRow({ module, index, onPress }: { module: Module; index: number; onPress?: () => void }) {
  const { colors } = useTheme();
  const locked = module.status === 'LOCKED';
  const done = module.status === 'COMPLETED';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress || locked}
      onPress={onPress}
      style={{
        flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1,
        borderColor: colors.border, borderStyle: locked ? 'dashed' : 'solid',
        backgroundColor: locked ? 'transparent' : colors.card, opacity: locked ? 0.55 : 1,
        marginLeft: module.kind === 'CORE' ? 0 : 20,
      }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: done ? colors.fg : colors.border, backgroundColor: done ? colors.fg : 'transparent' }}>
        <T variant="small" color={done ? colors.bg : colors.muted}>{done ? '✓' : index + 1}</T>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="label" style={{ fontSize: 15 }}>{module.title}</T>
        {kindLabel[module.kind] && <Badge label={kindLabel[module.kind]!} tone="warn" />}
        <T variant="small" muted>{module.level.toLowerCase()} · {module.estimatedMinutes} min · {module.concepts.join(', ')}</T>
      </View>
      {done ? <T muted>{percent(module.score)}</T> : module.status === 'AVAILABLE' ? <Badge label="start" tone="solid" /> : <T variant="small" muted>locked</T>}
    </Pressable>
  );
}

export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: curriculum, error, loading, reload } = useLoad(() => api<Curriculum>(`/api/curricula/${id}`), [id], (c) => c.status === 'GENERATING');

  if (loading) return <Screen edges={[]}><Loading /></Screen>;
  if (!curriculum) return <Screen edges={[]}><ErrorNote error={error ?? 'Not found'} /></Screen>;

  const mine = curriculum.userId === user?.id;
  const done = curriculum.modules.filter((m) => m.status === 'COMPLETED').length;

  function remove() {
    Alert.alert('Delete this learning path?', 'Its progress is deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api(`/api/curricula/${id}`, { method: 'DELETE' }); router.back(); } },
    ]);
  }

  return (
    <Screen edges={[]} onRefresh={reload}>
      <T variant="title">{curriculum.topic}</T>
      {!mine && <T muted>Learner: {curriculum.userName} (read only)</T>}
      {curriculum.status === 'GENERATING' && <Card><Loading label="Researching the topic and planning your path. This can take a few minutes on a local model." /></Card>}
      {curriculum.status === 'FAILED' && <ErrorNote error={curriculum.error ?? 'Generation failed'} />}
      {curriculum.status === 'READY' && (
        <>
          <Card style={{ gap: 10 }}>
            <T>{curriculum.summary}</T>
            <Bar value={curriculum.modules.length ? done / curriculum.modules.length : 0} />
            <T variant="small" muted>{done} of {curriculum.modules.length} modules completed</T>
            {curriculum.fallbackUsed && <T variant="small" muted>Planned without an AI model, so the outline is generic.</T>}
          </Card>
          <Button title="Knowledge graph" variant="secondary" onPress={() => router.push({ pathname: '/knowledge', params: { curriculum: curriculum.id } })} />

          <T variant="label" muted>Your path</T>
          {curriculum.modules.map((module, index) => (
            <ModuleRow key={module.id} module={module} index={index} onPress={mine ? () => router.push(`/module/${curriculum.id}/${module.id}`) : undefined} />
          ))}

          {curriculum.sources.length > 0 && (
            <>
              <T variant="label" muted>Researched sources</T>
              {curriculum.sources.map((source) => (
                <T key={source.url} accessibilityRole="link" onPress={() => Linking.openURL(source.url)} style={{ textDecorationLine: 'underline' }}>{source.title}</T>
              ))}
            </>
          )}
        </>
      )}
      {mine && <Button title="Delete path" variant="danger" onPress={remove} />}
    </Screen>
  );
}
