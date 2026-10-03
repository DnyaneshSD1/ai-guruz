import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { T } from './ui';
import { useTheme } from '@/lib/providers';

/**
 * The AI Guruz mark: a letter G drawn as a learning path that starts at one node and turns
 * inward to end on a second node at the centre. Same artwork as the web app and the app icon.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M23.8 8.2A11 11 0 1 0 27 16H16" stroke={colors.fg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={23.8} cy={8.2} r={2.7} fill={colors.fg} />
      <Circle cx={16} cy={16} r={2.7} fill={colors.fg} />
    </Svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="AI Guruz" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      <T variant="heading" style={{ fontSize: size * 0.64 }}>
        <T variant="heading" muted style={{ fontSize: size * 0.64 }}>AI</T> Guruz
      </T>
    </View>
  );
}
