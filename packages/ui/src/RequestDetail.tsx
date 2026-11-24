import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { BackButton } from './BackButton';
import { Text } from './Text';
import { resend, toCurl, toShareText, type NetworkEntry } from 'react-native-netlog';
import { Chevron, JsonViewer } from 'react-native-netlog-json-viewer';
import { bytesText, durationText, formatStack, isJson, responseSize, statusColors, statusLabel, timeOfDay } from './format';
import type { NetLogLabels } from './labels';
import type { NetLogTheme } from './theme';

type Tab = 'overview' | 'request' | 'response' | 'timing';

export interface RequestDetailProps {
  entry: NetworkEntry;
  onBack: () => void;
  copy: (text: string) => void;
  theme: NetLogTheme;
  jsonTheme: 'light' | 'dark';
  labels: NetLogLabels;
}

function useFlash(): [string | null, (key: string) => void] {
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [
    flash,
    (key: string) => {
      setFlash(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), 1400);
    },
  ];
}

function Section({ title, children, theme: t }: { title: string; children: ReactNode; theme: NetLogTheme }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.muted }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { borderColor: t.border }]}>{children}</View>
    </View>
  );
}

function KeyValue({ k, v, theme: t, last }: { k: string; v: string; theme: NetLogTheme; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.kvKey, { color: t.muted }]}>{k}</Text>
      <Text style={[styles.kvValue, { color: t.text, fontFamily: t.mono }]} selectable>
        {v}
      </Text>
    </View>
  );
}

