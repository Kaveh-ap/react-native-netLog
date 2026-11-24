import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { getConfig, type DeviceInfo } from 'react-native-netlog';
import { DesktopPairing, type ScannerProps } from './DesktopPairing';
import { bytesText } from './format';
import { RESOURCE_TYPES } from './hiddenTypes';
import type { NetLogLabels } from './labels';
import { Text } from './Text';
import type { NetLogTheme } from './theme';

export interface SettingsPanelProps {
  theme: NetLogTheme;
  mode: 'light' | 'dark';
  onModeChange: (mode: 'light' | 'dark') => void;
  labels: NetLogLabels;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  storedCount: number;
  onClear: () => void;
  onShareHar: () => void;
  pairingEnabled: boolean;
  renderScanner?: (props: ScannerProps) => ReactNode;
  device?: DeviceInfo;
  hidden: ReadonlySet<string>;
  onHiddenChange: (ids: string[]) => void;
}

function Section({ title, children, theme: t }: { title: string; children: ReactNode; theme: NetLogTheme }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.muted }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { borderColor: t.border, backgroundColor: t.surface }]}>{children}</View>
    </View>
  );
}

function Row({ children, theme: t, last }: { children: ReactNode; theme: NetLogTheme; last?: boolean }) {
  return <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: t.border }]}>{children}</View>;
}

function SmallButton({ label, onPress, theme: t, tone }: { label: string; onPress: () => void; theme: NetLogTheme; tone?: 'warn' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.smallButton, { backgroundColor: tone === 'warn' ? t.warnBg : t.surfaceAlt }]}
    >
      <Text style={[styles.smallButtonText, { color: tone === 'warn' ? t.warn : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsPanel(p: SettingsPanelProps) {
  const t = p.theme;
  const config = getConfig();
  const segments: Array<['light' | 'dark', string]> = [
    ['light', p.labels.light],
    ['dark', p.labels.dark],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
        {p.labels.tabSettings}
      </Text>

      <Section title={p.labels.appearance} theme={t}>
        <Row theme={t} last>
          <View style={[styles.segment, { backgroundColor: t.surfaceAlt }]} accessibilityRole="radiogroup">
            {segments.map(([id, label]) => {
              const on = p.mode === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => p.onModeChange(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.segmentItem, on && { backgroundColor: t.surface }]}
                >
                  <Text style={[styles.segmentText, { color: on ? t.text : t.muted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Row>
      </Section>

      <Section title={p.labels.capture} theme={t}>
        <Row theme={t}>
          <View style={[styles.dot, { backgroundColor: p.paused ? t.warn : t.ok }]} />
          <Text style={[styles.rowText, { color: t.text }]}>{p.paused ? p.labels.capturePaused : p.labels.recording}</Text>
          <SmallButton
            label={p.paused ? p.labels.resume : p.labels.pause}
            onPress={() => p.onPausedChange(!p.paused)}
            theme={t}
            tone={p.paused ? 'warn' : undefined}
          />
        </Row>
        <Row theme={t} last>
          <Text style={[styles.rowText, { color: t.text }]}>{p.labels.stored(p.storedCount)}</Text>
          <SmallButton label={p.labels.clear} onPress={p.onClear} theme={t} />
        </Row>
      </Section>

      <Section title={p.labels.hideFromList} theme={t}>
        <View style={styles.typesBox}>
          <View style={styles.chips}>
            {RESOURCE_TYPES.map((type) => {
              const on = p.hidden.has(type.id);
              const next = new Set(p.hidden);
              if (on) next.delete(type.id);
              else next.add(type.id);
              return (
                <Pressable
                  key={type.id}
                  onPress={() => p.onHiddenChange([...next])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${p.labels.hideFromList}: ${type.label}`}
                  style={[styles.chip, { backgroundColor: on ? t.primary : t.surfaceAlt }]}
                >
                  <Text style={[styles.chipText, { color: on ? t.onPrimary : t.text }]}>{type.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.typeActions}>
            <SmallButton
              label={p.labels.hideImages}
              onPress={() => p.onHiddenChange([...new Set([...p.hidden, ...RESOURCE_TYPES.filter((r) => r.image).map((r) => r.id)])])}
              theme={t}
            />
            <SmallButton label={p.labels.showAll} onPress={() => p.onHiddenChange([])} theme={t} />
          </View>
          <Text style={[styles.hint, { color: t.muted }]}>{p.labels.hideHint}</Text>
        </View>
      </Section>

      <Section title={p.labels.exportTitle} theme={t}>
        <Row theme={t} last>
          <Text style={[styles.rowText, styles.hint, { color: t.muted }]}>{p.labels.exportHint}</Text>
          <SmallButton label={p.labels.exportHar} onPress={p.onShareHar} theme={t} />
        </Row>
      </Section>

      {p.pairingEnabled ? (
        <Section title={p.labels.desktopTitle} theme={t}>
          <DesktopPairing
            renderScanner={p.renderScanner}
            device={p.device}
            theme={p.mode}
            style={{ backgroundColor: t.surface }}
          />
        </Section>
      ) : null}

      <Section title={p.labels.limits} theme={t}>
        <Row theme={t}>
          <Text style={[styles.rowText, { color: t.muted }]}>{p.labels.maxEntries}</Text>
          <Text style={[styles.value, { color: t.text, fontFamily: t.mono }]}>{config.maxEntries}</Text>
        </Row>
        <Row theme={t}>
          <Text style={[styles.rowText, { color: t.muted }]}>{p.labels.maxBodyLength}</Text>
          <Text style={[styles.value, { color: t.text, fontFamily: t.mono }]}>{bytesText(config.maxBodyLength)}</Text>
        </Row>
        <Row theme={t}>
          <Text style={[styles.rowText, { color: t.muted }]}>{p.labels.ignoreRules}</Text>
          <Text style={[styles.value, { color: t.text, fontFamily: t.mono }]}>{config.ignore.length}</Text>
        </Row>
        <Row theme={t} last>
          <Text style={[styles.rowText, { color: t.muted }]}>{p.labels.redactedHeaders}</Text>
          <Text style={[styles.value, { color: t.text, fontFamily: t.mono }]} numberOfLines={2}>
            {config.redactHeaders.join(', ') || '—'}
          </Text>
        </Row>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 20 },
  title: { fontSize: 20, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  rowText: { flex: 1, fontSize: 14 },
  hint: { fontSize: 12, lineHeight: 17 },
  value: { flexShrink: 1, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  smallButton: { height: 36, paddingHorizontal: 14, borderRadius: 9, justifyContent: 'center' },
  smallButtonText: { fontSize: 13, fontWeight: '600' },
  typesBox: { padding: 12, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  typeActions: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, flexDirection: 'row', padding: 3, borderRadius: 10 },
  segmentItem: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
});
