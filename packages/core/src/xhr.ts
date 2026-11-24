import { getConfig } from './config';
import { netlogGlobal } from './global';
import { addEntry, isPaused, updateEntry } from './store';
import type { NetworkEntry } from './types';

type XhrCtor = { prototype: XMLHttpRequest };

interface XhrState {
  ctor: XhrCtor;
  open: XMLHttpRequest['open'];
  send: XMLHttpRequest['send'];
  setRequestHeader: XMLHttpRequest['setRequestHeader'];
}

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
    const r = xhr.response as { size?: number; byteLength?: number } | null;
    if (r == null) return undefined;
    return `[${type} ${r.size ?? r.byteLength ?? '?'} bytes]`;
  } catch {
    return undefined;
  }
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
  // drop "Error" and our own frames
  return stack
    .split('\n')
    .slice(1)
    .filter((l) => !/netlog|xhr\.ts|XMLHttpRequest/.test(l))
    .slice(0, 8)
    .map((l) => l.trim())
    .join('\n');
}

function track(xhr: XMLHttpRequest, m: Meta, body: unknown) {
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
  };

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    meta.set(this, { method: String(method).toUpperCase(), url: String(url), headers: {} });
    return (state.open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as XMLHttpRequest['open'];

  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const m = meta.get(this);
    if (m) m.headers[name] = value;
    return state.setRequestHeader.call(this, name, value);
  };

  proto.send = function (this: XMLHttpRequest, body?: unknown) {
    const m = meta.get(this);
    if (m && !isPaused() && !isIgnored(m.method, m.url)) {
      try {
        track(this, m, body);
      } catch {
        // never break the request because of logging
      }
    }
    return (state.send as (b?: unknown) => void).call(this, body);
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
  g.xhr = undefined;
}

export function isCapturing(): boolean {
  return !!netlogGlobal().xhr;
}
