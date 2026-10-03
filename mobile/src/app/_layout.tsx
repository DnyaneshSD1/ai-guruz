import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Providers, useTheme } from '@/lib/providers';

function Navigator() {
  const { colors, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.fg,
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="curriculum/[id]" options={{ title: 'Learning path' }} />
        <Stack.Screen name="module/[curriculumId]/[moduleId]" options={{ title: 'Module' }} />
        <Stack.Screen name="document/[id]" options={{ title: 'Document' }} />
        <Stack.Screen name="knowledge" options={{ title: 'Knowledge graph' }} />
        <Stack.Screen name="admin/users" options={{ title: 'Users' }} />
        <Stack.Screen name="admin/audit" options={{ title: 'Audit log' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <Navigator />
    </Providers>
  );
}
