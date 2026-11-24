# react-native-netlog

Network capture for React Native in plain JS, with no native module and no React Native private APIs.

- Records `XMLHttpRequest` traffic, which in React Native includes `fetch` and axios
- One shared store on `globalThis`, so several bundles (e.g. Module Federation remotes) see the same requests
- Optional desktop pairing: stream traffic to `netlog-desktop` by scanning a QR code

```ts
import { initNetLog } from 'react-native-netlog';

if (__DEV__) {
  initNetLog({ ignore: [/\/symbolicate$/] }); // configure + start capture
}
```

`initNetLog(config)` takes the config below plus `capture` (default `true`; pass `false` to configure without recording). Calling it again updates the config. The lower-level `configure()` and `startCapture()` are also exported.

## Feature switches

| Feature | Default | What it controls |
|---|---|---|
| `qrPairing` | `true` | Desktop pairing by QR code or pairing code. When `false`, `DesktopPairing` from `react-native-netlog-ui` renders nothing, and `connectToDesktop`, `pairFromPayload` and `handleNetLogUrl` refuse to connect. In-app capture is unaffected. |

Turn it off for apps that must never send traffic off the device:

```ts
initNetLog({ features: { qrPairing: false } });
```

## Config

| Option | Default | |
|---|---|---|
| `features` | `{ qrPairing: true }` | See above |
| `maxEntries` | `500` | Oldest entries are dropped |
| `maxBodyLength` | `1048576` | Bodies are cut to this many characters |
| `ignore` | `[]` | RegExp (tested on `"METHOD url"`) or `(method, url) => boolean` |
| `captureStack` | `true` | Record which code sent each request |
| `redactHeaders` | `authorization, cookie, set-cookie` | Masked when entries are sent to the desktop |

## Desktop pairing

```ts
import { pairFromPayload, handleNetLogUrl, disconnectFromDesktop } from 'react-native-netlog';

pairFromPayload(scannedQrText, { device: { name: 'Pixel 7', appVersion: '1.2.3' } });
// or from a deep link: Linking.addEventListener('url', ({ url }) => handleNetLogUrl(url));
```

The desktop's QR code holds `netlog://pair?u=ws://<ip>:<port>/device&t=<token>`. The typed form is `<ip>:<port> <token>`. A wrong token stops the connection; network drops reconnect with backoff and resend the backlog.
