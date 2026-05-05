import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { OrdersStackParamList } from '@navigation/types';
import { useAuth } from '@hooks/useAuth';
import { useOrders } from '@store/orders.store';
import { colors, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

const ORDER_STATUSES = [
  'pending',
  'accepted',
  'paid',
  'in_transit',
  'delivered',
  'completed',
];

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

export function OrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const user = useAuth((s) => s.user);
  const selected = useOrders((s) => s.selected);
  const detailLoading = useOrders((s) => s.detailLoading);
  const loadDetail = useOrders((s) => s.loadDetail);
  const updateStatus = useOrders((s) => s.updateStatus);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    loadDetail(orderId);
  }, [orderId]);

  const handleUpdateStatus = async (status: string) => {
    setBusy(true);
    try {
      await updateStatus(orderId, status);
    } finally {
      setBusy(false);
    }
  };

  if (detailLoading || !selected) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <AppBar
          title="Order Detail"
          left={
            <Pressable onPress={() => navigation.goBack()}>
              <Icon name="chevronLeft" size={22} />
            </Pressable>
          }
        />
        <View style={styles.loader}>
          <ActivityIndicator color={colors.mashia[600]} />
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusIndex = ORDER_STATUSES.indexOf(selected.status);
  const role = user?.role;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Order Detail"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Listing */}
        <View style={styles.section}>
          {selected.listing ? (
            <View style={styles.listingRow}>
              {selected.listing.images[0] ? (
                <Image
                  source={{ uri: selected.listing.images[0] }}
                  style={styles.listingImage}
                />
              ) : (
                <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
                  <Icon name="image" size={24} color={colors.muted} />
                </View>
              )}
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle}>{selected.listing.title}</Text>
                <Text style={styles.listingBreed}>{selected.listing.breed}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.listingRemoved}>Listing removed</Text>
          )}
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Overline>PARTIES</Overline>
          <View style={styles.partyRow}>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>Buyer</Text>
              <Text style={styles.partyName}>{selected.buyer.fullName}</Text>
              <Text style={styles.partySub}>{selected.buyer.city}, {selected.buyer.country}</Text>
            </View>
            <View style={styles.partySpacer} />
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>Seller</Text>
              <Text style={styles.partyName}>{selected.seller.fullName}</Text>
              <Text style={styles.partySub}>{selected.seller.city}, {selected.seller.country}</Text>
            </View>
          </View>
        </View>

        {/* Financials */}
        <View style={styles.section}>
          <Overline>ORDER SUMMARY</Overline>
          <View style={styles.table}>
            <Row label="Quantity" value={`${selected.quantity} head`} />
            <Row label="Unit price" value={`${selected.currency} ${selected.unitPrice.toLocaleString()}`} />
            <Row label="Commission" value={`${selected.currency} ${selected.commissionAmount.toLocaleString()} (${(selected.commissionRate * 100).toFixed(1)}%)`} />
            <Row label="Total" value={`${selected.currency} ${selected.totalPrice.toLocaleString()}`} bold />
          </View>
        </View>

        {/* Delivery */}
        <View style={styles.section}>
          <Overline>DELIVERY</Overline>
          <Text style={styles.addressText}>{selected.deliveryAddress}</Text>
          {selected.notes ? (
            <Text style={styles.notesText}>{selected.notes}</Text>
          ) : null}
        </View>

        {/* Payment */}
        {selected.payment ? (
          <View style={styles.section}>
            <Overline>PAYMENT</Overline>
            <View style={styles.table}>
              <Row label="Method" value={selected.payment.method.replace('_', ' ').toUpperCase()} />
              <Row label="Escrow status" value={selected.payment.escrowStatus} />
              <Row label="Amount" value={`${selected.payment.currency} ${selected.payment.amount.toLocaleString()}`} />
            </View>
          </View>
        ) : null}

        {/* Status timeline */}
        <View style={styles.section}>
          <Overline>STATUS TIMELINE</Overline>
          <View style={styles.timeline}>
            {ORDER_STATUSES.map((s, i) => {
              const done = i <= currentStatusIndex;
              return (
                <View key={s} style={styles.timelineRow}>
                  <Icon
                    name={done ? 'checkCircle' : 'clock'}
                    size={18}
                    color={done ? colors.mashia[600] : colors.hairline}
                  />
                  <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>
                    {statusLabel(s)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Order meta */}
        <View style={styles.section}>
          <Text style={styles.meta}>Order #{selected.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.meta}>Placed {formatDate(selected.createdAt)}</Text>
        </View>
      </ScrollView>

      {role === 'seller' && selected.status === 'pending' ? (
        <View style={styles.footer}>
          <Button
            kind="secondary"
            full
            loading={busy}
            onPress={() => handleUpdateStatus('cancelled')}
          >
            Reject
          </Button>
          <View style={{ height: spacing[3] }} />
          <Button
            kind="primary"
            full
            loading={busy}
            onPress={() => handleUpdateStatus('accepted')}
          >
            Accept Order
          </Button>
        </View>
      ) : role === 'buyer' && selected.status === 'accepted' ? (
        <View style={styles.footer}>
          <Button
            kind="primary"
            full
            onPress={() =>
              navigation.navigate('PaymentMethod', {
                orderId: selected.id,
                totalPrice: selected.totalPrice,
                currency: selected.currency,
              })
            }
          >
            Pay Now
          </Button>
        </View>
      ) : role === 'buyer' && selected.status === 'delivered' ? (
        <View style={styles.footer}>
          <Button
            kind="primary"
            icon="check"
            iconPosition="leading"
            full
            loading={busy}
            onPress={() => handleUpdateStatus('completed')}
          >
            Confirm Delivery
          </Button>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, bold && rowStyles.bold]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  label: { ...type.caption, color: colors.muted },
  value: { ...type.caption, color: colors.ink },
  bold: { fontWeight: '700', color: colors.ink },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: spacing[5], paddingBottom: spacing[6] },
  section: { marginBottom: spacing[5] },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  listingImage: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.parchment,
  },
  listingImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingInfo: { flex: 1 },
  listingTitle: { ...type.bodyMd, color: colors.ink, marginBottom: 2 },
  listingBreed: { ...type.caption, color: colors.muted },
  listingRemoved: { ...type.body, color: colors.muted, fontStyle: 'italic' },
  partyRow: { flexDirection: 'row', marginTop: spacing[3] },
  partyCol: { flex: 1 },
  partySpacer: { width: 1, backgroundColor: colors.hairline, marginHorizontal: spacing[3] },
  partyLabel: { ...type.caption, color: colors.muted },
  partyName: { ...type.bodyMd, color: colors.ink, marginTop: 2 },
  partySub: { ...type.caption, color: colors.muted },
  table: { marginTop: spacing[3] },
  addressText: { ...type.body, color: colors.ink, marginTop: spacing[3] },
  notesText: { ...type.caption, color: colors.muted, marginTop: spacing[2] },
  timeline: { marginTop: spacing[3], gap: spacing[3] },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  timelineLabel: { ...type.caption, color: colors.muted },
  timelineLabelDone: { color: colors.ink, fontWeight: '600' },
  meta: { ...type.caption, color: colors.muted },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.paper,
  },
});
