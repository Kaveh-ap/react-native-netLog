import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addMockRule,
  getEntries,
  getMockRules,
  getNetworkCondition,
  mockRuleFromEntry,
  removeMockRule,
  resetNetLogGlobal,
  setMockStorage,
  setNetworkCondition,
  startCapture,
  stopCapture,
  updateMockRule,
  urlMatches,
} from '../src';
import { decideMock } from '../src/mocks';
import { FakeXHR, request } from './fakeXhr';

beforeEach(() => {
  resetNetLogGlobal();
  (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
  FakeXHR.next = { status: 200, body: 'real' };
  FakeXHR.sent = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  stopCapture();
  resetNetLogGlobal();
});

describe('urlMatches', () => {
  it('uses contains without wildcards and anchors with them', () => {
    expect(urlMatches('/v1/cart', 'https://x.test/v1/cart/items')).toBe(true);
    expect(urlMatches('*/v1/cart/*', 'https://x.test/v1/cart/items')).toBe(true);
    expect(urlMatches('*/v1/cart', 'https://x.test/v1/cart/items')).toBe(false);
    expect(urlMatches('https://x.test/a?b=*', 'https://x.test/a?b=1')).toBe(true);
    expect(urlMatches('', 'anything')).toBe(false);
  });
});

describe('respond rules', () => {
  it('answers without the network, like a real response', () => {
    startCapture();
    addMockRule({ method: 'POST', url: '*/v1/cart/*', action: { type: 'respond', status: 500, body: '{"error":"boom"}', headers: { 'Content-Type': 'application/json' } } });
    const xhr = request('POST', 'https://x.test/v1/cart/items', '{}');
    const onload = vi.fn();
    xhr.addEventListener('load', onload);
    vi.runAllTimers();
    expect(FakeXHR.sent).toBe(0);
    expect(xhr.status).toBe(500);
    expect(xhr.responseText).toBe('{"error":"boom"}');
    expect(xhr.getAllResponseHeaders()).toBe('content-type: application/json');
    expect(onload).toHaveBeenCalledTimes(1);
    const [e] = getEntries();
    expect(e).toMatchObject({ status: 500, state: 'done', responseBody: '{"error":"boom"}', mocked: { label: 'Mocked 500' } });
    expect(getMockRules()[0]!.hits).toBe(1);
  });

  it('serves fetch-style blob requests a string body', () => {
    startCapture();
    addMockRule({ method: '*', url: '/profile', action: { type: 'respond', status: 200, body: '{"name":"a"}' } });
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://x.test/profile');
    xhr.responseType = 'blob';
    xhr.send();
    vi.runAllTimers();
    expect(xhr.response).toBe('{"name":"a"}');
    expect(getEntries()[0]!.responseBody).toBe('{"name":"a"}');
  });

  it('skips disabled rules and other methods, first match wins', () => {
    startCapture();
    const r1 = addMockRule({ method: 'GET', url: '/a', action: { type: 'respond', status: 201 } });
    addMockRule({ method: 'GET', url: '/a', action: { type: 'respond', status: 202 } });
    request('POST', 'https://x.test/a');
    vi.runAllTimers();
    expect(getEntries()[0]!.status).toBe(200);
    expect(FakeXHR.sent).toBe(1);
    request('GET', 'https://x.test/a');
    vi.runAllTimers();
    expect(getEntries()[1]!.status).toBe(202); // newest rule is first
    updateMockRule(getMockRules()[0]!.id, { enabled: false });
    request('GET', 'https://x.test/a');
    vi.runAllTimers();
    expect(getEntries()[2]!.status).toBe(201);
    removeMockRule(r1.id);
    expect(getMockRules()).toHaveLength(1);
  });
});

describe('delay and fail rules', () => {
  it('delays the real request', () => {
    startCapture();
    addMockRule({ method: '*', url: '/slow', action: { type: 'delay', ms: 3000 } });
    request('GET', 'https://x.test/slow');
    vi.advanceTimersByTime(2999);
    expect(FakeXHR.sent).toBe(0);
    vi.advanceTimersByTime(1);
    expect(FakeXHR.sent).toBe(1);
    expect(getEntries()[0]!.mocked?.label).toBe('Delayed 3000 ms');
  });

  it('fails like a broken connection or timeout', () => {
    startCapture();
    addMockRule({ method: '*', url: '/down', action: { type: 'fail' } });
    addMockRule({ method: '*', url: '/hang', action: { type: 'fail', error: 'Timeout' } });
    const onerror = vi.fn();
    const xhr = request('GET', 'https://x.test/down');
    xhr.addEventListener('error', onerror);
    request('GET', 'https://x.test/hang');
    vi.runAllTimers();
    expect(onerror).toHaveBeenCalled();
    expect(getEntries().map((e) => [e.state, e.error, e.status])).toEqual([
      ['error', 'Network error', 0],
      ['error', 'Timeout', 0],
    ]);
    expect(FakeXHR.sent).toBe(0);
  });
});

describe('network conditions', () => {
  it('offline fails everything, but rules still answer', () => {
    startCapture();
    setNetworkCondition('offline');
    addMockRule({ method: '*', url: '/mocked', action: { type: 'respond', status: 200, body: 'ok' } });
    request('GET', 'https://x.test/real');
    request('GET', 'https://x.test/mocked');
    vi.runAllTimers();
    expect(getEntries().map((e) => [e.url.split('/').pop(), e.state, e.mocked?.label])).toEqual([
      ['real', 'error', 'Offline'],
      ['mocked', 'done', 'Mocked 200'],
    ]);
  });

  it('slow delays, flaky fails some', () => {
    setNetworkCondition('slow');
    expect(decideMock('GET', 'https://x.test')).toEqual({ kind: 'delay', delayMs: 2000, label: 'Slow network' });
    setNetworkCondition('flaky');
    expect(decideMock('GET', 'https://x.test', () => 0.05)).toMatchObject({ kind: 'fail', label: 'Flaky network' });
    expect(decideMock('GET', 'https://x.test', () => 0.5)).toBeNull();
    setNetworkCondition('off');
    expect(decideMock('GET', 'https://x.test')).toBeNull();
    expect(getNetworkCondition()).toBe('off');
  });

  it('mocks still apply while capture is paused or not running', () => {
    addMockRule({ method: '*', url: '/x', action: { type: 'respond', status: 204 } });
    startCapture();
    const xhr = request('GET', 'https://x.test/x');
    vi.runAllTimers();
    expect(xhr.status).toBe(204);
  });
});

describe('mockRuleFromEntry and storage', () => {
  it('replays a captured response', () => {
    const input = mockRuleFromEntry({
      id: 1, kind: 'xhr', method: 'GET', url: 'https://x.test/a?x=1', requestHeaders: {}, status: 404,
      responseBody: '{"e":1}', responseHeaders: { 'content-type': 'application/json' }, startedAt: 0, state: 'done',
    });
    expect(input).toEqual({
      method: 'GET', url: 'https://x.test/a*',
      action: { type: 'respond', status: 404, body: '{"e":1}', headers: { 'content-type': 'application/json' } },
    });
  });

  it('saves and restores rules and condition', async () => {
    vi.useRealTimers();
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    await setMockStorage(storage);
    addMockRule({ method: '*', url: '/saved', action: { type: 'delay', ms: 10 } });
    setNetworkCondition('slow');
    resetNetLogGlobal();
    await setMockStorage(storage);
    expect(getMockRules().map((r) => r.url)).toEqual(['/saved']);
    expect(getNetworkCondition()).toBe('slow');
  });
});
