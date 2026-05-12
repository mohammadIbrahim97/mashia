# 14 — Mobile App

React Native 0.73 with TypeScript. Targets iOS and Android. Source under `mobile/src/`. Phases A–E (design system, auth, all core screens, certificates) are merged on `develop`; Phase F (i18n, RTL, push notifications) is the next milestone.

## Stack

| Concern | Library |
|---|---|
| Framework | React Native 0.73 |
| Language | TypeScript (strict) |
| Navigation | `@react-navigation/native` + native-stack + bottom-tabs |
| State | `zustand` (one store per domain) |
| HTTP | `axios` |
| WebSocket | `socket.io-client` |
| Secure storage | `react-native-keychain` (JWT pair) |
| Forms / validation | Hand-rolled with `utils/validation.ts` |
| Image picker | `react-native-image-picker` |
| Fonts | Fraunces (display), Manrope (body), JetBrains Mono (mono) |

## Folder map

```
mobile/src/
├── App.tsx                       ← Mounts <RootNavigator />
├── config.ts                     ← API_BASE_URL, keychain service name
├── i18n/index.ts                 ← (stub; not wired yet)
├── navigation/
│   ├── RootNavigator.tsx         ← AuthStack vs MainTabs switch
│   ├── AuthStack.tsx             ← Welcome → SignIn / SignUp → RecoverAccess
│   ├── MainTabs.tsx              ← Home / Orders / Chat / Profile
│   ├── HomeStack.tsx
│   ├── OrdersStack.tsx
│   ├── ChatStack.tsx
│   ├── ProfileStack.tsx
│   └── types.ts                  ← *SINGLE SOURCE OF TRUTH for ParamLists*
├── screens/
│   ├── auth/{Welcome,SignIn,SignUp,RecoverAccess}Screen.tsx
│   ├── listings/{Home,ListingDetail,CreateListing,MyListings,FilterSheet}.tsx
│   ├── orders/{PlaceOrder,OrderConfirmation,MyOrders,OrderDetail,PaymentMethod,PaymentResult}.tsx
│   ├── messaging/{Conversations,Chat}.tsx
│   ├── certificates/{UploadCertificate,CertificateDetail}.tsx
│   └── profile/{Profile,EditProfile,Settings,KycUpload}.tsx
├── services/
│   ├── api.ts                    ← axios + Keychain-backed token store
│   ├── auth.service.ts
│   ├── users.service.ts
│   ├── kyc.service.ts
│   ├── listings.service.ts
│   ├── orders.service.ts
│   ├── payments.service.ts
│   ├── certificates.service.ts
│   ├── messaging.service.ts
│   └── socket.service.ts         ← Socket.io connection + helpers
├── store/                        ← Zustand
│   ├── auth.store.ts
│   ├── listings.store.ts
│   ├── orders.store.ts
│   └── messaging.store.ts
├── components/                   ← Atom library (Phase A)
│   ├── AppBar, Button, Chip, Icon (30+ glyphs), Monogram, OtpInput,
│   ├── Overline, PhoneInput, StepIndicator, Wordmark
│   └── index.ts                  ← re-exports
├── hooks/
│   └── useAuth.ts                ← thin Zustand selector wrapper
├── theme/
│   ├── colors.ts, typography.ts, spacing.ts, shadows.ts
│   └── index.ts
└── utils/{format, validation, constants}.ts
```

## Bootstrap (App.tsx → RootNavigator)

```
1. App.tsx mounts <RootNavigator />.
2. RootNavigator reads `status` from useAuth.
3. On mount it calls `hydrate()`:
     - load tokens from Keychain
     - if found, GET /users/me to validate + load profile
     - set status = 'authenticated' | 'anonymous'
4. While status === 'loading' a centered ActivityIndicator is shown.
5. Once status is settled, render either AuthStack or MainTabs.
```

`mobile/src/store/auth.store.ts` is the source of truth for `status`, `user`, and the imperative `setAuth/signOut` actions. Tokens are NOT in this store — they live in Keychain only.

## API client

`mobile/src/services/api.ts` exports:

