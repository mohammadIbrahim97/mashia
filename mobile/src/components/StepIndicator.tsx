import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@theme/index';

type Props = {
  total: number;
  current: number;
};

export function StepIndicator({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { backgroundColor: i < current ? colors.mashia[600] : colors.hairline },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing[5],
    paddingTop: 4,
  },
  bar: {
    height: 3,
    flex: 1,
    borderRadius: 2,
  },
});
