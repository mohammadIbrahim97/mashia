# Mashia — Sheep Marketplace Platform

Cross-border livestock trading platform for the GCC and Syrian market.
Three-sided marketplace: Sellers list sheep → Buyers browse and order → Escrow payment protects both.

---

## Architecture

| Layer | Stack | Status |
|---|---|---|
| Backend API | NestJS, PostgreSQL, Redis, Socket.io, S3 | **9 modules · admin module bootstrapped (1 endpoint) · AWS infra pending** |
| Mobile App | React Native 0.73, TypeScript, Zustand | **Phases A–E done** |
| Admin Dashboard | Next.js 14, Tailwind CSS | **Foundation done · Certificates section live · 4 sections placeholder** |

---

## What's Done

### Backend (Goal 1) — API Complete / Infrastructure Pending

**API code — 9 modules wired**, tested, CI passing on `develop`. The admin module exists with one endpoint so far (`GET /admin/certificates`); the rest of the admin endpoints are still to come — see *What's Next*.

| Module | Endpoints |
|---|---|
| Auth (trader) | POST /auth/otp/send, /auth/otp/verify, /auth/register, /auth/login, /auth/refresh |
| Auth (admin) | POST /auth/admin/login, /auth/admin/totp/verify, /auth/admin/totp/setup, /auth/admin/totp/enable |
| Users | GET/PATCH /users/me |
| KYC | POST /kyc/submit, GET /kyc/status |
| Uploads | POST /uploads/presigned-url |
| Listings | CRUD /listings, GET /listings/mine (seller's own) |
| Orders | POST /orders, GET /orders, GET /orders/:id, PATCH /orders/:id/status |
| Payments | POST /payments/initiate, POST /payments/:id/release, POST /payments/:id/refund (admin), GET /payments/by-order/:id, GET /payments/:id |
| Certificates | POST /certificates, GET /certificates/:id, PATCH /certificates/:id/verify (admin) |
| Messaging | REST + Socket.io /chat namespace (send, markRead, broadcast) |
| Admin | GET /admin/certificates *(1 of ~12; rest in **What's Next**)* |

**AWS Infrastructure — not provisioned** (issues #82, #86–93, #239–246):
- [ ] RDS PostgreSQL Multi-AZ in me-south-1 (#88 / #239)
- [ ] ElastiCache Redis in me-south-1 (#89 / #240)
- [ ] S3 bucket with server-side encryption in me-south-1 (#90 / #241)
- [ ] ECR repository for backend Docker image (#242)
- [ ] ECS Fargate service + ALB + health checks (#243)
- [x] GitHub Actions CD pipeline: Docker → ECR → ECS (#244 / #87)
- [ ] CloudFront CDN for media files (#92 / #246)
- [ ] CloudWatch monitoring + log aggregation (#91 / #245)

**Also pending:**
- [ ] Payment gateway real integration (#132) — **deferred, labeled `After Beta phase`** until business registration. MVP uses manual bank-transfer flow handled by admin.
- [ ] Certificate expiry auto-flag scheduler (#61)

**Recent merges to `develop`:**
- **Admin → Certificates section, end-to-end** (PR #266). First full admin vertical: backend `GET /admin/certificates` (filter/paginate, joins seller + listing); admin frontend `/certificates` list page with tabs (Pending / Verified / Rejected / All) and `/certificates/[id]` detail with Approve / Reject (rejection requires reason). Reusable `ConfirmDialog` component added.
- **Refresh-on-401 in admin** (same PR). New `services/session.ts` owns `access_token` (15 min) + `refresh_token` (7 days) cookies; axios response interceptor transparently refreshes the access token via `POST /auth/refresh` and retries the failing request once. Single in-flight refresh promise prevents thundering-herd.
- **Phase E — Certificates module** (was empty stubs): entity, enums, DTOs, service, controller, migration `1777600000000-CreateCertificates` with `listings.certificate_id` FK. Service auto-syncs `listing.healthStatus` → PENDING on upload, CERTIFIED on verify, UNCHECKED on reject (#143–146)
- **Admin auth** — email + password + optional TOTP. New endpoints under `/auth/admin/*`, `password_hash`/`totp_secret`/`totp_enabled` columns on `users` (migration `1777700000000-AdminAuth`), partial unique index on `email WHERE role='admin'`, bootstrap script `scripts/create-admin.js`
- Full backend suite **322 tests passing across 30 files**

### Mobile — Phases A–E Complete

**Phase A — Design System**
- Theme: colors, typography (Fraunces, Manrope, JetBrains Mono), spacing, shadows
- Components: AppBar, Button, Chip, Icon (30+ icons), Monogram, OtpInput, Overline, PhoneInput, StepIndicator, Wordmark
- Navigation shell: RootNavigator, AuthStack, MainTabs (4 tabs)

**Phase B — Auth Screens** (PR #260)
- WelcomeScreen, SignInScreen, SignUpScreen (phone + OTP + role + profile), RecoverAccessScreen
- JWT stored in Keychain, auto-refresh via Axios interceptor, auth state in Zustand

**Phase C — All Core Screens** (merged to develop)
- **Navigation**: HomeStack, OrdersStack, ChatStack, ProfileStack all wired with typed params via `navigation/types.ts`
- **Services**: `listings`, `orders`, `payments`, `messaging`, `kyc`, `uploads` (S3 presigned URLs)
- **Stores**: `listings.store`, `orders.store`, `messaging.store` (Zustand)
- **Screens implemented**:
  - Listings: HomeScreen (feed + filters + sort), FilterSheet, ListingDetailScreen, CreateListingScreen, MyListingsScreen
  - Orders: PlaceOrderScreen, OrderConfirmationScreen, MyOrdersScreen, OrderDetailScreen
  - Payments: PaymentMethodScreen, PaymentResultScreen
  - Messaging: ConversationsScreen, ChatScreen (Socket.io real-time)
  - Profile: ProfileScreen, EditProfileScreen, SettingsScreen, KycUploadScreen
  - Certificates: UploadCertificateScreen, CertificateDetailScreen *(both real in Phase E)*

**Phase D — Business Polish** (merged to develop, commit `5e83f45`)
- [x] Image sending in chat: camera/gallery → S3 presigned upload → `<Image>` bubble; "Photo" preview in ConversationsScreen (#140)
- [x] Typing indicator in ChatScreen — debounced emit, 3s idle stop, 5s safety auto-clear, italic line above input (#142)
- [x] Bug fix: mobile↔backend message field mismatch (`body` → `content`); text send/receive was silently failing DTO validation in Phase C
- [ ] Payment gateway — **deferred to `After Beta phase`** (#132)

**Phase E — Certificates** (merged to develop)
- [x] Backend certificates module built from empty stubs: entity, enums (`CertificateType`, `CertificateStatus`), DTOs, service, controller, migration with FKs (#143)
- [x] `UploadCertificateScreen` — type picker (vaccination/health/origin), authority, issue/expiry dates, S3 presigned photo upload (#144)
- [x] `CertificateDetailScreen` — image preview, status chip, dates, rejection reason (#146)
- [x] `ListingDetailScreen` — "View certificate" if linked or "Upload certificate" for owner if missing (#145)
- [x] Wired into HomeStack and ProfileStack with composite navigation typing

### Admin Dashboard — Core Sections Implemented

**Foundation** (Goal 3, merged to develop)
- [x] Next.js 14 App Router scaffold under `admin/`, dev on port 3001
- [x] Design system tokens (Tailwind theme + globals): full Mashia palette, Fraunces / Manrope / Reem Kufi self-hosted variable fonts in `public/fonts`
- [x] Atom components: `Button`, `Overline`, `Badge`, `Card`, `KpiCard`, `ComingSoon`, `ConfirmDialog`
- [x] Layout: basalt `Sidebar` with all 6 G3 sections + sign-out wired; `Header` ready for detail pages
- [x] Login (G3-US01): email + password, with optional TOTP second-step
- [x] Dashboard (G3-US02): 8 KPI tiles, attention queues, recent activity feed, commission sparkline (mock data)
- [x] not-found page; middleware-based route guard via `access_token` cookie
- [x] Refresh-on-401 axios interceptor + dual-cookie session helper (PR #266)

**Certificates section — G3-US05** (PR #266)
- [x] Backend: `GET /admin/certificates` with status filter, pagination, seller + listing joins
- [x] Admin frontend: `/certificates` list with Pending / Verified / Rejected / All tabs (live counts), table (issuer / type / linked listing / seller / status / submitted)
- [x] Admin frontend: `/certificates/[id]` detail with image preview, metadata, linked listing/seller card, Approve / Reject buttons; rejection-reason banner; existing `PATCH /certificates/:id/verify` wired to the buttons
- [x] `ConfirmDialog` modal with optional required-reason textarea (will be reused for suspend / refund / flag in upcoming sections)

**Admin sections now live:** `/users`, `/listings`, `/orders`, `/payments`, `/certificates`

---

## What's Next

Payment gateway #132 is the only outstanding item from Phases D–E. Deferred until beta.

### Admin Dashboard — Follow-up work after section implementation

Core sections are now wired end-to-end. Remaining work is mostly hardening, analytics, and production readiness.

**1. Backend admin endpoints — shipped set**

| # | Endpoint | Purpose | G3 | Status |
|---|---|---|---|---|
| 1 | `GET /admin/dashboard` | KPI aggregates (counts + revenue) | US02 | ✅ shipped |
| 2 | `GET /admin/users` | List + filter (role, kyc status, search) | US03 | ✅ shipped |
| 3 | `GET /admin/users/:id` | Profile + KYC docs (presigned URLs) | US03 | ✅ shipped |
| 4 | `PATCH /admin/users/:id/kyc` | Approve / reject with reason | US03 | ✅ shipped |
| 5 | `PATCH /admin/users/:id/suspend` + `/unsuspend` | Suspend bad actors | US03 | ✅ shipped |
| 6 | `GET /admin/listings` | Index across all statuses incl. flagged | US04 | ✅ shipped |
| 7 | `PATCH /admin/listings/:id/flag` | Set FLAGGED status (moderation action) | US04 | ✅ shipped |
| 8 | `DELETE /admin/listings/:id` | Force-remove | US04 | ✅ shipped |
| 9 | `GET /admin/certificates` | Pending-default queue with filters | US05 | ✅ **shipped (PR #266)** |
| 10 | `GET /admin/orders` | Index of all orders (today's `GET /orders` is user-scoped) | US06 | ✅ shipped |
| 11 | `POST /admin/payments/:id/release` | Force-release in dispute resolution | US06 | ✅ shipped |
| 12 | `GET /admin/payments` + `GET /admin/revenue` | Payment ledger + commission summary | US07 | ✅ shipped |

Plus a migration: `users.suspended` boolean, `users.kyc_rejection_reason`, `users.kyc_reviewed_at`, `users.kyc_reviewed_by_id`.

**2. Admin frontend — shipped**

Users/KYC, Listings moderation, Orders/Disputes, and Payments/Revenue pages are implemented. Continue iterating UX polish and data quality as operational feedback arrives.

**3. Loose ends on the foundation itself**
- [ ] Settings page with TOTP enable UI (`/auth/admin/totp/setup` + `/enable` exist already, no caller)
- [ ] Real i18n: language switcher in the sidebar is UI-only. Wire `next-intl` for ar / tr / en + RTL via `dir="rtl"` and Tailwind logical properties
- [ ] Auth hardening: move both cookies to HttpOnly via a Server Action / Route Handler. Refresh-on-401 already shipped (PR #266); HttpOnly is the remaining gap.
- [ ] `@nestjs/throttler` on `/auth/otp/send` and `/auth/admin/login` to cap brute force / SMS abuse
- [ ] Real SMS provider — `ConsoleSmsService` is dev-only. `SmsService` interface is already in `backend/src/shared/sms/`; production swap is a one-class drop-in (Unifonic recommended for KSA, AWS SNS as fallback). Defer until business / sender-ID registration.
- [ ] Replace the static SVG sparkline with real Recharts (deps already declared in `package.json`)
- [ ] Audit log endpoint + page (referenced by "Open audit log →" link on dashboard)
- [ ] Production: `admin/Dockerfile` exists; needs ECS Fargate service + custom domain (G3-US09)

### Mobile — Phase F (Polish)

Not started. Issues #150, #152–163.
- [ ] i18n/RTL: react-i18next, ar / tr / en files (#153)
- [ ] RTL via `I18nManager.forceRTL()` for Arabic (#154)
- [ ] Translate all screens to Arabic (#155) and Turkish (#156)
- [ ] Language switcher in `SettingsScreen` (currently UI-only) (#150)
- [ ] Push notifications (FCM iOS + Android, #159–163): new message, order status, KYC outcome, deep links

---

## Running Locally

### Prerequisites
- Docker Desktop
- Node 20
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### 1. Start Infrastructure
```bash
docker compose up -d   # PostgreSQL 16 on :5432, Redis 7 on :6379
```

### 2. Start Backend
```bash
cd backend
cp .env.example .env   # fill in values (see below)
npm install
npm run start:dev      # http://localhost:3000
```

### 3. Run Admin Dashboard (web)
```bash
cd admin
npm install
npm run dev          # http://localhost:3001
```

To create the first admin (registration via `/auth/register` blocks the ADMIN role):
```bash
cd backend
node scripts/create-admin.js
# prompts for email, password, country, city, optional TOTP
# answer "n" to "Set up TOTP now?" if you don't want to scan a QR right now —
# you can enable TOTP later via POST /auth/admin/totp/setup + /enable
```

Sign in at `localhost:3001/login` with the email + password you set.

### 4. Run Mobile (Android)
```bash
cd mobile
npm install

# Terminal 1 — Metro bundler
npm start

# Terminal 2 — install and launch on emulator
npm run android
```

In Metro terminal: press `r` to reload, `d` to open dev menu.

### Backend `.env` minimum config
```
DATABASE_URL=postgresql://mashia:mashia@localhost:5432/mashia
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-prod
JWT_REFRESH_SECRET=dev-refresh-secret
AWS_REGION=me-south-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET=mashia-media
```

For local S3, LocalStack is optional — KYC and listing image uploads will fail gracefully without it.

### Seed demo users (for mobile testing)
```bash
cd backend
node scripts/seed-demo-users.js
# Creates: seller +966501234567, buyer +966507654321, broker +966509876543
# OTP for all: 123456
```

---

## Repository Structure

```
mashia/
├── backend/          NestJS API — 9 modules; admin module bootstrapped (1 endpoint)
├── mobile/           React Native 0.73 — Phases A–E done
├── admin/            Next.js 14 — foundation + Certificates section live; 4 sections placeholder
├── docs/             Specs, requirements, implementation plans
├── docker-compose.yml
├── FILE_MAP.md       Detailed file-by-file reference
└── README.md         This file
```

---

## Key Files to Know

| File | Purpose |
|---|---|
| `mobile/src/navigation/types.ts` | **Single source of truth** for all navigation ParamList types — import from here, not from individual stack files |
| `mobile/src/services/api.ts` | Axios instance with JWT auto-refresh + 401 redirect |
| `mobile/src/config.ts` | `API_BASE_URL` and other constants |
| `mobile/src/store/auth.store.ts` | Auth state: user, tokens, isAuthenticated |
| `backend/src/modules/messaging/messaging.gateway.ts` | Socket.io /chat namespace — joinConversation, sendMessage, markRead |
| `backend/src/shared/interceptors/transform.interceptor.ts` | Wraps every response in `{ success, data }` — clients must `unwrap()` |
| `backend/scripts/create-admin.js` | Bootstrap admin user (since `/auth/register` blocks ADMIN role) |
| `admin/src/app/(admin)/layout.tsx` | Sidebar + main pane wrapper for all authenticated admin pages |
| `admin/src/services/api.ts` | Axios instance for admin (talks to `:3000/api/v1`); request interceptor attaches Bearer token; response interceptor refreshes on 401 |
| `admin/src/services/session.ts` | Owns the `access_token` (15m) + `refresh_token` (7d) cookies; only place to set/read them |
| `admin/tailwind.config.js` | Mashia design tokens — colors, fonts, radii, shadows |

---

## Active Branch

No outstanding feature branch — `develop` is at the latest merged work (admin foundation, commit `7df038b`).

Standard merge flow (use this on every feature branch to trigger CI):
```bash
git checkout develop
git pull origin develop
git merge --no-ff origin/<your-branch>
git push origin develop
```

CI triggers automatically on push to `develop` when `backend/**`, `mobile/**`, or `admin/**` files change.

---

## GitHub Issues State

- **Closed (done)**: #94–128, #130–131, #133–134, #136–142, #143–146, #148–149, #151
- **Deferred — `After Beta phase` label** (until business registration + manual bank-transfer flow proven): #129, #132, #210–214
- **Open — mobile Phase F**: #150, #152–163
- **Open — admin dashboard**: #173–209, #215–226 (excl. deferred). Foundation work isn't tied to a single issue; the next concrete tickets are the backend admin endpoints listed in *What's Next*.
- **Open — infra/deployment**: #82, #86–93, #239–246
