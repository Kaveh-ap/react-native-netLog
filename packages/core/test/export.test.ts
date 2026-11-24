import { afterEach, describe, expect, it, vi } from 'vitest';
import { resend, resetNetLogGlobal, toCurl, toHar, toShareText, type NetworkEntry } from '../src';

const entry: NetworkEntry = {
  id: 1,
  kind: 'xhr',
  method: 'POST',
  url: "https://api.example.com/v1/cart?x=1&y=it's",
  requestHeaders: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
  requestBody: '{"q":"it\'s"}',
  status: 500,
  responseHeaders: { 'content-type': 'application/json' },
  responseBody: '{"error":"boom"}',
  startedAt: Date.UTC(2026, 10, 24, 10, 0, 0),
  headersAt: Date.UTC(2026, 10, 24, 10, 0, 0) + 100,
  endedAt: Date.UTC(2026, 10, 24, 10, 0, 0) + 120,
  durationMs: 120,
  state: 'done',
};

afterEach(() => {
  resetNetLogGlobal();
  vi.unstubAllGlobals();
});

describe('toCurl', () => {
  it('builds a runnable command with shell quoting', () => {
    expect(toCurl(entry)).toBe(
      "curl -X POST 'https://api.example.com/v1/cart?x=1&y=it'\\''s' -H 'Content-Type: application/json' -H 'Authorization: Bearer secret' --data-raw '{\"q\":\"it'\\''s\"}'",
    );
  });

  it('can redact and omits -X for GET', () => {
    const c = toCurl({ ...entry, method: 'GET', requestBody: undefined }, { redact: true });
    expect(c).toBe("curl 'https://api.example.com/v1/cart?x=1&y=it'\\''s' -H 'Content-Type: application/json' -H 'Authorization: [redacted]'");
  });
});

describe('toShareText', () => {
  it('pretty-prints bodies and redacts by default', () => {
    const t = toShareText(entry);
    expect(t).toContain('POST https://api.example.com/v1/cart');
    expect(t).toContain('Status: 500');
    expect(t).toContain('Authorization: [redacted]');
    expect(t).toContain('{\n  "error": "boom"\n}');
  });
});

describe('toHar', () => {
  it('produces HAR 1.2 entries', () => {
    const har = toHar([entry]);
    const e = har.log.entries[0]!;
    expect(har.log.version).toBe('1.2');
    expect(e.request.queryString).toEqual([
      { name: 'x', value: '1' },
      { name: 'y', value: "it's" },
    ]);
    expect(e.request.headers).toContainEqual({ name: 'Authorization', value: '[redacted]' });
    expect(e.request.postData).toEqual({ mimeType: 'application/json', text: entry.requestBody });
    expect(e.response.status).toBe(500);
    expect(e.timings).toEqual({ send: 0, wait: 100, receive: 20 });
  });
});

describe('toHar maxBodyLength', () => {
  it('cuts long bodies', () => {
    const har = toHar([{ ...entry, responseBody: 'x'.repeat(50) }], { maxBodyLength: 10 });
    expect(har.log.entries[0]!.response.content.text).toBe('xxxxxxxxxx…[truncated]');
    expect(har.log.entries[0]!.response.content.size).toBe(50);
  });
});

describe('resend', () => {
  it('replays with fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await resend(entry, { requestBody: '{"q":2}' });
    expect(fetchMock).toHaveBeenCalledWith(entry.url, {
      method: 'POST',
      headers: entry.requestHeaders,
      body: '{"q":2}',
    });
  });

  it('refuses binary bodies', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(resend({ ...entry, requestBody: '[FormData]' })).rejects.toThrow('cannot be resent');
  });
});
