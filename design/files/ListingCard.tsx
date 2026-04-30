import React from 'react';
import {
  View, Text, Image, Pressable,
  StyleSheet, ImageSourcePropType, ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing, radius, borderWidth, shadow, layout } from '../theme/spacing';
import { textStyle } from '../theme/typography';
import { StatusBadge } from './StatusBadge';

/**
 * ListingCard
 * ===========
 * The fundamental marketplace surface. eBay-style: photo-forward, price-loud,
 * seller-trust visible, location grounded.
 *
 * Why this composition:
 *   - Photo aspect is 4:3 — livestock photography is wide, not square. Forces
 *     sellers to upload landscape shots that show the animal in context.
 *   - Price uses display font (Tajawal Bold) — the eBay move where price gets
 *     its OWN typographic treatment, not just a heavier weight of body font.
 *   - Verified-seller badge sits next to seller name, not floating in corner —
 *     trust is contextual, not decorative.
 *   - Location with country flag emoji — Mashia is cross-border by default;
 *     "where is this animal" is part of the listing identity, not a filter facet.
 */

type Props = {
  image: ImageSourcePropType;
  title: string;
  /** Pre-formatted price string, e.g. "1,250 AED" or "١٬٢٥٠ د.إ". */
  price: string;
  /** Optional original/struck-through price for sale items. */
  originalPrice?: string;
  sellerName: string;
  sellerVerified?: boolean;
  /** Localized location string, e.g. "Aleppo, Syria" or "حلب، سوريا". */
  location: string;
  countryFlag?: string;
  /** Optional health badge from the StatusBadge.health states. */
  healthStatus?: 'healthy' | 'quarantine' | 'flagged';
  healthLabel?: string;
  /** Optional listing-level highlight ("Premium", "Featured") */
  premium?: boolean;
  premiumLabel?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export const ListingCard: React.FC<Props> = ({
  image, title, price, originalPrice,
  sellerName, sellerVerified,
  location, countryFlag,
  healthStatus, healthLabel,
  premium, premiumLabel,
  onPress, style,
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      {/* Photo */}
      <View style={styles.imageWrapper}>
        <Image source={image} style={styles.image} />

        {premium && (
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumLabel}>{premiumLabel ?? 'Premium'}</Text>
          </View>
        )}

        {healthStatus && healthLabel && (
          <View style={styles.healthOverlay}>
            <StatusBadge kind="health" value={healthStatus} label={healthLabel} />
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Price block — display font, brand-red */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          {originalPrice && (
            <Text style={styles.originalPrice}>{originalPrice}</Text>
          )}
        </View>

        {/* Seller line */}
        <View style={styles.sellerRow}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {sellerName}
          </Text>
          {sellerVerified && (
            <View style={styles.verifiedTick}>
              {/* Inline SVG-style checkmark via Text — RN-friendly */}
              <Text style={styles.verifiedTickGlyph}>✓</Text>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          {countryFlag && <Text style={styles.flag}>{countryFlag}</Text>}
          <Text style={styles.location} numberOfLines={1}>
            {location}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.raised,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    ...shadow.native.sm,
  },
  cardPressed: {
    borderColor: colors.border.strong,
    transform: [{ scale: 0.99 }],
  },

  imageWrapper: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.surface.sunken,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  premiumBanner: {
    position: 'absolute',
    top: spacing.sm,
    // intentional: this is a visual overlay; in RTL it auto-mirrors via
    // start/end at the parent layout level. Within the image, top-start is fine.
    insetInlineStart: spacing.sm,
    backgroundColor: colors.brand.secondary,
    paddingVertical: spacing['3xs'],
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
  } as any,
  premiumLabel: {
    fontFamily: textStyle.labelSmall.family,
    fontSize: textStyle.labelSmall.size,
    fontWeight: textStyle.labelSmall.weight,
    color: colors.brand.onSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  healthOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    insetInlineStart: spacing.sm,
  } as any,

  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: textStyle.headlineSmall.family,
    fontSize: textStyle.headlineSmall.size,
    fontWeight: textStyle.headlineSmall.weight,
    lineHeight: textStyle.headlineSmall.size * textStyle.headlineSmall.lineHeight,
    color: colors.text.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  price: {
    fontFamily: textStyle.priceLarge.family,
    fontSize: textStyle.priceLarge.size,
    fontWeight: textStyle.priceLarge.weight,
    color: colors.text.price,
  },
  originalPrice: {
    fontFamily: textStyle.bodySmall.family,
    fontSize: textStyle.bodySmall.size,
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
    marginTop: spacing['2xs'],
  },
  sellerName: {
    fontFamily: textStyle.bodySmall.family,
    fontSize: textStyle.bodySmall.size,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  verifiedTick: {
    width: 16, height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.kyc.verified.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTickGlyph: {
    color: colors.surface.raised,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
  },
  flag: {
    fontSize: 14,
  },
  location: {
    fontFamily: textStyle.caption.family,
    fontSize: textStyle.caption.size,
    color: colors.text.tertiary,
    flexShrink: 1,
  },
});
