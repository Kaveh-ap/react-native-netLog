import { assertFeature, getConfig, isFeatureEnabled } from './config';
import { netlogGlobal } from './global';
import { clearEntries, getEntries, setPaused, subscribe } from './store';
import type { NetworkEntry, StoreEvent } from './types';

export const PROTOCOL_VERSION = 1;
export const PAIRING_LINK_PREFIX = 'netlog://pair';

export interface PairingInfo {
  /** WebSocket URL of the desktop, e.g. `ws://192.168.1.5:9099/device`. */
  url: string;
  token: string;
  /** Desktop name, for display. */
  name?: string;
}

export interface DeviceInfo {
  id?: string;
  name?: string;
  platform?: string;
  osVersion?: string;
  appName?: string;
  appVersion?: string;
  [extra: string]: unknown;
}

export type PairingStatus =
  | { state: 'idle' }
  | { state: 'connecting'; url: string; attempt: number }
  | { state: 'connected'; url: string; desktopName?: string; sent: number }
  | { state: 'error'; url: string; message: string };

// ---------------------------------------------------------------- payloads

function encode(v: string) {
  return encodeURIComponent(v);
}

/** The text the desktop puts in its QR code. */
export function createPairingLink(info: PairingInfo): string {
  let link = `${PAIRING_LINK_PREFIX}?u=${encode(info.url)}&t=${encode(info.token)}`;
  if (info.name) link += `&n=${encode(info.name)}`;
  return link;
}

/** The short form people can type: `192.168.1.5:9099 4821-7730`. */
export function createPairingCode(host: string, port: number, token: string): string {
  return `${host}:${port} ${token}`;
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    } catch {
      // ignore malformed pairs
    }
  }
  return out;
}

