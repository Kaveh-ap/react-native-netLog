import type { JsonNode } from './tree';

export const DEFAULT_MAX_VALUE_LENGTH = 200;

/** Single-line display text for a primitive. Strings are JSON-quoted so newlines stay visible as `\n`. */
export function formatValue(node: JsonNode, maxLength = DEFAULT_MAX_VALUE_LENGTH): string {
  let text: string;
  switch (node.kind) {
    case 'string':
      text = JSON.stringify(String(node.value));
      break;
    case 'null':
      text = 'null';
      break;
    case 'undefined':
      text = 'undefined';
      break;
    case 'object':
    case 'array':
      return summary(node);
    default:
      text = String(node.value);
  }
  if (text.length > maxLength) text = text.slice(0, maxLength - 1) + '…';
  return text;
}

/** `"name"` for object keys, `0` for array indexes, empty for the root. */
export function formatKey(node: JsonNode): string {
  if (node.key === undefined) return '';
  return typeof node.key === 'number' ? String(node.key) : JSON.stringify(node.key);
}

export function summary(node: JsonNode): string {
  const n = node.childCount;
  if (node.kind === 'array') return n === 0 ? '[]' : `[ ${n} ${n === 1 ? 'item' : 'items'} ]`;
  if (node.kind === 'object') return n === 0 ? '{}' : `{ ${n} ${n === 1 ? 'key' : 'keys'} }`;
  return '';
}

export function openBracket(node: JsonNode): string {
  return node.kind === 'array' ? '[' : '{';
}

export function closeBracket(node: JsonNode): string {
  return node.kind === 'array' ? ']' : '}';
}

/** Text to put on the clipboard: raw string contents, or pretty JSON. */
export function copyText(node: JsonNode): string {
  if (node.kind === 'string') return String(node.value);
  if (node.kind === 'undefined') return 'undefined';
  try {
    return JSON.stringify(node.value, null, 2) ?? String(node.value);
  } catch {
    return String(node.value);
  }
}

export type Range = readonly [start: number, end: number];

/** All non-overlapping occurrences of `query` in `text`. */
export function highlightRanges(text: string, query: string, caseSensitive = false): Range[] {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: Range[] = [];
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i < 0) break;
    out.push([i, i + needle.length]);
    from = i + needle.length;
  }
  return out;
}

export interface Segment {
  text: string;
  hit: boolean;
}

export function splitByRanges(text: string, ranges: readonly Range[]): Segment[] {
  if (ranges.length === 0) return [{ text, hit: false }];
  const out: Segment[] = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s > at) out.push({ text: text.slice(at, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    at = e;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}
