import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type ChevronDirection = 'right' | 'down' | 'left' | 'up';

const ROTATION: Record<ChevronDirection, string> = { right: '0deg', down: '90deg', left: '180deg', up: '-90deg' };

export interface ChevronProps {
  direction?: ChevronDirection;
  size?: number;
  color: string;
  /** Stroke width. Default: size / 8. */
  weight?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A chevron drawn with two rounded bars: no font glyphs, no icon library.
 * Only centering and transforms are used, so RTL layouts can't mirror it.
 */
export function Chevron({ direction = 'right', size = 16, color, weight, style }: ChevronProps) {
  const thickness = weight ?? Math.max(1.5, size / 8);
  const arm = size * 0.5;
  const offset = arm / (2 * Math.SQRT2);
  const bar = { width: arm, height: thickness, borderRadius: thickness / 2, backgroundColor: color };
  return (
    <View
      style={[styles.box, { width: size, height: size, transform: [{ rotate: ROTATION[direction] }] }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.bar, bar, { transform: [{ translateY: -offset }, { rotate: '45deg' }] }]} />
      <View style={[styles.bar, bar, { transform: [{ translateY: offset }, { rotate: '-45deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute' },
});
