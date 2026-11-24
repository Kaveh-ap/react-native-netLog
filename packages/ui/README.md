# react-native-netlog-ui

The NetLog in-app network inspector for React Native. Plain React Native components, no native code.

- Request list with search and All / Errors / Slow / Pending filters
- Request details: overview, the code that sent the request, headers, and request/response bodies in a searchable JSON viewer
- Copy as cURL, share a request, resend it, share the whole session as HAR
- Requests and Settings tabs; Settings has light/dark, pause/clear, HAR export, the active limits, and desktop pairing
- Optional desktop pairing (QR code or pairing code), hidden when `qrPairing` is off
- Icons are drawn with Views: no icon font or icon library
- Light and dark themes, overridable colors and labels, always left-to-right (works inside RTL apps)

## Usage

```tsx
import { initNetLog } from 'react-native-netlog';
import { NetLogScreen } from 'react-native-netlog-ui';
import Clipboard from '@react-native-clipboard/clipboard';

// once, at app start (dev/QA builds)
initNetLog({ ignore: [/\/symbolicate$/] });

// any screen
export function NetworkScreen({ navigation }) {
  return (
    <NetLogScreen
      theme="light"
      onClose={() => navigation.goBack()}
      onCopy={(text) => Clipboard.setString(text)}
    />
  );
}
```

| Prop | | |
|---|---|---|
| `theme` | `'light'` | `'light'`, `'dark'`, or partial theme tokens. Users can switch light/dark in the header or Settings |
| `onThemeChange(mode)` | | Called when the user switches light/dark |
| `labels` | English | Override any UI text |
| `onClose` | | Shows a close button |
| `onCopy(text)` | | Your clipboard. Without it, copy actions open the share sheet |
| `renderScanner` | | QR scanner for desktop pairing (from your camera library) |
| `device` | | Name/version shown on the desktop when paired |

Android's back button goes from a request back to the list before leaving the screen.

The building blocks are exported too: `RequestList`, `RequestDetail`, `DesktopPairing`, `useEntries()` (live, throttled list of requests), `usePaused()`, `useNetLogFeature()`.
