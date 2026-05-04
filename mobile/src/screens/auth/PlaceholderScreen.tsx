import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@components/index';
import { useAuth } from '@hooks/useAuth';
import { colors, spacing, type } from '@theme/index';

/**
 * Placeholder screen used while real auth screens (Welcome, Sign in,
 * Sign up, Recover access) are landed in Phase B. Shipping this in
 * Phase A keeps the navigator wired and lets us flip into the
 * authenticated stack to inspect MainTabs.
 */
export function AuthPlaceholderScreen() {
  const signIn = useAuth((s) => s.signIn);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Text style={[type.h2, { color: colors.fg1 }]}>
        Auth flow lands in Phase B.
      </Text>
      <Text style={[type.body, { color: colors.fg2, marginTop: spacing[3] }]}>
        Tap below to enter the authenticated app for now.
      </Text>
      <View style={{ marginTop: spacing[6] }}>
        <Button
          kind="primary"
          icon="arrowRight"
          onPress={() =>
            signIn({
              id: 'dev-user',
              phone: '+966500000000',
              role: 'buyer',
              fullName: 'Dev User',
              country: 'SA',
              city: 'Riyadh',
            })
          }
        >
          Continue as dev user
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing[5],
    justifyContent: 'center',
  },
});
