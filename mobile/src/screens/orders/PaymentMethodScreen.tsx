import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppBar, Button, Icon, Overline } from '@components/index';
import { OrdersStackParamList } from '@navigation/OrdersStack';
import { paymentsService } from '@services/payments.service';
import { errorMessage } from '@services/api';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentMethod'>;

type PaymentMethod = 'stc_pay' | 'mada' | 'bank_transfer';

const METHODS: { id: PaymentMethod; label: string; sub: string }[] = [
  { id: 'stc_pay', label: 'STC Pay', sub: 'Pay via STC Pay wallet' },
  { id: 'mada', label: 'Mada', sub: 'Debit card payment' },
  { id: 'bank_transfer', label: 'Bank Transfer', sub: 'Direct bank transfer' },
];

export function PaymentMethodScreen({ navigation, route }: Props) {
  const { orderId, totalPrice, currency } = route.params;
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      await paymentsService.initiate({ orderId, method: selected });
      navigation.navigate('PaymentResult', { success: true, orderId });
    } catch (err) {
      setError(errorMessage(err, 'Payment could not be initiated. Please try again.'));
      navigation.navigate('PaymentResult', { success: false, orderId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        title="Payment"
        left={
          <Pressable onPress={() => navigation.goBack()}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.amountBox}>
          <Overline>AMOUNT DUE</Overline>
          <Text style={styles.amount}>
            {currency} {totalPrice.toLocaleString()}
          </Text>
        </View>

        <View style={styles.escrowBanner}>
          <Icon name="shield" size={18} color={colors.mashia[700]} />
          <Text style={styles.escrowText}>
            Your payment will be held safely until delivery is confirmed
          </Text>
        </View>

        <Overline style={{ marginBottom: spacing[3] }}>SELECT METHOD</Overline>
        {METHODS.map((m) => {
          const isSelected = selected === m.id;
          return (
            <Pressable
              key={m.id}
              style={[styles.methodCard, isSelected && styles.methodCardSelected]}
              onPress={() => setSelected(m.id)}
            >
              <View style={styles.methodInfo}>
                <Text style={styles.methodLabel}>{m.label}</Text>
                <Text style={styles.methodSub}>{m.sub}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  isSelected && styles.radioSelected,
                ]}
              >
                {isSelected ? (
                  <View style={styles.radioDot} />
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          kind="primary"
          full
          loading={busy}
          disabled={!selected}
          onPress={onConfirm}
        >
          Confirm Payment
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5] },
  amountBox: { marginBottom: spacing[5] },
  amount: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '400',
    color: colors.ink,
    letterSpacing: -0.9,
    marginTop: spacing[2],
  },
  escrowBanner: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.mashia[50],
    borderRadius: radii.md,
    padding: spacing[4],
    marginBottom: spacing[5],
    alignItems: 'flex-start',
  },
  escrowText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.mashia[700],
    lineHeight: 19,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    backgroundColor: colors.parchment,
  },
  methodCardSelected: {
    borderColor: colors.mashia[600],
    backgroundColor: colors.mashia[50],
  },
  methodInfo: { flex: 1 },
  methodLabel: { ...type.bodyMd, color: colors.ink, fontWeight: '600' },
  methodSub: { ...type.caption, color: colors.muted, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: colors.mashia[600] },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mashia[600],
  },
  error: {
    color: '#B23B3B',
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing[3],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
