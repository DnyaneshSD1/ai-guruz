import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useAuth, useTheme } from '@/lib/providers';

// Minimal line icons (24x24), drawn inline so the app needs no icon font.
const icons = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  learn: 'M3 7l9-4 9 4-9 4-9-4zm4 3v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  insights: 'M4 20V10M10 20V4M16 20v-8M21 20H3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};

function icon(name: keyof typeof icons) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d={icons[name]} stroke={color} strokeWidth={name === 'more' ? 3 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (!loading && !user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.fg,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('learn') }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: icon('documents') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('insights') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('more') }} />
    </Tabs>
  );
}
