import type { NetworkEntry } from 'react-native-netlog';
import type { NetLogTheme } from './theme';

export const SLOW_MS = 1000;

export function splitUrl(url: string): { host: string; path: string } {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)(.*)$/i.exec(url);
  if (!m) return { host: '', path: url };
  return { host: m[1] ?? '', path: m[2] || '/' };
}

export const isError = (e: NetworkEntry) => e.state === 'error' || (e.status !== undefined && e.status >= 400);
export const isSlow = (e: NetworkEntry) => (e.durationMs ?? 0) > SLOW_MS;
export const isPending = (e: NetworkEntry) => e.state === 'pending';

export function statusLabel(e: NetworkEntry): string {
  if (e.state === 'pending') return '…';
  if (e.state === 'error' && !e.status) return 'ERR';
  return String(e.status ?? '');
}

export function statusColors(e: NetworkEntry, t: NetLogTheme): { fg: string; bg: string } {
  if (e.state === 'pending') return { fg: t.neutral, bg: t.neutralBg };
  const s = e.status ?? 0;
  if (e.state === 'error' && !s) return { fg: t.error, bg: t.errorBg };
  if (s >= 500) return { fg: t.error, bg: t.errorBg };
  if (s >= 400) return { fg: t.warn, bg: t.warnBg };
  if (s >= 300) return { fg: t.neutral, bg: t.neutralBg };
  if (s >= 200) return { fg: t.ok, bg: t.okBg };
  return { fg: t.info, bg: t.infoBg };
}

export function durationText(e: NetworkEntry): string {
  if (e.state === 'pending') return 'pending';
  const ms = e.durationMs;
  if (ms === undefined) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

export function bytesText(n: number | undefined): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function responseSize(e: NetworkEntry): number | undefined {
  const header = e.responseHeaders?.['content-length'];
  const fromHeader = header ? Number(header) : NaN;
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;
  return e.responseBody?.length;
}

export function timeOfDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function isJson(text: string | undefined): boolean {
  if (!text) return false;
  const c = text.trimStart()[0];
  if (c !== '{' && c !== '[') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** GraphQL operation name from a request body, if any. */
export function graphqlOperation(e: NetworkEntry): string | undefined {
  if (!e.requestBody || !e.requestBody.includes('operationName')) return undefined;
  try {
    const b = JSON.parse(e.requestBody) as { operationName?: unknown };
    return typeof b.operationName === 'string' ? b.operationName : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shortens JS stack frames for display: `at fn (http://host/index.bundle?x=y:123:45)`
 * becomes `fn · index.bundle:123`.
 */
export function formatStack(stack: string): string {
  return stack
    .split('\n')
    .map((line) => {
      const m = /^\s*at\s+(?:(.*?)\s+\()?(.*?)\)?\s*$/.exec(line);
      if (!m) return line.trim();
      const fn = m[1] || '(anonymous)';
      const loc = m[2] ?? '';
      const pos = /:(\d+)(?::\d+)?$/.exec(loc);
      const file =
        loc
          .replace(/:(\d+)(?::\d+)?$/, '')
          .replace(/[?&].*$/, '')
          .split('/')
          .filter(Boolean)
          .pop() ?? '';
      if (!file) return fn;
      return `${fn} · ${file}${pos ? `:${pos[1]}` : ''}`;
    })
    .join('\n');
}

/** Pretty-prints JSON text; anything else is returned unchanged. */
export function prettyIfJson(text: string | undefined): string {
  if (!text) return '';
  if (!isJson(text)) return text;
  return JSON.stringify(JSON.parse(text), null, 2);
}

/** 'empty', 'json' (valid), 'invalid' (looks like JSON but doesn't parse) or 'text'. */
export function jsonState(text: string): 'empty' | 'json' | 'invalid' | 'text' {
  const t = text.trim();
  if (!t) return 'empty';
  if (t[0] !== '{' && t[0] !== '[') return 'text';
  try {
    JSON.parse(t);
    return 'json';
  } catch {
    return 'invalid';
  }
}
