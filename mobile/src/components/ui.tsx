import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/providers';

type Variant = 'body' | 'title' | 'heading' | 'label' | 'small';

const textStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  title: { fontSize: 26, fontWeight: '600', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '500' },
  small: { fontSize: 12, lineHeight: 17 },
});

export function T({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[textStyles[variant], { color: color ?? (muted ? colors.muted : colors.fg) }, style]} />;
}

/** Page container: safe area, scrolling, pull-to-refresh. */
export function Screen({ children, onRefresh, edges }: { children: React.ReactNode; onRefresh?: () => Promise<unknown>; edges?: ('top' | 'bottom')[] }) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges ?? ['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.muted} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Button({
  title, onPress, variant = 'primary', busy, disabled, small, style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const textColor = primary ? colors.primaryFg : variant === 'danger' ? colors.danger : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          height: small ? 34 : 46,
          paddingHorizontal: small ? 12 : 18,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          backgroundColor: primary ? colors.primary : 'transparent',
          borderWidth: primary ? 0 : 1,
          borderColor: colors.border,
          opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {busy && <ActivityIndicator size="small" color={textColor} />}
      <Text style={{ color: textColor, fontWeight: '600', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput
        placeholderTextColor={colors.muted}
        {...input}
        accessibilityLabel={label}
        style={[
          {
            minHeight: 46,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: input.multiline ? 10 : 0,
            color: colors.fg,
            fontSize: 15,
            backgroundColor: colors.bg,
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
          input.style,
        ]}
      />
      {hint && <T variant="small" muted>{hint}</T>}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const base: ViewStyle = { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 6 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { borderColor: colors.fg }, style]}>
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'solid' | 'success' | 'warn' | 'danger' }) {
  const { colors } = useTheme();
  const color = tone === 'solid' ? colors.primaryFg : tone === 'neutral' ? colors.muted : colors[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: tone === 'solid' ? colors.primary : tone === 'neutral' ? colors.border : color,
        backgroundColor: tone === 'solid' ? colors.primary : 'transparent',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** value is 0..1 */
export function Bar({ value, tone }: { value: number; tone?: 'success' | 'warn' | 'danger' }) {
  const { colors } = useTheme();
  const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as const;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.hover, overflow: 'hidden' }}>
      <View style={{ height: 6, borderRadius: 3, width, backgroundColor: tone ? colors[tone] : colors.fg }} />
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { id: V; label: string }[]; value: V; onChange: (id: V) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 3, gap: 3 }}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center', backgroundColor: active ? colors.primary : 'transparent' }}
          >
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: active ? colors.primaryFg : colors.muted }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 24 }}>
      <ActivityIndicator color={colors.muted} />
      <T muted style={{ flex: 1 }}>{label}</T>
    </View>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  const { colors } = useTheme();
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: 10 }}>
      <T variant="small" color={colors.danger}>{error}</T>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 14, padding: 28, alignItems: 'center', gap: 4 }}>
      <T variant="heading">{title}</T>
      {body && <T muted style={{ textAlign: 'center' }}>{body}</T>}
    </View>
  );
}

export function Markdown({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <MarkdownDisplay
      style={{
        body: { color: colors.fg, fontSize: 15, lineHeight: 24 },
        heading1: { fontSize: 22, fontWeight: '600', marginTop: 18, marginBottom: 6 },
        heading2: { fontSize: 18, fontWeight: '600', marginTop: 18, marginBottom: 6 },
        heading3: { fontSize: 16, fontWeight: '600', marginTop: 14, marginBottom: 4 },
        link: { color: colors.fg, textDecorationLine: 'underline' },
        blockquote: { backgroundColor: 'transparent', borderLeftColor: colors.border, borderLeftWidth: 2, paddingLeft: 12 },
        code_inline: { backgroundColor: colors.hover, color: colors.fg },
        fence: { backgroundColor: colors.card, borderColor: colors.border, color: colors.fg },
        code_block: { backgroundColor: colors.card, borderColor: colors.border, color: colors.fg },
        hr: { backgroundColor: colors.border },
      }}
    >
      {children}
    </MarkdownDisplay>
  );
}

export const percent = (value: number | null | undefined) => (value == null ? '–' : `${Math.round(value * 100)}%`);

export const masteryTone = (value: number | null | undefined) =>
  value == null ? undefined : value >= 0.8 ? 'success' : value >= 0.5 ? 'warn' : 'danger';

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/**
 * Loads data on mount and whenever deps change. With pollWhile, re-fetches every 3 seconds
 * for as long as the predicate holds (used while the backend is generating something).
 */
export function useLoad<D>(load: () => Promise<D>, deps: unknown[], pollWhile?: (data: D) => boolean) {
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const pollRef = useRef(pollWhile);
  loadRef.current = load;
  pollRef.current = pollWhile;

  const reload = useCallback(async () => {
    try {
      const result = await loadRef.current();
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const result = await reload();
      if (!cancelled && result && pollRef.current?.(result)) timer = setTimeout(tick, 3000);
    };
    setLoading(true);
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}
