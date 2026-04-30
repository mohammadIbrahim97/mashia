import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius, borderWidth } from '../theme/spacing';
import { textStyle } from '../theme/typography';

/**
 * StatusBadge
 * ===========
 * The single component every transactional state in Mashia goes through.
 * Used for escrow, KYC, order lifecycle, and animal health.
 *
 * Anatomy:
 *   [dot] [label]   — pill shape, colored fill, optional emphasized border
 *
 * Why a single component:
 *   - Visual consistency across ten different state types is the trust story.
 *   - Centralizes the dot/strong-color logic so an "escrow.held" badge looks
 *     identical whether it's on a card, in a table, or in a notification.
 */

type StateKind =
  | { kind: 'escrow';  value: 'held' | 'released' | 'refunded' | 'disputed' }
  | { kind: 'kyc';     value: 'pending' | 'verified' | 'rejected' }
  | { kind: 'order';   value: 'placed' | 'paid' | 'shipped' | 'delivered' | 'cancelled' }
  | { kind: 'health';  value: 'healthy' | 'quarantine' | 'flagged' }
  | { kind: 'state';   value: 'success' | 'info' | 'warning' | 'danger' | 'neutral' };

type Props = StateKind & {
  /** Localized label. Component does not translate — it composes. */
  label: string;
  /** Show the leading dot. Default true. */
  withDot?: boolean;
  /** Add an emphasized border (used in tables for higher contrast). */
  emphasized?: boolean;
  style?: ViewStyle;
};

export const StatusBadge: React.FC<Props> = ({
  kind, value, label, withDot = true, emphasized = false, style,
}) => {
  // Lookup colors from the appropriate token group
  const tokens = (colors as any)[kind][value] as {
    bg: string; fg: string; strong: string;
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tokens.bg,
          borderColor: emphasized ? tokens.strong : 'transparent',
          borderWidth: emphasized ? borderWidth.thin : 0,
        },
        style,
      ]}
    >
      {withDot && (
        <View style={[styles.dot, { backgroundColor: tokens.strong }]} />
      )}
      <Text
        style={[
          styles.label,
          { color: tokens.fg },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing['3xs'],
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing['2xs'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  label: {
    fontFamily: textStyle.labelSmall.family,
    fontSize: textStyle.labelSmall.size,
    fontWeight: textStyle.labelSmall.weight,
    lineHeight: textStyle.labelSmall.size * textStyle.labelSmall.lineHeight,
  },
});
