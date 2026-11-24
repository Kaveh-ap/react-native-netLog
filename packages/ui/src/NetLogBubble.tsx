import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { getEntries, subscribe, type NetworkEntry } from 'react-native-netlog';
import { durationText, isError, splitUrl, statusLabel } from './format';
import { ListIcon } from './Icons';
import { Text } from './Text';
import { netLogDark, netLogLight, type NetLogTheme } from './theme';

export interface NetLogBubbleProps {
  /** Open the NetLog screen. */
  onPress: () => void;
  /** Open a specific request (from the error toast). Falls back to `onPress`. */
  onOpenEntry?: (entryId: number) => void;
  /** Show a toast when a request fails or returns 5xx. Default true. */
  showErrorToast?: boolean;
  theme?: 'light' | 'dark' | Partial<NetLogTheme>;
  viewLabel?: string;
  /** Accessibility label; receives total and error counts. */
  accessibilityLabel?: (total: number, errors: number) => string;
}

const SIZE = 56;
const MARGIN = 10;
const TOAST_MS = 4000;

const isToastWorthy = (e: NetworkEntry) => e.state === 'error' || (e.status ?? 0) >= 500;

/**
 * A draggable bubble with request/error counts, plus an error toast. Mount it once,
 * above your app (it fills the screen but only the bubble and toast take touches).
 */
export function NetLogBubble(props: NetLogBubbleProps) {
  const t = useMemo<NetLogTheme>(
    () => ({ ...(props.theme === 'dark' ? netLogDark : netLogLight), ...(typeof props.theme === 'object' ? props.theme : {}) }),
    [props.theme],
  );
  const [counts, setCounts] = useState(() => ({ total: getEntries().length, errors: getEntries().filter(isError).length }));
  const [toast, setToast] = useState<NetworkEntry | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seen = useRef(new Set<number>());
  const showToast = props.showErrorToast ?? true;

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe((ev) => {
      if (showToast && ev.type === 'update' && ev.entry.state !== 'pending' && isToastWorthy(ev.entry) && !seen.current.has(ev.entry.id)) {
        seen.current.add(ev.entry.id);
        setToast({ ...ev.entry });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
      }
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        const all = getEntries();
        setCounts({ total: all.length, errors: all.filter(isError).length });
      }, 300);
    });
    return () => {
      unsubscribe();
      if (pending) clearTimeout(pending);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  // Dragging: position is a translate from the top-left corner (never left/right
  // styles, which RTL layouts would mirror).
  const [area, setArea] = useState({ width: 0, height: 0 });
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const placed = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const id = pos.addListener((v) => {
      current.current = v;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
    if (!placed.current && width > 0) {
      placed.current = true;
      pos.setValue({ x: width - SIZE - MARGIN, y: height * 0.55 });
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          start.current = { ...current.current };
        },
        onPanResponderMove: (_, g) => {
          pos.setValue({ x: start.current.x + g.dx, y: start.current.y + g.dy });
        },
        onPanResponderRelease: (_, g) => {
          const x = start.current.x + g.dx;
          const y = Math.min(Math.max(start.current.y + g.dy, MARGIN), Math.max(MARGIN, area.height - SIZE - MARGIN));
          const toRight = x + SIZE / 2 > area.width / 2;
          Animated.spring(pos, {
            toValue: { x: toRight ? area.width - SIZE - MARGIN : MARGIN, y },
            useNativeDriver: true,
            friction: 7,
          }).start();
        },
      }),
    [area, pos],
  );

  const open = (e: NetworkEntry) => {
    setToast(null);
    if (props.onOpenEntry) props.onOpenEntry(e.id);
    else props.onPress();
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={onLayout}>
      {area.width > 0 ? (
        <Animated.View style={[styles.bubbleWrap, { transform: pos.getTranslateTransform() }]} {...responder.panHandlers}>
          <Pressable
            onPress={props.onPress}
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel?.(counts.total, counts.errors) ?? `NetLog, ${counts.total} requests, ${counts.errors} errors`}
            style={[styles.bubble, { backgroundColor: t.primary }]}
          >
            <ListIcon size={18} color={t.onPrimary} />
            <Text style={[styles.count, { color: t.onPrimary }]}>{counts.total > 999 ? '999+' : counts.total}</Text>
          </Pressable>
          {counts.errors > 0 ? (
            <View style={[styles.badge, { backgroundColor: t.error, borderColor: t.background }]} pointerEvents="none">
              <Text style={styles.badgeText}>{counts.errors > 99 ? '99+' : counts.errors}</Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
      {toast ? (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <View style={[styles.toast, { backgroundColor: t.primary }]} accessibilityLiveRegion="polite">
            <Text style={[styles.toastStatus, { backgroundColor: t.error }]}>{statusLabel(toast)}</Text>
            <View style={styles.toastMain}>
              <Text style={[styles.toastPath, { color: t.onPrimary, fontFamily: t.mono }]} numberOfLines={1}>
                {toast.method} {splitUrl(toast.url).path}
              </Text>
              <Text style={[styles.toastMeta, { color: t.onPrimary }]} numberOfLines={1}>
                {splitUrl(toast.url).host} · {toast.error ?? durationText(toast)}
              </Text>
            </View>
            <Pressable onPress={() => open(toast)} accessibilityRole="button" style={[styles.toastButton, { backgroundColor: t.onPrimary }]}>
              <Text style={[styles.toastButtonText, { color: t.primary }]}>{props.viewLabel ?? 'View'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, direction: 'ltr', alignItems: 'flex-start' },
  bubbleWrap: { position: 'absolute', top: 0, width: SIZE, height: SIZE },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  count: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -4 }],
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  toastWrap: { position: 'absolute', bottom: 24, width: '100%', paddingHorizontal: 12 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  toastStatus: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  toastMain: { flex: 1, gap: 2 },
  toastPath: { fontSize: 12 },
  toastMeta: { fontSize: 12, opacity: 0.8 },
  toastButton: { height: 36, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  toastButtonText: { fontSize: 13, fontWeight: '600' },
});
