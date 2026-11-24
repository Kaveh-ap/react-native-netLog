# NetLog

A network inspector for React Native apps, in plain JavaScript: no native module, no native build, and no React Native private APIs.

| Package | What it is |
|---|---|
| [`react-native-netlog`](packages/core) | Records requests (XMLHttpRequest, so `fetch` and axios too), mock rules and network conditions, cURL/HAR export, optional desktop pairing |
| [`react-native-netlog-ui`](packages/ui) | The in-app inspector: Requests, Mocks and Settings tabs, request details with JSON viewer, edit & resend, floating bubble |
| [`react-native-netlog-json-viewer`](packages/json-viewer) | Fast, searchable JSON tree viewer |
| [`react-native-netlog-desktop`](packages/desktop) | `npx netlog-desktop`: shows a pairing QR code and a live traffic viewer in the browser |

npm package names are lowercase, so the packages are `react-native-netlog*`; the project is NetLog.

## Quick start

```ts
import { initNetLog } from 'react-native-netlog';

if (__DEV__) {
  initNetLog({ ignore: [/\/symbolicate$/] });
}
```

To watch traffic on your computer, run `npx netlog-desktop` and scan its QR code from `DesktopPairing` in the app. Apps that must never send traffic off the device can turn pairing off:

```ts
initNetLog({ features: { qrPairing: false } });
```

## Development

```bash
npm install
npm test
npm run typecheck
```

## License

MIT
