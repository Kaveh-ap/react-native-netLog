import { describe, expect, it } from 'vitest';
import { buildTree, expandAll, expandedToDepth, reveal, searchTree, visibleRows } from '../src/core';

// Run with: PERF=1 npx vitest run test/perf.test.ts
const enabled = !!process.env.PERF;

function makePayload(items: number) {
  return {
    status: 200,
    data: {
      products: Array.from({ length: items }, (_, i) => ({
        id: 1_000_000 + i,
        title: `Product ${i} wireless headphones with noise cancelling`,
        price: { selling: 4_890_000 + i, rrp: 5_490_000, discount_percent: 11 },
        rating: { rate: 4.4, count: 1287 },
        variants: [
          { id: i * 10 + 1, color: 'Black', stock: i % 4 },
          { id: i * 10 + 2, color: 'White', stock: 0 },
        ],
        images: [`https://cdn.example.com/p/${i}-1.jpg`, `https://cdn.example.com/p/${i}-2.jpg`],
        is_fast_shipping: i % 2 === 0,
      })),
    },
  };
}

function time<T>(fn: () => T): [T, number] {
  const t = performance.now();
  const r = fn();
  return [r, performance.now() - t];
}

describe.skipIf(!enabled)('performance', () => {
  for (const items of [2_000, 20_000]) {
    it(`${items} products`, () => {
      const payload = makePayload(items);
      const json = JSON.stringify(payload);
      const [, parseMs] = time(() => JSON.parse(json));
      const [tree, buildMs] = time(() => buildTree(payload));
      const [collapsedRows, rowsMs] = time(() => visibleRows(tree, expandedToDepth(tree, 2)));
      const [allRows, allRowsMs] = time(() => visibleRows(tree, expandAll(tree)));
      const [, firstSearchMs] = time(() => searchTree(tree, 'white'));
      const [hits, searchMs] = time(() => searchTree(tree, 'stock'));
      const [, revealMs] = time(() => reveal(tree, expandedToDepth(tree, 2), hits.slice(0, 100)));

      console.log(
        [
          `${items} products · ${(json.length / 1024 / 1024).toFixed(1)} MB · ${tree.nodes.length} nodes`,
          `  JSON.parse            ${parseMs.toFixed(1)} ms`,
          `  buildTree             ${buildMs.toFixed(1)} ms`,
          `  rows (depth 2)        ${rowsMs.toFixed(1)} ms  → ${collapsedRows.length} rows`,
          `  rows (expand all)     ${allRowsMs.toFixed(1)} ms  → ${allRows.length} rows`,
          `  search (first, index) ${firstSearchMs.toFixed(1)} ms`,
          `  search (cached index) ${searchMs.toFixed(1)} ms  → ${hits.length} hits`,
          `  reveal 100 hits       ${revealMs.toFixed(1)} ms`,
        ].join('\n'),
      );
      expect(tree.nodes.length).toBeGreaterThan(items * 10);
    });
  }
});
