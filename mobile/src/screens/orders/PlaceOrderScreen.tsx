import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { HomeStackParamList } from '@navigation/types';
import { ordersService } from '@services/orders.service';
import { errorMessage } from '@services/api';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<HomeStackParamList, 'PlaceOrder'>;

export function PlaceOrderScreen({ navigation, route }: Props) {
  const { listingId, pricePerHead, currency } = route.params;

  const [quantity, setQuantity] = useState('1');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = parseInt(quantity, 10) || 0;
  const total = qty * pricePerHead;
  const canSubmit = qty >= 1 && deliveryAddress.trim().length > 0;

  const onPlaceOrder = async () => {
    setError(null);
    setBusy(true);
    try {
      const order = await ordersService.create({
        listingId,
        quantity: qty,
        unitPrice: pricePerHead,
        currency,
        deliveryAddress: deliveryAddress.trim(),
        notes: notes.trim() || undefined,
      });
      navigation.navigate('OrderConfirmation', { orderId: order.id });
    } catch (err) {
      setError(errorMessage(err, 'Could not place order. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Place Order"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Overline>QUANTITY (HEAD)</Overline>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={styles.field}>
          <Overline>UNIT PRICE</Overline>
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>
              {currency} {pricePerHead.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Overline>DELIVERY ADDRESS</Overline>
          <TextInput
            style={styles.input}
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            placeholder="Street, city, region"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.field}>
          <Overline>NOTES (OPTIONAL)</Overline>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special instructions…"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Text style={styles.totalValue}>
            {currency} {total > 0 ? total.toLocaleString() : '—'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          kind="primary"
          icon="shoppingBag"
          iconPosition="leading"
          full
          loading={busy}
          disabled={!canSubmit}
          onPress={onPlaceOrder}
        >
          Place Order
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5] },
  field: { marginBottom: spacing[5] },
  input: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.parchment,
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  readOnly: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.parchment,
  },
  readOnlyText: { ...type.bodyMd, color: colors.muted },
  totalBox: {
    marginTop: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.mashia[50],
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { ...type.bodyMd, color: colors.mashia[700] },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.mashia[700],
    letterSpacing: -0.4,
  },
  error: {
    marginBottom: spacing[3],
    color: '#B23B3B',
    fontFamily: fonts.body,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
