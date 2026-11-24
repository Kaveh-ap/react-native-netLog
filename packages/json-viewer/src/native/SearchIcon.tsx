import { StyleSheet, View } from 'react-native';

/** Magnifier drawn with Views (ring + handle). Only centering and transforms, so RTL can't mirror it. */
export function SearchIcon({ size = 18, color }: { size?: number; color: string }) {
  const ring = size * 0.66;
  const stroke = Math.max(1.5, size / 9);
  const handle = size * 0.34;
  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.abs,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: stroke,
            borderColor: color,
            transform: [{ translateX: -size * 0.08 }, { translateY: -size * 0.08 }],
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          {
            width: handle,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            transform: [{ translateX: size * 0.3 }, { translateY: size * 0.3 }, { rotate: '45deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
