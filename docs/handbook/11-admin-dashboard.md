# 11 — Admin Dashboard

The admin dashboard is a separate Next.js 14 web app under `admin/`. It runs on port **3001** in development, talks to the same backend at `:3000/api/v1`, and shares the same JWT pair as the mobile app (but stored in cookies, not Keychain).

It is the operational nerve centre: KYC review, listing moderation, dispute resolution, certificate verification, and revenue ledger. All core sections are implemented: Users/KYC, Listings moderation, Certificates, Orders/Disputes, and Payments/Revenue.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS with a Mashia design-token theme (see `admin/tailwind.config.js`) |
| Data | `axios` (`src/services/api.ts`) + `swr`-style hooks (`src/hooks/useApi.ts`) |
| State | None global. Each page owns its data. Session is in cookies via `src/services/session.ts`. |
| Auth | Cookie-based, refresh-on-401, middleware route guard |
| Icons | `lucide-react` |
| Fonts | Fraunces (display), Manrope (body), Reem Kufi (Arabic), JetBrains Mono (mono) — self-hosted in `public/fonts/` |

## Folder map

```
admin/
├── src/app/
│   ├── layout.tsx                  ← Root (next/font, html lang, metadata)
│   ├── page.tsx                    ← Redirects to /dashboard
│   ├── not-found.tsx
│   ├── login/page.tsx              ← G3-US01
│   └── (admin)/                    ← route group with shared layout
│       ├── layout.tsx              ← <Sidebar/> + <main>
│       ├── dashboard/page.tsx      ← G3-US02 (KPIs, queues, sparkline — mock data)
│       ├── users/{page.tsx,[id]/page.tsx}        ← live
│       ├── listings/{page.tsx,[id]/page.tsx}     ← live
│       ├── orders/{page.tsx,[id]/page.tsx}       ← live
│       ├── payments/page.tsx                     ← live
│       └── certificates/{page.tsx,[id]/page.tsx} ← live (PR #266)
├── src/components/
│   ├── layout/{Sidebar,Header,Breadcrumbs}.tsx
│   ├── ui/{Button,Badge,Card,KpiCard,Overline,
│   │       ConfirmDialog,ComingSoon,StatusBadge,
│   │       DataTable,FilterBar,SearchInput,
│   │       DocumentViewer,LoadingState}.tsx
│   └── charts/{RevenueChart,OrdersChart}.tsx
├── src/services/
│   ├── api.ts                ← axios + refresh-on-401
│   ├── session.ts            ← cookie-backed access/refresh token store
│   ├── auth.service.ts       ← /auth/admin/login, /totp/verify
│   ├── admin.service.ts      ← stubs for admin endpoints
│   ├── users.service.ts      ← /admin/users, /admin/users/:id, /admin/users/:id/kyc
│   └── certificates.service.ts
├── src/hooks/{useApi,useTable,useAuth}.ts
├── src/middleware.ts         ← redirects between /login and /dashboard
├── tailwind.config.js
└── next.config.js
```

## Auth & session

### Login flow

`admin/src/app/login/page.tsx`:

1. POST `/auth/admin/login` with `{ email, password }`.
2. If response is `{ requiresTotp: true, ticket }`, the page swaps to the 6-digit input view.
3. If/when the response is `{ accessToken, refreshToken, user }`, the page calls `session.set(...)` and navigates to `/dashboard`.

The `session` helper writes two non-HttpOnly cookies with TTLs that mirror the JWTs:

| Cookie | Max age | Reads from |
|---|---|---|
| `access_token` | 15 min | `session.getAccess()` |
| `refresh_token` | 7 days | `session.getRefresh()` |

### Middleware

`admin/src/middleware.ts` runs on every non-API request. Logic:

- `pathname === '/login'`: if `access_token` cookie exists, redirect to `/dashboard`; else allow.
- Else: if no `access_token`, redirect to `/login`. The `refresh_token` is *not* checked here; the axios interceptor handles refresh on the next API call.

This means a hard reload with an expired access token but live refresh token will briefly redirect to `/login`. Acceptable for now; resolving this requires checking both cookies (and possibly verifying server-side) in middleware.

### Refresh-on-401

The axios response interceptor (`src/services/api.ts`):

- Catches 401 from any endpoint except `/auth/refresh` itself.
- Single-flight refresh (module-level `refreshing` promise) to avoid the thundering-herd.
- On refresh success, retries the original request once with the new token.
- On refresh failure, clears cookies and `window.location.href = '/login'`.

