import { Pressable, StyleSheet } from 'react-native';
import { Chevron } from 'react-native-netlog-json-viewer';
import { Text } from './Text';

export function BackButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={styles.button}>
      <Chevron direction="left" size={18} weight={2.5} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: 10, alignSelf: 'flex-start' },
  label: { fontSize: 16, fontWeight: '500' },
});
