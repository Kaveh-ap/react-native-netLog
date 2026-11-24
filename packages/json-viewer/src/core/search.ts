import { formatKey, formatValue } from './format';
import { isContainer, type JsonTree } from './tree';

export type SearchScope = 'all' | 'keys' | 'values';

export interface SearchOptions {
  scope?: SearchScope;
  caseSensitive?: boolean;
  /** Must match the viewer's truncation so every match is visibly highlighted. */
  maxValueLength?: number;
}

interface Index {
  keys: string[];
  values: string[];
  keysLower: string[];
  valuesLower: string[];
}

const indexCache = new WeakMap<JsonTree, Map<number | undefined, Index>>();

function getIndex(tree: JsonTree, maxValueLength: number | undefined): Index {
  let byLen = indexCache.get(tree);
  if (!byLen) {
    byLen = new Map();
    indexCache.set(tree, byLen);
  }
  let idx = byLen.get(maxValueLength);
  if (!idx) {
    const keys: string[] = [];
    const values: string[] = [];
    for (const n of tree.nodes) {
      // array indexes aren't searchable keys
      keys.push(typeof n.key === 'string' ? formatKey(n) : '');
      values.push(isContainer(n) ? '' : formatValue(n, maxValueLength));
    }
    idx = {
      keys,
      values,
      keysLower: keys.map((s) => s.toLowerCase()),
      valuesLower: values.map((s) => s.toLowerCase()),
    };
    byLen.set(maxValueLength, idx);
  }
  return idx;
}

/** Node ids (pre-order) whose key or displayed value contains `query`. */
export function searchTree(tree: JsonTree, query: string, options: SearchOptions = {}): number[] {
  const { scope = 'all', caseSensitive = false, maxValueLength } = options;
  if (!query) return [];
  const idx = getIndex(tree, maxValueLength);
  const needle = caseSensitive ? query : query.toLowerCase();
  const keys = caseSensitive ? idx.keys : idx.keysLower;
  const values = caseSensitive ? idx.values : idx.valuesLower;
  const out: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    if (
      (scope !== 'values' && keys[i]!.includes(needle)) ||
      (scope !== 'keys' && values[i]!.includes(needle))
    ) {
      out.push(i);
    }
  }
  return out;
}
