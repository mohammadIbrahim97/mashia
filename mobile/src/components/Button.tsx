import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, type } from '@theme/index';
import { Icon, IconName } from './Icon';

export type ButtonKind = 'primary' | 'secondary' | 'dark' | 'ghost';

type Props = Omit<PressableProps, 'children'> & {
  children: React.ReactNode;
  kind?: ButtonKind;
  full?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'leading' | 'trailing';
};

const kindStyles: Record<
  ButtonKind,
  { bg: string; border: string; fg: string; pressedBg: string }
> = {
  primary: {
    bg: colors.mashia[600],
    border: colors.mashia[600],
    fg: colors.paper,
    pressedBg: colors.mashia[700],
  },
  secondary: {
    bg: colors.paper,
    border: colors.hairline,
    fg: colors.ink,
    pressedBg: colors.parchment,
  },
  dark: {
    bg: 'transparent',
    border: 'rgba(255,255,255,0.25)',
    fg: colors.paper,
    pressedBg: 'rgba(255,255,255,0.08)',
  },
  ghost: {
    bg: 'transparent',
    border: 'transparent',
    fg: colors.mashia[700],
    pressedBg: colors.mashia[50],
  },
};

export function Button({
  children,
  kind = 'primary',
  full,
  loading,
  icon,
  iconPosition = 'trailing',
  disabled,
  style,
  ...rest
}: Props) {
  const k = kindStyles[kind];

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? k.pressedBg : k.bg,
          borderColor: k.border,
          opacity: disabled ? 0.5 : 1,
          width: full ? '100%' : undefined,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {icon && iconPosition === 'leading' ? (
          <Icon name={icon} size={18} color={k.fg} />
        ) : null}
        {loading ? (
          <ActivityIndicator color={k.fg} />
        ) : (
          <Text style={[type.bodyMd, { color: k.fg, fontWeight: '600' }]}>
            {children}
          </Text>
        )}
        {icon && iconPosition === 'trailing' && !loading ? (
          <Icon name={icon} size={18} color={k.fg} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
