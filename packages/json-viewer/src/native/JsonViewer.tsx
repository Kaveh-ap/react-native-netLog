import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DEFAULT_MAX_VALUE_LENGTH, parseJson, type Row, type SearchScope } from '../core';
import { useJsonViewer } from '../react/useJsonViewer';
import { JsonRow } from './JsonRow';
import { defaultLabels, SearchBar, type JsonViewerLabels } from './SearchBar';
import { resolveTheme, type JsonViewerTheme } from './theme';

export interface JsonViewerProps {
  /** An already-parsed value. Takes precedence over `json`. */
  data?: unknown;
  /** A JSON string; parsed once. Invalid JSON falls back to raw text. */
  json?: string;
  /** Containers shallower than this start expanded. Default 2. */
  initialExpandDepth?: number;
  /** Show the search bar. Default true. */
  searchable?: boolean;
  initialQuery?: string;
  initialScope?: SearchScope;
  caseSensitive?: boolean;
  theme?: 'light' | 'dark' | Partial<JsonViewerTheme>;
  labels?: Partial<JsonViewerLabels>;
  showLineNumbers?: boolean;
  /** Longer values are cut with "…". Copy always uses the full value. Default 200. */
  maxValueLength?: number;
  rowHeight?: number;
  indent?: number;
  /** Root symbol of copied paths. Default `$`. */
  pathRoot?: string;
  /** Called by the Copy buttons. Wire it to your clipboard; the buttons are hidden without it. */
  onCopy?: (text: string, kind: 'path' | 'value') => void;
  onSelect?: (selection: { path: string; value: unknown } | null) => void;
  style?: StyleProp<ViewStyle>;
}

const RAW_PREVIEW_LIMIT = 100_000;

export function JsonViewer(props: JsonViewerProps) {
  const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);

  const parsed = useMemo(() => {
    if (props.data !== undefined || props.json === undefined) return { ok: true as const, value: props.data };
    return parseJson(props.json);
  }, [props.data, props.json]);

  if (!parsed.ok) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }, props.style]}>
        <Text style={[styles.banner, { color: theme.muted, borderColor: theme.border }]}>{labels.invalidJson}</Text>
        <ScrollView contentContainerStyle={styles.rawContent}>
          <Text selectable style={{ color: theme.text, fontFamily: theme.monoFontFamily, fontSize: 12 }}>
            {props.json!.length > RAW_PREVIEW_LIMIT ? props.json!.slice(0, RAW_PREVIEW_LIMIT) + '\n…' : props.json}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return <TreeView {...props} data={parsed.value} theme={theme} labels={labels} />;
}

type TreeViewProps = Omit<JsonViewerProps, 'theme' | 'labels'> & { theme: JsonViewerTheme; labels: JsonViewerLabels };

function TreeView(props: TreeViewProps) {
  const {
    theme,
    labels,
    searchable = true,
    caseSensitive = false,
    showLineNumbers = true,
    maxValueLength = DEFAULT_MAX_VALUE_LENGTH,
    rowHeight = 24,
    indent = 14,
    onCopy,
    onSelect,
  } = props;

  const [query, setQuery] = useState(props.initialQuery ?? '');
  const [scope, setScope] = useState<SearchScope>(props.initialScope ?? 'all');
  // Keeps typing responsive on big payloads: search runs at lower priority.
  const deferredQuery = useDeferredValue(query.trim());

  const viewer = useJsonViewer({
    data: props.data,
    initialExpandDepth: props.initialExpandDepth,
    query: deferredQuery,
    scope,
    caseSensitive,
    maxValueLength,
    pathRoot: props.pathRoot,
  });
  const { tree, rows, matchSet, currentMatch, currentRowIndex, selected } = viewer;

  const listRef = useRef<FlatList<Row>>(null);
  useEffect(() => {
    if (currentRowIndex === null) return;
    listRef.current?.scrollToIndex({ index: currentRowIndex, viewPosition: 0.35, animated: true });
    // Scroll on match change only, not on every expand/collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch, viewer.matchIndex]);

  const handleSelect = useCallback(
    (id: number) => {
      viewer.select(id);
      onSelect?.({ path: viewer.getPath(id), value: tree.nodes[id]!.value });
    },
    [viewer.select, viewer.getPath, onSelect, tree],
  );

  const lineNumberWidth = 14 + String(rows.length).length * 7;

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Row>) => {
      const node = tree.nodes[item.nodeId]!;
      const isMatch = item.type !== 'close' && matchSet.has(item.nodeId);
      return (
        <JsonRow
          row={item}
          node={node}
          line={index + 1}
          query={isMatch ? deferredQuery : ''}
          caseSensitive={caseSensitive}
          isCurrent={isMatch && item.nodeId === currentMatch}
          isSelected={item.type !== 'close' && item.nodeId === selected}
          maxValueLength={maxValueLength}
          showLineNumbers={showLineNumbers}
          lineNumberWidth={lineNumberWidth}
          indent={indent}
          rowHeight={rowHeight}
          theme={theme}
          onToggle={viewer.toggle}
          onSelect={handleSelect}
        />
      );
    },
    [
      tree,
      matchSet,
      deferredQuery,
      caseSensitive,
      currentMatch,
      selected,
      maxValueLength,
      showLineNumbers,
      lineNumberWidth,
      indent,
      rowHeight,
      theme,
      viewer.toggle,
      handleSelect,
    ],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Row> | null | undefined, index: number) => ({ length: rowHeight, offset: rowHeight * index, index }),
    [rowHeight],
  );

  const selectedNode = selected !== null ? tree.nodes[selected] : undefined;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, props.style]}>
      {searchable ? (
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          scope={scope}
          onScopeChange={setScope}
          matchCount={viewer.matches.length}
          matchIndex={viewer.matchIndex}
          onPrev={viewer.prevMatch}
          onNext={viewer.nextMatch}
          onExpandAll={viewer.expandAll}
          onCollapseAll={viewer.collapseAll}
          theme={theme}
          labels={labels}
        />
      ) : null}
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={15}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
      {selectedNode ? (
        <View style={[styles.footer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.footerPathRow}>
            <Text style={[styles.kind, { color: theme.muted, backgroundColor: theme.inputBackground }]}>
              {selectedNode.kind}
            </Text>
            <Text
              style={[styles.path, { color: theme.text, fontFamily: theme.monoFontFamily }]}
              numberOfLines={1}
              ellipsizeMode="head"
              selectable
            >
              {viewer.getPath(selectedNode.id)}
            </Text>
          </View>
          {onCopy ? (
            <View style={styles.footerButtons}>
              <Pressable
                onPress={() => onCopy(viewer.getPath(selectedNode.id), 'path')}
                accessibilityRole="button"
                style={[styles.footerButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.footerButtonText, { color: theme.text }]}>{labels.copyPath}</Text>
              </Pressable>
              <Pressable
                onPress={() => onCopy(viewer.getCopyText(selectedNode.id), 'value')}
                accessibilityRole="button"
                style={[styles.footerButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.footerButtonText, { color: theme.text }]}>{labels.copyValue}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // JSON reads left-to-right even inside RTL apps.
  root: { flex: 1, direction: 'ltr' },
  list: { flex: 1 },
  listContent: { paddingVertical: 4 },
  banner: { padding: 12, fontSize: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rawContent: { padding: 12 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  footerPathRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  path: { flex: 1, fontSize: 12 },
  footerButtons: { flexDirection: 'row', gap: 8 },
  footerButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: { fontSize: 13, fontWeight: '600' },
});
