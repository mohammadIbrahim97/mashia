import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '@components/index';
import { HomeStackParamList } from '@navigation/types';
import { Listing } from '@services/listings.service';
import { useListings } from '@store/listings.store';
import { colors, fonts, radii, spacing, type } from '@theme/index';
import { FilterSheet } from './FilterSheet';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeFeed'>;

type SortOption = 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
];

// ⚡ Bolt: Memoized ListingCard to prevent unnecessary re-renders of list items
// when parent HomeScreen state (like searchText or feedParams) changes.
// Reduces re-renders by skipping reconciliation for items whose props haven't changed.
const ListingCard = React.memo(({ item, onPress }: { item: Listing; onPress: (id: string) => void }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(item.id)}
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
});

export function HomeScreen({ navigation }: Props) {
  const feed = useListings((s) => s.feed);
  const feedLoading = useListings((s) => s.feedLoading);
  const feedParams = useListings((s) => s.feedParams);
  const feedTotal = useListings((s) => s.feedTotal);
  const setFeedParams = useListings((s) => s.setFeedParams);
  const loadFeed = useListings((s) => s.loadFeed);

  const [searchText, setSearchText] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  useEffect(() => {
    loadFeed(true);
  }, []);

  const onRefresh = useCallback(() => {
    loadFeed(true);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (!feedLoading && feed.length < feedTotal) {
      loadFeed();
    }
  }, [feedLoading, feed.length, feedTotal, loadFeed]);

  const onSortPress = (sort: SortOption) => {
    const next = { ...feedParams, sort };
    setFeedParams(next);
    loadFeed(true);
  };

  // ⚡ Bolt: Stable callback to prevent breaking React.memo on ListingCard
  const onCardPress = useCallback(
    (id: string) => {
      navigation.navigate('ListingDetail', { listingId: id });
    },
    [navigation]
  );

  const renderCard = useCallback(({ item }: { item: Listing }) => (
    <ListingCard item={item} onPress={onCardPress} />
  ), [onCardPress]);

  const renderEmpty = () => {
    if (feedLoading) return null;
    return (
      <View style={styles.empty}>
        <Icon name="search" size={40} color={colors.muted} />
        <Text style={styles.emptyTitle}>No listings found</Text>
        <Text style={styles.emptySub}>Try adjusting your filters.</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!feedLoading || feed.length === 0) return null;
    return (
      <View style={styles.footerSpinner}>
        <ActivityIndicator color={colors.mashia[600]} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings…"
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            onSubmitEditing={() => {
              setFeedParams({ ...feedParams, page: 1 });
              loadFeed(true);
            }}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')}>
              <Icon name="close" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]}
          onPress={() => setFilterVisible(true)}
        >
          <Icon name="filter" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => {
          const active = feedParams.sort === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.sortChip, active && styles.sortChipActive]}
              onPress={() => onSortPress(opt.value)}
            >
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {feedLoading && feed.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.mashia[600]} />
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          onRefresh={onRefresh}
          refreshing={feedLoading && feed.length === 0}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
        />
      )}

      <FilterSheet
        visible={filterVisible}
        params={feedParams}
        onApply={(params) => {
          setFeedParams(params);
          loadFeed(true);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    height: 44,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnPressed: { opacity: 0.7 },

  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
  },
  sortChipActive: {
    backgroundColor: colors.mashia[600],
    borderColor: colors.mashia[600],
  },
  sortChipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  sortChipTextActive: { color: colors.paper },

  list: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },

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

  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSpinner: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },

  empty: {
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
  },
});
