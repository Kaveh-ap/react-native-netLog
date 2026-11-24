import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Chevron } from './Chevron';
import { SearchIcon } from './SearchIcon';
import { Text } from './Text';
import type { SearchScope } from '../core';
import type { JsonViewerTheme } from './theme';

export interface JsonViewerLabels {
  searchPlaceholder: string;
  noMatches: string;
  /** e.g. (2, 5) => "2 of 5" */
  matchCount: (current: number, total: number) => string;
  previousMatch: string;
  nextMatch: string;
  scopeAll: string;
  scopeKeys: string;
  scopeValues: string;
  expandAll: string;
  collapseAll: string;
  copyPath: string;
  copyValue: string;
  invalidJson: string;
}

export const defaultLabels: JsonViewerLabels = {
  searchPlaceholder: 'Search keys and values',
  noMatches: 'No matches',
  matchCount: (c, t) => `${c} of ${t}`,
  previousMatch: 'Previous match',
  nextMatch: 'Next match',
  scopeAll: 'All',
  scopeKeys: 'Keys',
  scopeValues: 'Values',
  expandAll: 'Expand all',
  collapseAll: 'Collapse',
  copyPath: 'Copy path',
  copyValue: 'Copy value',
  invalidJson: 'Not valid JSON. Showing raw text.',
};

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  scope: SearchScope;
  onScopeChange: (s: SearchScope) => void;
  matchCount: number;
  matchIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  theme: JsonViewerTheme;
  labels: JsonViewerLabels;
}

export function SearchBar(props: Props) {
  const { query, scope, matchCount, matchIndex, theme, labels } = props;
  const countText = query ? (matchCount ? labels.matchCount(matchIndex + 1, matchCount) : labels.noMatches) : '';
  const scopes: Array<[SearchScope, string]> = [
    ['all', labels.scopeAll],
    ['keys', labels.scopeKeys],
    ['values', labels.scopeValues],
  ];
  const navDisabled = matchCount === 0;

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, { backgroundColor: theme.inputBackground }]}>
          <SearchIcon size={16} color={theme.muted} />
          <TextInput
            value={query}
            onChangeText={props.onQueryChange}
            placeholder={labels.searchPlaceholder}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            onSubmitEditing={props.onNext}
            accessibilityLabel={labels.searchPlaceholder}
            style={[styles.input, { color: theme.text, fontFamily: theme.fontFamily }]}
          />
          {countText ? (
            <Text style={[styles.count, { color: theme.muted }]} accessibilityLiveRegion="polite">
              {countText}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={props.onPrev}
          disabled={navDisabled}
          accessibilityRole="button"
          accessibilityLabel={labels.previousMatch}
          style={[styles.navButton, { backgroundColor: theme.inputBackground, opacity: navDisabled ? 0.4 : 1 }]}
        >
          <Chevron direction="up" size={16} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={props.onNext}
          disabled={navDisabled}
          accessibilityRole="button"
          accessibilityLabel={labels.nextMatch}
          style={[styles.navButton, { backgroundColor: theme.inputBackground, opacity: navDisabled ? 0.4 : 1 }]}
        >
          <Chevron direction="down" size={16} color={theme.text} />
        </Pressable>
      </View>
      <View style={styles.toolRow}>
        <View style={[styles.segment, { backgroundColor: theme.inputBackground }]} accessibilityRole="radiogroup">
          {scopes.map(([id, label]) => {
            const on = scope === id;
            return (
              <Pressable
                key={id}
                onPress={() => props.onScopeChange(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.segmentItem, on && { backgroundColor: theme.surface }]}
              >
                <Text style={[styles.segmentText, { color: on ? theme.text : theme.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.spacer} />
        <Pressable onPress={props.onExpandAll} accessibilityRole="button" style={styles.linkButton} hitSlop={6}>
          <Text style={[styles.linkText, { color: theme.accent }]}>{labels.expandAll}</Text>
        </Pressable>
        <Pressable onPress={props.onCollapseAll} accessibilityRole="button" style={styles.linkButton} hitSlop={6}>
          <Text style={[styles.linkText, { color: theme.accent }]}>{labels.collapseAll}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  count: { fontSize: 12, fontVariant: ['tabular-nums'] },
  navButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolRow: { flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  segmentItem: { height: 32, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center' },
  segmentText: { fontSize: 12, fontWeight: '600' },
  spacer: { flex: 1 },
  linkButton: { height: 32, paddingHorizontal: 8, justifyContent: 'center' },
  linkText: { fontSize: 12, fontWeight: '600' },
});
