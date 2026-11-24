# Changelog

All notable changes to NetLog. The packages are versioned together where possible.

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

### react-native-netlog-json-viewer — 0.1.1
- Fast, virtualized JSON tree with search (keys / values), next/previous, copy path or value.
- Array indexes hidden by default (`showArrayIndexes`).
- Fix: match count no longer clipped on Android.

### react-native-netlog-desktop
- `npx netlog-desktop`: pairing QR code in the terminal and browser, live viewer with filters, waterfall, highlighted JSON, HAR export, remote pause/clear, several devices.
- The viewer only answers this computer by default (`--allow-remote-viewer` to share).
