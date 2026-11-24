# Changelog

All notable changes to NetLog. The packages are versioned together where possible.

## 0.1.1 — 2026-11-24

### react-native-netlog-desktop
- **Security:** the viewer, QR code and pairing info now only answer this computer. Before, anyone on the same network could open the viewer. Use `--allow-remote-viewer` to share it. Devices still pair over the network.
- Redesigned viewer: path and host, method colors, waterfall, detail header, highlighted JSON, search and filter chips, links to a request (`#device:id`).
- Full guide: setup, pairing per platform, QR scanner example, troubleshooting, programmatic API.

### react-native-netlog-json-viewer
- Fix: the search match count no longer gets clipped on Android.

### All packages
- New README with screenshots, LICENSE file, and links to the repository.

## 0.1.0 — 2026-11-24

First public release.

### react-native-netlog
- Captures every `XMLHttpRequest`, which includes `fetch` and axios in React Native. No native code, no private React Native APIs.
- One shared store on `globalThis`, so several bundles (Module Federation) see the same requests.
- `initNetLog(config)`: ignore rules, size limits, header masking, stack capture.
- Mock rules (respond / delay / fail) and network conditions (Slow 3G, Flaky, Offline). Mocked responses go through the standard XHR interface, so `fetch` and axios see real responses.
- Export: cURL, shareable text, HAR 1.2. Resend with overrides.
- Desktop pairing client (QR code, pairing code, deep link), with `features.qrPairing` to turn it off.

### react-native-netlog-ui
- `NetLogScreen` with Requests, Mocks and Settings tabs.
- Request details: overview, initiator stack, headers, bodies in a JSON viewer (Tree / Raw), timing; Copy cURL, Share, Edit & resend, Mock this.
- Settings: light/dark, capture, hide resource types (images, fonts, media), HAR export, limits, desktop pairing.
- `NetLogBubble`: floating bubble with request/error counts and an error toast.
- Works in RTL apps; icons drawn with Views, no icon library.

### react-native-netlog-json-viewer
- Fast, virtualized JSON tree with search (keys / values), next/previous, copy path or value.
- Array indexes hidden by default (`showArrayIndexes`).

### react-native-netlog-desktop
- `npx netlog-desktop`: pairing QR code in the terminal and browser, live viewer, HAR export, remote pause/clear, several devices.
