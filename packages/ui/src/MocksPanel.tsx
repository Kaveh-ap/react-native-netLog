import { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  addMockRule,
  getMockRules,
  getNetworkCondition,
  removeMockRule,
  setNetworkCondition,
  subscribeMocks,
  updateMockRule,
  type MockAction,
  type MockRule,
  type MockRuleInput,
  type NetworkCondition,
} from 'react-native-netlog';
import { BackButton } from './BackButton';
import { Button, Card, Chips, Field, JsonField, Segmented, Switch } from './controls';
import { prettyIfJson } from './format';
import type { NetLogLabels } from './labels';
import { Text } from './Text';
import type { NetLogTheme } from './theme';

export function useMockRules(): MockRule[] {
  return useSyncExternalStore(subscribeMocks, getMockRules, getMockRules);
}

export function useNetworkCondition(): NetworkCondition {
  return useSyncExternalStore(subscribeMocks, getNetworkCondition, getNetworkCondition);
}

export function actionLabel(a: MockAction, labels: NetLogLabels): string {
  if (a.type === 'respond') return labels.mockRespondLabel(a.status);
  if (a.type === 'delay') return labels.mockDelayLabel(a.ms);
  return a.error === 'Timeout' ? labels.mockTimeout : labels.mockNetworkError;
}

const METHODS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type Draft = {
  method: string;
  url: string;
  type: MockAction['type'];
  status: string;
  body: string;
  contentType: string;
  respondDelay: string;
  delayMs: string;
  failError: 'Network error' | 'Timeout';
};

function toDraft(rule: MockRule | MockRuleInput | undefined): Draft {
  const a = rule?.action;
  return {
    method: rule?.method ?? '*',
    url: rule?.url ?? '',
    type: a?.type ?? 'respond',
    status: a?.type === 'respond' ? String(a.status) : '200',
    body: a?.type === 'respond' ? prettyIfJson(a.body) : '',
    contentType: a?.type === 'respond' ? (a.headers?.['content-type'] ?? 'application/json') : 'application/json',
    respondDelay: a?.type === 'respond' && a.delayMs ? String(a.delayMs) : '',
    delayMs: a?.type === 'delay' ? String(a.ms) : '2000',
    failError: a?.type === 'fail' ? (a.error ?? 'Network error') : 'Network error',
  };
}

function toAction(d: Draft): MockAction {
  if (d.type === 'delay') return { type: 'delay', ms: Math.max(0, Number(d.delayMs) || 0) };
  if (d.type === 'fail') return { type: 'fail', error: d.failError };
  const delay = Number(d.respondDelay);
  return {
    type: 'respond',
    status: Number(d.status) || 200,
    body: d.body,
    headers: d.contentType ? { 'content-type': d.contentType } : {},
    ...(delay > 0 ? { delayMs: delay } : {}),
  };
}

