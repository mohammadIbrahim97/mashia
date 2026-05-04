import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@theme/index';

type Props = {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export function AppBar({ title, left, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.slot}>{left}</View>
      <View style={styles.titleSlot}>
        {title ? (
          <Text style={[type.bodyMd, styles.title]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={[styles.slot, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  slot: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontWeight: '600',
  },
});
