import { netlogGlobal } from './global';
import type { NetworkEntry } from './types';

export type MockAction =
  /** Answer without touching the network. */
  | { type: 'respond'; status: number; body?: string; headers?: Record<string, string>; delayMs?: number }
  /** Send the real request after a delay. */
  | { type: 'delay'; ms: number }
  /** Fail like a broken connection. */
  | { type: 'fail'; error?: 'Network error' | 'Timeout' };

export interface MockRule {
  id: string;
  enabled: boolean;
  /** HTTP method, or '*' for any. */
  method: string;
  /**
   * Matched against the full URL. With `*` it's a wildcard pattern
   * (`*\/v1/cart/*`); without, a plain "contains" match.
   */
  url: string;
  action: MockAction;
  /** Times this rule answered a request (this session). */
  hits: number;
}

export type MockRuleInput = Omit<MockRule, 'id' | 'hits' | 'enabled'> & { enabled?: boolean };

/**
 * - `slow`: every request waits {@link SLOW_DELAY_MS} first
 * - `flaky`: {@link FLAKY_FAILURE_RATE} of requests fail with a network error
 * - `offline`: every request fails with a network error (mock rules still answer)
 */
export type NetworkCondition = 'off' | 'slow' | 'flaky' | 'offline';

export const SLOW_DELAY_MS = 2000;
export const FLAKY_FAILURE_RATE = 0.1;

/** Optional persistence, e.g. AsyncStorage. */
export interface MockStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

const STORAGE_KEY = 'netlog:mocks';

interface MocksState {
  rules: MockRule[];
  condition: NetworkCondition;
  listeners: Set<() => void>;
  storage: MockStorage | null;
  seq: number;
}

function state(): MocksState {
  const g = netlogGlobal() as unknown as { mocks?: MocksState };
  g.mocks ??= { rules: [], condition: 'off', listeners: new Set(), storage: null, seq: 0 };
  return g.mocks;
}

function changed(persist = true) {
  const s = state();
  for (const l of s.listeners) l();
  if (persist && s.storage) {
    try {
      const out = s.storage.setItem(STORAGE_KEY, JSON.stringify({ rules: s.rules, condition: s.condition }));
      if (out && typeof (out as Promise<void>).catch === 'function') (out as Promise<void>).catch(() => undefined);
    } catch {
      // storage is best-effort
    }
  }
}

export function subscribeMocks(listener: () => void): () => void {
  const set = state().listeners;
  set.add(listener);
  return () => set.delete(listener);
}

export function getMockRules(): MockRule[] {
  return state().rules;
}

export function getNetworkCondition(): NetworkCondition {
  return state().condition;
}

export function setNetworkCondition(condition: NetworkCondition) {
  state().condition = condition;
  changed();
}

export function addMockRule(input: MockRuleInput): MockRule {
  const s = state();
  const rule: MockRule = { enabled: true, ...input, id: `m${Date.now().toString(36)}${++s.seq}`, hits: 0 };
  s.rules = [rule, ...s.rules];
  changed();
  return rule;
}

export function updateMockRule(id: string, patch: Partial<Omit<MockRule, 'id'>>) {
  const s = state();
  s.rules = s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
  changed();
}

export function removeMockRule(id: string) {
  const s = state();
  s.rules = s.rules.filter((r) => r.id !== id);
  changed();
}

export function clearMockRules() {
  state().rules = [];
  changed();
}

/** Loads saved rules and condition, and saves future changes. */
export async function setMockStorage(storage: MockStorage | null) {
  const s = state();
  s.storage = storage;
  if (!storage) return;
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { rules?: MockRule[]; condition?: NetworkCondition };
      if (Array.isArray(saved.rules)) s.rules = saved.rules.map((r) => ({ ...r, hits: 0 }));
      if (saved.condition) s.condition = saved.condition;
      changed(false);
    }
  } catch {
    // corrupt or unavailable storage: start empty
  }
}

const escapeRegExp = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export function urlMatches(pattern: string, url: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (!p.includes('*')) return url.includes(p);
  return new RegExp(`^${p.split('*').map(escapeRegExp).join('.*')}$`).test(url);
}

export function findMockRule(method: string, url: string): MockRule | undefined {
  return state().rules.find(
    (r) => r.enabled && (r.method === '*' || r.method.toUpperCase() === method) && urlMatches(r.url, url),
  );
}

/** A "respond" rule that replays a captured response, matching its method and URL (query ignored). */
export function mockRuleFromEntry(entry: NetworkEntry): MockRuleInput {
  const base = entry.url.split('#')[0]!.split('?')[0]!;
  const contentType = entry.responseHeaders?.['content-type'];
  return {
    method: entry.method,
    url: `${base}*`,
    action: {
      type: 'respond',
      status: entry.status && entry.status > 0 ? entry.status : 200,
      body: entry.responseBody ?? '',
      headers: contentType ? { 'content-type': contentType } : { 'content-type': 'application/json' },
    },
  };
}

export type MockDecision =
  | { kind: 'respond'; rule: MockRule; action: Extract<MockAction, { type: 'respond' }>; delayMs: number }
  | { kind: 'delay'; delayMs: number; rule?: MockRule; label: string }
  | { kind: 'fail'; error: 'Network error' | 'Timeout'; delayMs: number; rule?: MockRule; label: string };

/** What to do with a request: answer it, delay it, fail it, or nothing (null). Counts rule hits. */
export function decideMock(method: string, url: string, random: () => number = Math.random): MockDecision | null {
  const s = state();
  const slowDelay = s.condition === 'slow' ? SLOW_DELAY_MS : 0;
  const found = findMockRule(method, url);
  if (found) {
    const rule: MockRule = { ...found, hits: found.hits + 1 };
    s.rules = s.rules.map((r) => (r.id === found.id ? rule : r));
    changed(false);
    const a = rule.action;
    if (a.type === 'respond') return { kind: 'respond', rule, action: a, delayMs: (a.delayMs ?? 0) + slowDelay };
    if (a.type === 'delay') return { kind: 'delay', rule, delayMs: a.ms + slowDelay, label: `Delayed ${a.ms} ms` };
    return { kind: 'fail', rule, error: a.error ?? 'Network error', delayMs: slowDelay, label: a.error ?? 'Network error' };
  }
  if (s.condition === 'offline') return { kind: 'fail', error: 'Network error', delayMs: 0, label: 'Offline' };
  if (s.condition === 'flaky' && random() < FLAKY_FAILURE_RATE) {
    return { kind: 'fail', error: 'Network error', delayMs: 0, label: 'Flaky network' };
  }
  if (slowDelay) return { kind: 'delay', delayMs: slowDelay, label: 'Slow network' };
  return null;
}
