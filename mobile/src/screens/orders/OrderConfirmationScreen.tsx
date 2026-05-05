import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Icon } from '@components/index';
import { HomeStackParamList } from '@navigation/HomeStack';
import { ordersService, OrderDetail } from '@services/orders.service';
import { colors, fonts, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<HomeStackParamList, 'OrderConfirmation'>;

export function OrderConfirmationScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersService
      .getById(orderId)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.mashia[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Icon name="checkCircle" size={64} color={colors.mashia[600]} />
        </View>

        <Text style={styles.heading}>Order Placed!</Text>
        <Text style={styles.sub}>
          Your order has been submitted. The seller will review it shortly.
        </Text>

        {order ? (
          <View style={styles.summaryBox}>
            <SummaryRow
              label="Total"
              value={`${order.currency} ${order.totalPrice.toLocaleString()}`}
            />
            <SummaryRow
              label="Commission"
              value={`${order.currency} ${order.commissionAmount.toLocaleString()}`}
            />
            <SummaryRow label="Delivery to" value={order.deliveryAddress} />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {order ? (
          <Button
            kind="primary"
            full
            onPress={() =>
              navigation.navigate('PaymentMethod', {
                orderId: order.id,
                totalPrice: order.totalPrice,
                currency: order.currency,
              })
            }
          >
            Pay Now
          </Button>
        ) : null}
        <View style={{ height: spacing[3] }} />
        <Button
          kind="secondary"
          full
          onPress={() => navigation.getParent()?.navigate('OrdersTab')}
        >
          View Orders
        </Button>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={summaryStyles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing[3],
  },
  label: { ...type.caption, color: colors.muted, flex: 1 },
  value: { ...type.caption, color: colors.ink, fontWeight: '600', flex: 2, textAlign: 'right' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: {
    flex: 1,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[8],
    alignItems: 'center',
  },
  iconWrap: { marginBottom: spacing[5] },
  heading: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '400',
    color: colors.ink,
    letterSpacing: -0.9,
    marginBottom: spacing[3],
  },
  sub: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing[6],
    maxWidth: 300,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: colors.parchment,
    borderRadius: 8,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
