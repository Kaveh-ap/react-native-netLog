import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { jsonState } from './format';
import { Text } from './Text';
import type { NetLogTheme } from './theme';

export function Switch({ value, onChange, theme: t, label }: { value: boolean; onChange: (v: boolean) => void; theme: NetLogTheme; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.switchHit}
    >
      <View style={[styles.track, { backgroundColor: value ? t.primary : t.separator }]}>
        <View style={[styles.knob, { backgroundColor: t.surface, transform: [{ translateX: value ? 18 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  theme: t,
}: {
  options: Array<[T, string]>;
  value: T;
  onChange: (v: T) => void;
  theme: NetLogTheme;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: t.surfaceAlt }]} accessibilityRole="radiogroup">
      {options.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segmentItem, on && { backgroundColor: t.surface }]}
          >
            <Text style={[styles.segmentText, { color: on ? t.text : t.muted }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  theme: t,
  mono,
}: {
  options: Array<[T, string]>;
  value: T;
  onChange: (v: T) => void;
  theme: NetLogTheme;
  mono?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.chip, { backgroundColor: on ? t.primary : t.surfaceAlt }]}
          >
            <Text style={[styles.chipText, { color: on ? t.onPrimary : t.text }, mono && { fontFamily: t.mono }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  theme: t,
  placeholder,
  multiline,
  mono,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: NetLogTheme;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: t.surfaceAlt, color: t.text },
          mono && { fontFamily: t.mono, fontSize: 13 },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function JsonField({
  label,
  value,
  onChangeText,
  theme: t,
  placeholder,
  labels,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: NetLogTheme;
  placeholder?: string;
  labels: { validJson: string; invalidJson: string; formatJson: string };
}) {
  const state = jsonState(value);
  const formatted = state === 'json' ? JSON.stringify(JSON.parse(value), null, 2) : value;
  return (
    <View style={styles.field}>
      <View style={styles.jsonHeader}>
        <Text style={[styles.fieldLabel, styles.flex, { color: t.muted }]}>{label}</Text>
        {state === 'json' ? <Text style={[styles.jsonState, { color: t.ok, backgroundColor: t.okBg }]}>{labels.validJson}</Text> : null}
        {state === 'invalid' ? <Text style={[styles.jsonState, { color: t.error, backgroundColor: t.errorBg }]}>{labels.invalidJson}</Text> : null}
        {state === 'json' && formatted !== value ? (
          <Pressable onPress={() => onChangeText(formatted)} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.jsonFormat, { color: t.accent }]}>{labels.formatJson}</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        multiline
        textAlignVertical="top"
        accessibilityLabel={label}
        style={[
          styles.jsonInput,
          {
            backgroundColor: t.surfaceAlt,
            color: t.text,
            fontFamily: t.mono,
            borderColor: state === 'invalid' ? t.error : 'transparent',
          },
        ]}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  theme: t,
  primary,
  danger,
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  theme: NetLogTheme;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  flex?: boolean;
}) {
  const bg = primary ? t.primary : 'transparent';
  const fg = primary ? t.onPrimary : danger ? t.error : t.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, flex && styles.flex, { backgroundColor: bg, borderColor: primary ? bg : t.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, theme: t }: { children: ReactNode; theme: NetLogTheme }) {
  return <View style={[styles.card, { borderColor: t.border, backgroundColor: t.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchHit: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, flexDirection: 'row' },
  knob: { width: 20, height: 20, borderRadius: 10 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 10 },
  segmentItem: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, paddingVertical: 8 },
  multiline: { minHeight: 140, maxHeight: 280 },
  hint: { fontSize: 12, lineHeight: 17 },
  button: { height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  jsonHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jsonState: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: 'hidden' },
  jsonFormat: { fontSize: 12, fontWeight: '600' },
  jsonInput: { minHeight: 220, maxHeight: 420, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, lineHeight: 18 },
});
