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
  searchIn: string;
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
  searchIn: 'Search in',
  collapseAll: 'Collapse all',
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
      <View style={[styles.searchBox, { backgroundColor: theme.inputBackground }]}>
        <View style={styles.inputRow}>
          <View style={styles.iconBox}>
            <SearchIcon size={16} color={theme.muted} />
          </View>
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
            <Text style={[styles.count, { color: theme.muted }]} numberOfLines={1} accessibilityLiveRegion="polite">
              {countText}
            </Text>
          ) : null}
          <Pressable
            onPress={props.onPrev}
            disabled={navDisabled}
            accessibilityRole="button"
            accessibilityLabel={labels.previousMatch}
            style={[styles.navButton, { opacity: navDisabled ? 0.35 : 1 }]}
          >
            <Chevron direction="up" size={14} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={props.onNext}
            disabled={navDisabled}
            accessibilityRole="button"
            accessibilityLabel={labels.nextMatch}
            style={[styles.navButton, { opacity: navDisabled ? 0.35 : 1 }]}
          >
            <Chevron direction="down" size={14} color={theme.text} />
          </Pressable>
        </View>
        <View style={[styles.scopeRow, { borderTopColor: theme.border }]} accessibilityRole="radiogroup" accessibilityLabel={labels.searchIn}>
          <Text style={[styles.scopeLabel, { color: theme.muted }]}>{labels.searchIn}</Text>
          {scopes.map(([id, label]) => {
            const on = scope === id;
            return (
              <Pressable
                key={id}
                onPress={() => props.onScopeChange(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                hitSlop={4}
                style={[styles.scopeItem, on && { backgroundColor: theme.surface }]}
              >
                <Text style={[styles.scopeText, { color: on ? theme.text : theme.muted, fontWeight: on ? '700' : '500' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.treeRow}>
        <Pressable onPress={props.onExpandAll} accessibilityRole="button" style={styles.linkButton} hitSlop={6}>
          <Text style={[styles.linkText, { color: theme.accent }]}>{labels.expandAll}</Text>
        </Pressable>
        <Text style={{ color: theme.muted }}>·</Text>
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
    paddingTop: 10,
    paddingBottom: 4,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: { borderRadius: 12, overflow: 'hidden' },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 44, gap: 2 },
  iconBox: { width: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 0 },
  count: { flexShrink: 0, fontSize: 12 },
  navButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  scopeLabel: { fontSize: 12, marginHorizontal: 4 },
  scopeItem: { height: 28, paddingHorizontal: 10, borderRadius: 7, justifyContent: 'center' },
  scopeText: { fontSize: 12 },
  treeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  linkButton: { height: 32, paddingHorizontal: 6, justifyContent: 'center' },
  linkText: { fontSize: 12, fontWeight: '600' },
});
