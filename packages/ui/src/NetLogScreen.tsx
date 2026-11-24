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
import { clearEntries, getEntries, mockRuleFromEntry, toHar, type DeviceInfo, type MockRuleInput } from 'react-native-netlog';

const getEntryById = (id: number) => getEntries().find((e) => e.id === id);
import type { ScannerProps } from './DesktopPairing';
import { isError } from './format';
import { initHiddenTypes, resourceTypeOf, setHiddenTypes, useHiddenTypes } from './hiddenTypes';
import { useNetLogFeature } from './hooks';
import { defaultLabels, type NetLogLabels } from './labels';
import { RequestDetail } from './RequestDetail';
import { RequestList } from './RequestList';
import { BoltIcon, CloseIcon, ExportIcon, ListIcon, PauseIcon, PlayIcon, SlidersIcon, TrashIcon } from './Icons';
import { MocksPanel } from './MocksPanel';
import { ResendEditor } from './ResendEditor';
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
  /**
   * Resource types hidden from the list at first (e.g. ['webp', 'gif', 'svg']).
   * Users can change it in Settings. Ids: webp, gif, svg, png, jpeg, avif, ico, font, video, audio.
   */
  hiddenTypes?: string[];
  /** Open this request's details first (e.g. from NetLogBubble's error toast). */
  initialEntryId?: number;
  style?: StyleProp<ViewStyle>;
}

const SHARE_LIMIT = 400_000;

type Tab = 'requests' | 'mocks' | 'settings';
type View_ = { name: 'list' } | { name: 'detail'; id: number } | { name: 'resend'; id: number };

function IconButton({
  label,
  onPress,
  theme: t,
  active,
  children,
}: {
  label: string;
  onPress: () => void;
  theme: NetLogTheme;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: active ? t.warnBg : pressed ? t.surfaceAlt : 'transparent' }]}
    >
      {children}
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
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const allEntries = useEntries();
  initHiddenTypes(props.hiddenTypes);
  const hidden = useHiddenTypes();
  const entries = useMemo(
    () => (hidden.size ? allEntries.filter((e) => !hidden.has(resourceTypeOf(e) ?? '')) : allEntries),
    [allEntries, hidden],
  );
  const hiddenCount = allEntries.length - entries.length;
  const [paused, setPaused] = usePaused();
  const [view, setView] = useState<View_>(() =>
    props.initialEntryId !== undefined ? { name: 'detail', id: props.initialEntryId } : { name: 'list' },
  );
  const [tab, setTab] = useState<Tab>('requests');
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<MockRuleInput | null>(null);
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

  const inDetail = view.name !== 'list' && tab === 'requests';
  const inSubScreen = inDetail || (tab === 'mocks' && editingRule !== null);
  useEffect(() => {
    if (!inSubScreen && tab === 'requests') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view.name === 'resend' && tab === 'requests') setView({ name: 'detail', id: view.id });
      else if (inDetail) goList();
      else if (tab === 'mocks' && editingRule !== null) setEditingRule(null);
      else setTab('requests');
      return true;
    });
    return () => sub.remove();
  }, [inSubScreen, inDetail, tab, view, editingRule, goList]);

  const mockThis = useCallback((id: number) => {
    const e = getEntryById(id);
    if (!e) return;
    setRuleDraft(mockRuleFromEntry(e));
    setEditingRule('new');
    setTab('mocks');
  }, []);

  const errors = useMemo(() => entries.filter(isError).length, [entries]);
  const detailEntry = view.name !== 'list' ? allEntries.find((e) => e.id === view.id) : undefined;

  const shareHar = () => {
    // Android can't pass much more than ~1 MB to the share sheet; shrink bodies until it fits.
    let message = JSON.stringify(toHar(allEntries));
    for (const limit of [20_000, 2_000, 0]) {
      if (message.length <= SHARE_LIMIT) break;
      message = JSON.stringify(toHar(allEntries, { maxBodyLength: limit }));
    }
    Share.share({ message }).catch(() => undefined);
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
        storedCount={allEntries.length}
        hidden={hidden}
        onHiddenChange={setHiddenTypes}
        onClear={clearEntries}
        onShareHar={shareHar}
        pairingEnabled={pairingEnabled}
        renderScanner={props.renderScanner}
        device={props.device}
      />
    );
  } else if (tab === 'mocks') {
    body = (
      <MocksPanel
        theme={t}
        labels={labels}
        editing={editingRule}
        onEdit={(id) => {
          setEditingRule(id);
          if (id !== 'new') setRuleDraft(null);
        }}
        draft={ruleDraft}
      />
    );
  } else if (view.name === 'resend' && detailEntry) {
    body = (
      <ResendEditor
        key={`resend-${detailEntry.id}`}
        entry={detailEntry}
        onBack={() => setView({ name: 'detail', id: detailEntry.id })}
        onOpenEntry={select}
        theme={t}
        labels={labels}
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
        onResend={() => setView({ name: 'resend', id: detailEntry.id })}
        onMockThis={() => mockThis(detailEntry.id)}
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
            <IconButton label={paused ? labels.resume : labels.pause} onPress={() => setPaused(!paused)} theme={t} active={paused}>
              {paused ? <PlayIcon color={t.warn} /> : <PauseIcon color={t.text} />}
            </IconButton>
            <IconButton label={labels.clear} onPress={clearEntries} theme={t}>
              <TrashIcon color={t.text} />
            </IconButton>
            <IconButton label={labels.exportHar} onPress={shareHar} theme={t}>
              <ExportIcon color={t.text} />
            </IconButton>
            {props.onClose ? (
              <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel={labels.close} hitSlop={8} style={styles.close}>
                <CloseIcon color={t.text} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {paused ? (
          <Text style={[styles.paused, { color: t.warn, backgroundColor: t.warnBg }]}>{labels.paused}</Text>
        ) : null}
        {hiddenCount > 0 ? (
          <Pressable onPress={() => setTab('settings')} accessibilityRole="button" style={styles.hiddenNote}>
            <Text style={[styles.hiddenNoteText, { color: t.muted }]}>{labels.hiddenNote(hiddenCount)}</Text>
            <Text style={[styles.hiddenNoteText, { color: t.accent }]}>{labels.tabSettings}</Text>
          </Pressable>
        ) : null}
        <RequestList entries={entries} onSelect={select} theme={t} labels={labels} />
      </View>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ['requests', labels.tabRequests],
    ['mocks', labels.tabMocks],
    ['settings', labels.tabSettings],
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.background }, props.style]}>
      <View style={styles.flex}>{body}</View>
      {inSubScreen && (tab !== 'requests' || detailEntry) ? null : (
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
                {id === 'requests' ? (
                  <ListIcon color={color} />
                ) : id === 'mocks' ? (
                  <BoltIcon color={color} />
                ) : (
                  <SlidersIcon color={color} background={t.surface} />
                )}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  paused: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, fontSize: 13 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1 },
  hiddenNote: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  hiddenNoteText: { fontSize: 12 },
  tabItem: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, textAlign: 'center' },
});
