export type NodeKind =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined';

export interface JsonNode {
  /** Index in `tree.nodes` (pre-order). */
  id: number;
  /** Parent node id, or -1 for the root. */
  parent: number;
  depth: number;
  /** Object key, array index, or undefined for the root. */
  key: string | number | undefined;
  kind: NodeKind;
  /** The original value (primitive, or a reference to the container). */
  value: unknown;
  /** Number of direct children (0 for primitives). */
  childCount: number;
  /** Exclusive end of this node's subtree in `tree.nodes`. */
  end: number;
}

export interface JsonTree {
  nodes: JsonNode[];
  root: unknown;
}

export function kindOf(value: unknown): NodeKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    case 'number':
    case 'bigint':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'undefined':
      return 'undefined';
    default:
      // functions, symbols: shown as strings
      return 'string';
  }
}

export function isContainer(node: JsonNode): boolean {
  return node.kind === 'object' || node.kind === 'array';
}

function entriesOf(value: unknown, kind: NodeKind): Array<[string | number, unknown]> {
  if (kind === 'array') return (value as unknown[]).map((v, i) => [i, v]);
  if (kind === 'object') return Object.entries(value as Record<string, unknown>);
  return [];
}

/**
 * Flattens a value into a pre-order node array. Iterative, so deeply nested
 * input can't overflow the call stack. Cycles are cut and shown as "[Circular]".
 */
export function buildTree(root: unknown): JsonTree {
  const nodes: JsonNode[] = [];
  type Frame = { value: unknown; key: string | number | undefined; depth: number; parent: number };
  const stack: Frame[] = [{ value: root, key: undefined, depth: 0, parent: -1 }];
  // ancestors on the current path, for cycle detection and `end` bookkeeping
  const open: number[] = [];
  const onPath = new Set<unknown>();

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const id = nodes.length;

    // close containers whose subtree ended before this node
    while (open.length > 0 && nodes[open[open.length - 1]!]!.depth >= frame.depth) {
      const closed = nodes[open.pop()!]!;
      closed.end = id;
      onPath.delete(closed.value);
    }

    let value = frame.value;
    let kind = kindOf(value);
    if ((kind === 'object' || kind === 'array') && onPath.has(value)) {
      value = '[Circular]';
      kind = 'string';
    }

    const entries = entriesOf(value, kind);
    nodes.push({
      id,
      parent: frame.parent,
      depth: frame.depth,
      key: frame.key,
      kind,
      value,
      childCount: entries.length,
      end: id + 1,
    });

    if (kind === 'object' || kind === 'array') {
      open.push(id);
      onPath.add(value);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [k, v] = entries[i]!;
        stack.push({ value: v, key: k, depth: frame.depth + 1, parent: id });
      }
    }
  }

  while (open.length > 0) nodes[open.pop()!]!.end = nodes.length;
  return { nodes, root };
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Ids of all ancestors of `id`, nearest first. */
export function ancestorsOf(tree: JsonTree, id: number): number[] {
  const out: number[] = [];
  let p = tree.nodes[id]?.parent ?? -1;
  while (p >= 0) {
    out.push(p);
    p = tree.nodes[p]!.parent;
  }
  return out;
}
