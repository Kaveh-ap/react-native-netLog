import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { getEntries, resend, type NetworkEntry } from 'react-native-netlog';
import { BackButton } from './BackButton';
import { Button, Chips, Field, JsonField } from './controls';
import { durationText, prettyIfJson, statusColors, statusLabel } from './format';
import { CloseIcon } from './Icons';
import type { NetLogLabels } from './labels';
import { Text } from './Text';
import type { NetLogTheme } from './theme';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type Header = { key: number; name: string; value: string };

export interface ResendEditorProps {
  entry: NetworkEntry;
  onBack: () => void;
  onOpenEntry: (id: number) => void;
  theme: NetLogTheme;
  labels: NetLogLabels;
}

export function ResendEditor({ entry, onBack, onOpenEntry, theme: t, labels }: ResendEditorProps) {
  const [method, setMethod] = useState<string>(entry.method);
  const [url, setUrl] = useState<string>(entry.url);
  const [headers, setHeaders] = useState<Header[]>(() =>
    Object.entries(entry.requestHeaders).map(([name, value], key) => ({ key, name, value })),
  );
  const [body, setBody] = useState<string>(() => prettyIfJson(entry.requestBody));
  const [sending, setSending] = useState<boolean>(false);
  const [result, setResult] = useState<{ status?: number; ms?: number; entry?: NetworkEntry; error?: string } | null>(null);

  const updateHeader = (key: number, patch: Partial<Header>) =>
    setHeaders((hs) => hs.map((h) => (h.key === key ? { ...h, ...patch } : h)));

  const send = () => {
    setSending(true);
    setResult(null);
    const startedAt = Date.now();
    const requestHeaders: Record<string, string> = {};
    for (const h of headers) if (h.name.trim()) requestHeaders[h.name.trim()] = h.value;
    resend(entry, { method, url: url.trim(), requestHeaders, requestBody: body || undefined })
      .then((res) => {
        const sent = [...getEntries()].reverse().find((e) => e.url === url.trim() && e.startedAt >= startedAt);
        setResult({ status: res.status, ms: Date.now() - startedAt, entry: sent });
      })
      .catch((e: unknown) => setResult({ error: e instanceof Error ? e.message.replace(/^NetLog: /, '') : String(e) }))
      .finally(() => setSending(false));
  };

  const sc = result?.entry
    ? statusColors(result.entry, t)
    : result?.status
      ? statusColors({ state: 'done', status: result.status } as NetworkEntry, t)
      : null;

  return (
    <View style={styles.flex}>
      <BackButton label={labels.back} color={t.accent} onPress={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
          {labels.editResend}
        </Text>
        <Chips options={METHODS.map((m) => [m, m] as [string, string])} value={method} onChange={setMethod} theme={t} mono />
        <Field label="URL" value={url} onChangeText={setUrl} mono theme={t} />

        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={[styles.label, { color: t.muted }]}>{labels.headers}</Text>
            <Pressable
              onPress={() => setHeaders((hs) => [...hs, { key: Date.now(), name: '', value: '' }])}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.link, { color: t.accent }]}>{labels.addHeader}</Text>
            </Pressable>
          </View>
          <View style={[styles.headersBox, { borderColor: t.border }]}>
            {headers.map((h, i) => (
              <View key={h.key} style={[styles.headerRow, i > 0 && { borderTopWidth: 1, borderTopColor: t.border }]}>
                <TextInput
                  value={h.name}
                  onChangeText={(name) => updateHeader(h.key, { name })}
                  placeholder={labels.headerName}
                  placeholderTextColor={t.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  scrollEnabled={false}
                  accessibilityLabel={labels.headerName}
                  style={[styles.headerName, { color: t.muted, fontFamily: t.mono }]}
                />
                <TextInput
                  value={h.value}
                  onChangeText={(value) => updateHeader(h.key, { value })}
                  placeholder={labels.headerValue}
                  placeholderTextColor={t.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  scrollEnabled={false}
                  accessibilityLabel={labels.headerValue}
                  style={[styles.headerValue, { color: t.text, fontFamily: t.mono }]}
                />
                <Pressable
                  onPress={() => setHeaders((hs) => hs.filter((x) => x.key !== h.key))}
                  accessibilityRole="button"
                  accessibilityLabel={`${labels.removeHeader} ${h.name}`}
                  style={styles.remove}
                >
                  <CloseIcon size={12} color={t.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {method !== 'GET' ? <JsonField label={labels.body} value={body} onChangeText={setBody} theme={t} labels={labels} /> : null}

        {result ? (
          <View style={[styles.result, { borderColor: t.border }]}>
            <Text style={[styles.label, { color: t.muted }]}>{labels.resendResult}</Text>
            {result.error ? (
              <Text style={{ color: t.error, fontSize: 13 }}>
                {labels.resendFailed}: {result.error}
              </Text>
            ) : (
              <View style={styles.resultRow}>
                <Text style={[styles.pill, { color: sc?.fg ?? t.neutral, backgroundColor: sc?.bg ?? t.neutralBg, fontFamily: t.mono }]}>
                  {result.entry ? statusLabel(result.entry) : String(result.status ?? '')}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{result.entry ? durationText(result.entry) : `${result.ms ?? 0} ms`}</Text>
                <View style={styles.flex} />
                {result.entry ? (
                  <Pressable onPress={() => onOpenEntry(result.entry!.id)} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.link, { color: t.accent }]}>{labels.openRequest}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.surface }]}>
        <Button label={sending ? labels.sending : labels.send} onPress={send} primary disabled={sending || !url.trim()} theme={t} flex />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  group: { gap: 6 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '600' },
  link: { fontSize: 13, fontWeight: '600' },
  headersBox: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  headerName: { width: '36%', fontSize: 12, paddingVertical: 8, paddingHorizontal: 12 },
  headerValue: { flex: 1, fontSize: 12, paddingVertical: 8 },
  remove: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  result: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  footer: { flexDirection: 'row', padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
