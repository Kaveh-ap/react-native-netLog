// The browser viewer: one self-contained page, no build step.
// All device data is rendered with textContent, never as HTML.
export function viewerHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>netlog</title>
<style>
:root{--bg:#F9FAFB;--surface:#fff;--border:#EAECF0;--text:#101828;--muted:#475467;--accent:#175CD3;--ok:#067647;--okbg:#ECFDF3;--warn:#B54708;--warnbg:#FFFAEB;--err:#B42318;--errbg:#FEF3F2;--sel:#EFF4FF}
@media (prefers-color-scheme:dark){:root{--bg:#0C111D;--surface:#161B26;--border:#1F242F;--text:#F5F5F6;--muted:#94969C;--accent:#84ADFF;--ok:#75E0A7;--okbg:#053321;--warn:#FEC84B;--warnbg:#4E1D09;--err:#FDA29B;--errbg:#55160C;--sel:#102A56}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 Inter,system-ui,sans-serif}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border)}
h1{font-size:16px;margin:0}.dot{width:8px;height:8px;border-radius:4px;display:inline-block;margin-right:6px;background:#98A2B3}.dot.on{background:#17B26A}
.muted{color:var(--muted)}.grow{flex:1}button,select{font:inherit;height:36px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer}
main{display:flex;flex-wrap:wrap;min-height:calc(100vh - 62px)}#list{flex:999 1 640px;min-width:0;overflow:auto;background:var(--surface);border-right:1px solid var(--border)}
#detail{flex:1 1 380px;min-width:0;background:var(--surface);display:flex;flex-direction:column}
table{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:var(--bg);text-align:left;color:var(--muted);font-weight:600;font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border)}
td{padding:7px 10px;border-bottom:1px solid var(--border);white-space:nowrap}td.url{max-width:0;overflow:hidden;text-overflow:ellipsis;width:100%;font-family:ui-monospace,Menlo,monospace;font-size:12px}
tr{cursor:pointer}tr.sel{background:var(--sel)}.pill{padding:1px 6px;border-radius:6px;font:700 12px ui-monospace,Menlo,monospace}
.s2{color:var(--ok);background:var(--okbg)}.s4{color:var(--warn);background:var(--warnbg)}.s5,.serr{color:var(--err);background:var(--errbg)}.s0{color:var(--muted)}
pre{margin:0;padding:12px 16px;font:12px/1.55 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;overflow:auto;flex:1}
#pair{display:flex;gap:24px;align-items:center;flex-wrap:wrap;padding:32px;margin:24px;border:1px dashed var(--border);border-radius:16px;background:var(--surface)}
#pair img{width:220px;height:220px;background:#fff;border-radius:12px;padding:8px}code{font:13px ui-monospace,Menlo,monospace;background:var(--bg);padding:2px 6px;border-radius:6px}
.tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid var(--border)}.tabs button{border:0;border-radius:0;border-bottom:2px solid transparent;background:none;color:var(--muted)}.tabs button.on{border-color:var(--text);color:var(--text)}
#dhead{padding:12px 16px;border-bottom:1px solid var(--border);font:12px ui-monospace,Menlo,monospace;word-break:break-all}
</style>
</head>
<body>
<header>
  <h1>netlog</h1>
  <span id="devices" class="muted">No device connected</span>
  <span class="grow"></span>
  <button id="pause" type="button">Pause</button>
  <button id="clear" type="button">Clear</button>
  <button id="har" type="button">Export HAR</button>
</header>
<section id="pair" hidden>
  <img id="qr" alt="Pairing QR code">
  <div>
    <h2 style="margin:0 0 8px;font-size:18px">Pair a device</h2>
    <p class="muted" style="margin:0 0 12px;max-width:440px">In the app's netlog screen, tap <b>Connect to desktop</b> and scan this code, or type the pairing code. Phone and computer must be on the same network.</p>
    <p style="margin:0 0 6px">Pairing code: <code id="code"></code></p>
    <p class="muted" style="margin:0">Simulator / USB (after <code>adb reverse tcp:PORT tcp:PORT</code>): <code id="local"></code></p>
    <p style="margin:12px 0 0"><label class="muted">Address for the QR: <select id="hostSel"></select></label></p>
  </div>
</section>
<main>
  <section id="list"><table><thead><tr><th>Status</th><th>Method</th><th>URL</th><th>Device</th><th>Size</th><th>Time</th></tr></thead><tbody id="rows"></tbody></table></section>
  <aside id="detail"><div id="dhead" class="muted">Select a request</div>
    <div class="tabs" id="tabs"></div><pre id="body"></pre></aside>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const entries = new Map();
  let devices = [], selected = null, tab = 'response', paused = false, pairing = null;
  const key = (e) => e.deviceId + ':' + e.id;
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/viewer');
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'pairing') { pairing = m; renderPairing(); }
    if (m.type === 'devices') { devices = m.devices; renderDevices(); }
    if (m.type === 'snapshot') { entries.clear(); m.entries.forEach((e) => entries.set(key(e), e)); renderRows(); }
    if (m.type === 'entries') { m.entries.forEach((e) => entries.set(key(e), e)); renderRows(); }
  };
  const send = (command) => ws.send(JSON.stringify({ type: 'command', command }));
  $('pause').onclick = () => { paused = !paused; send(paused ? 'pause' : 'resume'); $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  $('clear').onclick = () => send('clear');
  $('har').onclick = () => {
    const har = { log: { version: '1.2', creator: { name: 'netlog', version: '0.1.0' }, entries: [...entries.values()].map(toHar) } };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' }));
    a.download = 'netlog-' + new Date().toISOString().replace(/[:.]/g, '-') + '.har';
    a.click();
  };
  $('hostSel').onchange = () => { $('qr').src = '/qr.svg?host=' + encodeURIComponent($('hostSel').value) + '&t=' + Date.now(); };
  const hdrs = (o) => Object.entries(o || {}).map(([name, value]) => ({ name, value: String(value) }));
  function toHar(e) {
    return { startedDateTime: new Date(e.startedAt).toISOString(), time: e.durationMs || 0,
      request: { method: e.method, url: e.url, httpVersion: 'HTTP/1.1', headers: hdrs(e.requestHeaders), queryString: [], cookies: [], headersSize: -1, bodySize: (e.requestBody || '').length, postData: e.requestBody ? { mimeType: 'application/json', text: e.requestBody } : undefined },
      response: { status: e.status || 0, statusText: '', httpVersion: 'HTTP/1.1', headers: hdrs(e.responseHeaders), cookies: [], content: { size: (e.responseBody || '').length, mimeType: (e.responseHeaders || {})['content-type'] || '', text: e.responseBody || '' }, redirectURL: '', headersSize: -1, bodySize: -1 },
      cache: {}, timings: { send: 0, wait: e.headersAt ? e.headersAt - e.startedAt : 0, receive: e.endedAt && e.headersAt ? e.endedAt - e.headersAt : 0 } };
  }
  function renderPairing() {
    if (!pairing) return;
    $('code').textContent = pairing.code;
    $('local').textContent = 'localhost:' + pairing.port + ' ' + pairing.token;
    $('hostSel').replaceChildren(...pairing.hosts.map((h) => { const o = document.createElement('option'); o.value = o.textContent = h; return o; }));
    $('qr').src = '/qr.svg?host=' + encodeURIComponent(pairing.primaryHost);
    renderDevices();
  }
  function renderDevices() {
    const online = devices.filter((d) => d.online);
    $('pair').hidden = online.length > 0;
    const el = $('devices'); el.replaceChildren();
    if (!devices.length) { el.textContent = 'No device connected'; return; }
    devices.forEach((d) => { const s = document.createElement('span'); s.style.marginRight = '12px';
      const dot = document.createElement('span'); dot.className = 'dot' + (d.online ? ' on' : '');
      s.append(dot, [d.name, d.platform, d.appVersion].filter(Boolean).join(' · ') || d.id); el.append(s); });
  }
  const devName = (id) => { const d = devices.find((x) => x.id === id); return d ? (d.name || id) : id; };
  function td(text, cls) { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = text; return c; }
  function statusCell(e) {
    const c = document.createElement('td'); const p = document.createElement('span');
    const s = e.status || 0; p.className = 'pill ' + (e.state === 'error' ? 'serr' : 's' + String(s)[0]);
    p.textContent = e.state === 'pending' ? '…' : e.state === 'error' && !s ? 'ERR' : String(s); c.append(p); return c;
  }
  function renderRows() {
    const tbody = $('rows'); const list = [...entries.values()].sort((a, b) => b.startedAt - a.startedAt);
    tbody.replaceChildren(...list.map((e) => {
      const tr = document.createElement('tr'); if (key(e) === selected) tr.className = 'sel';
      tr.append(statusCell(e), td(e.method), td(e.url, 'url'), td(devName(e.deviceId), 'muted'),
        td(e.responseBody ? (e.responseBody.length / 1024).toFixed(1) + ' KB' : '', 'muted'),
        td(e.durationMs != null ? e.durationMs + ' ms' : (e.state === 'pending' ? 'pending' : ''), 'muted'));
      tr.onclick = () => { selected = key(e); renderRows(); };
      return tr;
    }));
    renderDetail();
  }
  function pretty(text) { if (!text) return '(empty)'; try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } }
  function renderDetail() {
    const e = selected && entries.get(selected);
    const tabs = $('tabs'); tabs.replaceChildren();
    if (!e) { $('dhead').textContent = 'Select a request'; $('body').textContent = ''; return; }
    $('dhead').textContent = e.method + ' ' + e.url + (e.error ? '  ·  ' + e.error : '');
    ['headers', 'request', 'response', 'initiator'].forEach((t) => { const b = document.createElement('button');
      b.type = 'button'; b.textContent = t[0].toUpperCase() + t.slice(1); if (t === tab) b.className = 'on';
      b.onclick = () => { tab = t; renderDetail(); }; tabs.append(b); });
    const h = (o) => Object.entries(o || {}).map(([k, v]) => k + ': ' + v).join('\\n');
    $('body').textContent = tab === 'headers' ? 'Request\\n' + h(e.requestHeaders) + '\\n\\nResponse\\n' + h(e.responseHeaders)
      : tab === 'request' ? pretty(e.requestBody) : tab === 'response' ? pretty(e.responseBody) : (e.initiator || '(not captured)');
  }
})();
</script>
</body>
</html>`;
}
