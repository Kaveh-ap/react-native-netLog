# @netlog/desktop

Pair a phone by QR code and watch its network traffic live in the browser.

```bash
npx netlog-desktop            # --port 9099 --token 1234-5678 --name "My Mac"
```

It prints a QR code and pairing code, and serves the viewer at `http://localhost:9099`:

- **Physical phone on the same Wi-Fi:** scan the QR code in the app (`DesktopPairing` from `@netlog/ui`), or type the pairing code.
- **iOS simulator:** use `localhost:<port> <token>`.
- **Android over USB or emulator:** first run `adb reverse tcp:9099 tcp:9099`, then use the `localhost` code.

The viewer lists requests from every paired device, shows headers, bodies and the code that sent each request, and can pause or clear capture on the device and export HAR.

Authorization and cookie headers are masked on the device before anything is sent. The pairing token is checked with a constant-time compare; a wrong token is rejected and the app doesn't retry.

Apps can turn this feature off completely with `configure({ features: { qrPairing: false } })`.