function RuleEditor({
  rule,
  initial,
  onDone,
  theme: t,
  labels,
}: {
  rule: MockRule | undefined;
  initial?: MockRuleInput | null;
  onDone: () => void;
  theme: NetLogTheme;
  labels: NetLogLabels;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(rule ?? initial ?? undefined));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const valid = d.url.trim().length > 0 && (d.type !== 'respond' || (Number(d.status) >= 100 && Number(d.status) <= 599));

  const save = () => {
    const input = { method: d.method, url: d.url.trim(), action: toAction(d) };
    if (rule) updateMockRule(rule.id, input);
    else addMockRule(input);
    onDone();
  };

  return (
    <View style={styles.flex}>
      <BackButton label={labels.tabMocks} color={t.accent} onPress={onDone} />
      <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
          {rule ? labels.editRule : labels.newRule}
        </Text>
        <View style={styles.group}>
          <Text style={[styles.label, { color: t.muted }]}>{labels.mockMethod}</Text>
          <Chips
            options={METHODS.map((m) => [m, m === '*' ? labels.anyMethod : m] as [string, string])}
            value={d.method}
            onChange={(method) => set({ method })}
            theme={t}
            mono
          />
        </View>
        <Field
          label={labels.mockUrl}
          value={d.url}
          onChangeText={(url) => set({ url })}
          placeholder="*/v1/cart/*"
          mono
          theme={t}
          hint={labels.mockUrlHint}
        />
        <View style={styles.group}>
          <Text style={[styles.label, { color: t.muted }]}>{labels.mockAction}</Text>
          <Segmented
            options={[
              ['respond', labels.actionRespond],
              ['delay', labels.actionDelay],
              ['fail', labels.actionFail],
            ]}
            value={d.type}
            onChange={(type) => set({ type })}
            theme={t}
          />
        </View>
        {d.type === 'respond' ? (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Field label={labels.mockStatus} value={d.status} onChangeText={(status) => set({ status })} keyboardType="number-pad" mono theme={t} />
              </View>
              <View style={styles.flex}>
                <Field
                  label={labels.mockExtraDelay}
                  value={d.respondDelay}
                  onChangeText={(respondDelay) => set({ respondDelay })}
                  keyboardType="number-pad"
                  placeholder="0"
                  mono
                  theme={t}
                />
              </View>
            </View>
            <Field label="Content-Type" value={d.contentType} onChangeText={(contentType) => set({ contentType })} mono theme={t} />
            <JsonField label={labels.body} value={d.body} onChangeText={(body) => set({ body })} theme={t} labels={labels} placeholder='{"ok": true}' />
          </>
        ) : null}
        {d.type === 'delay' ? (
          <Field
            label={labels.mockDelayMs}
            value={d.delayMs}
            onChangeText={(delayMs) => set({ delayMs })}
            keyboardType="number-pad"
            mono
            theme={t}
            hint={labels.mockDelayHint}
          />
        ) : null}
        {d.type === 'fail' ? (
          <Segmented
            options={[
              ['Network error', labels.mockNetworkError],
              ['Timeout', labels.mockTimeout],
            ]}
            value={d.failError}
            onChange={(failError) => set({ failError })}
            theme={t}
          />
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        {rule ? (
          <Button
            label={labels.deleteRule}
            danger
            onPress={() => {
              removeMockRule(rule.id);
              onDone();
            }}
            theme={t}
          />
        ) : null}
        <Button label={labels.cancel} onPress={onDone} theme={t} flex />
        <Button label={labels.save} onPress={save} primary disabled={!valid} theme={t} flex />
      </View>
    </View>
  );
}

export interface MocksPanelProps {
  theme: NetLogTheme;
  labels: NetLogLabels;
  /** Rule to open in the editor ('new' for an empty one). */
  editing: string | null;
  onEdit: (id: string | null) => void;
  /** Prefill for a new rule (from "Mock this"). */
  draft?: MockRuleInput | null;
}

export function MocksPanel({ theme: t, labels, editing, onEdit, draft }: MocksPanelProps) {
  const rules = useMockRules();
  const condition = useNetworkCondition();

  if (editing) {
    const isNew = editing === 'new' || editing === 'blank';
    const rule = isNew ? undefined : rules.find((r) => r.id === editing);
    return <RuleEditor key={editing} rule={rule} initial={editing === 'new' ? draft : null} onDone={() => onEdit(null)} theme={t} labels={labels} />;
  }

  const active = rules.filter((r) => r.enabled).length;
  const conditions: Array<[NetworkCondition, string]> = [
    ['off', labels.conditionOff],
    ['slow', labels.conditionSlow],
    ['flaky', labels.conditionFlaky],
    ['offline', labels.conditionOffline],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
            {labels.tabMocks}
          </Text>
          <Text style={[styles.subtitle, { color: t.muted }]}>{labels.mocksSummary(active, condition === 'off' ? null : conditions.find(([c]) => c === condition)![1])}</Text>
        </View>
        <Button label={labels.newRule} onPress={() => onEdit('blank')} primary theme={t} />
      </View>

      <View style={styles.group}>
        <Text style={[styles.section, { color: t.muted }]}>{labels.networkConditions}</Text>
        <Segmented options={conditions} value={condition} onChange={setNetworkCondition} theme={t} />
        <Text style={[styles.hint, { color: t.muted }]}>{labels.conditionHint(condition)}</Text>
      </View>

      <View style={styles.group}>
        <Text style={[styles.section, { color: t.muted }]}>{labels.rulesTitle}</Text>
        {rules.length === 0 ? (
          <Text style={[styles.empty, { color: t.muted, borderColor: t.border }]}>{labels.noRules}</Text>
        ) : (
          rules.map((r, i) => (
            <Card key={r.id} theme={t}>
              <View style={styles.ruleTop}>
                <Text style={[styles.index, { color: t.muted, backgroundColor: t.surfaceAlt }]}>{i + 1}</Text>
                <View style={styles.ruleMain}>
                  <Text style={[styles.ruleUrl, { fontFamily: t.mono }]} numberOfLines={2}>
                    <Text style={{ color: t.methods[r.method] ?? t.muted, fontWeight: '700' }}>{r.method === '*' ? labels.anyMethod : r.method} </Text>
                    <Text style={{ color: t.text }}>{r.url}</Text>
                  </Text>
                  <Text style={[styles.actionBadge, { color: t.info, backgroundColor: t.infoBg }]}>{actionLabel(r.action, labels)}</Text>
                </View>
                <Switch value={r.enabled} onChange={(enabled) => updateMockRule(r.id, { enabled })} theme={t} label={labels.ruleEnabled(i + 1)} />
              </View>
              <View style={[styles.ruleBottom, { borderTopColor: t.border }]}>
                <Text style={[styles.hits, { color: t.muted }]}>{r.enabled ? labels.hits(r.hits) : labels.off}</Text>
                <Pressable onPress={() => onEdit(r.id)} accessibilityRole="button" hitSlop={8} style={styles.edit}>
                  <Text style={[styles.editText, { color: t.accent }]}>{labels.edit}</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </View>
      <Text style={[styles.hint, { color: t.muted }]}>{labels.mocksHowItWorks}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 20 },
  editor: { padding: 16, paddingTop: 0, paddingBottom: 24, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  group: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 12, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 12, lineHeight: 17 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  ruleTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, paddingBottom: 8 },
  index: { width: 24, height: 24, borderRadius: 6, overflow: 'hidden', textAlign: 'center', lineHeight: 24, fontSize: 12, fontWeight: '700' },
  ruleMain: { flex: 1, gap: 6 },
  ruleUrl: { fontSize: 12, lineHeight: 18 },
  actionBadge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  ruleBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 40 },
  hits: { fontSize: 12 },
  edit: { height: 40, justifyContent: 'center' },
  editText: { fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
