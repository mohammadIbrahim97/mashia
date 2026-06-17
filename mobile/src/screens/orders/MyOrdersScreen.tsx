import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Chip, ChipKind } from '@components/index';
import { OrdersStackParamList } from '@navigation/types';
import { Order } from '@services/orders.service';
import { useOrders } from '@store/orders.store';
import { colors, fonts, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<OrdersStackParamList, 'MyOrders'>;

function statusChipKind(status: string): ChipKind {
  switch (status) {
    case 'accepted':
    case 'delivered':
    case 'completed':
      return 'verified';
    case 'paid':
    case 'in_transit':
      return 'info';
    case 'disputed':
      return 'flagged';
    case 'cancelled':
      return 'neutral';
    default:
      return 'pending';
  }
}

function statusLabel(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function MyOrdersScreen({ navigation }: Props) {
  const orders = useOrders((s) => s.orders);
  const loading = useOrders((s) => s.loading);
  const loadOrders = useOrders((s) => s.loadOrders);

  React.useEffect(() => {
    loadOrders(true);
  }, []);

  const onRefresh = useCallback(() => {
    loadOrders(true);
  }, [loadOrders]);

  const renderItem = useCallback(({ item }: { item: Order }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
        <Chip kind={statusChipKind(item.status)}>{statusLabel(item.status)}</Chip>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.qty}>
          {item.quantity} head ·{' '}
          <Text style={styles.price}>
            {item.currency} {item.totalPrice.toLocaleString()}
          </Text>
        </Text>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </Pressable>
  ), [navigation]);

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySub}>Orders you place or receive will appear here.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar title="My Orders" />
      {loading && orders.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.mashia[600]} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={ListEmpty}
          refreshing={loading}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing[5], flexGrow: 1 },
  separator: { height: spacing[3] },
  card: {
    backgroundColor: colors.parchment,
    borderRadius: 8,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  orderId: {
    ...type.mono,
    color: colors.ink,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qty: {
    ...type.caption,
    color: colors.muted,
  },
  price: {
    color: colors.ink,
    fontWeight: '600',
  },
  date: {
    ...type.caption,
    color: colors.muted,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing[2],
  },
  emptySub: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
  },
});
