import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { AuthStackParamList } from '@navigation/AuthStack';
import { errorMessage } from '@services/api';
import {
  authService,
  PreferredLanguage,
  Role,
} from '@services/auth.service';
import { useAuth } from '@hooks/useAuth';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
type Step = 1 | 2 | 3;
type SignUpRole = Exclude<Role, 'admin'>;

const ROLE_OPTIONS: { id: SignUpRole; t: string; d: string }[] = [
  {
    id: 'buyer',
    t: 'Buyer',
    d: 'Browse listings, place orders into escrow, receive deliveries.',
  },
  {
    id: 'seller',
    t: 'Seller',
    d: 'List your livestock, negotiate, deliver. Vet certificates required.',
  },
  {
    id: 'broker',
    t: 'Broker',
    d: 'Connect buyers and sellers. Earn on verified deals.',
  },
];

const REGIONS = [
  { city: 'Riyadh', country: 'SA' },
  { city: 'Damascus', country: 'SY' },
  { city: 'Dubai', country: 'AE' },
  { city: 'Manama', country: 'BH' },
  { city: 'Kuwait City', country: 'KW' },
  { city: 'Doha', country: 'QA' },
];

export function SignUpScreen({ navigation, route }: Props) {
  const setUser = useAuth((s) => s.setUser);

  const initialPhone = route.params?.phone ?? '';
  const initialCode = route.params?.code ?? '';
  const initialCountry =
    COUNTRIES.find((c) => initialPhone.startsWith(c.code)) ?? COUNTRIES[0];
  const initialPhoneLocal = initialPhone.startsWith(initialCountry.code)
    ? initialPhone.slice(initialCountry.code.length)
    : '';

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<SignUpRole>('buyer');
  const [fullName, setFullName] = useState('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [country, setCountry] = useState(initialCountry);
  const [phoneLocal, setPhoneLocal] = useState(initialPhoneLocal);
  const [otp, setOtp] = useState(initialCode);
  const [otpSent, setOtpSent] = useState(Boolean(initialCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = `${country.code}${phoneLocal.replace(/\D/g, '')}`;
  const canContinueStep1 = !!role;
  const canContinueStep2 = fullName.trim().length > 1;
  const canSubmit = phoneLocal.length >= 6 && otp.length === 6;

  const onBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => (s - 1) as Step);
  };

  const onSendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await authService.sendOtp(e164);
      setOtpSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send code. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const env = await authService.register({
        phone: e164,
        code: otp,
        role,
        fullName: fullName.trim(),
        country: region.country,
        city: region.city,
        preferredLanguage: language,
      });
      setUser(env.user);
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && canContinueStep1) setStep(2);
    else if (step === 2 && canContinueStep2) setStep(3);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <AppBar
        left={
          <Pressable onPress={onBack}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        }
        right={
          <Text style={styles.stepLabel}>{step} / 3</Text>
        }
      />

      <StepIndicator total={3} current={step} />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <RoleStep role={role} onChange={setRole} />
        ) : step === 2 ? (
          <IdentityStep
            fullName={fullName}
            onFullNameChange={setFullName}
            region={region}
            onRegionChange={setRegion}
            language={language}
            onLanguageChange={setLanguage}
          />
        ) : (
          <VerifyStep
            country={country}
            onCountryChange={setCountry}
            phoneLocal={phoneLocal}
            onPhoneChange={setPhoneLocal}
            otp={otp}
            onOtpChange={setOtp}
            otpSent={otpSent}
            onSendCode={onSendCode}
            busy={busy}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          kind="primary"
          icon="arrowRight"
          loading={busy}
          full
          disabled={
            step === 1
              ? !canContinueStep1
              : step === 2
              ? !canContinueStep2
              : !otpSent
              ? phoneLocal.length < 6
              : !canSubmit
          }
          onPress={
            step === 3
              ? otpSent
                ? onSubmit
                : onSendCode
              : next
          }
        >
          {step === 3
            ? otpSent
              ? 'Submit for review'
              : 'Send code'
            : 'Continue'}
        </Button>
        {step === 1 ? (
          <Text style={styles.footerNote}>
            Already have an account?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.replace('SignIn')}
            >
              Sign in
            </Text>
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function RoleStep({
  role,
  onChange,
}: {
  role: SignUpRole;
  onChange: (r: SignUpRole) => void;
}) {
  return (
    <>
      <Overline bullet>● 01 · WHO ARE YOU</Overline>
      <Text style={styles.headline}>
        Pick your <Text style={styles.italic}>role</Text>.
      </Text>
      <Text style={styles.sub}>
        You can hold more than one. We&rsquo;ll set up your home screen
        accordingly.
      </Text>

      <View style={{ marginTop: spacing[5], gap: spacing[3] }}>
        {ROLE_OPTIONS.map((o) => {
          const selected = role === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              style={[styles.roleCard, selected && styles.roleCardSelected]}
            >
              <View
                style={[
                  styles.radio,
                  selected && styles.radioSelected,
                ]}
              >
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.roleTitle,
                    selected && { color: colors.mashia[700] },
                  ]}
                >
                  {o.t}
                </Text>
                <Text style={styles.roleDesc}>{o.d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function IdentityStep({
  fullName,
  onFullNameChange,
  region,
  onRegionChange,
  language,
  onLanguageChange,
}: {
  fullName: string;
  onFullNameChange: (v: string) => void;
  region: { city: string; country: string };
  onRegionChange: (r: { city: string; country: string }) => void;
  language: PreferredLanguage;
  onLanguageChange: (l: PreferredLanguage) => void;
}) {
  return (
    <>
      <Overline bullet>● 02 · YOUR IDENTITY</Overline>
      <Text style={styles.headline}>
        Tell us your <Text style={styles.italic}>name</Text>.
      </Text>
      <Text style={styles.sub}>
        Use your full legal name. It must match your national ID for KYC.
      </Text>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>FULL NAME</Overline>
        <TextInput
          value={fullName}
          onChangeText={onFullNameChange}
          autoCapitalize="words"
          placeholder="Khalid Al-Mutairi"
          placeholderTextColor={colors.muted}
          style={styles.textInput}
        />
      </View>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>REGION</Overline>
        <View style={styles.regions}>
          {REGIONS.map((r) => {
            const selected = r.city === region.city;
            return (
              <Pressable
                key={r.city}
                onPress={() => onRegionChange(r)}
                style={[
                  styles.regionPill,
                  selected && styles.regionPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.regionPillText,
                    selected && { color: colors.mashia[700] },
                  ]}
                >
                  {r.city}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>LANGUAGE</Overline>
        <View style={styles.langSwitch}>
          {(
            [
              ['en', 'English'],
              ['ar', 'العربية'],
            ] as const
          ).map(([id, label]) => {
            const selected = language === id;
            return (
              <Pressable
                key={id}
                onPress={() => onLanguageChange(id)}
                style={[
                  styles.langOption,
                  selected && styles.langOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.langText,
                    selected && { color: colors.fg1 },
                    id === 'ar' && { fontFamily: fonts.arBody },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

function VerifyStep({
  country,
  onCountryChange,
  phoneLocal,
  onPhoneChange,
  otp,
  onOtpChange,
  otpSent,
  onSendCode,
  busy,
}: {
  country: CountryOption;
  onCountryChange: (c: CountryOption) => void;
  phoneLocal: string;
  onPhoneChange: (v: string) => void;
  otp: string;
  onOtpChange: (v: string) => void;
  otpSent: boolean;
  onSendCode: () => void;
  busy: boolean;
}) {
  return (
    <>
      <Overline bullet>● 03 · VERIFY PHONE</Overline>
      <Text style={styles.headline}>
        We&rsquo;ll <Text style={styles.italic}>text you</Text>.
      </Text>
      <Text style={styles.sub}>
        Mashia uses your phone number for sign-in and order updates. Sellers
        and buyers never see it.
      </Text>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>MOBILE NUMBER</Overline>
        <View style={{ marginTop: 10 }}>
          <PhoneInput
            country={country}
            onCountryChange={onCountryChange}
            value={phoneLocal}
            onChangeText={onPhoneChange}
            editable={!otpSent}
          />
        </View>
      </View>

      {otpSent ? (
        <View style={{ marginTop: spacing[5] }}>
          <Overline>6-DIGIT CODE</Overline>
          <View style={{ marginTop: 10 }}>
            <OtpInput value={otp} onChangeText={onOtpChange} />
          </View>
          <Text style={styles.resend}>
            Didn&rsquo;t get it?{' '}
            <Text
              style={styles.resendLink}
              onPress={busy ? undefined : onSendCode}
            >
              Resend code
            </Text>
          </Text>
        </View>
      ) : null}

      <View style={styles.privacy}>
        <Icon name="shield" size={14} color={colors.mashia[600]} />
        <Text style={styles.privacyText}>
          KYC documents come next. We review within 24 hours; until then you
          can browse, but not transact.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing[5], paddingTop: spacing[6] },
  stepLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.muted,
  },
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
  textInput: {
    marginTop: 10,
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  roleCard: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  roleCardSelected: {
    backgroundColor: colors.mashia[50],
    borderColor: colors.mashia[600],
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderColor: colors.hairline,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.mashia[600],
    backgroundColor: colors.mashia[600],
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
  },
  roleTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '500',
    color: colors.fg1,
  },
  roleDesc: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 19,
    fontFamily: fonts.body,
  },
  regions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  regionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.paper,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  regionPillSelected: {
    backgroundColor: colors.mashia[50],
    borderColor: colors.mashia[600],
  },
  regionPillText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
  },
  langSwitch: {
    marginTop: 10,
    padding: 4,
    backgroundColor: colors.parchment,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: 'row',
  },
  langOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  langOptionSelected: {
    backgroundColor: colors.paper,
  },
  langText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  resend: {
    marginTop: spacing[3],
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.body,
  },
  resendLink: { color: colors.mashia[700], fontWeight: '600' },
  privacy: {
    marginTop: spacing[5],
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.basaltBlack,
    borderRadius: radii.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.palmyraSand,
    fontFamily: fonts.body,
    lineHeight: 18,
  },
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
