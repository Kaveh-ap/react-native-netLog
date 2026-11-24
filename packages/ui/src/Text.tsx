import { I18nManager, StyleSheet, Text as RNText, type TextProps } from 'react-native';

const { isRTL, doLeftAndRightSwapInRTL } = I18nManager.getConstants();
const swapped = isRTL && doLeftAndRightSwapInRTL;

/**
 * Physical text alignment. In RTL apps React Native swaps `left` and `right`
 * for text, even inside a `direction: 'ltr'` view, so ask for the opposite.
 */
export const physicalAlign = (side: 'left' | 'right'): 'left' | 'right' =>
  swapped ? (side === 'left' ? 'right' : 'left') : side;

/**
 * Invisible left-to-right mark. Android ignores `writingDirection` and takes a
 * line's direction from its first strong character, so in RTL apps a line like
 * `{` or `}` (no strong character) would render mirrored without it.
 */
const LRM = '‎';

/** Text that stays left-aligned and left-to-right inside RTL apps. */
export function Text({ style, children, ...rest }: TextProps) {
  return (
    <RNText {...rest} style={[styles.ltr, style]}>
      {isRTL ? LRM : null}
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  ltr: { textAlign: physicalAlign('left'), writingDirection: 'ltr' },
});