function Headers({ headers, theme: t, labels }: { headers: Record<string, string> | undefined; theme: NetLogTheme; labels: NetLogLabels }) {
  const [open, setOpen] = useState(false);
  const list = Object.entries(headers ?? {});
  return (
    <View style={styles.headersWrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.headersToggle, { borderColor: t.border }]}
      >
        <Chevron direction={open ? 'down' : 'right'} size={14} color={t.muted} />
        <Text style={[styles.headersTitle, { color: t.text }]}>{labels.headers}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{list.length}</Text>
      </Pressable>
      {open ? (
        <ScrollView style={[styles.headersList, { borderColor: t.border }]} nestedScrollEnabled>
          {list.map(([k, v], i) => (
            <KeyValue key={k} k={k} v={v} theme={t} last={i === list.length - 1} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Body({ text, copy, theme: t, jsonTheme, labels }: { text: string | undefined; copy: (s: string) => void; theme: NetLogTheme; jsonTheme: 'light' | 'dark'; labels: NetLogLabels }) {
  if (!text) {
    return <Text style={[styles.noBody, { color: t.muted, borderColor: t.border }]}>{labels.noBody}</Text>;
  }
  if (isJson(text)) {
    return (
      <View style={[styles.flex, styles.bodyBox, { borderColor: t.border }]}>
        <JsonViewer json={text} theme={jsonTheme} initialExpandDepth={2} onCopy={copy} />
      </View>
    );
  }
  return (
    <ScrollView style={[styles.flex, styles.bodyBox, { borderColor: t.border }]} contentContainerStyle={styles.rawBody}>
      <Text selectable style={{ color: t.text, fontFamily: t.mono, fontSize: 12 }}>
        {text.length > 200_000 ? `${text.slice(0, 200_000)}\n…` : text}
      </Text>
    </ScrollView>
  );
}

export function RequestDetail({ entry: e, onBack, copy, theme: t, jsonTheme, labels }: RequestDetailProps) {
  const [tab, setTab] = useState<Tab>(e.state === 'error' || (e.status ?? 0) >= 400 ? 'response' : 'overview');
  const [flash, setFlashKey] = useFlash();
  const sc = statusColors(e, t);

  const tabs: Array<[Tab, string]> = [
    ['overview', labels.tabOverview],
    ['request', labels.tabRequest],
    ['response', labels.tabResponse],
    ['timing', labels.tabTiming],
  ];

  const onCopyCurl = () => {
    copy(toCurl(e));
    setFlashKey('curl');
  };
  const onShare = () => {
    Share.share({ message: toShareText(e) }).catch(() => undefined);
  };
  const onResend = () => {
    resend(e)
      .then(() => setFlashKey('resend'))
      .catch(() => setFlashKey('resend-failed'));
  };

  const total = e.durationMs ?? 0;
  const wait = e.headersAt !== undefined ? e.headersAt - e.startedAt : total;
  const download = Math.max(0, total - wait);
  const pct = (n: number) => (total > 0 ? Math.max(1, (n / total) * 100) : 0);

  return (
    <View style={styles.flex}>
      <BackButton label={labels.back} color={t.accent} onPress={onBack} />

      <View style={styles.summary}>
        <View style={styles.summaryLine}>
          <Text style={[styles.method, { color: t.methods[e.method] ?? t.text, fontFamily: t.mono }]}>{e.method}</Text>
          <Text style={[styles.status, { color: sc.fg, backgroundColor: sc.bg, fontFamily: t.mono }]}>{statusLabel(e)}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {durationText(e)} · {bytesText(responseSize(e))}
          </Text>
        </View>
        <Text selectable style={[styles.url, { color: t.text, fontFamily: t.mono }]}>
          {e.url}
        </Text>
        {e.error ? <Text style={{ color: t.error, fontSize: 13 }}>{e.error}</Text> : null}
      </View>

      <View style={[styles.tabs, { backgroundColor: t.surfaceAlt }]} accessibilityRole="tablist">
        {tabs.map(([id, label]) => {
          const on = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { backgroundColor: t.surface }]}
            >
              <Text style={[styles.tabText, { color: on ? t.text : t.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.flex, styles.tabBody]}>
        {tab === 'overview' ? (
          <ScrollView contentContainerStyle={styles.scrollPad}>
            <Section title={labels.general} theme={t}>
              <KeyValue k="URL" v={e.url} theme={t} />
              <KeyValue k="Method" v={e.method} theme={t} />
              <KeyValue k="Status" v={`${statusLabel(e)}${e.error ? ` · ${e.error}` : ''}`} theme={t} />
              <KeyValue k="Started" v={timeOfDay(e.startedAt)} theme={t} />
              <KeyValue k="Duration" v={durationText(e)} theme={t} />
              <KeyValue k="Size" v={bytesText(responseSize(e))} theme={t} />
              <KeyValue k="Type" v={e.responseType ?? '—'} theme={t} last />
            </Section>
            {e.initiator ? (
              <Section title={labels.initiator} theme={t}>
                <Text selectable style={[styles.stack, { color: t.text, fontFamily: t.mono }]}>
                  {formatStack(e.initiator)}
                </Text>
              </Section>
            ) : null}
          </ScrollView>
        ) : null}

        {tab === 'request' ? (
          <View style={[styles.flex, styles.pad]}>
            <Headers headers={e.requestHeaders} theme={t} labels={labels} />
            <Body text={e.requestBody} copy={copy} theme={t} jsonTheme={jsonTheme} labels={labels} />
          </View>
        ) : null}

        {tab === 'response' ? (
          <View style={[styles.flex, styles.pad]}>
            <Headers headers={e.responseHeaders} theme={t} labels={labels} />
            <Body text={e.responseBody} copy={copy} theme={t} jsonTheme={jsonTheme} labels={labels} />
          </View>
        ) : null}

        {tab === 'timing' ? (
          <ScrollView contentContainerStyle={styles.scrollPad}>
            {e.durationMs === undefined ? (
              <Text style={[styles.noBody, { color: t.muted, borderColor: t.border }]}>{labels.timingPending}</Text>
            ) : (
              <View style={[styles.card, styles.timingCard, { borderColor: t.border }]}>
                {[
                  [labels.waiting, wait, 0, t.timing.waiting],
                  [labels.download, download, wait, t.timing.download],
                ].map(([label, ms, offset, color]) => (
                  <View key={String(label)} style={styles.timingRow}>
                    <View style={styles.timingLabels}>
                      <Text style={{ color: t.text, fontSize: 13 }}>{label}</Text>
                      <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{ms} ms</Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
                      <View style={{ width: `${total > 0 ? ((offset as number) / total) * 100 : 0}%` }} />
                      <View style={[styles.bar, { width: `${pct(ms as number)}%`, backgroundColor: color as string }]} />
                    </View>
                  </View>
                ))}
                <View style={[styles.timingLabels, styles.totalRow, { borderTopColor: t.border }]}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{labels.total}</Text>
                  <Text style={{ color: t.text, fontWeight: '600' }}>{durationText(e)}</Text>
                </View>
              </View>
            )}
            <Text style={[styles.note, { color: t.muted }]}>{labels.timingNote}</Text>
          </ScrollView>
        ) : null}
      </View>
      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        <Pressable onPress={onCopyCurl} accessibilityRole="button" style={[styles.action, { borderColor: t.border }]}>
          <Text style={[styles.actionText, { color: t.text }]}>{flash === 'curl' ? labels.copied : labels.copyCurl}</Text>
        </Pressable>
        <Pressable onPress={onShare} accessibilityRole="button" style={[styles.action, { borderColor: t.border }]}>
          <Text style={[styles.actionText, { color: t.text }]}>{labels.share}</Text>
        </Pressable>
        <Pressable onPress={onResend} accessibilityRole="button" style={[styles.action, { borderColor: t.border }]}>
          <Text style={[styles.actionText, { color: flash === 'resend-failed' ? t.error : t.text }]}>
            {flash === 'resend' ? labels.resent : labels.resend}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  method: { fontSize: 13, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  url: { fontSize: 13, lineHeight: 19 },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, padding: 3, borderRadius: 10 },
  tab: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBody: { paddingTop: 12 },
  pad: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  kv: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 9 },
  kvKey: { width: 84, fontSize: 13 },
  kvValue: { flex: 1, fontSize: 12 },
  stack: { padding: 12, fontSize: 11, lineHeight: 17 },
  headersWrap: { gap: 6 },
  headersToggle: { height: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  headersTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  headersList: { maxHeight: 220, borderWidth: 1, borderRadius: 12 },
  bodyBox: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  rawBody: { padding: 12 },
  noBody: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 16, textAlign: 'center', fontSize: 13 },
  timingCard: { padding: 12, gap: 14 },
  timingRow: { gap: 6 },
  timingLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  bar: { borderRadius: 5 },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  note: { fontSize: 12, lineHeight: 18 },
});
