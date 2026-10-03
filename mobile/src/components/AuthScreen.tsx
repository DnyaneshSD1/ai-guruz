import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { Button, ErrorNote, Field, Screen, Segmented, T, errorMessage } from './ui';
import { useAuth } from '@/lib/providers';
import type { Role } from '@/lib/types';

type Workspace = 'personal' | 'join' | 'create';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>('personal');
  const [institutionName, setInstitutionName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          institutionName: workspace === 'create' ? institutionName.trim() : undefined,
          joinCode: workspace === 'join' ? joinCode.trim() : undefined,
          role: workspace === 'join' ? role : undefined,
        });
      }
      router.replace('/(tabs)');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ marginTop: 32, marginBottom: 12, gap: 6 }}>
          <T variant="label" muted>LearnMind AI</T>
          <T variant="title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</T>
          <T muted>{mode === 'login' ? 'Sign in to continue learning.' : 'Start with a personal workspace or your institution.'}</T>
        </View>

        {mode === 'register' && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={80} />}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          hint={mode === 'register' ? 'At least 8 characters, with a letter and a digit.' : undefined}
        />

        {mode === 'register' && (
          <>
            <View style={{ gap: 6 }}>
              <T variant="label">Workspace</T>
              <Segmented
                value={workspace}
                onChange={setWorkspace}
                options={[{ id: 'personal', label: 'Just me' }, { id: 'join', label: 'Join' }, { id: 'create', label: 'New institution' }]}
              />
            </View>
            {workspace === 'create' && (
              <Field label="Institution name" value={institutionName} onChangeText={setInstitutionName} hint="You become its administrator." maxLength={120} />
            )}
            {workspace === 'join' && (
              <>
                <Field label="Institution code" value={joinCode} onChangeText={(v) => setJoinCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} hint="Ask your administrator or teacher for the 8-character code." />
                <View style={{ gap: 6 }}>
                  <T variant="label">I am a</T>
                  <Segmented value={role} onChange={setRole} options={[{ id: 'STUDENT', label: 'Student' }, { id: 'RESEARCHER', label: 'Researcher' }]} />
                </View>
              </>
            )}
          </>
        )}

        <ErrorNote error={error} />
        <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} busy={busy} disabled={!email || !password || (mode === 'register' && !name)} />
        <Pressable accessibilityRole="link" onPress={() => router.replace(mode === 'login' ? '/register' : '/login')} style={{ alignItems: 'center', padding: 8 }}>
          <T muted>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</T>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
