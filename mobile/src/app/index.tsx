import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Loading } from '@/components/ui';
import { useAuth, useTheme } from '@/lib/providers';

/** Entry point: waits for the stored session check, then routes to the app or to sign-in. */
export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <Loading />
      </View>
    );
  }
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
