import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  Share,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { clearEntries, toHar, type DeviceInfo } from 'react-native-netlog';
import type { ScannerProps } from './DesktopPairing';
import { isError } from './format';
import { useNetLogFeature } from './hooks';
import { defaultLabels, type NetLogLabels } from './labels';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';
import { CloseIcon, ListIcon, MoonIcon, SlidersIcon, SunIcon } from './Icons';
import { SettingsPanel } from './SettingsPanel';
import { netLogDark, netLogLight, type NetLogTheme } from './theme';
import { useEntries, usePaused } from './useEntries';

export interface NetLogScreenProps {
  /** Starting theme. A partial theme object overrides colors on top of light/dark. */
  theme?: 'light' | 'dark' | Partial<NetLogTheme>;
  /** Called when the header's light/dark toggle is used. */
  onThemeChange?: (mode: 'light' | 'dark') => void;
  labels?: Partial<NetLogLabels>;
  /** Shows a close button in the header. */
  onClose?: () => void;
  /**
   * Puts text on the clipboard (cURL, JSON values, paths). Wire it to your
   * clipboard library; without it, NetLog falls back to the share sheet.
   */
  onCopy?: (text: string) => void;
  /** QR scanner for desktop pairing (see DesktopPairing). Only used when `qrPairing` is on. */
  renderScanner?: (props: ScannerProps) => ReactNode;
  /** Device info shown on the desktop when paired. */
  device?: DeviceInfo;
  style?: StyleProp<ViewStyle>;
}

type Tab = 'requests' | 'settings';
type View_ = { name: 'list' } | { name: 'detail'; id: number };

function HeaderButton({ label, onPress, theme: t, active }: { label: string; onPress: () => void; theme: NetLogTheme; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={4}
      style={[styles.headerButton, { backgroundColor: active ? t.warnBg : t.surfaceAlt }]}
    >
      <Text style={[styles.headerButtonText, { color: active ? t.warn : t.text }]}>{label}</Text>
    </Pressable>
  );
}

/** The complete in-app network inspector: request list, request details, and (optionally) desktop pairing. */
export function NetLogScreen(props: NetLogScreenProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(props.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    if (props.theme === 'light' || props.theme === 'dark') setMode(props.theme);
  }, [props.theme]);
  const t = useMemo<NetLogTheme>(
    () => ({ ...(mode === 'dark' ? netLogDark : netLogLight), ...(typeof props.theme === 'object' ? props.theme : {}) }),
    [mode, props.theme],
  );
  const jsonTheme = mode;
  const { onThemeChange } = props;
  const changeMode = useCallback(
    (next: 'light' | 'dark') => {
      setMode(next);
      onThemeChange?.(next);
    },
    [onThemeChange],
  );
  const toggleMode = useCallback(() => changeMode(mode === 'dark' ? 'light' : 'dark'), [mode, changeMode]);
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const entries = useEntries();
  const [paused, setPaused] = usePaused();
  const [view, setView] = useState<View_>({ name: 'list' });
  const [tab, setTab] = useState<Tab>('requests');
  const pairingEnabled = useNetLogFeature('qrPairing');
  const { onCopy } = props;

  const copy = useCallback(
    (text: string) => {
      if (onCopy) onCopy(text);
      else Share.share({ message: text }).catch(() => undefined);
    },
    [onCopy],
  );

  const goList = useCallback(() => setView({ name: 'list' }), []);
  const select = useCallback((id: number) => setView({ name: 'detail', id }), []);

  const inDetail = view.name === 'detail' && tab === 'requests';
  useEffect(() => {
    if (!inDetail && tab === 'requests') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inDetail) goList();
      else setTab('requests');
      return true;
    });
    return () => sub.remove();
  }, [inDetail, tab, goList]);

  const errors = useMemo(() => entries.filter(isError).length, [entries]);
  const detailEntry = view.name === 'detail' ? entries.find((e) => e.id === view.id) : undefined;

  const shareHar = () => {
    Share.share({ message: JSON.stringify(toHar(entries)) }).catch(() => undefined);
  };

  let body: ReactNode;
  if (tab === 'settings') {
    body = (
      <SettingsPanel
        theme={t}
        mode={mode}
        onModeChange={changeMode}
        labels={labels}
        paused={paused}
        onPausedChange={setPaused}
        storedCount={entries.length}
        onClear={clearEntries}
        onShareHar={shareHar}
        pairingEnabled={pairingEnabled}
        renderScanner={props.renderScanner}
        device={props.device}
      />
    );
  } else if (inDetail && detailEntry) {
    body = (
      <RequestDetail
        key={detailEntry.id}
        entry={detailEntry}
        onBack={goList}
        copy={copy}
        theme={t}
        jsonTheme={jsonTheme}
        labels={labels}
      />
    );
  } else {
    body = (
      <View style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
                {labels.title}
              </Text>
              <Text style={[styles.subtitle, { color: t.muted }]}>{labels.summary(entries.length, errors)}</Text>
            </View>
            <Pressable
              onPress={toggleMode}
              accessibilityRole="button"
              accessibilityLabel={mode === 'dark' ? labels.lightMode : labels.darkMode}
              hitSlop={8}
              style={styles.close}
            >
              {mode === 'dark' ? <SunIcon color={t.text} /> : <MoonIcon color={t.text} background={t.background} />}
            </Pressable>
            {props.onClose ? (
              <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel={labels.close} hitSlop={8} style={styles.close}>
                <CloseIcon color={t.text} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.headerButtons}>
            <HeaderButton label={paused ? labels.resume : labels.pause} onPress={() => setPaused(!paused)} theme={t} active={paused} />
            <HeaderButton label={labels.clear} onPress={clearEntries} theme={t} />
            <HeaderButton label={labels.exportHar} onPress={shareHar} theme={t} />
          </View>
        </View>
        {paused ? (
          <Text style={[styles.paused, { color: t.warn, backgroundColor: t.warnBg }]}>{labels.paused}</Text>
        ) : null}
        <RequestList entries={entries} onSelect={select} theme={t} labels={labels} />
      </View>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ['requests', labels.tabRequests],
    ['settings', labels.tabSettings],
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.background }, props.style]}>
      <View style={styles.flex}>{body}</View>
      {inDetail && detailEntry ? null : (
        <View style={[styles.tabBar, { borderTopColor: t.separator, backgroundColor: t.surface }]} accessibilityRole="tablist">
          {tabs.map(([id, label]) => {
            const on = tab === id;
            const color = on ? t.text : t.muted;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                style={styles.tabItem}
              >
                {id === 'requests' ? <ListIcon color={color} /> : <SlidersIcon color={color} background={t.surface} />}
                <Text style={[styles.tabLabel, { color, fontWeight: on ? '700' : '500' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // URLs, JSON and codes read left-to-right, even inside RTL apps.
  root: { flex: 1, direction: 'ltr' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headerButton: { height: 34, paddingHorizontal: 12, borderRadius: 9, justifyContent: 'center' },
  headerButtonText: { fontSize: 13, fontWeight: '600' },
  paused: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, fontSize: 13 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1 },
  tabItem: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, textAlign: 'center' },
});
