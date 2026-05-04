import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthPlaceholderScreen } from '@screens/auth/PlaceholderScreen';

export type AuthStackParamList = {
  Welcome: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Phase A renders a single placeholder screen. Phase B replaces it with
 * Welcome → SignIn → SignUp → RecoverAccess.
 */
export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={AuthPlaceholderScreen} />
    </Stack.Navigator>
  );
}
