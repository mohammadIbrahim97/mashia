import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppBar,
  Button,
  COUNTRIES,
  CountryOption,
  Icon,
  OtpInput,
  Overline,
  PhoneInput,
  StepIndicator,
} from '@components/index';
import { AuthStackParamList } from '@navigation/types';
import { errorMessage } from '@services/api';
import { authService } from '@services/auth.service';
import { useAuth } from '@hooks/useAuth';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
type Step = 'phone' | 'otp';

export function SignInScreen({ navigation }: Props) {
  const setUser = useAuth((s) => s.setUser);
  const [step, setStep] = useState<Step>('phone');
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = `${country.code}${phone.replace(/\D/g, '')}`;

  const onSendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await authService.sendOtp(e164);
      setStep('otp');
    } catch (err) {
      setError(errorMessage(err, 'Could not send code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      const { verified, userExists } = await authService.verifyOtp(e164, otp);
      if (!verified) {
        setError('That code is wrong or expired.');
        return;
      }
      if (!userExists) {
        navigation.replace('SignUp', { phone: e164, code: otp });
        return;
      }
      const env = await authService.login(e164, otp);
      setUser(env.user);
    } catch (err) {
      setError(errorMessage(err, 'Could not verify code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        left={
          <Pressable
            onPress={() =>
              step === 'otp' ? setStep('phone') : navigation.goBack()
            }
          >
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
      />

      <StepIndicator total={2} current={step === 'otp' ? 2 : 1} />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Overline bullet>
          ● {step === 'phone' ? '01 · YOUR NUMBER' : '02 · CONFIRM'}
        </Overline>
        <Text style={styles.headline}>
          {step === 'phone' ? (
            <>
              Welcome <Text style={styles.italic}>back</Text>.
            </>
          ) : (
            <>
              Six digits{'\n'}
              <Text style={styles.italic}>to verify</Text>.
            </>
          )}
        </Text>
        <Text style={styles.sub}>
          {step === 'phone'
            ? 'Sign in with your registered mobile number. We send a one-time code by SMS.'
            : `We sent a code to ${country.code} ${phone}.`}
        </Text>

        <View style={styles.field}>
          {step === 'phone' ? (
            <>
              <Overline>MOBILE NUMBER</Overline>
              <View style={{ marginTop: 10 }}>
                <PhoneInput
                  country={country}
                  onCountryChange={setCountry}
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
              </View>
              <View style={styles.privacy}>
                <Icon name="shield" size={14} color={colors.mashia[600]} />
                <Text style={styles.privacyText}>
                  Your number stays private. We never share it with sellers or
                  buyers.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Overline>6-DIGIT CODE</Overline>
              <View style={{ marginTop: 10 }}>
                <OtpInput value={otp} onChangeText={setOtp} />
              </View>
              <Text style={styles.resend}>
                Didn&rsquo;t get it?{' '}
                <Text style={styles.resendLink} onPress={onSendCode}>
                  Resend code
                </Text>
              </Text>
            </>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          kind="primary"
          icon="arrowRight"
          loading={busy}
          full
          disabled={
            step === 'phone' ? phone.length < 6 : otp.length !== 6
          }
          onPress={step === 'phone' ? onSendCode : onVerify}
        >
          {step === 'phone' ? 'Send code' : 'Verify and continue'}
        </Button>
        <Text style={styles.footerNote}>
          {step === 'phone' ? (
            <>
              Don&rsquo;t have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => navigation.replace('SignUp', {})}
              >
                Create one
              </Text>
            </>
          ) : (
            <>
              Can&rsquo;t access this number?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => navigation.navigate('RecoverAccess')}
              >
                Recover access
              </Text>
            </>
          )}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5], paddingTop: spacing[6] },
  headline: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '400',
    color: colors.fg1,
    letterSpacing: -0.9,
    lineHeight: 38,
    marginTop: 14,
  },
  italic: {
    fontFamily: fonts.displayItalic,
    fontStyle: 'italic',
    color: colors.mashia[700],
  },
  sub: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing[3],
    maxWidth: 320,
  },
  field: { marginTop: spacing[6] },
  privacy: {
    marginTop: spacing[3],
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: colors.mashia[50],
    borderRadius: radii.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.mashia[700],
    fontFamily: fonts.body,
    lineHeight: 18,
  },
  resend: {
    marginTop: spacing[3],
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.body,
  },
  resendLink: { color: colors.mashia[700], fontWeight: '600' },
  error: {
    marginTop: spacing[4],
    color: '#B23B3B',
    fontFamily: fonts.body,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
  },
  footerNote: {
    marginTop: spacing[3],
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.body,
  },
  footerLink: { color: colors.mashia[700], fontWeight: '600' },
});
