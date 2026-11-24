import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEntries,
  configure,
  connectToDesktop,
  createPairingCode,
  createPairingLink,
  getConfig,
  getEntries,
  getPairingStatus,
  handleNetLogUrl,
  isFeatureEnabled,
  NetLogFeatureDisabledError,
  pairFromPayload,
  parsePairingPayload,
  resetNetLogGlobal,
  setPaused,
  startCapture,
  stopCapture,
  subscribe,
} from '../src';
import { FakeXHR, request } from './fakeXhr';

beforeEach(() => {
  resetNetLogGlobal();
  (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
  FakeXHR.next = { status: 200, body: '' };
});

afterEach(() => {
  stopCapture();
  resetNetLogGlobal();
});

describe('capture', () => {
  it('records a request and its response', () => {
    startCapture();
    FakeXHR.next = { status: 201, headers: 'Content-Type: application/json\r\nX-Id: 7', body: '{"ok":true}' };
    request('post', 'https://api.example.com/v1/cart', '{"q":1}', { Authorization: 'Bearer x' });
    const [e] = getEntries();
    expect(e).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/v1/cart',
      requestBody: '{"q":1}',
      requestHeaders: { Authorization: 'Bearer x' },
      status: 201,
      responseHeaders: { 'content-type': 'application/json', 'x-id': '7' },
      responseBody: '{"ok":true}',
      state: 'done',
    });
    expect(e!.durationMs).toBeGreaterThanOrEqual(0);
    expect(e!.headersAt).toBeDefined();
  });

  it('marks network errors, timeouts and aborts', () => {
    startCapture();
    for (const fail of ['error', 'timeout', 'abort'] as const) {
      FakeXHR.next = { status: 0, fail };
      request('GET', 'https://x.test/' + fail);
    }
    expect(getEntries().map((e) => [e.state, e.error])).toEqual([
      ['error', 'Network error'],
      ['error', 'Timeout'],
      ['error', 'Aborted'],
    ]);
  });

  it('honors ignore rules and pause', () => {
    configure({ ignore: [/symbolicate$/, (_m, url) => url.includes('hot-update')] });
    startCapture();
    request('POST', 'http://10.0.2.2:8081/symbolicate');
    request('GET', 'http://10.0.2.2:8081/index.hot-update.json');
    setPaused(true);
    request('GET', 'https://x.test/paused');
    setPaused(false);
    request('GET', 'https://x.test/kept');
    expect(getEntries().map((e) => e.url)).toEqual(['https://x.test/kept']);
  });

  it('caps the number of entries and body length', () => {
    configure({ maxEntries: 3, maxBodyLength: 5 });
    startCapture();
    FakeXHR.next = { status: 200, body: '0123456789' };
    for (let i = 0; i < 5; i++) request('GET', `https://x.test/${i}`);
    const entries = getEntries();
    expect(entries.map((e) => e.url)).toEqual(['https://x.test/2', 'https://x.test/3', 'https://x.test/4']);
    expect(entries[0]!.responseBody).toBe('01234\n…[truncated 5 chars]');
  });

  it('is idempotent and restorable', () => {
    const original = FakeXHR.prototype.send;
    startCapture();
    startCapture();
    request('GET', 'https://x.test/once');
    expect(getEntries()).toHaveLength(1);
    stopCapture();
    expect(FakeXHR.prototype.send).toBe(original);
  });

  it('notifies subscribers and clears', () => {
    startCapture();
    const events: string[] = [];
    subscribe((e) => events.push(e.type));
    request('GET', 'https://x.test/a');
    clearEntries();
    expect(events).toEqual(['add', 'update', 'update', 'clear']);
    expect(getEntries()).toEqual([]);
  });

  it('shares state across copies through globalThis', async () => {
    startCapture();
    request('GET', 'https://x.test/shared');
    const g = (globalThis as unknown as Record<string, { entries: unknown[] }>).__NETLOG__!;
    expect(g.entries).toHaveLength(1);
  });
});

describe('qrPairing feature flag', () => {
  it('is on by default', () => {
    expect(isFeatureEnabled('qrPairing')).toBe(true);
  });

  it('can be turned off, and pairing calls are refused', () => {
    configure({ features: { qrPairing: false } });
    expect(getConfig().features.qrPairing).toBe(false);
    const WebSocketImpl = vi.fn();
    const info = { url: 'ws://127.0.0.1:9099/device', token: 'abcd-1234' };
    expect(() => connectToDesktop(info, { WebSocketImpl: WebSocketImpl as never })).toThrow(NetLogFeatureDisabledError);
    expect(() => pairFromPayload(createPairingLink(info))).toThrow(NetLogFeatureDisabledError);
    expect(handleNetLogUrl(createPairingLink(info), { WebSocketImpl: WebSocketImpl as never })).toBe(false);
    expect(WebSocketImpl).not.toHaveBeenCalled();
    expect(getPairingStatus()).toEqual({ state: 'idle' });
  });

  it('keeps other config when only features change', () => {
    configure({ maxEntries: 42 });
    configure({ features: { qrPairing: false } });
    expect(getConfig().maxEntries).toBe(42);
  });
});

describe('pairing payloads', () => {
  const info = { url: 'ws://192.168.1.5:9099/device', token: '4821-7730', name: 'Dev Mac' };

  it('round-trips a pairing link', () => {
    const link = createPairingLink(info);
    expect(link.startsWith('netlog://pair?')).toBe(true);
    expect(parsePairingPayload(link)).toEqual(info);
  });

  it('parses typed pairing codes', () => {
    expect(parsePairingPayload(createPairingCode('192.168.1.5', 9099, '4821-7730'))).toEqual({
      url: 'ws://192.168.1.5:9099/device',
      token: '4821-7730',
    });
    expect(parsePairingPayload('  wss://relay.example.com:443/device#abcd1234 ')).toEqual({
      url: 'wss://relay.example.com:443/device',
      token: 'abcd1234',
    });
  });

  it('rejects other text', () => {
    expect(parsePairingPayload('https://example.com')).toBeNull();
    expect(parsePairingPayload('netlog://pair?u=http://x&t=1')).toBeNull();
    expect(parsePairingPayload('hello')).toBeNull();
  });
});
