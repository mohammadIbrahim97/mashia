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
  Overline,
  PhoneInput,
  StepIndicator,
} from '@components/index';
import { AuthStackParamList } from '@navigation/types';
import { colors, fonts, radii, spacing, type } from '@theme/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'RecoverAccess'>;
type Step = 1 | 2 | 3 | 4;

/**
 * UI-only for now. The backend doesn't expose a recovery endpoint yet —
 * submission generates a local case ID and shows the "under review" state
 * so the design can be reviewed end-to-end. Wire to /auth/recover when the
 * endpoint lands.
 */
export function RecoverAccessScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [caseId] = useState(
    () => `REC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
  );

  const onBack = () => {
    if (step === 1) navigation.goBack();
    else if (step === 4) navigation.popToTop();
    else setStep((s) => (s - 1) as Step);
  };

  const onNext = () => {
    if (step === 1 && fullName && idNumber) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3 && phoneLocal.length >= 6) setStep(4);
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
          step <= 3 ? (
            <Text style={styles.stepLabel}>{step} / 3</Text>
          ) : null
        }
      />

      {step <= 3 ? <StepIndicator total={3} current={step} /> : null}

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <IdentityStep
            fullName={fullName}
            onFullNameChange={setFullName}
            idNumber={idNumber}
            onIdNumberChange={setIdNumber}
          />
        ) : step === 2 ? (
          <SelfieStep />
        ) : step === 3 ? (
          <NewNumberStep
            country={country}
            onCountryChange={setCountry}
            phoneLocal={phoneLocal}
            onPhoneChange={setPhoneLocal}
          />
        ) : (
          <UnderReviewStep
            caseId={caseId}
            phone={`${country.code} ${phoneLocal}`}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step <= 3 ? (
          <Button
            kind="primary"
            icon="arrowRight"
            full
            onPress={onNext}
            disabled={
              step === 1
                ? !(fullName.length > 1 && idNumber.length > 4)
                : step === 3
                ? phoneLocal.length < 6
                : false
            }
          >
            {step === 3 ? 'Submit for review' : 'Continue'}
          </Button>
        ) : (
          <Button
            kind="primary"
            full
            onPress={() => navigation.popToTop()}
          >
            Done
          </Button>
        )}
        {step === 1 ? (
          <Text style={styles.footerNote}>
            Got it back?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.replace('SignIn')}
            >
              Sign in normally
            </Text>
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function IdentityStep({
  fullName,
  onFullNameChange,
  idNumber,
  onIdNumberChange,
}: {
  fullName: string;
  onFullNameChange: (v: string) => void;
  idNumber: string;
  onIdNumberChange: (v: string) => void;
}) {
  return (
    <>
      <Overline bullet>● 01 · CONFIRM IDENTITY</Overline>
      <Text style={styles.headline}>
        Lost your <Text style={styles.italic}>number</Text>?
      </Text>
      <Text style={styles.sub}>
        No password to reset — Mashia is OTP-only. Instead, we&rsquo;ll
        re-verify your KYC and move your account to a new number. Reviewed
        within 24 hours.
      </Text>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>FULL NAME (AS ON ID)</Overline>
        <TextInput
          value={fullName}
          onChangeText={onFullNameChange}
          autoCapitalize="words"
          placeholder="Khalid Al-Mutairi"
          placeholderTextColor={colors.muted}
          style={styles.textInput}
        />
      </View>

      <View style={{ marginTop: spacing[4] }}>
        <Overline>NATIONAL ID NUMBER</Overline>
        <TextInput
          value={idNumber}
          onChangeText={onIdNumberChange}
          keyboardType="number-pad"
          placeholder="1xxxxxxxxx"
          placeholderTextColor={colors.muted}
          style={[
            styles.textInput,
            { fontFamily: fonts.mono, letterSpacing: 0.75 },
          ]}
        />
      </View>

      <View style={styles.privacy}>
        <Icon name="shield" size={14} color={colors.mashia[600]} />
        <Text style={styles.privacyText}>
          Must match the ID on file. We hash and check — we don&rsquo;t
          display your full number anywhere.
        </Text>
      </View>
    </>
  );
}

function SelfieStep() {
  return (
    <>
      <Overline bullet>● 02 · SELFIE WITH ID</Overline>
      <Text style={styles.headline}>
        Show your <Text style={styles.italic}>face</Text>.
      </Text>
      <Text style={styles.sub}>
        Hold your national ID next to your face. Plain background, good
        light. We compare it to the photo we have on file.
      </Text>

      <View style={styles.viewfinder}>
        <View style={styles.viewfinderFrame} />
        <View style={styles.viewfinderCircle} />
        <Text style={styles.viewfinderHint}>
          ● LIVE CAPTURE · FACE IN CIRCLE, ID IN HAND
        </Text>
      </View>

      <View style={styles.note}>
        <Icon name="image" size={14} color={colors.muted} />
        <Text style={styles.noteText}>
          Liveness check — you may be asked to blink or turn your head.
        </Text>
      </View>
    </>
  );
}

function NewNumberStep({
  country,
  onCountryChange,
  phoneLocal,
  onPhoneChange,
}: {
  country: CountryOption;
  onCountryChange: (c: CountryOption) => void;
  phoneLocal: string;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <>
      <Overline bullet>● 03 · NEW NUMBER</Overline>
      <Text style={styles.headline}>
        Where shall we{'\n'}
        <Text style={styles.italic}>reach you</Text> now?
      </Text>
      <Text style={styles.sub}>
        We&rsquo;ll move your account, listings, escrow balance and order
        history to this number once review passes.
      </Text>

      <View style={{ marginTop: spacing[5] }}>
        <Overline>NEW MOBILE NUMBER</Overline>
        <View style={{ marginTop: 10 }}>
          <PhoneInput
            country={country}
            onCountryChange={onCountryChange}
            value={phoneLocal}
            onChangeText={onPhoneChange}
          />
        </View>
      </View>

      <View style={styles.darkPanel}>
        <Overline color={colors.qasiounGold} bullet>
          ● WHAT HAPPENS NEXT
        </Overline>
        <View style={{ marginTop: spacing[3], gap: spacing[3] }}>
          {[
            ['1', 'Mashia ops review', 'Manual KYC re-check, within 24h.'],
            ['2', 'Old number locked', 'Cannot sign in from old number once approved.'],
            ['3', 'OTP to new number', 'Sign in with the new number going forward.'],
          ].map(([n, t, d]) => (
            <View key={n} style={styles.numberedRow}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberBadgeText}>{n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.numberedTitle}>{t}</Text>
                <Text style={styles.numberedDesc}>{d}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function UnderReviewStep({ caseId, phone }: { caseId: string; phone: string }) {
  return (
    <View style={{ paddingTop: spacing[6] }}>
      <View style={styles.bigShield}>
        <Icon name="shield" size={28} color={colors.mashia[600]} />
      </View>
      <Overline color={colors.mashia[700]} bullet>
        ● SUBMITTED
      </Overline>
      <Text style={styles.headline}>
        Under <Text style={styles.italic}>review</Text>.
      </Text>
      <Text style={styles.sub}>
        We&rsquo;re re-verifying your KYC. You&rsquo;ll get an SMS at{' '}
        <Text style={{ color: colors.fg1, fontWeight: '600' }}>{phone}</Text>{' '}
        within 24 hours. Browse continues to work; transactions are paused
        until approval.
      </Text>

      <View style={styles.caseIdRow}>
        <Text style={styles.caseIdLabel}>CASE ID</Text>
        <Text style={styles.caseIdValue}>{caseId}</Text>
      </View>
    </View>
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
  privacy: {
    marginTop: spacing[4],
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
  viewfinder: {
    marginTop: spacing[5],
    aspectRatio: 4 / 5,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderColor: colors.hairline,
    borderWidth: 1,
    backgroundColor: '#1A1E1B',
    padding: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderColor: colors.palmyraSand,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    opacity: 0.6,
  },
  viewfinderCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    borderColor: colors.palmyraSand,
    borderWidth: 3,
    opacity: 0.5,
  },
  viewfinderHint: {
    position: 'absolute',
    bottom: 18,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.palmyraSand,
    textAlign: 'center',
  },
  note: {
    marginTop: spacing[4],
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: colors.parchment,
    borderRadius: radii.sm,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.body,
    lineHeight: 18,
  },
  darkPanel: {
    marginTop: spacing[5],
    padding: spacing[4],
    backgroundColor: colors.basaltBlack,
    borderRadius: radii.md,
  },
  numberedRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  numberBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.qasiounGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.basaltBlack,
  },
  numberedTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.paper,
  },
  numberedDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.palmyraSand,
    marginTop: 2,
    lineHeight: 18,
  },
  bigShield: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.mashia[50],
    borderColor: colors.mashia[200],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  caseIdRow: {
    marginTop: spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: 12,
    backgroundColor: colors.parchment,
    borderRadius: radii.md,
    borderColor: colors.hairline,
    borderWidth: 1,
  },
  caseIdLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.muted,
  },
  caseIdValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
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
