import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar, Button, Chip, Icon } from '@components/index';
import { errorMessage } from '@services/api';
import { messagingService } from '@services/messaging.service';
import { useListings } from '@store/listings.store';
import { colors, fonts, radii, spacing, type } from '@theme/index';

const { width: SCREEN_W } = Dimensions.get('window');

type Props = {
  navigation: any;
  route: { params: { listingId: string } };
};

function healthChipKind(status: string): 'verified' | 'pending' | 'neutral' {
  if (status === 'certified') return 'verified';
  if (status === 'pending') return 'pending';
  return 'neutral';
}

function healthLabel(status: string): string {
  if (status === 'certified') return 'Certified';
  if (status === 'pending') return 'Pending';
  return 'Unchecked';
}

function kycChipKind(status: string): 'verified' | 'pending' | 'neutral' {
  if (status === 'verified') return 'verified';
  if (status === 'pending') return 'pending';
  return 'neutral';
}

export function ListingDetailScreen({ navigation, route }: Props) {
  const { listingId } = route.params;

  const selected = useListings((s) => s.selected);
  const detailLoading = useListings((s) => s.detailLoading);
  const loadDetail = useListings((s) => s.loadDetail);

  const [msgBusy, setMsgBusy] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadDetail(listingId);
  }, [listingId]);

  const onMessageSeller = useCallback(async () => {
    if (!selected) return;
    setMsgBusy(true);
    try {
      const convo = await messagingService.createOrGetConversation(
        selected.id,
        selected.seller.id,
      );
      navigation.navigate('ChatTab', {
        screen: 'Chat',
        params: { conversationId: convo.id, title: selected.seller.fullName },
      });
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'Could not open conversation.'));
    } finally {
      setMsgBusy(false);
    }
  }, [selected, navigation]);

  const onPlaceOrder = useCallback(() => {
    if (!selected) return;
    navigation.navigate('PlaceOrder', {
      listingId: selected.id,
      pricePerHead: selected.pricePerHead,
      currency: selected.currency,
    });
  }, [selected, navigation]);

  if (detailLoading || (!selected && !detailLoading)) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <AppBar
          left={
            <Pressable onPress={() => navigation.goBack()}>
              <Icon name="chevronLeft" size={22} />
            </Pressable>
          }
        />
        <View style={styles.center}>
          {detailLoading ? (
            <ActivityIndicator size="large" color={colors.mashia[600]} />
          ) : (
            <>
              <Icon name="alertCircle" size={36} color={colors.muted} />
              <Text style={styles.errorText}>Could not load listing.</Text>
              <Pressable onPress={() => loadDetail(listingId)} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const listing = selected!;
  const images = listing.images;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
        title={listing.title}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {images.length > 0 ? (
          <View>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setImageIndex(idx);
              }}
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.carouselImage} />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === imageIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.carouselImage, styles.imagePlaceholder]}>
            <Icon name="image" size={48} color={colors.muted} />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.breed}>
                {listing.breed.charAt(0).toUpperCase() + listing.breed.slice(1)}
              </Text>
              <Text style={styles.title}>{listing.title}</Text>
            </View>
            <Chip kind={healthChipKind(listing.healthStatus)}>
              {healthLabel(listing.healthStatus)}
            </Chip>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {listing.currency} {listing.pricePerHead.toLocaleString()}
            </Text>
            <Text style={styles.priceSub}>/head</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Icon name="package" size={16} color={colors.muted} />
              <Text style={styles.statLabel}>Quantity</Text>
              <Text style={styles.statValue}>{listing.quantity} head</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="clock" size={16} color={colors.muted} />
              <Text style={styles.statLabel}>Age</Text>
              <Text style={styles.statValue}>{listing.ageMonths} mo</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="truck" size={16} color={colors.muted} />
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>{listing.weightKg} kg</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="home" size={16} color={colors.muted} />
              <Text style={styles.statLabel}>Origin</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {listing.originCity}
              </Text>
            </View>
          </View>

          <View style={styles.originRow}>
            <Icon name="truck" size={14} color={colors.muted} />
            <Text style={styles.originText}>
              {listing.originCity}, {listing.originCountry}
            </Text>
          </View>

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          <View style={styles.sellerCard}>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>
                  {listing.seller.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName}>{listing.seller.fullName}</Text>
                <Text style={styles.sellerLocation}>
                  {listing.seller.city}, {listing.seller.country}
                </Text>
              </View>
              {listing.seller.kycStatus === 'verified' ? (
                <Chip kind="verified">Verified</Chip>
              ) : (
                <Chip kind={kycChipKind(listing.seller.kycStatus)}>
                  {listing.seller.kycStatus.charAt(0).toUpperCase() +
                    listing.seller.kycStatus.slice(1)}
                </Chip>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Button
          kind="secondary"
          icon="message"
          iconPosition="leading"
          loading={msgBusy}
          onPress={onMessageSeller}
          style={{ flex: 1 }}
        >
          Message Seller
        </Button>
        <Button
          kind="primary"
          icon="shoppingBag"
          iconPosition="leading"
          onPress={onPlaceOrder}
          style={{ flex: 1 }}
        >
          Place Order
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  errorText: { ...type.body, color: colors.muted },
  retryBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  retryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },

  carouselImage: {
    width: SCREEN_W,
    height: SCREEN_W * 0.65,
    backgroundColor: colors.parchment,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.hairline,
  },
  dotActive: { backgroundColor: colors.mashia[600] },

  content: { padding: spacing[5], gap: spacing[4] },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  breed: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: colors.mashia[600],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    ...type.h3,
    color: colors.ink,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  priceSub: {
    ...type.body,
    color: colors.muted,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  stat: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    padding: spacing[3],
    gap: 4,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },

  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  originText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },

  section: { gap: spacing[2] },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  description: {
    ...type.body,
    color: colors.ink,
  },

  sellerCard: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    padding: spacing[4],
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mashia[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.mashia[700],
  },
  sellerName: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  sellerLocation: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },

  actionBar: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.paper,
  },
});
