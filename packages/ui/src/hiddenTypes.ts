import { useSyncExternalStore } from 'react';
import type { NetworkEntry } from 'react-native-netlog';

export interface ResourceType {
  id: string;
  label: string;
  extensions: string[];
  /** Matched as prefixes of the response content-type. */
  mimeTypes: string[];
  image?: boolean;
}

export const RESOURCE_TYPES: ResourceType[] = [
  { id: 'webp', label: 'WebP', extensions: ['webp'], mimeTypes: ['image/webp'], image: true },
  { id: 'gif', label: 'GIF', extensions: ['gif'], mimeTypes: ['image/gif'], image: true },
  { id: 'svg', label: 'SVG', extensions: ['svg'], mimeTypes: ['image/svg'], image: true },
  { id: 'png', label: 'PNG', extensions: ['png'], mimeTypes: ['image/png'], image: true },
  { id: 'jpeg', label: 'JPEG', extensions: ['jpg', 'jpeg'], mimeTypes: ['image/jpeg', 'image/jpg'], image: true },
  { id: 'avif', label: 'AVIF', extensions: ['avif'], mimeTypes: ['image/avif'], image: true },
  { id: 'ico', label: 'ICO', extensions: ['ico'], mimeTypes: ['image/x-icon', 'image/vnd.microsoft.icon'], image: true },
  { id: 'font', label: 'Fonts', extensions: ['woff', 'woff2', 'ttf', 'otf'], mimeTypes: ['font/', 'application/font', 'application/x-font'] },
  { id: 'video', label: 'Video', extensions: ['mp4', 'webm', 'mov', 'm3u8', 'ts'], mimeTypes: ['video/', 'application/vnd.apple.mpegurl'] },
  { id: 'audio', label: 'Audio', extensions: ['mp3', 'aac', 'm4a', 'wav', 'ogg'], mimeTypes: ['audio/'] },
];

const BY_EXTENSION = new Map(RESOURCE_TYPES.flatMap((t) => t.extensions.map((e) => [e, t.id] as const)));

/** The resource type of a request, from the URL's extension or else the response content-type. */
export function resourceTypeOf(entry: NetworkEntry): string | undefined {
  const path = entry.url.split('#')[0]!.split('?')[0]!;
  const dot = path.lastIndexOf('.');
  if (dot > path.lastIndexOf('/')) {
    const id = BY_EXTENSION.get(path.slice(dot + 1).toLowerCase());
    if (id) return id;
  }
  const ct = entry.responseHeaders?.['content-type']?.toLowerCase();
  if (!ct) return undefined;
  return RESOURCE_TYPES.find((t) => t.mimeTypes.some((m) => ct.startsWith(m)))?.id;
}

// Shared for the app session, so the choice survives closing and reopening the screen.
const KEY = '__NETLOG_UI_HIDDEN__';
type Store = { hidden: ReadonlySet<string>; listeners: Set<() => void>; initialized: boolean };
function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  g[KEY] ??= { hidden: new Set(), listeners: new Set(), initialized: false };
  return g[KEY]!;
}

export function getHiddenTypes(): ReadonlySet<string> {
  return store().hidden;
}

export function setHiddenTypes(ids: Iterable<string>) {
  const s = store();
  s.hidden = new Set(ids);
  s.initialized = true;
  for (const l of s.listeners) l();
}

/** Applies app defaults once per session; later user changes win. */
export function initHiddenTypes(ids: Iterable<string> | undefined) {
  const s = store();
  if (s.initialized || !ids) return;
  setHiddenTypes(ids);
}

function subscribe(listener: () => void) {
  const s = store();
  s.listeners.add(listener);
  return () => s.listeners.delete(listener);
}

export function useHiddenTypes(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getHiddenTypes, getHiddenTypes);
}
