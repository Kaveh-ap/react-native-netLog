import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from './Text';
import type { NetworkEntry } from 'react-native-netlog';
import { SearchIcon } from 'react-native-netlog-json-viewer';
import {
  durationText,
  graphqlOperation,
  isError,
  isPending,
  isSlow,
  SLOW_MS,
  splitUrl,
  statusColors,
  statusLabel,
} from './format';
import type { NetLogLabels } from './labels';
import type { NetLogTheme } from './theme';

type Filter = 'all' | 'errors' | 'slow' | 'pending';

const ROW_HEIGHT = 60;

interface RowProps {
  entry: NetworkEntry;
  theme: NetLogTheme;
  onPress: (id: number) => void;
}

const Row = memo(function Row({ entry, theme: t, onPress }: RowProps) {
  const { host, path } = splitUrl(entry.url);
  const op = graphqlOperation(entry);
  const sc = statusColors(entry, t);
  const methodColor = t.methods[entry.method] ?? t.text;
  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.method} ${entry.url}, status ${statusLabel(entry)}, ${durationText(entry)}`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.separator, backgroundColor: pressed ? t.surfaceAlt : isError(entry) ? t.errorBg + '55' : t.surface },
      ]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowLine}>
          <Text style={[styles.method, { color: methodColor, fontFamily: t.mono }]}>{entry.method}</Text>
          <Text style={[styles.path, { color: t.text, fontFamily: t.mono }]} numberOfLines={1} ellipsizeMode="middle">
            {op ? `${path} · ${op}` : path}
          </Text>
        </View>
        <View style={styles.rowLine}>
          <View style={styles.methodSpacer} />
          <Text style={[styles.host, { color: t.muted }]} numberOfLines={1}>
            {host}
            {entry.error ? ` · ${entry.error}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.rowSide}>
        <Text style={[styles.status, { color: sc.fg, backgroundColor: sc.bg, fontFamily: t.mono }]}>{statusLabel(entry)}</Text>
        <Text style={[styles.time, { color: (entry.durationMs ?? 0) > SLOW_MS ? t.warn : t.muted }]}>{durationText(entry)}</Text>
      </View>
    </Pressable>
  );
});

export interface RequestListProps {
  entries: NetworkEntry[];
  onSelect: (id: number) => void;
  theme: NetLogTheme;
  labels: NetLogLabels;
}

export function RequestList({ entries, onSelect, theme: t, labels }: RequestListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => ({
      all: entries.length,
      errors: entries.filter(isError).length,
      slow: entries.filter(isSlow).length,
      pending: entries.filter(isPending).length,
    }),
    [entries],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: NetworkEntry[] = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (filter === 'errors' && !isError(e)) continue;
      if (filter === 'slow' && !isSlow(e)) continue;
      if (filter === 'pending' && !isPending(e)) continue;
      if (q && !`${e.method} ${e.status ?? ''} ${e.url} ${graphqlOperation(e) ?? ''}`.toLowerCase().includes(q)) continue;
      out.push(e);
    }
    return out;
  }, [entries, query, filter]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NetworkEntry>) => <Row entry={item} theme={t} onPress={onSelect} />,
    [t, onSelect],
  );

  const chips: Array<[Filter, string]> = [
    ['all', labels.filterAll],
    ['errors', labels.filterErrors],
    ['slow', labels.filterSlow],
    ['pending', labels.filterPending],
  ];

  return (
    <View style={styles.flex}>
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: t.surfaceAlt }]}>
        <SearchIcon size={17} color={t.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={labels.searchPlaceholder}
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={labels.searchPlaceholder}
          style={[styles.search, { color: t.text }]}
        />
        </View>
      </View>
      <View style={styles.chips} accessibilityRole="tablist">
        {chips.map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { backgroundColor: on ? t.primary : t.surfaceAlt }]}
            >
              <Text style={[styles.chipText, { color: on ? t.onPrimary : t.text }]}>
                {label} <Text style={{ color: on ? t.onPrimary : t.muted }}>{counts[id]}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(e) => String(e.id)}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={20}
        windowSize={11}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={[styles.flex, { borderTopColor: t.separator }, styles.listTop]}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.muted }]}>{entries.length ? labels.emptyFiltered : labels.empty}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: { height: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, height: 44, fontSize: 14, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '500' },
  listTop: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  method: { width: 42, fontSize: 11, fontWeight: '700' },
  path: { flex: 1, fontSize: 13 },
  methodSpacer: { width: 42 },
  host: { flex: 1, fontSize: 12 },
  rowSide: { alignItems: 'flex-end', gap: 4 },
  status: { minWidth: 38, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { padding: 40, textAlign: 'center', fontSize: 14 },
});
