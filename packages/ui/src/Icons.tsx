import { StyleSheet, View } from 'react-native';

// Small icons drawn with Views: no font glyphs, no icon library. Only centering
// and transforms are used, so RTL layouts can't mirror them.

interface IconProps {
  size?: number;
  color: string;
}

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

export function CloseIcon({ size = 18, color }: IconProps) {
  const t = Math.max(2, size / 9);
  const bar = { width: size * 1.05, height: t, borderRadius: t / 2, backgroundColor: color };
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <View style={[styles.abs, bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.abs, bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

export function SunIcon({ size = 22, color }: IconProps) {
  const core = size * 0.42;
  const t = Math.max(2, size / 11);
  const ray = { width: t, height: size * 0.16, borderRadius: t / 2, backgroundColor: color };
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <View style={{ width: core, height: core, borderRadius: core / 2, backgroundColor: color }} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <View key={deg} style={[styles.abs, ray, { transform: [{ rotate: `${deg}deg` }, { translateY: -size * 0.4 }] }]} />
      ))}
    </View>
  );
}

/** Crescent: a disc with a second disc in `background` color cut out of it. */
export function MoonIcon({ size = 22, color, background }: IconProps & { background: string }) {
  const d = size * 0.78;
  return (
    <View style={[styles.box, { width: size, height: size, overflow: 'hidden' }]} {...hidden}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color }} />
      <View
        style={[
          styles.abs,
          { width: d, height: d, borderRadius: d / 2, backgroundColor: background, transform: [{ translateX: d * 0.36 }, { translateY: -d * 0.28 }] },
        ]}
      />
    </View>
  );
}

/** Three list rows with bullets. */
export function ListIcon({ size = 22, color }: IconProps) {
  const t = Math.max(2, size / 10);
  return (
    <View style={[styles.box, { width: size, height: size, gap: size * 0.17 }]} {...hidden}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.row, { gap: size * 0.12 }]}>
          <View style={{ width: t * 1.4, height: t * 1.4, borderRadius: t, backgroundColor: color }} />
          <View style={{ width: size * 0.62, height: t, borderRadius: t / 2, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}

/** Two slider tracks with knobs. */
export function SlidersIcon({ size = 22, color, background }: IconProps & { background: string }) {
  const t = Math.max(2, size / 10);
  const knob = size * 0.3;
  const track = { width: size * 0.86, height: t, borderRadius: t / 2, backgroundColor: color };
  const knobStyle = { width: knob, height: knob, borderRadius: knob / 2, borderWidth: t, borderColor: color, backgroundColor: background };
  return (
    <View style={[styles.box, { width: size, height: size, gap: size * 0.26 }]} {...hidden}>
      {[-0.18, 0.18].map((x) => (
        <View key={x} style={styles.box}>
          <View style={track} />
          <View style={[styles.abs, knobStyle, { transform: [{ translateX: size * x }] }]} />
        </View>
      ))}
    </View>
  );
}

/**
 * A straight stroke between two points, given as fractions (0..1) of `size`.
 * Positioned with transforms from the box center, so RTL can't mirror it.
 */
function Stroke({ size, from, to, weight, color }: { size: number; from: [number, number]; to: [number, number]; weight: number; color: string }) {
  const dx = (to[0] - from[0]) * size;
  const dy = (to[1] - from[1]) * size;
  const length = Math.hypot(dx, dy) + weight;
  const cx = ((from[0] + to[0]) / 2 - 0.5) * size;
  const cy = ((from[1] + to[1]) / 2 - 0.5) * size;
  return (
    <View
      style={[
        styles.abs,
        {
          width: length,
          height: weight,
          borderRadius: weight / 2,
          backgroundColor: color,
          transform: [{ translateX: cx }, { translateY: cy }, { rotate: `${Math.atan2(dy, dx)}rad` }],
        },
      ]}
    />
  );
}

/** Lightning bolt. */
export function BoltIcon({ size = 22, color }: IconProps) {
  const w = Math.max(2, size / 10);
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <Stroke size={size} from={[0.62, 0.06]} to={[0.3, 0.54]} weight={w} color={color} />
      <Stroke size={size} from={[0.3, 0.54]} to={[0.7, 0.46]} weight={w} color={color} />
      <Stroke size={size} from={[0.7, 0.46]} to={[0.38, 0.94]} weight={w} color={color} />
    </View>
  );
}

export function PauseIcon({ size = 20, color }: IconProps) {
  const w = Math.max(2.5, size / 7);
  const bar = { width: w, height: size * 0.62, borderRadius: w / 2, backgroundColor: color };
  return (
    <View style={[styles.box, styles.row, { width: size, height: size, gap: size * 0.2 }]} {...hidden}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

/** Outlined play triangle (strokes, not borders, so RTL can't flip it). */
export function PlayIcon({ size = 20, color }: IconProps) {
  const w = Math.max(2, size / 9);
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <Stroke size={size} from={[0.3, 0.18]} to={[0.3, 0.82]} weight={w} color={color} />
      <Stroke size={size} from={[0.3, 0.18]} to={[0.8, 0.5]} weight={w} color={color} />
      <Stroke size={size} from={[0.3, 0.82]} to={[0.8, 0.5]} weight={w} color={color} />
    </View>
  );
}

export function TrashIcon({ size = 20, color }: IconProps) {
  const w = Math.max(2, size / 10);
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <Stroke size={size} from={[0.14, 0.24]} to={[0.86, 0.24]} weight={w} color={color} />
      <Stroke size={size} from={[0.4, 0.12]} to={[0.6, 0.12]} weight={w} color={color} />
      <Stroke size={size} from={[0.24, 0.32]} to={[0.3, 0.88]} weight={w} color={color} />
      <Stroke size={size} from={[0.76, 0.32]} to={[0.7, 0.88]} weight={w} color={color} />
      <Stroke size={size} from={[0.3, 0.88]} to={[0.7, 0.88]} weight={w} color={color} />
      <Stroke size={size} from={[0.43, 0.42]} to={[0.43, 0.74]} weight={w * 0.8} color={color} />
      <Stroke size={size} from={[0.57, 0.42]} to={[0.57, 0.74]} weight={w * 0.8} color={color} />
    </View>
  );
}

/** Arrow into a tray: export / download. */
export function ExportIcon({ size = 20, color }: IconProps) {
  const w = Math.max(2, size / 10);
  return (
    <View style={[styles.box, { width: size, height: size }]} {...hidden}>
      <Stroke size={size} from={[0.5, 0.1]} to={[0.5, 0.62]} weight={w} color={color} />
      <Stroke size={size} from={[0.3, 0.44]} to={[0.5, 0.64]} weight={w} color={color} />
      <Stroke size={size} from={[0.7, 0.44]} to={[0.5, 0.64]} weight={w} color={color} />
      <Stroke size={size} from={[0.14, 0.66]} to={[0.14, 0.88]} weight={w} color={color} />
      <Stroke size={size} from={[0.14, 0.88]} to={[0.86, 0.88]} weight={w} color={color} />
      <Stroke size={size} from={[0.86, 0.66]} to={[0.86, 0.88]} weight={w} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
