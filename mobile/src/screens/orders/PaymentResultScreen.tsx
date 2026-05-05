import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Icon } from '@components/index';
import { OrdersStackParamList } from '@navigation/types';
import { colors, fonts, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<OrdersStackParamList, 'PaymentResult'>;

export function PaymentResultScreen({ navigation, route }: Props) {
  const { success, orderId } = route.params;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Icon
          name={success ? 'checkCircle' : 'alertCircle'}
          size={72}
          color={success ? colors.mashia[600] : colors.statusFlagged}
        />

        <Text style={styles.heading}>
          {success ? 'Payment Successful' : 'Payment Failed'}
        </Text>

        <Text style={styles.sub}>
          {success
            ? 'Your funds are held in escrow safely.'
            : 'Please try again or use a different payment method.'}
        </Text>
      </View>

      <View style={styles.footer}>
        {success ? (
          <Button
            kind="primary"
            full
            onPress={() =>
              navigation.navigate('OrderDetail', { orderId })
            }
          >
            View Order
          </Button>
        ) : (
          <Button kind="primary" full onPress={() => navigation.goBack()}>
            Retry
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '400',
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: spacing[5],
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  sub: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
