# Mashia — Sheep Marketplace Platform

Cross-border livestock trading platform for the GCC and Syrian market.
Three-sided marketplace: Sellers list sheep → Buyers browse and order → Escrow payment protects both.

---

## Architecture

| Layer | Stack | Status |
|---|---|---|
| Backend API | NestJS, PostgreSQL, Redis, Socket.io, S3 | **API done · AWS infra pending** |
| Mobile App | React Native 0.73, TypeScript, Zustand | **Phases A–C done · Phase D in progress** |
| Admin Dashboard | Next.js 14, Tailwind CSS | Not started |

---

## What's Done

### Backend (Goal 1) — API Complete / Infrastructure Pending

**API code — done.** All 8 modules fully implemented, tested, CI passing on `develop`.

| Module | Endpoints |
|---|---|
| Auth | POST /auth/otp/send, /auth/register, /auth/login, /auth/refresh |
| Users | GET/PATCH /users/me, POST /users/me/kyc |
| Listings | CRUD /listings, GET /listings/mine (seller's own) |
| Orders | POST /orders, GET /orders, GET /orders/:id, PATCH /orders/:id/status |
| Payments | POST /payments/initiate, /payments/release, GET /payments/order/:id |
| Certificates | POST /certificates, GET /certificates/listing/:id, PATCH /certificates/:id/verify |
| Messaging | REST + Socket.io /chat namespace (send, markRead, broadcast) |
| Admin | GET /admin/dashboard, /admin/users, /admin/orders, PATCH kyc/suspend/flag |

**AWS Infrastructure — not provisioned** (issues #82, #86–93, #239–246):
- [ ] RDS PostgreSQL Multi-AZ in me-south-1 (#88 / #239)
- [ ] ElastiCache Redis in me-south-1 (#89 / #240)
- [ ] S3 bucket with server-side encryption in me-south-1 (#90 / #241)
- [ ] ECR repository for backend Docker image (#242)
- [ ] ECS Fargate service + ALB + health checks (#243)
- [ ] GitHub Actions CD pipeline: Docker → ECR → ECS (#244 / #87)
- [ ] CloudFront CDN for media files (#92 / #246)
- [ ] CloudWatch monitoring + log aggregation (#91 / #245)

**Also pending:**
- [ ] Payment gateway real integration (#132) — **deferred, labeled `After Beta phase`** until business registration. MVP uses manual bank-transfer flow handled by admin.
- [ ] Certificate expiry auto-flag scheduler (#61)

**Recent backend changes (on `claude/list-next-tasks-qByz2`, not yet on `develop`):**
- `messaging.gateway.ts` — `typing` event handler broadcasts `userTyping` to room participants (#142)
- `uploads/` — `chat_image` purpose allowed; `generatePresignedUploadUrl` now also returns `fileUrl` (signed read URL, 7-day expiry) (#140)

### Mobile — Phases A, B, C Complete

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
  - Certificates: UploadCertificateScreen *(stub)*, CertificateDetailScreen *(stub)*

**Phase D — Business Polish** (in progress, branch `claude/list-next-tasks-qByz2`)
- [x] Image sending in chat: camera/gallery → S3 presigned upload → `<Image>` bubble; "Photo" preview in ConversationsScreen (#140)
- [x] Typing indicator in ChatScreen — debounced emit, 3s idle stop, 5s safety auto-clear, italic line above input (#142)
- [x] Bug fix: mobile↔backend message field mismatch (`body` → `content`); text send/receive was silently failing DTO validation in Phase C
- [ ] Payment gateway — **deferred to `After Beta phase`** (#132)

---

## What's Next

### Mobile — Remaining Work

**Phase D — Business Polish** (#140 + #142 done on branch; #132 deferred)
- [ ] Real payment gateway integration — STC Pay / Mada (#132). **Deferred**: requires registered company; until beta, manual bank-transfer flow with unique reference + admin handles release.

**Phase E — Certificates Mobile** (phase-07, #143–146)
- [ ] Implement UploadCertificateScreen: type picker, authority, dates, file/photo
- [ ] CertificateDetailScreen: show status (pending/verified/rejected)
- [ ] Show certificate status chip on ListingDetailScreen

**Phase F — Polish** (phase-08, #152–163)
- [ ] i18n/RTL: set up react-i18next, add ar/tr/en translation files (#153)
- [ ] RTL layout switching via I18nManager.forceRTL() for Arabic (#154)
- [ ] Translate all screens to Arabic (#155) and Turkish (#156)
- [ ] Language switcher in SettingsScreen (currently UI-only) (#150)
- [ ] Push notifications: integrate FCM for iOS and Android (#159–163)
  - New message notification
  - Order status change notification
  - KYC approval/rejection notification
  - Notification tap → deep link to correct screen

### Admin Dashboard — Not Started (Goal 3, phase-09)
Next.js 14 + Tailwind. All issues #173–226 open.
Order to build: Login → Dashboard KPIs → Users/KYC → Listings → Orders → Certificates → Payments → i18n → Deploy

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

### 3. Run Mobile (Android)
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
├── backend/          NestJS API — 8 modules, fully implemented
├── mobile/           React Native 0.73 — Phases A+B+C done, D in progress
├── admin/            Next.js — not started
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

---

## Active Branch

Working branch: `claude/list-next-tasks-qByz2` (Phase D — chat images + typing indicator)

Merge flow (always do this to trigger CI):
```bash
git checkout develop
git pull origin develop
git merge origin/claude/list-next-tasks-qByz2
git push origin develop
```

CI triggers automatically on push to `develop` when `mobile/**` files change.

To auto-close the related issues on merge, include in the merge commit body:
```
Closes #140
Closes #142
```

---

## GitHub Issues State

- **Closed (done)**: #94–128, #130–131, #133–134, #136–139, #141, #148–149, #151
- **Done on branch, awaiting merge to `develop`**: #140 (chat images), #142 (typing indicator)
- **Deferred — `After Beta phase` label** (until business registration + manual bank-transfer flow proven): #129, #132, #210–214
- **Open — mobile remaining**: #143–146, #150, #152–163
- **Open — admin dashboard**: #173–209, #215–226 (excl. deferred)
- **Open — infra/deployment**: #82, #86–93, #239–246
