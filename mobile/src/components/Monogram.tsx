import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@theme/index';

type Props = { size?: number };

/**
 * Square Basalt-on-green monogram: italic Fraunces "m" with a gold dot.
 */
export function Monogram({ size = 64 }: Props) {
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size },
      ]}
    >
      <Text
        style={[
          styles.glyph,
          { fontSize: size * 0.78, lineHeight: size * 0.78 },
        ]}
      >
        m
      </Text>
      <View
        style={[
          styles.dot,
          {
            width: size * 0.08,
            height: size * 0.08,
            borderRadius: size,
            top: size * 0.18,
            right: size * 0.18,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.basaltBlack,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: {
    fontFamily: fonts.displayItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    color: colors.mashia[600],
    includeFontPadding: false,
  },
  dot: {
    position: 'absolute',
    backgroundColor: colors.qasiounGold,
  },
});
