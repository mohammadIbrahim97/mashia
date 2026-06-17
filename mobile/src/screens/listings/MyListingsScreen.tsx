import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Chip, ChipKind, Icon } from '@components/index';
import { ProfileStackParamList } from '@navigation/types';
import { Listing, listingsService } from '@services/listings.service';
import { useListings } from '@store/listings.store';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyListings'>;

function statusChipKind(status: string): ChipKind {
  if (status === 'active') return 'verified';
  if (status === 'flagged') return 'flagged';
  if (status === 'expired') return 'pending';
  return 'neutral';
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function MyListingsScreen({ navigation }: Props) {
  const myListings = useListings((s) => s.myListings);
  const myListingsLoading = useListings((s) => s.myListingsLoading);
  const loadMyListings = useListings((s) => s.loadMyListings);

  useEffect(() => {
    loadMyListings(true);
  }, []);

  const onRefresh = useCallback(() => {
    loadMyListings(true);
  }, [loadMyListings]);

  const onDelete = useCallback(
    (item: Listing) => {
      Alert.alert(
        'Delete listing',
        `Remove "${item.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await listingsService.remove(item.id);
                loadMyListings(true);
              } catch {
                Alert.alert('Error', 'Could not delete listing. Try again.');
              }
            },
          },
        ],
      );
    },
    [loadMyListings],
  );

  const renderItem = useCallback(({ item }: { item: Listing }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
    >
      {item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.imagePlaceholder]}>
          <Icon name="image" size={24} color={colors.muted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardBreed}>
            {item.breed.charAt(0).toUpperCase() + item.breed.slice(1)}
          </Text>
          <Chip kind={statusChipKind(item.status)}>{statusLabel(item.status)}</Chip>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.cardMeta}>
          <Icon name="package" size={12} color={colors.muted} />
          <Text style={styles.cardMetaText}>{item.quantity} head</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardMetaText}>
            {item.currency} {item.pricePerHead.toLocaleString()}/head
          </Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={styles.actionBtn}
          hitSlop={8}
          onPress={() =>
            navigation.navigate('CreateListing', { editId: item.id })
          }
        >
          <Icon name="pencil" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          hitSlop={8}
          onPress={() => onDelete(item)}
        >
          <Icon name="trash" size={18} color={colors.statusFlagged} />
        </Pressable>
      </View>
    </Pressable>
  ), [navigation, onDelete]);

  const renderEmpty = () => {
    if (myListingsLoading) return null;
    return (
      <View style={styles.empty}>
        <Icon name="package" size={40} color={colors.muted} />
        <Text style={styles.emptyTitle}>No listings yet</Text>
        <Text style={styles.emptySub}>
          Tap the + button to create your first listing.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="My Listings"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
        right={
          <Pressable
            onPress={() => navigation.navigate('CreateListing', undefined)}
            hitSlop={8}
          >
            <Icon name="plus" size={24} color={colors.mashia[600]} />
          </Pressable>
        }
      />

      {myListingsLoading && myListings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.mashia[600]} />
        </View>
      ) : (
        <FlatList
          data={myListings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={onRefresh}
          refreshing={myListingsLoading && myListings.length === 0}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { padding: spacing[4], gap: spacing[3] },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardPressed: { opacity: 0.85 },

  cardImage: {
    width: 88,
    height: 88,
    backgroundColor: colors.parchment,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardMetaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  cardDot: {
    color: colors.muted,
    fontSize: 12,
  },

  cardActions: {
    paddingRight: spacing[3],
    gap: spacing[3],
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
  },

  empty: {
    flex: 1,
    paddingTop: spacing[9],
    alignItems: 'center',
    gap: spacing[2],
  },
  emptyTitle: {
    ...type.h3,
    color: colors.ink,
    marginTop: spacing[3],
  },
  emptySub: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing[5],
  },
});
