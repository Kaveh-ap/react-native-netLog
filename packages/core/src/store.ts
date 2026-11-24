import { netlogGlobal } from './global';
import type { NetworkEntry, StoreEvent, StoreListener } from './types';

function emit(event: StoreEvent) {
  for (const l of netlogGlobal().listeners) {
    try {
      l(event);
    } catch {
      // a broken listener must never break the app's networking
    }
  }
}

export function addEntry(init: Omit<NetworkEntry, 'id'>): NetworkEntry {
  const g = netlogGlobal();
  const entry: NetworkEntry = { ...init, id: ++g.seq };
  g.entries.push(entry);
  const overflow = g.entries.length - g.config.maxEntries;
  if (overflow > 0) g.entries.splice(0, overflow);
  emit({ type: 'add', entry });
  return entry;
}

/** Call after mutating an entry returned by `addEntry`. */
export function updateEntry(entry: NetworkEntry) {
  emit({ type: 'update', entry });
}

/** Snapshot, oldest first. */
export function getEntries(): NetworkEntry[] {
  return netlogGlobal().entries.slice();
}

export function clearEntries() {
  netlogGlobal().entries.length = 0;
  emit({ type: 'clear' });
}

export function subscribe(listener: StoreListener): () => void {
  const set = netlogGlobal().listeners;
  set.add(listener);
  return () => set.delete(listener);
}

export function setPaused(paused: boolean) {
  netlogGlobal().paused = paused;
}

export function isPaused(): boolean {
  return netlogGlobal().paused;
}
