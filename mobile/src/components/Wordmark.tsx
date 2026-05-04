import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@theme/index';

type Props = {
  size?: number;
  /** When true (e.g. for dark backgrounds) the period darkens to gold accent. */
  inverse?: boolean;
};

/**
 * The Mashia wordmark — a typographic mark built from the brand fonts:
 * "Mash" in upright Fraunces, italic "ia" in gold, period in green/gold.
 */
export function Wordmark({ size = 56, inverse }: Props) {
  const base = inverse ? colors.paper : colors.mashia[600];
  return (
    <View style={styles.row}>
      <Text style={[styles.glyph, { fontSize: size, color: base }]}>Mash</Text>
      <Text
        style={[
          styles.glyph,
          styles.italic,
          { fontSize: size, color: colors.qasiounGold },
        ]}
      >
        ia
      </Text>
      <Text
        style={[
          styles.glyph,
          { fontSize: size, color: inverse ? colors.qasiounGold : base },
        ]}
      >
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  glyph: {
    fontFamily: fonts.display,
    fontWeight: '300',
    letterSpacing: -2,
  },
  italic: {
    fontFamily: fonts.displayItalic,
    fontStyle: 'italic',
    fontWeight: '400',
  },
});
