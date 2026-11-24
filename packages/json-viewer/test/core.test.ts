import { describe, expect, it } from 'vitest';
import {
  buildTree,
  expandAll,
  expandedToDepth,
  formatKey,
  formatValue,
  getPath,
  highlightRanges,
  parseJson,
  reveal,
  rowIndexByNode,
  searchTree,
  splitByRanges,
  summary,
  toggle,
  visibleRows,
  type JsonTree,
  type Row,
} from '../src/core';

const sample = {
  status: 200,
  data: {
    product: {
      id: 14812763,
      title: 'Wireless Headphones',
      in_stock: true,
      variants: [
        { id: 1, color: 'Black', stock: 3 },
        { id: 2, color: 'White', stock: 0 },
      ],
      warranty: null,
      'content-type': 'x',
    },
    tags: [],
  },
};

const render = (tree: JsonTree, rows: Row[]) =>
  rows.map((r) => {
    const n = tree.nodes[r.nodeId]!;
    const indent = '  '.repeat(r.depth);
    const key = formatKey(n);
    const prefix = key ? key + ': ' : '';
    switch (r.type) {
      case 'open':
        return indent + prefix + (n.kind === 'array' ? '[' : '{');
      case 'close':
        return indent + (n.kind === 'array' ? ']' : '}');
      case 'collapsed':
        return indent + prefix + summary(n);
      default:
        return indent + prefix + formatValue(n);
    }
  });

describe('buildTree', () => {
  it('flattens in pre-order with subtree ends', () => {
    const t = buildTree({ a: { b: 1 }, c: [true, null] });
    expect(t.nodes.map((n) => [n.key, n.kind, n.depth, n.end])).toEqual([
      [undefined, 'object', 0, 6],
      ['a', 'object', 1, 3],
      ['b', 'number', 2, 3],
      ['c', 'array', 1, 6],
      [0, 'boolean', 2, 5],
      [1, 'null', 2, 6],
    ]);
    expect(t.nodes[3]!.parent).toBe(0);
    expect(t.nodes[4]!.parent).toBe(3);
  });

  it('handles primitives at the root', () => {
    const t = buildTree('hi');
    expect(t.nodes).toHaveLength(1);
    expect(visibleRows(t, new Set()).map((r) => r.type)).toEqual(['value']);
  });

  it('cuts cycles', () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    const t = buildTree(a);
    const self = t.nodes.find((n) => n.key === 'self')!;
    expect(self.kind).toBe('string');
    expect(self.value).toBe('[Circular]');
  });

  it('keeps shared (non-cyclic) references', () => {
    const shared = { v: 1 };
    const t = buildTree({ a: shared, b: shared });
    expect(t.nodes.filter((n) => n.key === 'v')).toHaveLength(2);
  });

  it('survives very deep nesting without recursion', () => {
    let v: unknown = 0;
    for (let i = 0; i < 20000; i++) v = [v];
    const t = buildTree(v);
    expect(t.nodes).toHaveLength(20001);
    expect(t.nodes[0]!.end).toBe(20001);
  });
});

