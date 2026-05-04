import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '@screens/auth/WelcomeScreen';
import { SignInScreen } from '@screens/auth/SignInScreen';
import { SignUpScreen } from '@screens/auth/SignUpScreen';
import { RecoverAccessScreen } from '@screens/auth/RecoverAccessScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  /** Optional pre-filled phone + verified code from a SignIn → SignUp redirect. */
  SignUp: { phone?: string; code?: string } | undefined;
  RecoverAccess: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="RecoverAccess" component={RecoverAccessScreen} />
    </Stack.Navigator>
  );
}
