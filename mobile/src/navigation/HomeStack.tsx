import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@screens/listings/HomeScreen';
import { ListingDetailScreen } from '@screens/listings/ListingDetailScreen';
import { PlaceOrderScreen } from '@screens/orders/PlaceOrderScreen';
import { OrderConfirmationScreen } from '@screens/orders/OrderConfirmationScreen';
import { PaymentMethodScreen } from '@screens/orders/PaymentMethodScreen';
import { PaymentResultScreen } from '@screens/orders/PaymentResultScreen';

export type HomeStackParamList = {
  HomeFeed: undefined;
  ListingDetail: { listingId: string };
  PlaceOrder: { listingId: string; pricePerHead: number; currency: string };
  OrderConfirmation: { orderId: string };
  PaymentMethod: { orderId: string; totalPrice: number; currency: string };
  PaymentResult: { success: boolean; orderId: string };
};

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