- `api` — axios instance with `baseURL = ${API_BASE_URL}${API_PATH_PREFIX}`.
- `loadTokens()` / `setTokens(tokens | null)` — Keychain-backed, with a module-level cache to avoid hitting Keychain on every request.
- `unwrap(res)` — peels `{ success, data }`.
- `isApiError(err)` / `errorMessage(err, fallback)` — type guard + message extractor.

The request interceptor attaches `Authorization: Bearer <accessToken>` if a pair is loaded. There is currently **no response-side refresh-on-401 interceptor in the mobile client** as of the last read — the admin web client implements it (`admin/src/services/api.ts`). If you need refresh on the mobile side, port that logic; it's small.

## Services

One file per backend module under `mobile/src/services/`. The shape is consistent:

```ts
export type Foo = { ... };                  // mirrored from backend response
export type CreateFooPayload = { ... };

export const fooService = {
  async list(query): Promise<Page<Foo>>     { const res = await api.get('/foos', { params: query });  return unwrap(res); },
  async getById(id): Promise<Foo>           { const res = await api.get(`/foos/${id}`);              return unwrap(res); },
  async create(payload): Promise<Foo>       { const res = await api.post('/foos', payload);          return unwrap(res); },
  async update(id, payload): Promise<Foo>   { const res = await api.patch(`/foos/${id}`, payload);   return unwrap(res); },
  async remove(id): Promise<void>           { await api.delete(`/foos/${id}`); },
};
```

Some files (e.g. `listings.service.ts`) don't `unwrap` for paginated endpoints because the backend already returns a `{ data, total, page, limit }` shape — but it does pass through the standard envelope on top, so the service has a tiny "did this look envelope-y?" check. When you touch one of these, prefer always `unwrap` and have the backend return the page object directly inside `data`.

## Navigation

### Stack types (`navigation/types.ts`)

The single source of truth for every navigation param list. **Always import from here**, never from the individual stack files. This is a hard convention — having two declarations of the same ParamList causes type drift that's painful to debug.

### Stack tree

```
RootStackParamList
├── Auth (AuthStackParamList)
│     Welcome
│     SignIn
│     SignUp
│     RecoverAccess
└── Main (BottomTab)
      ├── Home (HomeStackParamList)
      │     HomeFeed
      │     ListingDetail
      │     PlaceOrder
      │     OrderConfirmation
      │     PaymentMethod         (re-used in OrdersStack)
      │     PaymentResult
      │     CertificateDetail
      ├── Orders (OrdersStackParamList)
      │     MyOrders
      │     OrderDetail
      │     PaymentMethod
      │     PaymentResult
      ├── Chat (ChatStackParamList)
      │     Conversations
      │     Chat
      └── Profile (ProfileStackParamList)
            Profile
            EditProfile
            Settings
            KycUpload
            MyListings
            CreateListing
            ListingDetail         (re-used from HomeStack)
            UploadCertificate
            CertificateDetail
```

### Composite navigation typing

Screens that can navigate across stacks (e.g. ProfileStack → ListingDetail) use `CompositeNavigationProp` to compose the parent navigators. Look at `CertificateDetailScreen.tsx` for the pattern.

## State stores

### `auth.store.ts`

```ts
{ status, user, hydrate(), setAuth(user), signOut() }
```

Hydrate reads Keychain, calls `/users/me`, updates state. SignOut wipes Keychain and resets state — the RootNavigator's `status === 'anonymous'` branch then swaps the navigator.

### `listings.store.ts`

Holds the current feed (with pagination), the active filter state, and the seller's own `MyListings` cache. Provides `search()`, `loadMore()`, `setFilters()`, `clearCache()`.

### `orders.store.ts`

Cache of order list and individual order details. Optimistically updates status on `PATCH /orders/:id/status` so the UI doesn't flicker.

### `messaging.store.ts`

Conversations list, active conversation, unread counts. Socket events feed into it via `socket.service.ts` listeners.

## Theme

`mobile/src/theme/`:

