import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@screens/listings/HomeScreen';
import { ListingDetailScreen } from '@screens/listings/ListingDetailScreen';
import { PlaceOrderScreen } from '@screens/orders/PlaceOrderScreen';
import { OrderConfirmationScreen } from '@screens/orders/OrderConfirmationScreen';
import { PaymentMethodScreen } from '@screens/orders/PaymentMethodScreen';
import { PaymentResultScreen } from '@screens/orders/PaymentResultScreen';
import { HomeStackParamList } from './types';

export type { HomeStackParamList };

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeFeed" component={HomeScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="PlaceOrder" component={PlaceOrderScreen} />
      <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="PaymentResult" component={PaymentResultScreen} />
    </Stack.Navigator>
  );
}
