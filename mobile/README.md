# Mashia Mobile

React Native app for Mashia traders (sellers, buyers, brokers).

## Status

**Phase A (this PR) — Design system foundation.** Tokens, atomic
components, navigation skeleton, and a dev preview screen wired up so the
brand is verifiable on a real device. Auth flow lands in Phase B.

## What's in here

```
src/
  theme/         — colors, typography, spacing, radii, shadows
  components/    — Button, Chip, AppBar, Overline, StepIndicator, Icon,
                   Wordmark, Monogram
  navigation/    — RootNavigator (auth/main split), AuthStack, MainTabs
  screens/
    DevPreviewScreen.tsx       — design system showcase (Phase A target)
    auth/PlaceholderScreen.tsx — stand-in until Phase B
  services/
    api.ts             — axios instance + JWT-from-keychain interceptor
    auth.service.ts    — sendOtp / verifyOtp wired to backend
  hooks/useAuth.ts     — Zustand auth state machine (stub)
  config.ts            — API base URL (Platform-branched defaults)
  assets/
    fonts/   — Fraunces, Manrope, Reem Kufi (variable), JetBrains Mono
    logos/   — wordmark, monogram (SVG, used as reference)
```

## Running locally

After pulling this branch:

```bash
cd mobile
npm install --legacy-peer-deps
npx react-native-asset            # link bundled fonts to iOS + Android
cd ios && pod install && cd ..    # iOS only
npm run android                   # or: npm run ios
```

The app boots into the auth stack. Tap **"Continue as dev user"** on the
placeholder to flip into MainTabs and inspect the design-system preview
(typography, color, buttons, chips, icons).

## API URL defaults

Configured in `src/config.ts`:

- Android emulator → `http://10.0.2.2:3000`
- iOS simulator → `http://localhost:3000`
- Physical device → edit `src/config.ts` (Phase A) or wire
  `react-native-config` (Phase B+)

Backend must be running on port 3000 (see `backend/README.md`).

## Phase B — auth flow

Replaces `screens/auth/PlaceholderScreen.tsx` with the four screens from
the design bundle:

1. `WelcomeScreen` — dark Basalt + green vignette, dual CTA
2. `SignInScreen` — phone + OTP, two-step
3. `SignUpScreen` — role → identity → KYC, three-step
4. `RecoverAccessScreen` — KYC re-verification, four-step

Then wires `authService.sendOtp` / `verifyOtp` and the keychain hydration
on app boot so signed-in users skip the auth stack on relaunch.
