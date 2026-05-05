import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyOrdersScreen } from '@screens/orders/MyOrdersScreen';
import { OrderDetailScreen } from '@screens/orders/OrderDetailScreen';
import { PaymentMethodScreen } from '@screens/orders/PaymentMethodScreen';
import { PaymentResultScreen } from '@screens/orders/PaymentResultScreen';

export type OrdersStackParamList = {
  MyOrders: undefined;
  OrderDetail: { orderId: string };
  PaymentMethod: { orderId: string; totalPrice: number; currency: string };
  PaymentResult: { success: boolean; orderId: string };
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="PaymentResult" component={PaymentResultScreen} />
    </Stack.Navigator>
  );
}
