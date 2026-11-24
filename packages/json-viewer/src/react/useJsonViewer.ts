import { useCallback, useMemo, useState } from 'react';
import {
  buildTree,
  copyText as nodeCopyText,
  expandAll as expandAllOf,
  expandedToDepth,
  getPath as pathOf,
  reveal,
  rowIndexByNode,
  searchTree,
  toggle as toggleIn,
  visibleRows,
  type Expanded,
  type JsonTree,
  type SearchScope,
} from '../core';

export interface UseJsonViewerOptions {
  data: unknown;
  /** Containers shallower than this start expanded. Default 2. */
  initialExpandDepth?: number;
  query?: string;
  scope?: SearchScope;
  caseSensitive?: boolean;
  maxValueLength?: number;
  /** With more matches than this, only the current match is auto-expanded. Default 100. */
  revealLimit?: number;
  pathRoot?: string;
}

interface State {
  tree: JsonTree;
  expanded: Expanded;
  matches: number[];
  index: number;
  selected: number | null;
}

/**
 * Platform-agnostic viewer state: expansion, search matches, current match, selection.
 * Used by the React Native component and usable from React DOM.
 */
export function useJsonViewer(options: UseJsonViewerOptions) {
  const {
    data,
    initialExpandDepth = 2,
    query = '',
    scope = 'all',
    caseSensitive = false,
    maxValueLength,
    revealLimit = 100,
    pathRoot,
  } = options;

  const tree = useMemo(() => buildTree(data), [data]);
  const matches = useMemo(
    () => searchTree(tree, query, { scope, caseSensitive, maxValueLength }),
    [tree, query, scope, caseSensitive, maxValueLength],
  );

  const revealIds = (m: number[], i: number) =>
    m.length <= revealLimit ? m : m[i] !== undefined ? [m[i]!] : [];

  const [stored, setStored] = useState<State>(() => ({
    tree,
    expanded: reveal(tree, expandedToDepth(tree, initialExpandDepth), revealIds(matches, 0)),
    matches,
    index: 0,
    selected: null,
  }));

  // Derived-state resets (React's "adjust state during render" pattern).
  let state = stored;
  if (state.tree !== tree) {
    state = { tree, expanded: expandedToDepth(tree, initialExpandDepth), matches: [], index: 0, selected: null };
  }
  if (state.matches !== matches) {
    state = { ...state, matches, index: 0, expanded: reveal(tree, state.expanded, revealIds(matches, 0)) };
  }
  if (state !== stored) setStored(state);

  const rows = useMemo(() => visibleRows(tree, state.expanded), [tree, state.expanded]);
  const rowIndex = useMemo(() => rowIndexByNode(rows), [rows]);
  const matchSet = useMemo(() => new Set(matches), [matches]);

  const currentMatch = matches.length > 0 ? matches[state.index] ?? null : null;

  const toggle = useCallback((id: number) => {
    setStored((s) => ({ ...s, expanded: toggleIn(s.expanded, id) }));
  }, []);

  const go = useCallback((delta: number) => {
    setStored((s) => {
      const n = s.matches.length;
      if (n === 0) return s;
      const index = (s.index + delta + n) % n;
      return { ...s, index, expanded: reveal(s.tree, s.expanded, [s.matches[index]!]) };
    });
  }, []);
  const nextMatch = useCallback(() => go(1), [go]);
  const prevMatch = useCallback(() => go(-1), [go]);

  const expandAll = useCallback(() => setStored((s) => ({ ...s, expanded: expandAllOf(s.tree) })), []);
  const collapseAll = useCallback(
    () => setStored((s) => ({ ...s, expanded: expandedToDepth(s.tree, 1) })),
    [],
  );
  const select = useCallback((id: number | null) => setStored((s) => ({ ...s, selected: id })), []);

  const getPath = useCallback((id: number) => pathOf(tree, id, { root: pathRoot }), [tree, pathRoot]);
  const getCopyText = useCallback((id: number) => nodeCopyText(tree.nodes[id]!), [tree]);

  return {
    tree,
    rows,
    rowIndex,
    matches,
    matchSet,
    matchIndex: state.index,
    currentMatch,
    currentRowIndex: currentMatch !== null ? rowIndex.get(currentMatch) ?? null : null,
    selected: state.selected,
    expanded: state.expanded,
    toggle,
    nextMatch,
    prevMatch,
    expandAll,
    collapseAll,
    select,
    getPath,
    getCopyText,
  };
}

export type JsonViewerController = ReturnType<typeof useJsonViewer>;
