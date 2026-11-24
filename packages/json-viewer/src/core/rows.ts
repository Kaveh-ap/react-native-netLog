import { ancestorsOf, isContainer, type JsonTree } from './tree';

/**
 * - `open`: an expanded container's first line (`"key": {`)
 * - `collapsed`: a collapsed or empty container on one line (`"key": { 4 keys }`, `[]`)
 * - `value`: a primitive
 * - `close`: an expanded container's closing bracket
 */
export type RowType = 'open' | 'collapsed' | 'value' | 'close';

export interface Row {
  nodeId: number;
  type: RowType;
  depth: number;
  /** Stable list key. */
  key: string;
}

export type Expanded = ReadonlySet<number>;

/** Containers shallower than `depth` start expanded (depth 1 = only the root). */
export function expandedToDepth(tree: JsonTree, depth: number): Set<number> {
  const out = new Set<number>();
  for (const n of tree.nodes) {
    if (n.depth < depth && isContainer(n) && n.childCount > 0) out.add(n.id);
  }
  return out;
}

export function expandAll(tree: JsonTree): Set<number> {
  return expandedToDepth(tree, Infinity);
}

export function toggle(expanded: Expanded, id: number): Set<number> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Returns `expanded` plus every ancestor of `ids`, or the same set if nothing changed. */
export function reveal(tree: JsonTree, expanded: Expanded, ids: Iterable<number>): Expanded {
  let next: Set<number> | null = null;
  for (const id of ids) {
    for (const a of ancestorsOf(tree, id)) {
      if (!(next ?? expanded).has(a)) {
        next ??= new Set(expanded);
        next.add(a);
      }
    }
  }
  return next ?? expanded;
}

/** The rows to render for the current expansion state. O(visible + skipped subtrees). */
export function visibleRows(tree: JsonTree, expanded: Expanded): Row[] {
  const { nodes } = tree;
  const rows: Row[] = [];
  const closing: number[] = [];
  let i = 0;

  const flushClosing = (upTo: number) => {
    while (closing.length > 0 && nodes[closing[closing.length - 1]!]!.end <= upTo) {
      const id = closing.pop()!;
      rows.push({ nodeId: id, type: 'close', depth: nodes[id]!.depth, key: 'c' + id });
    }
  };

  while (i < nodes.length) {
    flushClosing(i);
    const n = nodes[i]!;
    if (isContainer(n)) {
      if (n.childCount > 0 && expanded.has(i)) {
        rows.push({ nodeId: i, type: 'open', depth: n.depth, key: 'o' + i });
        closing.push(i);
        i++;
      } else {
        rows.push({ nodeId: i, type: 'collapsed', depth: n.depth, key: 'o' + i });
        i = n.end; // skip the hidden subtree
      }
    } else {
      rows.push({ nodeId: i, type: 'value', depth: n.depth, key: 'o' + i });
      i++;
    }
  }
  flushClosing(Infinity);
  return rows;
}

/** Map from node id to the index of its first row, for scrolling to a node. */
export function rowIndexByNode(rows: readonly Row[]): Map<number, number> {
  const map = new Map<number, number>();
  rows.forEach((r, idx) => {
    if (r.type !== 'close') map.set(r.nodeId, idx);
  });
  return map;
}
