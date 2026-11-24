import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { disconnectFromDesktop, pairFromPayload, type DeviceInfo, type PairingStatus } from 'react-native-netlog';
import { useNetLogFeature, usePairingStatus } from './hooks';

export interface ScannerProps {
  /** Call with the decoded QR text. */
  onScan: (data: string) => void;
  onCancel: () => void;
}

export interface DesktopPairingLabels {
  title: string;
  description: string;
  scan: string;
  cancelScan: string;
  orEnterCode: string;
  codePlaceholder: string;
  connect: string;
  disconnect: string;
  idle: string;
  connecting: (attempt: number) => string;
  connected: (desktop: string, sent: number) => string;
}

export const defaultPairingLabels: DesktopPairingLabels = {
  title: 'Connect to desktop',
  description: 'Run `npx netlog-desktop` on your computer, then scan its QR code or type the pairing code it shows.',
  scan: 'Scan QR code',
  cancelScan: 'Cancel',
  orEnterCode: 'Or enter the pairing code',
  codePlaceholder: '192.168.1.5:9099 1234-5678',
  connect: 'Connect',
  disconnect: 'Disconnect',
  idle: 'Not connected',
  connecting: (n) => (n > 1 ? `Reconnecting… (attempt ${n})` : 'Connecting…'),
  connected: (d, n) => `Connected to ${d} · ${n} events sent`,
};

export interface DesktopPairingProps {
  /**
   * Renders a QR scanner. NetLog has no camera code of its own: pass your
   * app's scanner (e.g. react-native-vision-camera) here. Without it, only the
   * typed pairing code is offered.
   */
  renderScanner?: (props: ScannerProps) => ReactNode;
  /** Shown on the desktop. Defaults to the platform name. */
  device?: DeviceInfo;
  theme?: 'light' | 'dark';
  labels?: Partial<DesktopPairingLabels>;
  style?: StyleProp<ViewStyle>;
}

const palette = {
  light: { bg: '#FFFFFF', text: '#101828', muted: '#475467', border: '#D0D5DD', input: '#F2F4F7', primary: '#101828', onPrimary: '#FFFFFF', ok: '#17B26A', warn: '#F79009', err: '#D92D20', idle: '#98A2B3', errText: '#B42318' },
  dark: { bg: '#161B26', text: '#F5F5F6', muted: '#94969C', border: '#333741', input: '#1F242F', primary: '#F5F5F6', onPrimary: '#0C111D', ok: '#47CD89', warn: '#FDB022', err: '#F97066', idle: '#61646C', errText: '#FDA29B' },
};

function statusView(status: PairingStatus, labels: DesktopPairingLabels, c: (typeof palette)['light']) {
  switch (status.state) {
    case 'connected':
      return { color: c.ok, text: labels.connected(status.desktopName ?? status.url, status.sent) };
    case 'connecting':
      return { color: c.warn, text: labels.connecting(status.attempt) };
    case 'error':
      return { color: c.err, text: status.message };
    default:
      return { color: c.idle, text: labels.idle };
  }
}

/**
 * Pairing panel for the QR / pairing-code feature. Renders nothing when
 * `configure({ features: { qrPairing: false } })` is set.
 */
export function DesktopPairing(props: DesktopPairingProps) {
  const enabled = useNetLogFeature('qrPairing');
  const status = usePairingStatus();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const labels = { ...defaultPairingLabels, ...props.labels };
  const c = palette[props.theme ?? 'light'];
  const device: DeviceInfo = props.device ?? {
    name: Platform.OS === 'ios' ? 'iOS device' : Platform.OS === 'android' ? 'Android device' : Platform.OS,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
  };
  const busy = status.state === 'connected' || status.state === 'connecting';
  const s = statusView(status, labels, c);

  const pair = (text: string) => {
    setError(null);
    try {
      pairFromPayload(text, { device });
      setScanning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^NetLog: /, '') : String(e));
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }, props.style]}>
      <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
        {labels.title}
      </Text>
      <Text style={[styles.description, { color: c.muted }]}>{labels.description}</Text>

      <View style={[styles.status, { borderColor: c.border }]} accessibilityLiveRegion="polite">
        <View style={[styles.dot, { backgroundColor: s.color }]} />
        <Text style={[styles.statusText, { color: status.state === 'error' ? c.errText : c.text }]}>{s.text}</Text>
      </View>

      {busy ? (
        <Pressable
          onPress={disconnectFromDesktop}
          accessibilityRole="button"
          style={[styles.button, styles.secondary, { borderColor: c.border }]}
        >
          <Text style={[styles.buttonText, { color: c.text }]}>{labels.disconnect}</Text>
        </Pressable>
      ) : (
        <>
          {props.renderScanner ? (
            scanning ? (
              <View style={[styles.scanner, { borderColor: c.border }]}>
                {props.renderScanner({ onScan: pair, onCancel: () => setScanning(false) })}
                <Pressable onPress={() => setScanning(false)} accessibilityRole="button" style={styles.cancel}>
                  <Text style={[styles.buttonText, { color: c.text }]}>{labels.cancelScan}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setScanning(true)}
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: c.primary }]}
              >
                <Text style={[styles.buttonText, { color: c.onPrimary }]}>{labels.scan}</Text>
              </Pressable>
            )
          ) : null}

          <Text style={[styles.or, { color: c.muted }]}>{labels.orEnterCode}</Text>
          <View style={styles.codeRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={labels.codePlaceholder}
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              returnKeyType="go"
              onSubmitEditing={() => pair(code)}
              accessibilityLabel={labels.orEnterCode}
              style={[styles.input, { backgroundColor: c.input, color: c.text }]}
            />
            <Pressable
              onPress={() => pair(code)}
              disabled={!code.trim()}
              accessibilityRole="button"
              style={[styles.button, styles.connect, { backgroundColor: c.primary, opacity: code.trim() ? 1 : 0.4 }]}
            >
              <Text style={[styles.buttonText, { color: c.onPrimary }]}>{labels.connect}</Text>
            </Pressable>
          </View>
        </>
      )}

      {error ? <Text style={[styles.error, { color: c.errText }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Codes and addresses read left-to-right even inside RTL apps.
  root: { padding: 16, gap: 12, direction: 'ltr' },
  title: { fontSize: 17, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 19 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 13 },
  button: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  scanner: { height: 280, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  cancel: { position: 'absolute', bottom: 8, alignSelf: 'center', height: 44, paddingHorizontal: 16, justifyContent: 'center' },
  or: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  codeRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  connect: { minWidth: 96 },
  error: { fontSize: 13 },
});
