import { getConfig } from './config';
import { netlogGlobal } from './global';
import { addEntry, isPaused, updateEntry } from './store';
import { decideMock, type MockAction } from './mocks';
import type { NetworkEntry } from './types';

type XhrCtor = { prototype: XMLHttpRequest };

interface XhrState {
  ctor: XhrCtor;
  open: XMLHttpRequest['open'];
  send: XMLHttpRequest['send'];
  setRequestHeader: XMLHttpRequest['setRequestHeader'];
  addEventListener: XMLHttpRequest['addEventListener'];
  removeEventListener: XMLHttpRequest['removeEventListener'];
}

type Listener = ((ev: unknown) => void) | { handleEvent: (ev: unknown) => void };

/**
 * Listeners added through the standard addEventListener, so a mocked response
 * can call them. (React Native has no global Event constructor, so
 * dispatchEvent can't be used without its private modules.)
 */
const listeners = new WeakMap<XMLHttpRequest, Map<string, Set<Listener>>>();

interface Meta {
  method: string;
  url: string;
  headers: Record<string, string>;
}

const meta = new WeakMap<XMLHttpRequest, Meta>();

function truncate(text: string): string {
  const max = getConfig().maxBodyLength;
  return text.length > max ? text.slice(0, max) + `\n…[truncated ${text.length - max} chars]` : text;
}

function describeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return truncate(body);
  const tag = Object.prototype.toString.call(body).slice(8, -1);
  if (tag === 'FormData') return '[FormData]';
  if (tag === 'Blob') return `[Blob ${(body as { size?: number }).size ?? '?'} bytes]`;
  if (tag === 'ArrayBuffer') return `[ArrayBuffer ${(body as ArrayBuffer).byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[${tag} ${body.byteLength} bytes]`;
  return truncate(String(body));
}

function readResponse(xhr: XMLHttpRequest): string | undefined {
  try {
    const type = xhr.responseType;
    if (type === '' || type === 'text') return truncate(xhr.responseText ?? '');
    if (type === 'json') return truncate(JSON.stringify(xhr.response));
    if (typeof xhr.response === 'string') return truncate(xhr.response);
    const r = xhr.response as { size?: number; byteLength?: number } | null;
    if (r == null) return undefined;
    return `[${type} ${r.size ?? r.byteLength ?? '?'} bytes]`;
  } catch {
    return undefined;
  }
}

const TEXT_TYPE = /json|text|xml|javascript|x-www-form-urlencoded|graphql/i;

type BlobLike = { size?: number; text?: () => Promise<string> };
type FileReaderCtor = new () => {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  result: unknown;
  readAsText(blob: unknown): void;
};

function blobToText(blob: BlobLike): Promise<string | undefined> {
  const Reader = (globalThis as { FileReader?: FileReaderCtor }).FileReader;
  if (Reader) {
    return new Promise((resolve) => {
      const reader = new Reader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsText(blob);
    });
  }
  return typeof blob.text === 'function' ? blob.text().catch(() => undefined) : Promise.resolve(undefined);
}

/**
 * React Native's fetch() asks XHR for a Blob. Reads text-like blobs
 * (JSON, text, XML...) asynchronously; binary content keeps its size label.
 */
function readBlobResponse(xhr: XMLHttpRequest, entry: NetworkEntry) {
  if (xhr.responseType !== 'blob') return;
  const blob = xhr.response as BlobLike | string | null;
  if (typeof blob === 'string') return;
  const contentType = entry.responseHeaders?.['content-type'] ?? '';
  if (!blob || (contentType && !TEXT_TYPE.test(contentType))) return;
  blobToText(blob).then((text) => {
    if (text === undefined) return;
    entry.responseBody = truncate(text);
    updateEntry(entry);
  });
}

