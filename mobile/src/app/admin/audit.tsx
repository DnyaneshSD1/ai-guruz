import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorNote, Loading, Screen, T, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { AuditPage } from '@/lib/types';

const PAGE_SIZE = 25;
const label = (type: string) => type.toLowerCase().replaceAll('_', ' ');
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Audit() {
  const { hasRole } = useAuth();
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useLoad(() => api<AuditPage>(`/api/audit-logs?page=${page}&size=${PAGE_SIZE}`), [page]);

  if (!hasRole('ADMIN')) return <Screen edges={[]}><Empty title="Administrators only" /></Screen>;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Screen edges={[]} onRefresh={reload}>
      <T muted>Security-relevant actions in your institution, newest first.</T>
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="No audit events" />
      ) : (
        <>
          {data.items.map((event) => {
            const details = Object.entries(event.metadata ?? {}).map(([key, value]) => `${key}=${String(value)}`).join('  ');
            return (
              <Card key={event.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T variant="label" style={{ flex: 1 }}>{label(event.type)}</T>
                  <T variant="small" muted>{when(event.timestamp)}</T>
                </View>
                <T variant="small" muted>{event.userName}</T>
                {!!details && <T variant="small" muted>{details}</T>}
              </Card>
            );
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Button title="Previous" variant="secondary" small disabled={page === 0} onPress={() => setPage(page - 1)} />
            <T variant="small" muted>{data.total} events · page {page + 1} of {pages}</T>
            <Button title="Next" variant="secondary" small disabled={page + 1 >= pages} onPress={() => setPage(page + 1)} />
          </View>
        </>
      )}
    </Screen>
  );
}
