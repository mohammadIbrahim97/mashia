# 01 — Getting Started

This chapter walks you from a clean checkout to a running stack you can sign in to. Allow ~30 minutes the first time, mostly because of `npm install` weight on three projects.

## Prerequisites

| Tool | Why | Min version |
|---|---|---|
| Docker Desktop | Runs PostgreSQL 16, Redis 7, and LocalStack (S3) | Current |
| Node.js | Backend, mobile, and admin all build with Node | **20.x** |
| Java + Android Studio | Android emulator for the mobile app | API 33+ |
| Xcode (macOS only) | iOS simulator for the mobile app | Latest |
| `psql` client (optional) | Inspect the database, run ad-hoc queries | Any |

You do **not** need any AWS account. Everything works against `localhost` thanks to LocalStack.

## 1. Clone and explore

```bash
git clone <repo-url> mashia
cd mashia
ls
# admin/  backend/  design/  docs/  infra/  mobile/  docker-compose.yml  README.md
```

The repo is a non-workspace polyrepo: each of `backend/`, `mobile/`, `admin/` has its own `package.json` and `node_modules`. There is no top-level `npm install`.

## 2. Start infrastructure

```bash
docker compose up -d
```

This starts three containers (see `docker-compose.yml`):

| Container | Image | Port | Purpose |
|---|---|---|---|
| `mashia-db` | `postgres:16-alpine` | 5432 | Primary database |
| `mashia-redis` | `redis:7-alpine` | 6379 | OTP store, refresh-token blacklist, admin TOTP tickets |
| `mashia-localstack` | `localstack/localstack:3.0` | 4566 | S3 stand-in for KYC and listing image uploads |

Defaults from `.env.example`: DB `sheep_marketplace`, user `sheep_user`, password `sheep_pass_dev`. Tweak in your `.env` if you need to.

## 3. Configure environment

Copy the template and edit values:

```bash
cp .env.example backend/.env
```

The minimum `.env` you need to run the backend:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sheep_user
DB_PASSWORD=sheep_pass_dev
DB_NAME=sheep_marketplace
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-secret
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=dev-refresh
JWT_REFRESH_EXPIRATION=7d
AWS_REGION=me-south-1
AWS_S3_BUCKET=mashia-files
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
PORT=3000
NODE_ENV=development
```

> Use a long random string for `JWT_SECRET` and `JWT_REFRESH_SECRET` in **any** shared environment (staging, production). The `dev-secret` values above are only safe locally.

## 4. Backend

```bash
cd backend
npm install
npm run migration:run     # apply TypeORM migrations against the docker DB
npm run start:dev         # http://localhost:3000  (Pino pretty-printed logs)
```

The first start can take a few seconds while Nest compiles. You should see:

```
[Nest] LOG [NestApplication] Nest application successfully started
Mashia API running on port 3000
```

All endpoints live under the `/api/v1` prefix (see `backend/src/main.ts`). Smoke-test:

```bash
curl http://localhost:3000/api/v1/listings   # → {"success":true,"data":{"data":[],"total":0,...}}
```

### Seed demo users

For mobile testing you'll want a buyer, a seller, and a broker that already have **KYC verified**, so you can skip the upload flow.

```bash
cd backend
node scripts/seed-demo-users.js
```

Output:

```
Demo users ready:

  +966500001001  buyer    Khalid Al-Mutairi
                  Riyadh, SA

  +966500001002  seller   Yusuf Haddad
                  Damascus, SY

  +966500001003  broker   Sara Al-Sabah
                  Kuwait City, KW
```

In dev, OTPs are sent to the console (no real SMS provider, see [03 — Authentication](03-authentication.md)). To sign in: enter the phone, tap "Send code", grep the backend log for `[SMS] OTP for +966500001001: 123456`, then enter that code.

### Create an admin

`/auth/register` deliberately blocks the `ADMIN` role. Use the bootstrap script:

```bash
cd backend
node scripts/create-admin.js
# prompts: email, password (≥12 chars), confirm, full name, country, city,
# then asks "Set up TOTP now? [Y/n]"
```

Answer **n** to the TOTP prompt if you don't want to scan a QR right now — you can enable TOTP later through `POST /auth/admin/totp/setup` + `/enable`. Re-running the script with the same email is idempotent (it updates the password).

## 5. Admin dashboard

```bash
cd admin
npm install
npm run dev      # http://localhost:3001
```

Sign in at `http://localhost:3001/login` with the email + password you set above.

`admin/src/middleware.ts` redirects to `/login` if there's no `access_token` cookie. The cookie is *not* HttpOnly today (so the axios interceptor can read it for refresh-on-401); see the auth-hardening list in the root `README.md`.

## 6. Mobile app

### Android

```bash
cd mobile
npm install

# Terminal 1 — Metro
npm start

# Terminal 2 — build & install on emulator
npm run android
```

If the emulator can't reach the backend at `localhost:3000`, override `API_BASE_URL`. The default lives in `mobile/src/config.ts`. For Android emulator that talks to host-machine `localhost`, use `http://10.0.2.2:3000`.

### iOS (macOS only)

```bash
cd mobile/ios
pod install
cd ..
npm run ios
```

In Metro: press `r` to reload, `d` for dev menu.

## 7. Verify the full loop

A 5-minute smoke test that exercises auth → KYC → listing → order → escrow:

1. Sign in as `+966500001002` (seller, already KYC-verified).
2. Create a listing from the Profile → My Listings → "+" screen.
3. Sign out, sign in as `+966500001001` (buyer, already KYC-verified).
4. Open the listing from Home, tap "Place order", complete the form.
5. Pick a payment method on the next screen (any — escrow is stubbed).
6. Sign back in as the seller, go to Orders, accept the order (`PENDING → ACCEPTED`).
7. Switch to buyer, initiate payment (`payment.held` event → order auto-transitions to `PAID`).
8. Switch back to seller, mark `IN_TRANSIT` then watch buyer mark `DELIVERED`.
9. Buyer hits "Release payment" (or just wait 7 days — there's an auto-release cron).

If any of these break, check the backend logs first — the structured pino logger usually points right at the failed listener.

## 8. Common gotchas

| Symptom | Likely cause |
|---|---|
| Backend won't start, "ECONNREFUSED" to 5432 | `docker compose up -d` not run, or postgres still booting (wait 10s) |
| `POST /auth/otp/send` returns "Too many OTP requests" | Hit the rate-limit (5 per phone per hour). Clear with `docker exec -it mashia-redis redis-cli FLUSHDB` |
| Mobile app can't reach API | Wrong `API_BASE_URL` for emulator. Use `10.0.2.2` on Android emulator, `localhost` on iOS sim |
| `KYC verification required` 403 on listing or order create | The user isn't KYC-verified. Either use a demo user (already verified) or POST docs to `/kyc/submit` and flip `kyc_status` in the DB |
| Admin login returns `{requiresTotp: true, ticket}` | Account has TOTP enabled. Call `POST /auth/admin/totp/verify` with the ticket and a 6-digit code, or recreate the admin without TOTP |
| `listing.deleted_at` rows show up in queries | They shouldn't — TypeORM `softDelete()` and `@DeleteDateColumn` filter them by default. If you see them you bypassed the repository (raw query / migration) |

## 9. Where to go next

- [02 — Architecture](02-architecture.md) — the why behind the modular monolith
- [03 — Authentication](03-authentication.md) — how OTP + JWT + TOTP fit together
- [13 — API reference](13-api-reference.md) — pick an endpoint and trace it
