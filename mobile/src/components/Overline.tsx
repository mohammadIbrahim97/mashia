import React from 'react';
import { Text, TextStyle, View } from 'react-native';
import { colors, type } from '@theme/index';

type Props = {
  children: React.ReactNode;
  color?: string;
  bullet?: boolean;
  style?: TextStyle;
};

export function Overline({
  children,
  color = colors.muted,
  bullet = false,
  style,
}: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {bullet ? (
        <Text style={[type.mono, { color, marginRight: 6 }]}>●</Text>
      ) : null}
      <Text style={[type.mono, { color }, style]}>
        {typeof children === 'string' ? children.toUpperCase() : children}
      </Text>
    </View>
  );
}
