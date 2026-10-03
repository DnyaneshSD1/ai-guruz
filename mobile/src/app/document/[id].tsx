import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Loading, Screen, Segmented, T, errorMessage, percent, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/lib/providers';
import type { Analysis, AnalysisType, Doc, MindNode } from '@/lib/types';

const tabs: { id: AnalysisType; label: string }[] = [
  { id: 'SUMMARY', label: 'Summary' },
  { id: 'MIND_MAP', label: 'Mind map' },
  { id: 'DEEP_ANALYSIS', label: 'Analysis' },
  { id: 'EXAM_PREP', label: 'Exam prep' },
];

const descriptions: Record<AnalysisType, string> = {
  SUMMARY: 'An overview, the key points and the key terms of the document.',
  MIND_MAP: "The document's structure as a map of topics and sub-topics.",
  DEEP_ANALYSIS: 'Themes, insights, gaps and questions for further study.',
  EXAM_PREP: 'Flashcards, exam-style questions with model answers, and study tips.',
};

function Bullets({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" muted>{title}</T>
      {items.map((item, index) => <T key={index}>• {item}</T>)}
    </View>
  );
}

function MindBranch({ node, depth = 0 }: { node: MindNode; depth?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          alignSelf: 'flex-start', borderRadius: 8,
          paddingHorizontal: depth < 2 ? 10 : 0, paddingVertical: depth < 2 ? 5 : 0,
          backgroundColor: depth === 0 ? colors.primary : 'transparent',
          borderWidth: depth === 1 ? 1 : 0, borderColor: colors.fg,
        }}
      >
        <T variant={depth < 2 ? 'label' : 'body'} color={depth === 0 ? colors.primaryFg : undefined}>{node.label}</T>
      </View>
      {!!node.children?.length && (
        <View style={{ marginLeft: 10, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.border, gap: 8 }}>
          {node.children.map((child, index) => <MindBranch key={index} node={child} depth={depth + 1} />)}
        </View>
      )}
    </View>
  );
}

/** A card that flips between front and back when tapped (flashcards and practice questions). */
function Reveal({ front, back }: { front: string; back: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 6, backgroundColor: colors.bg }}>
      <T variant="label">{front}</T>
      {open ? <T muted>{back}</T> : <T variant="small" muted>Tap to show the answer</T>}
    </Pressable>
  );
}

function Result({ analysis }: { analysis: Analysis }) {
  const r = analysis.result;
  switch (analysis.type) {
    case 'SUMMARY':
      return (
        <View style={{ gap: 14 }}>
          <T>{r.overview}</T>
          <Bullets title="Key points" items={r.keyPoints} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {r.keywords?.map((k: string) => <Badge key={k} label={k} />)}
          </View>
        </View>
      );
    case 'MIND_MAP':
      return <MindBranch node={r.root} />;
    case 'DEEP_ANALYSIS':
      return (
        <View style={{ gap: 14 }}>
          {r.themes?.map((theme: { title: string; explanation: string }, index: number) => (
            <View key={index} style={{ gap: 2 }}>
              <T variant="label" style={{ fontSize: 15 }}>{theme.title}</T>
              <T muted>{theme.explanation}</T>
            </View>
          ))}
          <Bullets title="Insights" items={r.insights} />
          <Bullets title="Gaps and limitations" items={r.gaps} />
          <Bullets title="Questions for further study" items={r.questions} />
        </View>
      );
    case 'EXAM_PREP':
      return (
        <View style={{ gap: 10 }}>
          <T variant="label" muted>Flashcards</T>
          {r.flashcards?.map((card: { front: string; back: string }, index: number) => <Reveal key={`f${index}`} {...card} />)}
          <T variant="label" muted style={{ marginTop: 6 }}>Practice questions</T>
          {r.questions?.map((q: { question: string; answer: string }, index: number) => <Reveal key={`q${index}`} front={q.question} back={q.answer} />)}
          <Bullets title="Study tips" items={r.studyTips} />
        </View>
      );
  }
}

function AnalysisPanel({ documentId, type }: { documentId: string; type: AnalysisType }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    async () => (await api<Analysis[]>(`/api/analyses?documentId=${documentId}`)).find((a) => a.type === type) ?? null,
    [documentId, type],
    (analysis) => analysis?.status === 'PENDING',
  );

  async function generate() {
    setBusy(true);
    setActionError(null);
    try {
      await api<Analysis>('/api/analyses', { body: { documentId, type, regenerate: true } });
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!data || data.status === 'FAILED') {
    return (
      <Card style={{ gap: 10 }}>
        <T muted>{descriptions[type]}</T>
        <ErrorNote error={actionError ?? error ?? data?.error} />
        <Button title={data ? 'Try again' : 'Generate'} onPress={generate} busy={busy} />
      </Card>
    );
  }
  if (data.status === 'PENDING') return <Card><Loading label="Analysing the document" /></Card>;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Badge label={`grounding ${percent(data.confidence)}`} tone={data.confidence >= 0.8 ? 'success' : 'warn'} />
        {data.fallbackUsed && <Badge label="no AI model: extractive result" tone="warn" />}
        {data.sourceTruncated && <Badge label="first part of document only" tone="warn" />}
        <T variant="small" muted>{data.provider} · {(data.durationMs / 1000).toFixed(1)}s</T>
      </View>
      <ErrorNote error={actionError} />
      <Card><Result analysis={data} /></Card>
      <Button title="Regenerate" variant="secondary" small onPress={generate} busy={busy} style={{ alignSelf: 'flex-start' }} />
    </>
  );
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState<AnalysisType>('SUMMARY');
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: doc, error, loading, setData } = useLoad(() => api<Doc>(`/api/documents/${id}`), [id], (d) => d.status === 'PROCESSING');

  if (loading) return <Screen edges={[]}><Loading /></Screen>;
  if (!doc) return <Screen edges={[]}><ErrorNote error={error ?? 'Not found'} /></Screen>;

  const canManage = doc.ownerId === user?.id || hasRole('LIBRARIAN', 'ADMIN');
  const canShare = canManage && hasRole('TEACHER', 'LIBRARIAN', 'ADMIN');

  async function toggleShare() {
    setActionError(null);
    try {
      setData(await api<Doc>(`/api/documents/${id}`, { method: 'PATCH', body: { visibility: doc!.visibility === 'SHARED' ? 'PRIVATE' : 'SHARED' } }));
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  function remove() {
    Alert.alert('Delete this document?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api(`/api/documents/${id}`, { method: 'DELETE' }); router.back(); } },
    ]);
  }

  return (
    <Screen edges={[]}>
      <T variant="title">{doc.title}</T>
      <T variant="small" muted>{doc.filename} · uploaded by {doc.ownerName}</T>
      {doc.visibility === 'SHARED' && <Badge label="shared with institution" />}
      <ErrorNote error={actionError} />
      {(canShare || canManage) && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canShare && <Button title={doc.visibility === 'SHARED' ? 'Unshare' : 'Share'} variant="secondary" small onPress={toggleShare} />}
          {canManage && <Button title="Delete" variant="danger" small onPress={remove} />}
        </View>
      )}

      {doc.status === 'PROCESSING' && <Card><Loading label="Extracting text from the document" /></Card>}
      {doc.status === 'FAILED' && <ErrorNote error={doc.error ?? 'The document could not be processed'} />}
      {doc.status === 'READY' && (
        <>
          <Segmented value={tab} onChange={setTab} options={tabs} />
          <AnalysisPanel key={tab} documentId={doc.id} type={tab} />
        </>
      )}
    </Screen>
  );
}
