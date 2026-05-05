import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Overline } from '@components/index';
import { AuthStackParamList } from '@navigation/types';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Overline color={colors.qasiounGold} bullet>
          MASHIA · v1.0
        </Overline>

        <Text style={styles.headline}>
          {'A green\n'}
          <Text style={styles.headlineItalic}>thread</Text>
          {'\nbetween\nmarkets.'}
        </Text>

        <Text style={styles.tagline}>
          Verified livestock trade across the Gulf and Levant. Escrow on every
          order. Halal certificates baked in.
        </Text>
      </View>

      <View style={styles.trust}>
        {[
          ['KYC', 'verified'],
          ['Escrow', 'on every order'],
          ['Halal', 'certified'],
        ].map(([k, v]) => (
          <View key={k}>
            <Text style={styles.trustHeading}>{k}</Text>
            <Text style={styles.trustSub}>{v.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          kind="primary"
          icon="arrowRight"
          onPress={() => navigation.navigate('SignUp')}
          full
        >
          Create account
        </Button>
        <Button
          kind="dark"
          onPress={() => navigation.navigate('SignIn')}
          full
        >
          I already have an account
        </Button>
        <Text style={styles.legal}>
          By continuing you agree to Mashia&rsquo;s{' '}
          <Text style={styles.legalLink}>Terms</Text> &amp;{' '}
          <Text style={styles.legalLink}>Privacy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.basaltBlack,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[7],
    paddingBottom: spacing[6],
  },
  top: { flex: 1 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 56,
    fontWeight: '300',
    color: colors.paper,
    letterSpacing: -2,
    marginTop: spacing[5],
  },
  headlineItalic: {
    fontFamily: fonts.displayItalic,
    fontStyle: 'italic',
    fontWeight: '400',
    color: colors.qasiounGold,
  },
  tagline: {
    ...type.body,
    color: colors.palmyraSand,
    marginTop: spacing[5],
    maxWidth: 320,
  },
  trust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: spacing[5],
  },
  trustHeading: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '500',
    color: colors.paper,
  },
  trustSub: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    color: colors.palmyraSand,
    marginTop: 2,
  },
  actions: {
    gap: spacing[3],
  },
  legal: {
    marginTop: spacing[2],
    textAlign: 'center',
    fontSize: 11,
    color: colors.palmyraSand,
    fontFamily: fonts.body,
  },
  legalLink: { textDecorationLine: 'underline' },
});
