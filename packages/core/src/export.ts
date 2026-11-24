import { getConfig } from './config';
import type { NetworkEntry } from './types';

export interface ExportOptions {
  /** Mask the headers listed in `config.redactHeaders`. Default false for cURL (it's for replaying), true for share/HAR. */
  redact?: boolean;
}

function headersOf(entry: NetworkEntry, which: 'request' | 'response', redact: boolean): Record<string, string> {
  const headers = (which === 'request' ? entry.requestHeaders : entry.responseHeaders) ?? {};
  if (!redact) return headers;
  const names = getConfig().redactHeaders.map((h) => h.toLowerCase());
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k] = names.includes(k.toLowerCase()) ? '[redacted]' : v;
  return out;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** A cURL command that repeats the request. */
export function toCurl(entry: NetworkEntry, options: ExportOptions = {}): string {
  const parts = ['curl'];
  if (entry.method !== 'GET') parts.push('-X', entry.method);
  parts.push(shellQuote(entry.url));
  for (const [k, v] of Object.entries(headersOf(entry, 'request', options.redact ?? false))) {
    parts.push('-H', shellQuote(`${k}: ${v}`));
  }
  if (entry.requestBody !== undefined && !/^\[(FormData|Blob|ArrayBuffer)/.test(entry.requestBody)) {
    parts.push('--data-raw', shellQuote(entry.requestBody));
  }
  return parts.join(' ');
}

function prettyBody(body: string | undefined): string {
  if (!body) return '(empty)';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** Human-readable text of the whole request and response, for sharing. */
export function toShareText(entry: NetworkEntry, options: ExportOptions = {}): string {
  const redact = options.redact ?? true;
  const h = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') || '(none)';
  return [
    `${entry.method} ${entry.url}`,
    `Status: ${entry.status ?? '-'}${entry.error ? ` (${entry.error})` : ''}`,
    `Started: ${new Date(entry.startedAt).toISOString()}`,
    `Duration: ${entry.durationMs ?? '-'} ms`,
    '',
    '--- Request headers ---',
    h(headersOf(entry, 'request', redact)),
    '',
    '--- Request body ---',
    prettyBody(entry.requestBody),
    '',
    '--- Response headers ---',
    h(headersOf(entry, 'response', redact)),
    '',
    '--- Response body ---',
    prettyBody(entry.responseBody),
  ].join('\n');
}

const harHeaders = (o: Record<string, string>) => Object.entries(o).map(([name, value]) => ({ name, value }));

function queryString(url: string) {
  const q = url.indexOf('?');
  if (q < 0) return [];
  return url
    .slice(q + 1)
    .split('#')[0]!
    .split('&')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('=');
      return { name: i < 0 ? p : p.slice(0, i), value: i < 0 ? '' : p.slice(i + 1) };
    });
}

/** HAR 1.2 log, readable by browser dev tools and most HTTP tools. */
export function toHar(entries: NetworkEntry[], options: ExportOptions & { creator?: string; maxBodyLength?: number } = {}) {
  const redact = options.redact ?? true;
  const cut = (body: string | undefined) =>
    body !== undefined && options.maxBodyLength !== undefined && body.length > options.maxBodyLength
      ? `${body.slice(0, options.maxBodyLength)}…[truncated]`
      : body;
  return {
    log: {
      version: '1.2',
      creator: { name: options.creator ?? 'NetLog', version: '0.1.0' },
      entries: entries.map((e) => {
        const reqHeaders = headersOf(e, 'request', redact);
        const resHeaders = headersOf(e, 'response', redact);
        const wait = e.headersAt !== undefined ? e.headersAt - e.startedAt : (e.durationMs ?? 0);
        const receive = e.endedAt !== undefined && e.headersAt !== undefined ? e.endedAt - e.headersAt : 0;
        return {
          startedDateTime: new Date(e.startedAt).toISOString(),
          time: e.durationMs ?? 0,
          request: {
            method: e.method,
            url: e.url,
            httpVersion: 'HTTP/1.1',
            headers: harHeaders(reqHeaders),
            queryString: queryString(e.url),
            cookies: [],
            headersSize: -1,
            bodySize: e.requestBody?.length ?? 0,
            ...(e.requestBody !== undefined
              ? { postData: { mimeType: reqHeaders['Content-Type'] ?? reqHeaders['content-type'] ?? '', text: cut(e.requestBody)! } }
              : {}),
          },
          response: {
            status: e.status ?? 0,
            statusText: e.error ?? '',
            httpVersion: 'HTTP/1.1',
            headers: harHeaders(resHeaders),
            cookies: [],
            content: {
              size: e.responseBody?.length ?? 0,
              mimeType: resHeaders['content-type'] ?? '',
              text: cut(e.responseBody) ?? '',
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: { send: 0, wait, receive },
        };
      }),
    },
  };
}

/**
 * Sends the request again with `fetch`. The new request is captured like any
 * other. Binary/FormData bodies can't be replayed and throw.
 */
export async function resend(entry: NetworkEntry, overrides: Partial<Pick<NetworkEntry, 'method' | 'url' | 'requestHeaders' | 'requestBody'>> = {}) {
  const method = overrides.method ?? entry.method;
  const body = overrides.requestBody ?? entry.requestBody;
  if (body !== undefined && /^\[(FormData|Blob|ArrayBuffer)/.test(body)) {
    throw new Error('NetLog: this request body is binary and cannot be resent');
  }
  const doFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!doFetch) throw new Error('NetLog: fetch is not available');
  return doFetch(overrides.url ?? entry.url, {
    method,
    headers: overrides.requestHeaders ?? entry.requestHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });
}
