#!/usr/bin/env node
import { startServer, terminalQr } from '../src/server.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

if (process.argv.includes('--help')) {
  console.log(`netlog-desktop [--port 9099] [--token 1234-5678] [--name "My Mac"] [--allow-remote-viewer]

Shows a pairing QR code and serves a live viewer of your app's traffic.`);
  process.exit(0);
}

const server = await startServer({
  port: Number(arg('port', 9099)),
  token: arg('token'),
  name: arg('name'),
  allowRemoteViewer: process.argv.includes('--allow-remote-viewer'),
});
const p = server.pairing();

console.log(`
NetLog desktop is running

  Viewer:        http://localhost:${p.port}
  Pairing code:  ${p.code}
  Simulator/USB: localhost:${p.port} ${p.token}   (Android USB: adb reverse tcp:${p.port} tcp:${p.port})

Scan with the app (NetLog → Connect to desktop):
`);
console.log(await terminalQr(p.link));

server.on((event) => {
  if (event.type === 'devices') {
    for (const d of event.devices) {
      console.log(`${d.online ? '●' : '○'} ${[d.name, d.platform, d.appVersion].filter(Boolean).join(' · ') || d.id} ${d.online ? 'connected' : 'disconnected'}`);
    }
  }
});

const stop = async () => {
  await server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