const CODE = /^(?:(wss?):\/\/)?([A-Za-z0-9.-]+|\[[0-9a-fA-F:]+\]):(\d{1,5})(\/[^\s#]*)?[\s#]+([A-Za-z0-9-]{4,64})$/;

/** Accepts a pairing link (from the QR code) or a typed pairing code. Returns null if it's neither. */
export function parsePairingPayload(text: string): PairingInfo | null {
  const t = text.trim();
  if (t.startsWith(PAIRING_LINK_PREFIX)) {
    const q = parseQuery(t.slice(t.indexOf('?') + 1));
    if (!q.u || !q.t || !/^wss?:\/\//.test(q.u)) return null;
    return { url: q.u, token: q.t, name: q.n };
  }
  const m = CODE.exec(t);
  if (!m) return null;
  const [, scheme = 'ws', host, port, path = '/device', token] = m;
  return { url: `${scheme}://${host}:${port}${path}`, token: token! };
}

// ---------------------------------------------------------------- connection

interface Connection {
  info: PairingInfo;
  device: DeviceInfo;
  socket: WebSocket | null;
  status: PairingStatus;
  queue: Array<{ op: 'upsert'; entry: NetworkEntry } | { op: 'clear' }>;
  flushTimer: ReturnType<typeof setInterval> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  unsubscribe: (() => void) | null;
  attempt: number;
  stopped: boolean;
  sent: number;
  WebSocketImpl: typeof WebSocket;
}

interface PairingGlobal {
  connection: Connection | null;
  status: PairingStatus;
  listeners: Set<(s: PairingStatus) => void>;
}

const IDLE: PairingStatus = { state: 'idle' };

function pairingGlobal(): PairingGlobal {
  const g = netlogGlobal();
  g.pairing ??= { connection: null, status: IDLE, listeners: new Set() } satisfies PairingGlobal;
  return g.pairing as PairingGlobal;
}

function setStatus(conn: Connection | null, status: PairingStatus) {
  const p = pairingGlobal();
  if (conn) conn.status = status;
  if (conn && p.connection !== conn) return; // stale connection
  p.status = status;
  for (const l of p.listeners) l(status);
}

export function getPairingStatus(): PairingStatus {
  return pairingGlobal().status;
}

export function subscribePairing(listener: (s: PairingStatus) => void): () => void {
  const set = pairingGlobal().listeners;
  set.add(listener);
  return () => set.delete(listener);
}

function redact(entry: NetworkEntry): NetworkEntry {
  const names = getConfig().redactHeaders.map((h) => h.toLowerCase());
  if (names.length === 0) return entry;
  const mask = (headers?: Record<string, string>) => {
    if (!headers) return headers;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) out[k] = names.includes(k.toLowerCase()) ? '[redacted]' : v;
    return out;
  };
  return { ...entry, requestHeaders: mask(entry.requestHeaders)!, responseHeaders: mask(entry.responseHeaders) };
}

function send(conn: Connection, message: unknown) {
  conn.socket?.send(JSON.stringify(message));
}

function flush(conn: Connection) {
  if (conn.status.state !== 'connected' || conn.queue.length === 0) return;
  const events = conn.queue.splice(0, conn.queue.length);
  send(conn, { type: 'events', events });
  conn.sent += events.length;
  setStatus(conn, { ...conn.status, sent: conn.sent });
}

function onStore(conn: Connection, e: StoreEvent) {
  if (e.type === 'clear') {
    conn.queue.length = 0;
    conn.queue.push({ op: 'clear' });
    return;
  }
  // collapse repeated updates of one entry in the same batch
  const i = conn.queue.findIndex((q) => q.op === 'upsert' && q.entry.id === e.entry.id);
  const item = { op: 'upsert' as const, entry: redact(e.entry) };
  if (i >= 0) conn.queue[i] = item;
  else conn.queue.push(item);
}

function open(conn: Connection) {
  if (conn.stopped) return;
  conn.attempt += 1;
  setStatus(conn, { state: 'connecting', url: conn.info.url, attempt: conn.attempt });
  let socket: WebSocket;
  try {
    socket = new conn.WebSocketImpl(conn.info.url);
  } catch (e) {
    setStatus(conn, { state: 'error', url: conn.info.url, message: e instanceof Error ? e.message : String(e) });
    return;
  }
  conn.socket = socket;
  let authFailed = false;

  socket.onopen = () => {
    conn.queue.length = 0;
    send(conn, {
      type: 'hello',
      protocol: PROTOCOL_VERSION,
      token: conn.info.token,
      device: conn.device,
      entries: getEntries().map(redact),
    });
  };
  socket.onmessage = (ev: { data?: unknown }) => {
    let msg: { type?: string; name?: string; command?: string; message?: string; code?: string };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === 'welcome') {
      conn.attempt = 0;
      setStatus(conn, { state: 'connected', url: conn.info.url, desktopName: msg.name ?? conn.info.name, sent: conn.sent });
    } else if (msg.type === 'error') {
      authFailed = msg.code === 'bad-token' || msg.code === 'protocol';
      setStatus(conn, { state: 'error', url: conn.info.url, message: msg.message ?? 'Desktop refused the connection' });
    } else if (msg.type === 'command') {
      if (msg.command === 'clear') clearEntries();
      else if (msg.command === 'pause') setPaused(true);
      else if (msg.command === 'resume') setPaused(false);
    }
  };
  socket.onclose = () => {
    if (conn.socket === socket) conn.socket = null;
    if (conn.stopped || authFailed) return;
    const delay = Math.min(10_000, 500 * 2 ** Math.min(conn.attempt, 5));
    setStatus(conn, { state: 'connecting', url: conn.info.url, attempt: conn.attempt });
    conn.retryTimer = setTimeout(() => open(conn), delay);
  };
  socket.onerror = () => {
    // onclose follows and schedules the retry
  };
}

export interface ConnectOptions {
  device?: DeviceInfo;
  /** For tests or custom environments. Default: global WebSocket. */
  WebSocketImpl?: typeof WebSocket;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Streams captured traffic to a `netlog-desktop` instance. Replaces any
 * existing connection. Throws NetLogFeatureDisabledError when `qrPairing` is off.
 */
export function connectToDesktop(info: PairingInfo, options: ConnectOptions = {}) {
  assertFeature('qrPairing');
  disconnectFromDesktop();
  const WebSocketImpl = options.WebSocketImpl ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WebSocketImpl) throw new Error('NetLog: no WebSocket implementation available');
  const conn: Connection = {
    info,
    device: { id: randomId(), ...options.device },
    socket: null,
    status: IDLE,
    queue: [],
    flushTimer: null,
    retryTimer: null,
    unsubscribe: null,
    attempt: 0,
    stopped: false,
    sent: 0,
    WebSocketImpl,
  };
  pairingGlobal().connection = conn;
  conn.unsubscribe = subscribe((e) => onStore(conn, e));
  conn.flushTimer = setInterval(() => flush(conn), 250);
  open(conn);
}

/** Parses a scanned QR / typed code and connects. Throws on an unrecognized payload. */
export function pairFromPayload(text: string, options?: ConnectOptions): PairingInfo {
  assertFeature('qrPairing');
  const info = parsePairingPayload(text);
  if (!info) throw new Error('NetLog: not a pairing QR code or pairing code');
  connectToDesktop(info, options);
  return info;
}

/**
 * For deep links: returns true if `url` was a NetLog pairing link and pairing
 * started. Returns false (and does nothing) for other URLs or when the feature is off.
 */
export function handleNetLogUrl(url: string, options?: ConnectOptions): boolean {
  if (!url.startsWith(PAIRING_LINK_PREFIX) || !isFeatureEnabled('qrPairing')) return false;
  try {
    pairFromPayload(url, options);
    return true;
  } catch {
    return false;
  }
}

export function disconnectFromDesktop() {
  const p = pairingGlobal();
  const conn = p.connection;
  if (!conn) return;
  conn.stopped = true;
  conn.unsubscribe?.();
  if (conn.flushTimer) clearInterval(conn.flushTimer);
  if (conn.retryTimer) clearTimeout(conn.retryTimer);
  try {
    conn.socket?.close();
  } catch {
    // already closed
  }
  setStatus(conn, IDLE);
  p.connection = null;
}
