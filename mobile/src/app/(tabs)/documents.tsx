import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Badge, Button, Card, Empty, ErrorNote, Loading, Screen, Segmented, T, errorMessage, formatDate, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Doc } from '@/lib/types';

type Scope = 'mine' | 'shared' | 'all';

const ACCEPTED = [
  'application/pdf', 'text/plain', 'text/markdown', 'text/html', 'application/rtf', 'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export default function Documents() {
  const { hasRole } = useAuth();
  const [scope, setScope] = useState<Scope>('mine');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    () => api<Doc[]>(`/api/documents?scope=${scope}`),
    [scope],
    (docs) => docs.some((d) => d.status === 'PROCESSING'),
  );

  const scopes: { id: Scope; label: string }[] = [
    { id: 'mine', label: 'Mine' },
    { id: 'shared', label: 'Library' },
    ...(hasRole('LIBRARIAN', 'ADMIN') ? [{ id: 'all' as Scope, label: 'All' }] : []),
  ];

  async function upload() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ACCEPTED, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) {
        form.append('file', asset.file);
      } else {
        // React Native's FormData takes a file descriptor rather than a Blob.
        form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      }
      await api<Doc>('/api/documents', { form });
      setScope('mine');
      await reload();
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen onRefresh={reload}>
      <T variant="title">Documents</T>
      <T muted>Upload course material to get summaries, mind maps, deep analysis and exam preparation.</T>
      <Button title="Upload document" onPress={upload} busy={uploading} />
      <ErrorNote error={uploadError} />
      <Segmented value={scope} onChange={setScope} options={scopes} />
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title={scope === 'mine' ? 'No documents yet' : 'Nothing here yet'}
          body={scope === 'mine' ? 'PDF, Word, PowerPoint, text and Markdown files up to 25 MB.' : 'Documents shared by teachers and librarians appear here.'}
        />
      ) : (
        data.map((doc) => (
          <Card key={doc.id} onPress={() => router.push(`/document/${doc.id}`)}>
            <T variant="heading">{doc.title}</T>
            <T variant="small" muted>
              {doc.filename} · {formatDate(doc.createdAt)}{scope !== 'mine' ? ` · ${doc.ownerName}` : ''}
            </T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {doc.visibility === 'SHARED' && <Badge label="shared" />}
              {doc.status === 'PROCESSING' && <Badge label="processing" />}
              {doc.status === 'FAILED' && <Badge label="failed" tone="danger" />}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
