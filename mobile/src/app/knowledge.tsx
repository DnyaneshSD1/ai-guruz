import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Bar, Card, Empty, ErrorNote, Loading, Screen, T, masteryTone, percent, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/providers';
import type { Curriculum, Graph } from '@/lib/types';

/**
 * On a phone the graph reads best as a path: each module in order, with the concepts it teaches
 * and their mastery underneath (the web app draws the same data as a node-link diagram).
 */
export default function Knowledge() {
  const params = useLocalSearchParams<{ curriculum?: string }>();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(params.curriculum ?? null);
  const curricula = useLoad(async () => (await api<Curriculum[]>('/api/curricula')).filter((c) => c.status === 'READY'), []);
  const current = selected ?? curricula.data?.[0]?.id ?? null;
  const graph = useLoad(() => (current ? api<Graph>(`/api/learning/knowledge-graph?curriculumId=${current}`) : Promise.resolve(null)), [current]);

  const nodes = new Map(graph.data?.nodes.map((n) => [n.id, n]) ?? []);
  const modules = graph.data?.nodes.filter((n) => n.type === 'MODULE') ?? [];
  const concepts = graph.data?.nodes.filter((n) => n.type === 'CONCEPT') ?? [];
  const assessed = concepts.filter((c) => c.mastery != null);

  return (
    <Screen edges={[]} onRefresh={graph.reload}>
      <T muted>What you know, concept by concept. Mastery updates after every quiz.</T>
      {!!curricula.data?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {curricula.data.map((c) => (
            <T
              key={c.id}
              accessibilityRole="button"
              onPress={() => setSelected(c.id)}
              variant="label"
              color={c.id === current ? colors.primaryFg : colors.muted}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: c.id === current ? colors.primary : colors.border, backgroundColor: c.id === current ? colors.primary : 'transparent' }}
            >
              {c.topic}
            </T>
          ))}
        </ScrollView>
      )}
      <ErrorNote error={curricula.error ?? graph.error} />
      {curricula.loading || graph.loading ? (
        <Loading />
      ) : !graph.data ? (
        <Empty title="No knowledge graph yet" body="Create a learning path and take a quiz to start building your graph." />
      ) : (
        <>
          <T variant="small" muted>{assessed.length} of {concepts.length} concepts assessed</T>
          {modules.map((module) => (
            <Card key={module.id} style={{ gap: 10, opacity: module.status === 'LOCKED' ? 0.6 : 1, marginLeft: module.kind === 'CORE' ? 0 : 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T variant="label" style={{ flex: 1, fontSize: 15 }}>{module.label}</T>
                <Badge label={(module.status ?? '').toLowerCase()} tone={module.status === 'COMPLETED' ? 'solid' : 'neutral'} />
              </View>
              {graph.data!.edges
                .filter((e) => e.type === 'TEACHES' && e.from === module.id)
                .map((e) => nodes.get(e.to)!)
                .map((concept) => (
                  <View key={concept.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <T variant="small" style={{ flex: 1 }}>{concept.label}</T>
                      <T variant="small" muted>{concept.mastery == null ? 'not assessed' : percent(concept.mastery)}</T>
                    </View>
                    <Bar value={concept.mastery ?? 0} tone={masteryTone(concept.mastery)} />
                  </View>
                ))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
