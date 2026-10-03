import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Field, Screen, Segmented, T, errorMessage, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/lib/providers';
import type { Tenant } from '@/lib/types';

export default function More() {
  const { user, hasRole, logout } = useAuth();
  const { choice, setChoice } = useTheme();
  const tenant = useLoad(() => api<Tenant>('/api/tenants/me'), []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  async function changePassword() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/password', { body: { currentPassword, newPassword } });
      // Changing the password ends every session, including this one.
      await signOut();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function regenerateCode() {
    Alert.alert('New join code', 'The current code stops working.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Generate', onPress: async () => tenant.setData(await api<Tenant>('/api/tenants/me/join-code', { method: 'POST' })) },
    ]);
  }

  return (
    <Screen onRefresh={tenant.reload}>
      <T variant="title">More</T>

      <Card>
        <T variant="heading">{user?.name}</T>
        <T muted>{user?.email}</T>
        <Badge label={user?.role.toLowerCase() ?? ''} />
      </Card>

      <Card style={{ gap: 10 }}>
        <T variant="heading">Appearance</T>
        <Segmented
          value={choice}
          onChange={setChoice}
          options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }]}
        />
      </Card>

      <Card style={{ gap: 8 }}>
        <T variant="heading">{tenant.data?.personal ? 'Workspace' : 'Institution'}</T>
        <ErrorNote error={tenant.error} />
        {tenant.data && (
          <>
            <T muted>{tenant.data.name} · {tenant.data.members} member{tenant.data.members === 1 ? '' : 's'}</T>
            {tenant.data.joinCode && (
              <View style={{ gap: 6 }}>
                <T variant="small" muted>Join code (share with people who should join)</T>
                <T variant="heading" selectable style={{ letterSpacing: 5 }}>{tenant.data.joinCode}</T>
                {hasRole('ADMIN') && <Button title="New code" variant="secondary" small onPress={regenerateCode} style={{ alignSelf: 'flex-start' }} />}
              </View>
            )}
          </>
        )}
      </Card>

      {hasRole('ADMIN') && (
        <Card style={{ gap: 10 }}>
          <T variant="heading">Administration</T>
          <Button title="Users and roles" variant="secondary" onPress={() => router.push('/admin/users')} />
          <Button title="Audit log" variant="secondary" onPress={() => router.push('/admin/audit')} />
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        <T variant="heading">Change password</T>
        <Field label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" hint="At least 8 characters, with a letter and a digit. You will be signed out on all devices." />
        <ErrorNote error={error} />
        <Button title="Update password" variant="secondary" onPress={changePassword} busy={busy} disabled={!currentPassword || newPassword.length < 8} />
      </Card>

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}
