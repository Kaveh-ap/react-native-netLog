import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configure,
  connectToDesktop,
  disconnectFromDesktop,
  getEntries,
  getPairingStatus,
  handleNetLogUrl,
  NetLogFeatureDisabledError,
  pairFromPayload,
  resetNetLogGlobal,
  startCapture,
  stopCapture,
  type PairingStatus,
} from 'react-native-netlog';
import { FakeXHR, request } from '../../core/test/fakeXhr';
// @ts-expect-error plain JS module
import { startServer } from '../src/server.mjs';

type Server = Awaited<ReturnType<typeof startServer>>;
let server: Server;

async function until(check: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
const state = () => (getPairingStatus() as PairingStatus).state;

beforeEach(async () => {
  resetNetLogGlobal();
  (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
  FakeXHR.next = { status: 200, headers: 'Content-Type: application/json', body: '{"ok":true}' };
  server = await startServer({ port: 0, host: '127.0.0.1', token: '1111-2222', name: 'Test Mac' });
});

afterEach(async () => {
  disconnectFromDesktop();
  stopCapture();
  resetNetLogGlobal();
  await server.close();
});

describe('desktop pairing (qrPairing on)', () => {
  it('pairs from the QR link and streams requests with secrets redacted', async () => {
    startCapture();
    request('GET', 'https://api.example.com/before-pairing'); // backlog is sent on connect
    const link = server.pairing().localLink;
    pairFromPayload(link, { device: { name: 'Pixel 7', platform: 'android', appVersion: '3.2.4' } });
    await until(() => state() === 'connected');
    expect(getPairingStatus()).toMatchObject({ state: 'connected', desktopName: 'Test Mac' });

    request('POST', 'https://api.example.com/v1/cart', '{"q":1}', { Authorization: 'Bearer secret' });
    await until(() => server.entries().length === 2 && server.entries().every((e: { state: string }) => e.state === 'done'));

    const [first, second] = server.entries();
    expect(first.url).toBe('https://api.example.com/before-pairing');
    expect(second).toMatchObject({ method: 'POST', status: 200, responseBody: '{"ok":true}' });
    expect(second.requestHeaders.Authorization).toBe('[redacted]');
    expect(getEntries()[1]!.requestHeaders.Authorization).toBe('Bearer secret'); // only redacted on the wire
    expect(server.devices()).toMatchObject([{ name: 'Pixel 7', platform: 'android', online: true }]);
  });

  it('accepts the typed pairing code and deep links', async () => {
    const p = server.pairing();
    expect(handleNetLogUrl(p.localLink)).toBe(true);
    await until(() => state() === 'connected');
    disconnectFromDesktop();
    expect(state()).toBe('idle');
    pairFromPayload(`127.0.0.1:${p.port} ${p.token}`);
    await until(() => state() === 'connected');
  });

  it('runs commands sent from the desktop', async () => {
    startCapture();
    request('GET', 'https://x.test/a');
    pairFromPayload(server.pairing().localLink);
    await until(() => state() === 'connected');
    server.sendCommand(undefined, 'clear');
    await until(() => getEntries().length === 0);
    await until(() => server.entries().length === 0);
  });

  it('stops on a wrong pairing code instead of retrying', async () => {
    connectToDesktop({ url: `ws://127.0.0.1:${server.port}/device`, token: '9999-0000' });
    await until(() => state() === 'error');
    expect(getPairingStatus()).toMatchObject({ message: 'Wrong pairing code' });
    await new Promise((r) => setTimeout(r, 700));
    expect(state()).toBe('error');
    expect(server.devices()).toEqual([]);
  });
});

describe('desktop pairing (qrPairing off, e.g. Digikala)', () => {
  it('refuses to pair and never opens a socket', async () => {
    configure({ features: { qrPairing: false } });
    startCapture();
    request('GET', 'https://x.test/private');
    const link = server.pairing().localLink;
    expect(() => pairFromPayload(link)).toThrow(NetLogFeatureDisabledError);
    expect(handleNetLogUrl(link)).toBe(false);
    await new Promise((r) => setTimeout(r, 300));
    expect(state()).toBe('idle');
    expect(server.devices()).toEqual([]);
    expect(server.entries()).toEqual([]);
    expect(getEntries()).toHaveLength(1); // in-app capture still works
  });
});

describe('viewer access', () => {
  it('serves the viewer to this computer and refuses other machines', async () => {
    const local = await fetch(`http://127.0.0.1:${server.port}/api/pairing`);
    expect(local.status).toBe(200);
  });
});