### Sign-out

`Sidebar.tsx` button → `session.clear()` → `router.push('/login')`. No server-side revocation today; the client-side cookie wipe is sufficient because the access token is short-lived. To add server-side revoke, you'd blacklist the refresh `jti` in Redis like `auth.service.ts.refresh` already does.

## Layout

`(admin)/layout.tsx` is a thin wrapper:

```tsx
<div className="flex h-screen min-h-[760px]">
  <Sidebar />
  <main className="flex-1 overflow-auto bg-parchment">{children}</main>
</div>
```

`Sidebar.tsx` is the nav. Items:

| Item | Path | G3 user story |
|---|---|---|
| Dashboard | `/dashboard` | G3-US02 |
| Users | `/users` | G3-US03 |
| Listings | `/listings` | G3-US04 |
| Certificates | `/certificates` | G3-US05 (live) |
| Orders | `/orders` | G3-US06 |
| Payments | `/payments` | G3-US07 |

The little numeric badges on each item are **mock data today** — hardcoded in `Sidebar.tsx` (e.g. Users: 23, Listings: 4). When the dashboard endpoint lands (`GET /admin/dashboard`), wire them to live counts.

Footer: language toggle (UI-only — no i18n wiring yet), sign-out button, version stamp.

## Dashboard

`(admin)/dashboard/page.tsx` shows:

- 8 KPI tiles (`KpiCard.tsx`): total users, KYC pending, listings, orders today, commission MTD, etc.
- Attention queues (pending KYC, flagged listings, disputes).
- "Recent activity" feed.
- A commission sparkline (static SVG today; `recharts` is in `package.json` but not yet rendering live data).

All values are mock. When `GET /admin/dashboard` ships, replace the constants with `useApi(...)` calls.

## Certificates section (live)

Two pages: the list and the detail.

### List (`/certificates`)

- Tabs: Pending / Verified / Rejected / All. Each tab triggers a fresh fetch via `certificatesService.list({ status })`.
- Table columns: issuer / type / linked listing / seller / status / submitted date.
- Click a row → `/certificates/[id]`.

### Detail (`/certificates/[id]`)

- Image preview (presigned read URL from `/uploads/presigned-url`).
- Metadata card (type, issuer, dates).
- Linked listing + seller card.
- **Approve** button: `certificatesService.verify(id, { status: 'verified' })`.
- **Reject** button: opens `ConfirmDialog` with a required-reason textarea; calls `verify(id, { status: 'rejected', rejectionReason })`.
- If already rejected, shows the rejection reason as a banner.

This moderation pattern is now used across multiple live sections (users, listings, certificates, orders). Continue reusing it for new admin workflows.

## Single source-of-truth status (backend + admin web)

**Last verified date:** 2026-05-12  
**Verified against paths:** `README.md`, `FILE_MAP.md`, `backend/src/modules/admin/admin.controller.ts`, `admin/src/app/(admin)/**`, `admin/src/services/*.ts`

### 1) Admin endpoints

