import React from 'react';
import {
  Pressable, Text, View, ActivityIndicator,
  StyleSheet, ViewStyle, PressableProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius, borderWidth, layout } from '../theme/spacing';
import { textStyle } from '../theme/typography';

/**
 * Button
 * ======
 * Four variants: primary, secondary, destructive, ghost.
 * Three sizes: sm, md, lg.
 *
 * Design notes:
 *   - Primary uses Mashia Red (the single CTA color in the system).
 *   - Pressed state DARKENS rather than goes translucent — feels more solid,
 *     more "trade", less "consumer app".
 *   - Destructive is crimson, distinct from primary, so a "Cancel order" never
 *     looks like a "Buy now".
 *   - Loading state replaces the label, doesn't dim the button — keeps button
 *     width stable so layouts don't reflow.
 */

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  /** Icon component rendered before the label (auto-mirrored if directional). */
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Stretch to fill parent. Default false. */
  fullWidth?: boolean;
  style?: ViewStyle;
};

export const Button: React.FC<Props> = ({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  style,
  ...rest
}) => {
  const sizeStyles = SIZE[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles.container,
        getVariantStyle(variant, pressed, isDisabled),
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      {({ pressed }) => (
        <View style={styles.inner}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={getLabelColor(variant, isDisabled)}
            />
          ) : (
            <>
              {leadingIcon && (
                <View style={styles.icon}>{leadingIcon}</View>
              )}
              <Text
                style={[
                  sizeStyles.label,
                  { color: getLabelColor(variant, isDisabled) },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {trailingIcon && (
                <View style={styles.icon}>{trailingIcon}</View>
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
};

// ---------- Variant styling ----------

function getVariantStyle(v: Variant, pressed: boolean, disabled: boolean): ViewStyle {
  if (disabled) {
    return v === 'ghost'
      ? { backgroundColor: 'transparent', borderColor: 'transparent' }
      : { backgroundColor: colors.surface.sunken, borderColor: 'transparent' };
  }
  switch (v) {
    case 'primary':
      return {
        backgroundColor: pressed ? colors.brand.primaryPressed : colors.brand.primary,
        borderColor: 'transparent',
      };
    case 'secondary':
      return {
        backgroundColor: pressed ? colors.surface.sunken : colors.surface.raised,
        borderColor: pressed ? colors.border.strong : colors.border.default,
        borderWidth: borderWidth.thin,
      };
    case 'destructive':
      return {
        backgroundColor: pressed ? '#700F18' : colors.text.danger,
        borderColor: 'transparent',
      };
    case 'ghost':
      return {
        backgroundColor: pressed ? colors.brand.primaryMuted : 'transparent',
        borderColor: 'transparent',
      };
  }
}

function getLabelColor(v: Variant, disabled: boolean): string {
  if (disabled) return colors.text.tertiary;
  switch (v) {
    case 'primary':     return colors.brand.onPrimary;
    case 'destructive': return colors.brand.onPrimary;
    case 'secondary':   return colors.text.primary;
    case 'ghost':       return colors.brand.primary;
  }
}

// ---------- Size variants ----------

const SIZE = {
  sm: {
    container: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
    } as ViewStyle,
    label: {
      fontFamily: textStyle.label.family,
      fontSize: textStyle.label.size,
      fontWeight: textStyle.label.weight,
    },
  },
  md: {
    container: {
      minHeight: layout.hitTarget.minimum,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    } as ViewStyle,
    label: {
      fontFamily: textStyle.labelLarge.family,
      fontSize: textStyle.labelLarge.size,
      fontWeight: textStyle.labelLarge.weight,
    },
  },
  lg: {
    container: {
      minHeight: layout.hitTarget.spacious,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    } as ViewStyle,
    label: {
      fontFamily: textStyle.labelLarge.family,
      fontSize: textStyle.labelLarge.size + 1,
      fontWeight: textStyle.labelLarge.weight,
    },
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: layout.size.iconMd,
    height: layout.size.iconMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