export function parseHeaders(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

function isIgnored(method: string, url: string): boolean {
  const line = `${method} ${url}`;
  return getConfig().ignore.some((rule) => (rule instanceof RegExp ? rule.test(line) : rule(method, url)));
}

function captureStack(): string | undefined {
  if (!getConfig().captureStack) return undefined;
  const stack = new Error().stack;
  if (!stack) return undefined;
  const frames = stack
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '));
  // Our own frames come first: captureStack, track, then the patched send().
  // Bundled builds lose file names, so find them by function name.
  const trackAt = frames.findIndex((l) => /^at (?:\S+\.)?track[\s(]/.test(l));
  const callerFrames = trackAt >= 0 ? frames.slice(trackAt + 2) : frames.slice(1);
  return callerFrames
    .filter((l) => !/netlog|xhr\.ts/.test(l))
    .slice(0, 8)
    .join('\n');
}

function track(xhr: XMLHttpRequest, m: Meta, body: unknown): NetworkEntry {
  const entry: NetworkEntry = addEntry({
    kind: 'xhr',
    method: m.method,
    url: m.url,
    requestHeaders: m.headers,
    requestBody: describeBody(body),
    startedAt: Date.now(),
    state: 'pending',
    initiator: captureStack(),
  });

  let finished = false;
  const finish = (error?: string) => {
    if (finished) {
      // error/abort/timeout can arrive after readyState 4; refine the reason
      if (error && entry.error !== error) {
        entry.error = error;
        entry.state = 'error';
        updateEntry(entry);
      }
      return;
    }
    finished = true;
    entry.endedAt = Date.now();
    entry.durationMs = entry.endedAt - entry.startedAt;
    entry.status = xhr.status;
    entry.responseType = xhr.responseType || 'text';
    if (!entry.responseHeaders) entry.responseHeaders = parseHeaders(xhr.getAllResponseHeaders());
    entry.responseBody = readResponse(xhr);
    if (error || xhr.status === 0) {
      entry.state = 'error';
      entry.error = error ?? 'Network error';
    } else {
      entry.state = 'done';
    }
    updateEntry(entry);
    readBlobResponse(xhr, entry);
  };

  xhr.addEventListener('readystatechange', () => {
    if (xhr.readyState === 2 && entry.headersAt === undefined) {
      entry.headersAt = Date.now();
      entry.status = xhr.status;
      entry.responseHeaders = parseHeaders(xhr.getAllResponseHeaders());
      updateEntry(entry);
    } else if (xhr.readyState === 4) {
      finish();
    }
  });
  xhr.addEventListener('error', () => finish('Network error'));
  xhr.addEventListener('timeout', () => finish('Timeout'));
  xhr.addEventListener('abort', () => finish('Aborted'));
  return entry;
}

// ---- mock responses, through the standard XMLHttpRequest interface only

function setProp(xhr: XMLHttpRequest, key: string, value: unknown) {
  try {
    Object.defineProperty(xhr, key, { value, configurable: true, writable: true });
  } catch {
    // non-configurable on this platform: leave it
  }
}

function fire(xhr: XMLHttpRequest, type: string) {
  const event = { type, target: xhr, currentTarget: xhr, srcElement: xhr };
  const handler = (xhr as unknown as Record<string, unknown>)[`on${type}`];
  if (typeof handler === 'function') {
    try {
      (handler as (e: unknown) => void).call(xhr, event);
    } catch (e) {
      setTimeout(() => {
        throw e;
      });
    }
  }
  for (const l of [...(listeners.get(xhr)?.get(type) ?? [])]) {
    try {
      if (typeof l === 'function') l.call(xhr, event);
      else l.handleEvent(event);
    } catch (e) {
      setTimeout(() => {
        throw e;
      });
    }
  }
}

function fakeResponse(xhr: XMLHttpRequest, url: string, action: Extract<MockAction, { type: 'respond' }>) {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(action.headers ?? {})) headers[k.toLowerCase()] = v;
  const raw = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n');
  setProp(xhr, 'status', action.status);
  setProp(xhr, 'statusText', '');
  setProp(xhr, 'responseURL', url);
  setProp(xhr, 'getAllResponseHeaders', () => raw);
  setProp(xhr, 'getResponseHeader', (name: string) => headers[name.toLowerCase()] ?? null);
  setProp(xhr, 'readyState', 2);
  fire(xhr, 'readystatechange');

  const body = action.body ?? '';
  let response: unknown = body;
  if (xhr.responseType === 'json') {
    try {
      response = JSON.parse(body);
    } catch {
      response = null;
    }
  }
  setProp(xhr, 'response', response);
  setProp(xhr, 'responseText', body);
  setProp(xhr, 'readyState', 4);
  fire(xhr, 'readystatechange');
  fire(xhr, 'load');
  fire(xhr, 'loadend');
}

function fakeFailure(xhr: XMLHttpRequest, error: 'Network error' | 'Timeout') {
  setProp(xhr, 'status', 0);
  setProp(xhr, 'readyState', 4);
  fire(xhr, 'readystatechange');
  fire(xhr, error === 'Timeout' ? 'timeout' : 'error');
  fire(xhr, 'loadend');
}

/**
 * Starts recording requests made through XMLHttpRequest (in React Native this
 * includes fetch and axios). Idempotent; safe to call from several bundles.
 */
export function startCapture(ctor?: XhrCtor) {
  const g = netlogGlobal();
  if (g.xhr) return;
  const XHR = ctor ?? (globalThis as unknown as { XMLHttpRequest?: XhrCtor }).XMLHttpRequest;
  if (!XHR) return;
  const proto = XHR.prototype;
  const state: XhrState = {
    ctor: XHR,
    open: proto.open,
    send: proto.send,
    setRequestHeader: proto.setRequestHeader,
    addEventListener: proto.addEventListener,
    removeEventListener: proto.removeEventListener,
  };

  proto.addEventListener = function (this: XMLHttpRequest, type: string, listener: Listener | null, ...rest: unknown[]) {
    if (listener) {
      let byType = listeners.get(this);
      if (!byType) listeners.set(this, (byType = new Map()));
      let set = byType.get(type);
      if (!set) byType.set(type, (set = new Set()));
      set.add(listener);
    }
    return (state.addEventListener as (...a: unknown[]) => void).call(this, type, listener, ...rest);
  } as XMLHttpRequest['addEventListener'];

  proto.removeEventListener = function (this: XMLHttpRequest, type: string, listener: Listener | null, ...rest: unknown[]) {
    if (listener) listeners.get(this)?.get(type)?.delete(listener);
    return (state.removeEventListener as (...a: unknown[]) => void).call(this, type, listener, ...rest);
  } as XMLHttpRequest['removeEventListener'];

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    meta.set(this, { method: String(method).toUpperCase(), url: String(url), headers: {} });
    return (state.open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as XMLHttpRequest['open'];

  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const m = meta.get(this);
    if (m) m.headers[name] = value;
    return state.setRequestHeader.call(this, name, value);
  };

  const realSend = (xhr: XMLHttpRequest, body: unknown) => (state.send as (b?: unknown) => void).call(xhr, body);

  proto.send = function (this: XMLHttpRequest, body?: unknown) {
    const m = meta.get(this);
    let entry: NetworkEntry | undefined;
    if (m && !isPaused() && !isIgnored(m.method, m.url)) {
      try {
        entry = track(this, m, body);
      } catch {
        // never break the request because of logging
      }
    }
    const decision = m ? decideMock(m.method, m.url) : null;
    if (!m || !decision) return realSend(this, body);

    if (entry) {
      entry.mocked = {
        ruleId: decision.rule?.id,
        label: decision.kind === 'respond' ? `Mocked ${decision.action.status}` : decision.label,
      };
      updateEntry(entry);
    }
    const xhr = this;
    setTimeout(() => {
      if (decision.kind === 'respond') fakeResponse(xhr, m.url, decision.action);
      else if (decision.kind === 'fail') fakeFailure(xhr, decision.error);
      else realSend(xhr, body);
    }, decision.delayMs);
  } as XMLHttpRequest['send'];

  g.xhr = state;
}

/** Restores the original XMLHttpRequest methods. */
export function stopCapture() {
  const g = netlogGlobal();
  const state = g.xhr as XhrState | undefined;
  if (!state) return;
  const proto = state.ctor.prototype;
  proto.open = state.open;
  proto.send = state.send;
  proto.setRequestHeader = state.setRequestHeader;
  proto.addEventListener = state.addEventListener;
  proto.removeEventListener = state.removeEventListener;
  g.xhr = undefined;
}

export function isCapturing(): boolean {
  return !!netlogGlobal().xhr;
}