| Area | Endpoints | Status | Notes |
|---|---|---|---|
| Users | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/kyc`, `PATCH /admin/users/:id/suspend`, `PATCH /admin/users/:id/unsuspend` | implemented | Controller + service clients are wired. |
| Listings moderation | `GET /admin/listings`, `GET /admin/listings/:id`, `PATCH /admin/listings/:id/flag`, `PATCH /admin/listings/:id/unflag`, `DELETE /admin/listings/:id` | implemented | Includes explicit unflag endpoint. |
| Certificates queue | `GET /admin/certificates` | implemented | Review action is currently via shared certificates endpoint (`PATCH /certificates/:id/verify`). |
| Orders & disputes | `GET /admin/orders`, `GET /admin/orders/:id`, `POST /admin/orders/:id/release`, `POST /admin/orders/:id/refund` | implemented | Dispute actions are order-scoped. |
| Payments & revenue | `GET /admin/payments`, `GET /admin/revenue` | implemented | Wired in `payments.service.ts`. |
| Dashboard aggregate API | `GET /admin/dashboard` | not implemented | Still referenced in docs/UX plans but absent from `AdminController`. |

### 2) Admin dashboard pages

| Route group | Status | Notes |
|---|---|---|
| `/dashboard` | implemented (partial data) | Page exists, currently mock-driven KPI/activity data. |
| `/users`, `/users/[id]` | implemented | Connected to admin users endpoints. |
| `/listings`, `/listings/[id]` | implemented | Connected to admin listings moderation endpoints. |
| `/certificates`, `/certificates/[id]` | implemented | Queue + detail moderation flow live. |
| `/orders`, `/orders/[id]` | implemented | Includes release/refund controls in detail flow. |
| `/payments` | implemented | Uses `/admin/payments` + `/admin/revenue`. |
| `/settings` | not implemented | Still an open foundation item (needed for admin TOTP setup/enable UX). |

### 3) Foundation loose ends (still open)

| Item | Status |
|---|---|
| Settings page for admin TOTP setup/enable | not implemented |
| Move admin cookies to HttpOnly server-managed flow | not implemented |
| Real i18n + RTL wiring (`next-intl`) | not implemented |
| `@nestjs/throttler` on `/auth/admin/login` + `/auth/otp/send` | not implemented |
| Dashboard sparkline migration from static SVG to live chart data | partial |
| Audit log endpoint + dashboard link target | not implemented |
| Production hosting hardening (ECS service + domain rollout) | partial |

## API coverage status

Admin endpoint set (implemented):

| # | Endpoint | Purpose | Status |
|---|---|---|---|
| 1 | `GET /admin/dashboard` | KPI aggregates | shipped |
| 2 | `GET /admin/users` | List + filter | **shipped (service ready, controller wired)** |
| 3 | `GET /admin/users/:id` | Profile + KYC docs | shipped |
| 4 | `PATCH /admin/users/:id/kyc` | Approve / reject | shipped |
| 5 | `PATCH /admin/users/:id/suspend` / `/unsuspend` | Suspend | shipped |
| 6 | `GET /admin/listings` | Index incl. flagged | shipped |
| 7 | `PATCH /admin/listings/:id/flag` | Set FLAGGED | shipped |
| 8 | `DELETE /admin/listings/:id` | Force-remove | shipped |
| 9 | `GET /admin/certificates` | Queue with filters | **shipped** |
| 10 | `GET /admin/orders` | Index across users | shipped |
| 11 | `POST /admin/payments/:id/release` | Force-release for disputes | shipped |
| 12 | `GET /admin/payments` + `GET /admin/revenue` | Ledger + commissions | shipped |

Frontend sections consuming these endpoints are now live. Next work focuses on hardening and production-readiness (auth cookie model, throttling, audit logs, and live KPI quality).

## Component patterns to follow

When you add a new section:

1. **List page** (`page.tsx`):
   - Status tabs at the top.
   - `FilterBar` with a `SearchInput`.
   - `DataTable` for results with pagination at the bottom.
   - "Empty state" placeholder when no results.
   - Loading skeletons via `LoadingState`.

2. **Detail page** (`[id]/page.tsx`):
   - `Header` with breadcrumbs + the user/listing/order title.
   - Left: primary card (the thing you're managing).
   - Right: metadata cards.
   - Bottom action bar with primary (Approve / Verify) and secondary (Reject / Suspend) buttons.
   - Reject button always opens a `ConfirmDialog` with a required-reason field.

3. **Confirmation pattern**: every destructive or irreversible action goes through `ConfirmDialog`. If the action has a reason field, set `requireReason={true}` and the dialog shows a textarea.

4. **Status display**: use `StatusBadge` — it maps every backend enum (`OrderStatus`, `KycStatus`, `EscrowStatus`, etc.) to a consistent colour.

## Loose ends on the foundation itself

From the root README, ordered by ease:

- **Settings page with TOTP enable UI** — backend already supports `/auth/admin/totp/setup` and `/enable`. Build a Settings page that calls `setup` (render the QR via `qrcode.react` or similar), then `enable` on code confirmation.
- **Replace mock sparkline with real Recharts** — deps already declared.
- **Real i18n** — `next-intl` for ar/tr/en, including RTL via `dir="rtl"` and Tailwind logical properties. Today the sidebar language toggle is UI-only.
- **HttpOnly cookies via a Server Action / Route Handler** — currently non-HttpOnly so the axios interceptor can read them. Move the refresh logic to a server route to flip the cookies.
- **`@nestjs/throttler`** on `/auth/admin/login` and `/auth/otp/send` to cap brute force.
- **Audit log** — the "Open audit log →" link on the dashboard goes nowhere. Backing data and endpoint TBD.

## Cross-references

- [03 — Authentication](03-authentication.md) — admin login + TOTP details.
- [04 — Users & KYC](04-users-and-kyc.md) — backend service methods the Users section will call.
- [09 — Certificates](09-certificates.md) — the model that the live admin section operates on.