describe('visibleRows', () => {
  it('renders an expanded tree with brackets', () => {
    const t = buildTree({ a: { b: 1 }, c: [] });
    expect(render(t, visibleRows(t, expandAll(t)))).toEqual([
      '{',
      '  "a": {',
      '    "b": 1',
      '  }',
      '  "c": []',
      '}',
    ]);
  });

  it('skips collapsed subtrees', () => {
    const t = buildTree(sample);
    const rows = visibleRows(t, expandedToDepth(t, 2));
    expect(render(t, rows)).toEqual([
      '{',
      '  "status": 200',
      '  "data": {',
      '    "product": { 6 keys }',
      '    "tags": []',
      '  }',
      '}',
    ]);
  });

  it('toggle collapses and expands', () => {
    const t = buildTree(sample);
    const data = t.nodes.find((n) => n.key === 'data')!.id;
    const e1 = toggle(expandedToDepth(t, 2), data);
    expect(render(t, visibleRows(t, e1))).toEqual(['{', '  "status": 200', '  "data": { 2 keys }', '}']);
    expect(toggle(e1, data).has(data)).toBe(true);
  });

  it('closes several levels at once at the end', () => {
    const t = buildTree({ a: { b: { c: 1 } } });
    const rows = visibleRows(t, expandAll(t));
    expect(rows.slice(-3).map((r) => r.type)).toEqual(['close', 'close', 'close']);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('maps node ids to row indexes', () => {
    const t = buildTree(sample);
    const rows = visibleRows(t, expandAll(t));
    const map = rowIndexByNode(rows);
    const stock = t.nodes.find((n) => n.key === 'stock')!.id;
    expect(rows[map.get(stock)!]!.nodeId).toBe(stock);
  });
});

describe('search', () => {
  const t = buildTree(sample);

  it('matches keys and values, case-insensitive by default', () => {
    const hits = searchTree(t, 'STOCK').map((id) => getPath(t, id));
    expect(hits).toEqual([
      '$.data.product.in_stock',
      '$.data.product.variants[0].stock',
      '$.data.product.variants[1].stock',
    ]);
  });

  it('respects scope and case sensitivity', () => {
    expect(searchTree(t, 'black', { scope: 'keys' })).toEqual([]);
    expect(searchTree(t, 'black', { scope: 'values' }).map((id) => getPath(t, id))).toEqual([
      '$.data.product.variants[0].color',
    ]);
    expect(searchTree(t, 'black', { caseSensitive: true })).toEqual([]);
  });

  it('does not match array indexes as keys', () => {
    expect(searchTree(t, '0', { scope: 'keys' })).toEqual([]);
  });

  it('matches numbers, booleans and null by their text', () => {
    expect(searchTree(t, '14812763').map((id) => getPath(t, id))).toEqual(['$.data.product.id']);
    expect(searchTree(t, 'null').map((id) => getPath(t, id))).toEqual(['$.data.product.warranty']);
  });

  it('reveal expands only the ancestors needed', () => {
    const collapsed = expandedToDepth(t, 1);
    const hit = searchTree(t, 'white')[0]!;
    const e = reveal(t, collapsed, [hit]);
    const rows = render(t, visibleRows(t, e));
    expect(rows).toContain('          "color": "White"');
    expect(rows).toContain('        0: { 3 keys }'); // sibling variant stays collapsed
    expect(reveal(t, e, [hit])).toBe(e); // no-op returns same set
  });
});

describe('getPath', () => {
  const t = buildTree(sample);
  it('uses dot, index and bracket notation', () => {
    const ct = t.nodes.find((n) => n.key === 'content-type')!.id;
    expect(getPath(t, ct)).toBe('$.data.product["content-type"]');
    expect(getPath(t, 0)).toBe('$');
    expect(getPath(t, ct, { root: 'response' })).toBe('response.data.product["content-type"]');
  });
});

describe('format', () => {
  it('quotes and truncates strings on one line', () => {
    const t = buildTree({ s: 'a\nb', long: 'x'.repeat(50) });
    expect(formatValue(t.nodes[1]!)).toBe('"a\\nb"');
    expect(formatValue(t.nodes[2]!, 10)).toBe('"xxxxxxxx…');
  });

  it('finds all highlight ranges and splits text', () => {
    const r = highlightRanges('"Stock stock"', 'stock');
    expect(r).toEqual([
      [1, 6],
      [7, 12],
    ]);
    expect(splitByRanges('"Stock stock"', r)).toEqual([
      { text: '"', hit: false },
      { text: 'Stock', hit: true },
      { text: ' ', hit: false },
      { text: 'stock', hit: true },
      { text: '"', hit: false },
    ]);
  });

  it('parseJson reports errors', () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJson('{oops').ok).toBe(false);
  });
});
