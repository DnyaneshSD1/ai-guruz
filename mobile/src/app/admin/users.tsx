import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Button, Card, Empty, ErrorNote, Field, Loading, Screen, T, errorMessage, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/lib/providers';
import type { Role, User } from '@/lib/types';

const roles: Role[] = ['STUDENT', 'RESEARCHER', 'TEACHER', 'LIBRARIAN', 'ADMIN'];

function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {roles.map((role) => {
        const active = role === value;
        return (
          <T
            key={role}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            onPress={disabled || active ? undefined : () => onChange(role)}
            variant="small"
            color={active ? colors.primaryFg : colors.muted}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent', opacity: disabled && !active ? 0.4 : 1 }}
          >
            {role.toLowerCase()}
          </T>
        );
      })}
    </ScrollView>
  );
}

export default function Users() {
  const { user: me, hasRole } = useAuth();
  const { data: users, error, loading, reload } = useLoad(() => api<User[]>('/api/users'), []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!hasRole('ADMIN')) return <Screen edges={[]}><Empty title="Administrators only" /></Screen>;

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await reload();
      return true;
    } catch (e) {
      setActionError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (await act(() => api('/api/users', { body: { name: name.trim(), email: email.trim(), password, role } }))) {
      setName('');
      setEmail('');
      setPassword('');
      setShowForm(false);
    }
  }

  return (
    <Screen edges={[]} onRefresh={reload}>
      <T muted>Everyone in {me?.tenantName}. Role changes take effect at the user's next sign-in.</T>
      <Button title={showForm ? 'Cancel' : 'Add user'} variant={showForm ? 'secondary' : 'primary'} onPress={() => setShowForm((s) => !s)} />
      {showForm && (
        <Card style={{ gap: 12 }}>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Temporary password" value={password} onChangeText={setPassword} autoCapitalize="none" hint="At least 8 characters, with a letter and a digit." />
          <RolePicker value={role} onChange={setRole} />
          <Button title="Create user" onPress={create} busy={busy} disabled={!name || !email || password.length < 8} />
        </Card>
      )}
      <ErrorNote error={actionError ?? error} />
      {loading ? (
        <Loading />
      ) : (
        users?.map((user) => {
          const self = user.id === me?.id;
          return (
            <Card key={user.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T variant="heading">{user.name}{self ? ' (you)' : ''}</T>
                  <T variant="small" muted>{user.email}</T>
                </View>
                <Badge label={user.active ? 'active' : 'deactivated'} tone={user.active ? 'success' : 'danger'} />
              </View>
              <RolePicker value={user.role} disabled={self || busy} onChange={(next) => act(() => api(`/api/users/${user.id}`, { method: 'PATCH', body: { role: next } }))} />
              {!self && (
                <Button
                  title={user.active ? 'Deactivate' : 'Activate'}
                  variant={user.active ? 'danger' : 'secondary'}
                  small
                  disabled={busy}
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => act(() => api(`/api/users/${user.id}`, { method: 'PATCH', body: { active: !user.active } }))}
                />
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
