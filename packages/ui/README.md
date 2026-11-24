# react-native-netlog-ui

The NetLog in-app network inspector for React Native. Plain React Native components, no native code.

- **Requests:** search, All / Errors / Slow / Pending / Mocked filters, pause, clear, export HAR
- **Request details:** host and time chips, overview, the code that sent the request, headers, bodies in a searchable JSON viewer (Tree / Raw), timing; Copy cURL, Share, **Edit & resend**, **Mock this**
- **Mocks:** network conditions (Off / Slow 3G / Flaky / Offline) and rules that respond with a status and body, delay, or fail like a broken connection. Works for `fetch` and axios, without native code
- **Settings:** light/dark, capture, hide resource types from the list (WebP, GIF, SVG, PNG, JPEG, AVIF, ICO, fonts, video, audio), HAR export, limits, desktop pairing
- **NetLogBubble:** optional floating bubble with request/error counts and an error toast
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
| `theme` | `'light'` | `'light'`, `'dark'`, or partial theme tokens. Users can switch in Settings |
| `onThemeChange(mode)` | | Called when the user switches light/dark |
| `labels` | English | Override any UI text |
| `onClose` | | Shows a close button |
| `onCopy(text)` | | Your clipboard. Without it, copy actions open the share sheet |
| `renderScanner` | | QR scanner for desktop pairing (from your camera library) |
| `device` | | Name/version shown on the desktop when paired |
| `hiddenTypes` | `[]` | Resource types hidden from the list at first, e.g. `['webp', 'gif', 'svg']` |
| `initialEntryId` | | Open this request's details first |

Android's back button steps back inside NetLog (resend → details → list, rule editor → Mocks, Mocks/Settings → Requests) before leaving the screen.

## Floating bubble (optional)

```tsx
import { NetLogBubble } from 'react-native-netlog-ui';

// at your app root, above everything else
<NetLogBubble onPress={() => navigation.navigate('NetLog')} onOpenEntry={(id) => navigation.navigate('NetLog', { id })} />
// and in that screen: <NetLogScreen initialEntryId={route.params?.id} … />
```

## Keeping mock rules across restarts

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setMockStorage } from 'react-native-netlog';

setMockStorage(AsyncStorage);
```

The building blocks are exported too: `RequestList`, `RequestDetail`, `DesktopPairing`, `useEntries()` (live, throttled list of requests), `usePaused()`, `useNetLogFeature()`.
