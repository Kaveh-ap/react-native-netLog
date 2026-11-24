import type { NetLogConfig } from './config';
import { defaultConfig } from './defaults';
import type { NetworkEntry, StoreListener } from './types';

/**
 * All state lives on one global object, so several copies of this package
 * (e.g. one per Module Federation bundle) share the same store and config.
 */
export interface NetLogGlobal {
  version: 1;
  seq: number;
  entries: NetworkEntry[];
  listeners: Set<StoreListener>;
  paused: boolean;
  config: NetLogConfig;
  configListeners: Set<(config: NetLogConfig) => void>;
  /** Interceptor bookkeeping, owned by xhr.ts. */
  xhr?: unknown;
  /** Pairing connection, owned by pairing.ts. */
  pairing?: unknown;
}

const KEY = '__NETLOG__';

export function netlogGlobal(): NetLogGlobal {
  const root = globalThis as unknown as Record<string, NetLogGlobal | undefined>;
  let g = root[KEY];
  if (!g) {
    g = {
      version: 1,
      seq: 0,
      entries: [],
      listeners: new Set(),
      paused: false,
      config: defaultConfig(),
      configListeners: new Set(),
    };
    root[KEY] = g;
  }
  return g;
}

/** Test helper: forget all state. */
export function resetNetLogGlobal() {
  delete (globalThis as unknown as Record<string, unknown>)[KEY];
}
