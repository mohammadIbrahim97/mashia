import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, type } from '@theme/index';

export type ChipKind = 'verified' | 'pending' | 'flagged' | 'info' | 'neutral';

const kindStyles: Record<ChipKind, { bg: string; fg: string; border: string }> =
  {
    verified: {
      bg: colors.mashia[50],
      fg: colors.mashia[700],
      border: colors.mashia[200],
    },
    pending: { bg: '#FBF4E5', fg: '#7C5234', border: '#E5CC9B' },
    flagged: { bg: '#F9E5E5', fg: '#7C2A2A', border: '#E5B5B5' },
    info: { bg: '#E5EEF6', fg: '#1F5F8F', border: '#B5C9DC' },
    neutral: { bg: colors.parchment, fg: colors.muted, border: colors.hairline },
  };

type Props = {
  children: React.ReactNode;
  kind?: ChipKind;
  style?: ViewStyle;
};

export function Chip({ children, kind = 'neutral', style }: Props) {
  const k = kindStyles[kind];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: k.bg, borderColor: k.border },
        style,
      ]}
    >
      <Text style={[type.caption, { color: k.fg, fontWeight: '600' }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 4,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
