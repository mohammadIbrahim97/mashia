import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@components/index';
import { Listing } from '@services/listings.service';
import { colors, fonts, radii, spacing } from '@theme/index';

type Props = {
  item: Listing;
  onPress: () => void;
};

export function ListingCard({ item, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.imagePlaceholder]}>
          <Icon name="image" size={28} color={colors.muted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardBreed} numberOfLines={1}>
          {item.breed.charAt(0).toUpperCase() + item.breed.slice(1)}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.cardRow}>
          <Icon name="package" size={13} color={colors.muted} />
          <Text style={styles.cardMeta}>{item.quantity} head</Text>
          <Text style={styles.cardDot}>·</Text>
          <Icon name="truck" size={13} color={colors.muted} />
          <Text style={styles.cardMeta}>
            {item.originCity}, {item.originCountry}
          </Text>
        </View>
        <Text style={styles.cardPrice}>
          {item.currency} {item.pricePerHead.toLocaleString()}
          <Text style={styles.cardPriceSub}>/head</Text>
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing[3],
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.85 },
  cardImage: {
    width: 96,
    height: 96,
    backgroundColor: colors.parchment,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    padding: spacing[3],
    justifyContent: 'space-between',
  },
  cardBreed: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: colors.mashia[600],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  cardDot: {
    color: colors.muted,
    fontSize: 12,
  },
  cardPrice: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  cardPriceSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '400',
    color: colors.muted,
  },
});
