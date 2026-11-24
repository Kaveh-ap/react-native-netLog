import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  closeBracket,
  formatKey,
  formatValue,
  highlightRanges,
  openBracket,
  splitByRanges,
  summary,
  type JsonNode,
  type Row,
} from '../core';
import type { JsonViewerTheme } from './theme';

export interface JsonRowProps {
  row: Row;
  node: JsonNode;
  line: number;
  /** Only passed for matching rows, so non-matching rows stay memoized while typing. */
  query: string;
  caseSensitive: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  maxValueLength: number;
  showLineNumbers: boolean;
  lineNumberWidth: number;
  indent: number;
  rowHeight: number;
  theme: JsonViewerTheme;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
}

function valueColor(node: JsonNode, theme: JsonViewerTheme): string {
  switch (node.kind) {
    case 'string':
      return theme.string;
    case 'number':
      return theme.number;
    case 'boolean':
      return theme.boolean;
    case 'null':
    case 'undefined':
      return theme.null;
    default:
      return theme.punctuation;
  }
}

function Highlighted({
  text,
  query,
  caseSensitive,
  color,
  theme,
  isCurrent,
}: {
  text: string;
  query: string;
  caseSensitive: boolean;
  color: string;
  theme: JsonViewerTheme;
  isCurrent: boolean;
}) {
  if (!query) return <Text style={{ color }}>{text}</Text>;
  const segments = splitByRanges(text, highlightRanges(text, query, caseSensitive));
  const hitStyle = {
    backgroundColor: isCurrent ? theme.matchCurrent : theme.match,
    color: theme.matchText,
  };
  return (
    <Text style={{ color }}>
      {segments.map((s, i) =>
        s.hit ? (
          <Text key={i} style={hitStyle}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

export const JsonRow = memo(function JsonRow(props: JsonRowProps) {
  const {
    row,
    node,
    line,
    query,
    caseSensitive,
    isCurrent,
    isSelected,
    maxValueLength,
    showLineNumbers,
    lineNumberWidth,
    indent,
    rowHeight,
    theme,
    onToggle,
    onSelect,
  } = props;

  const toggleable = (row.type === 'open' || row.type === 'collapsed') && node.childCount > 0;
  const isClose = row.type === 'close';
  const keyText = isClose ? '' : formatKey(node);
  const isIndex = typeof node.key === 'number';

  let text: string;
  let color = theme.punctuation;
  switch (row.type) {
    case 'open':
      text = openBracket(node);
      break;
    case 'collapsed':
      text = summary(node);
      break;
    case 'close':
      text = closeBracket(node);
      break;
    default:
      text = formatValue(node, maxValueLength);
      color = valueColor(node, theme);
  }

  const background = isSelected ? theme.selectedRow : isCurrent ? theme.currentRow : 'transparent';
  const label = (keyText ? keyText + ': ' : '') + text;

  return (
    <Pressable
      onPress={toggleable ? () => onToggle(node.id) : () => onSelect(node.id)}
      onLongPress={() => onSelect(node.id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={toggleable ? { expanded: row.type === 'open' } : undefined}
      accessibilityHint={toggleable ? 'Expands or collapses. Long-press to select.' : 'Selects this value'}
      style={[styles.row, { height: rowHeight, backgroundColor: background }]}
    >
      {showLineNumbers ? (
        <Text
          style={[styles.lineNumber, { width: lineNumberWidth, color: theme.lineNumber, fontFamily: theme.monoFontFamily }]}
          numberOfLines={1}
        >
          {line}
        </Text>
      ) : null}
      <View style={{ width: row.depth * indent }} />
      <Text style={[styles.chevron, { color: theme.muted }]}>
        {toggleable ? (row.type === 'open' ? '▾' : '▸') : ' '}
      </Text>
      <Text style={[styles.text, { fontFamily: theme.monoFontFamily }]} numberOfLines={1} ellipsizeMode="tail">
        {keyText ? (
          <>
            {isIndex ? (
              <Text style={{ color: theme.index }}>{keyText}</Text>
            ) : (
              <Highlighted
                text={keyText}
                query={query}
                caseSensitive={caseSensitive}
                color={theme.key}
                theme={theme}
                isCurrent={isCurrent}
              />
            )}
            <Text style={{ color: theme.punctuation }}>: </Text>
          </>
        ) : null}
        {row.type === 'value' ? (
          <Highlighted
            text={text}
            query={query}
            caseSensitive={caseSensitive}
            color={color}
            theme={theme}
            isCurrent={isCurrent}
          />
        ) : (
          <Text style={{ color }}>{text}</Text>
        )}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingEnd: 8,
  },
  lineNumber: {
    fontSize: 11,
    textAlign: 'right',
    paddingEnd: 8,
  },
  chevron: {
    width: 14,
    fontSize: 11,
    textAlign: 'center',
  },
  text: {
    flex: 1,
    fontSize: 12,
  },
});