- `colors.ts` — Mashia palette. Key colours: `paper`, `parchment`, `basalt`, `mashia[100..900]`, `gold`, `sand`.
- `typography.ts` — Fraunces (display, e.g. screen titles), Manrope (body), JetBrains Mono (mono badges / overlines), Reem Kufi (Arabic — bundled but not yet selected at runtime).
- `spacing.ts` — `xs / sm / md / lg / xl / 2xl` numeric scale.
- `shadows.ts` — preset shadow styles for cards.

All exported from `theme/index.ts`; import via `import { colors, type } from '@theme'` (path alias defined in `tsconfig.json` and `babel.config.js`).

## Path aliases

`mobile/tsconfig.json` and `babel.config.js` define:

```
@theme    → src/theme
@hooks    → src/hooks
@components → src/components
```

The backend uses an analogous `@shared` alias (`backend/src/shared`) — visible in every `import { ... } from '@shared/enums'` line.

## KYC & uploads from the device

Two-step pattern repeated everywhere:

```
1. Pick file (image picker, document picker, camera).
2. POST /uploads/presigned-url { purpose, contentType, fileName }   → { uploadUrl, fileUrl, key }
3. fetch(uploadUrl, { method: 'PUT', body: fileBlob, headers: { 'Content-Type': contentType } })
4. Use `fileUrl` or `key` in the next API call (create listing, certificate, KYC submit, send chat image).
```

Implementation lives in `hooks/useImageUpload.ts` and the relevant services.

The exception is `/kyc/submit` — that one is `multipart/form-data` straight to the backend (not S3 presigned), because the backend wants to validate file types and run them through `kyc-file.validator.ts` before storage.

## Socket.io

`mobile/src/services/socket.service.ts`:

- Lazily creates the socket on first chat interaction.
- Connects to `${API_BASE}/chat`.
- Passes `{ auth: { token: <accessToken> } }`.
- Provides `joinConversation`, `sendMessage`, `markRead`, `typing` as promise-returning wrappers around `socket.emit(..., cb)`.
- Subscribes to `newMessage`, `userTyping`, `messageRead` and pipes them into `messaging.store`.

Reconnect on auth rotation: not automatic today. If a request rotates the JWT and the socket is still using the old token, the next reconnect will fail. Workaround: reconnect on app foreground.

## Component library (Phase A)

`mobile/src/components/`:

| Component | Purpose |
|---|---|
| `AppBar` | Top bar with title + back/close button |
| `Button` | Primary / secondary / ghost / destructive variants |
| `Chip` | Compact selectable label (used in FilterSheet) |
| `Icon` | Wraps the bundled SVG icon set (~30 glyphs) |
| `Monogram` | Circular avatar with initials |
| `OtpInput` | 6-digit numeric input with auto-advance |
| `Overline` | Small uppercase mono caption |
| `PhoneInput` | Country code + national number |
| `StepIndicator` | Multi-step form progress |
| `Wordmark` | The "Mashia." stylised logo |

All components are theme-aware (colour / typography / spacing tokens from `theme/`). Use them rather than ad-hoc `<View>`/`<Text>` styling.

## Adding a screen

A typical pattern:

1. Add the param list entry in `navigation/types.ts`.
2. Add the route in the relevant stack file (e.g. `HomeStack.tsx`).
3. Create the screen file under `screens/<feature>/`.
4. Use `useNavigation<NativeStackNavigationProp<...>>()` typed against the param list.
5. Pull data from a service; cache in a Zustand store if shared.
6. Reuse components from `components/` — don't reinvent buttons.

## Phase F (open)

From the root README:

- **i18n** — `react-i18next` with `ar/tr/en` files (#153).
- **RTL** — `I18nManager.forceRTL()` when locale is Arabic (#154). Trickier than it sounds: requires app restart on toggle, and several screens have hard-coded `flexDirection: 'row'` that won't flip naturally.
- **Translations** — translate every screen to Arabic (#155) and Turkish (#156).
- **Language switcher** in `SettingsScreen` (currently UI-only) (#150).
- **Push notifications** — FCM for iOS and Android (#159–163). New message, order status, KYC outcome. Deep-link payloads should match the navigation param lists in `navigation/types.ts`.

When you start any of these, write a Phase F section in the project root README and treat each ticket as a separate PR rather than a monolithic Phase-F merge.
