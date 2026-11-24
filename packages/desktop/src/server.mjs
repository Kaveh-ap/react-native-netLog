import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';
import { viewerHtml } from './viewer.mjs';

export const PROTOCOL_VERSION = 1;
export const PAIRING_LINK_PREFIX = 'netlog://pair';

/** e.g. "4821-7730" */
export function randomToken() {
  const n = crypto.randomInt(0, 1e8).toString().padStart(8, '0');
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

export function pairingLink({ host, port, token, name }) {
  const url = `ws://${host}:${port}/device`;
  let link = `${PAIRING_LINK_PREFIX}?u=${encodeURIComponent(url)}&t=${encodeURIComponent(token)}`;
  if (name) link += `&n=${encodeURIComponent(name)}`;
  return link;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Starts the pairing + viewer server.
 * Devices connect to ws://host:port/device; the browser viewer is served at http://host:port/.
 */
export async function startServer(options = {}) {
  const { port = 9099, host = '0.0.0.0', token = randomToken(), name = os.hostname(), maxEntries = 5000 } = options;

  /** deviceId -> { info, socket, connectedAt } */
  const devices = new Map();
  /** `${deviceId}:${entryId}` -> entry (with deviceId) */
  const entries = new Map();
  const viewers = new Set();
  const listeners = new Set();

  const emit = (event) => {
    const text = JSON.stringify(event);
    for (const v of viewers) if (v.readyState === 1) v.send(text);
    for (const l of listeners) l(event);
  };

  const deviceSummary = () =>
    [...devices.entries()].map(([id, d]) => ({ id, ...d.info, connectedAt: d.connectedAt, online: d.online }));

  const upsert = (deviceId, entry) => {
    const key = `${deviceId}:${entry.id}`;
    const value = { ...entry, deviceId };
    entries.delete(key); // keep insertion order = latest activity last
    entries.set(key, value);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return value;
  };

  const clearDevice = (deviceId) => {
    for (const [k, e] of entries) if (e.deviceId === deviceId) entries.delete(k);
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(viewerHtml());
    } else if (url.pathname === '/api/pairing') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(api.pairing()));
    } else if (url.pathname === '/qr.svg') {
      const target = url.searchParams.get('host') ?? api.pairing().primaryHost;
      const svg = await QRCode.toString(pairingLink({ host: target, port: api.port, token, name }), {
        type: 'svg',
        margin: 1,
      });
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
      res.end(svg);
    } else {
      res.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== '/device' && path !== '/viewer') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => (path === '/device' ? onDevice(ws) : onViewer(ws, req)));
  });

  function onDevice(ws) {
    let deviceId = null;
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!deviceId) {
        if (msg.type !== 'hello') return;
        if (msg.protocol !== PROTOCOL_VERSION) {
          ws.send(JSON.stringify({ type: 'error', code: 'protocol', message: `Unsupported protocol ${msg.protocol}` }));
          return ws.close(4002);
        }
        if (!safeEqual(msg.token, token)) {
          ws.send(JSON.stringify({ type: 'error', code: 'bad-token', message: 'Wrong pairing code' }));
          return ws.close(4001);
        }
        deviceId = String(msg.device?.id ?? crypto.randomUUID());
        clearDevice(deviceId); // a reconnect re-sends its backlog
        devices.set(deviceId, { info: msg.device ?? {}, socket: ws, connectedAt: Date.now(), online: true });
        for (const e of msg.entries ?? []) upsert(deviceId, e);
        ws.send(JSON.stringify({ type: 'welcome', name }));
        emit({ type: 'devices', devices: deviceSummary() });
        emit({ type: 'snapshot', entries: [...entries.values()] });
        return;
      }
      if (msg.type === 'events') {
        const changed = [];
        for (const ev of msg.events ?? []) {
          if (ev.op === 'upsert' && ev.entry) changed.push(upsert(deviceId, ev.entry));
          else if (ev.op === 'clear') {
            clearDevice(deviceId);
            emit({ type: 'snapshot', entries: [...entries.values()] });
          }
        }
        if (changed.length) emit({ type: 'entries', entries: changed });
      }
    });
    ws.on('close', () => {
      const d = deviceId && devices.get(deviceId);
      if (d && d.socket === ws) {
        d.online = false;
        emit({ type: 'devices', devices: deviceSummary() });
      }
    });
  }

  function onViewer(ws) {
    viewers.add(ws);
    ws.send(JSON.stringify({ type: 'pairing', ...api.pairing() }));
    ws.send(JSON.stringify({ type: 'devices', devices: deviceSummary() }));
    ws.send(JSON.stringify({ type: 'snapshot', entries: [...entries.values()] }));
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type === 'command') api.sendCommand(msg.deviceId, msg.command);
    });
    ws.on('close', () => viewers.delete(ws));
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const api = {
    port: server.address().port,
    token,
    name,
    pairing() {
      const hosts = lanAddresses();
      const primaryHost = hosts[0] ?? '127.0.0.1';
      return {
        port: api.port,
        token,
        name,
        primaryHost,
        hosts: [...hosts, 'localhost'],
        link: pairingLink({ host: primaryHost, port: api.port, token, name }),
        localLink: pairingLink({ host: 'localhost', port: api.port, token, name }),
        code: `${primaryHost}:${api.port} ${token}`,
      };
    },
    devices: deviceSummary,
    entries: () => [...entries.values()],
    sendCommand(deviceId, command) {
      const targets = deviceId ? [devices.get(deviceId)] : [...devices.values()];
      for (const d of targets) if (d?.online) d.socket.send(JSON.stringify({ type: 'command', command }));
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      for (const c of wss.clients) c.terminate();
      await new Promise((r) => server.close(r));
    },
  };
  return api;
}

export async function terminalQr(text) {
  return QRCode.toString(text, { type: 'terminal', small: true });
}
