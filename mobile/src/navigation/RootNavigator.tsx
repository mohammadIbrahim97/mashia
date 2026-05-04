import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { useAuth } from '@hooks/useAuth';
import { colors } from '@theme/index';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const status = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (status === 'loading') {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.mashia[600]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'authenticated' ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
