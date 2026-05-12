# Mashia Developer Handbook

This handbook is the canonical onboarding guide for engineers joining Mashia. It explains what the platform does, how it is built, and where to look when you need to change something.

Mashia is a cross-border sheep marketplace for the GCC and Syrian market. It is a three-sided platform: **sellers** list livestock, **buyers** browse and order, and an **escrow** mechanism protects both sides until delivery. **Brokers** can mediate large deals, and **admins** moderate the platform from a separate dashboard.

The product is implemented as three artefacts living in one monorepo:

| Surface | Stack | Folder |
|---|---|---|
| Backend API | NestJS 10, TypeORM, PostgreSQL 16, Redis 7, Socket.io, S3 | `backend/` |
| Mobile app | React Native 0.73, TypeScript, Zustand, Axios, react-native-keychain | `mobile/` |
| Admin dashboard | Next.js 14 App Router, Tailwind CSS | `admin/` |

---

## How to read this handbook

Pick a path based on what you have to do.

| If you are… | Start here |
|---|---|
| Brand new to the project | [00 — Overview](00-overview.md) → [01 — Getting started](01-getting-started.md) → [02 — Architecture](02-architecture.md) |
| Working on login, OTP, JWT or admin TOTP | [03 — Authentication](03-authentication.md) |
| Touching user records, profiles, KYC | [04 — Users & KYC](04-users-and-kyc.md) |
| Implementing a buyer-side feature | [05 — Buyer flow](05-buyer-flow.md) |
| Implementing a seller- or broker-side feature | [06 — Seller flow](06-seller-flow.md) |
| Touching listings | [07 — Listings](07-listings.md) |
| Touching orders, payments, or escrow | [08 — Orders, payments & escrow](08-orders-payments-escrow.md) |
| Working on certificates | [09 — Certificates](09-certificates.md) |
| Working on chat / Socket.io | [10 — Messaging](10-messaging.md) |
| Building admin features | [11 — Admin dashboard](11-admin-dashboard.md) |
| Writing a migration or query | [12 — Database schema](12-database-schema.md) |
| Adding or calling an endpoint | [13 — API reference](13-api-reference.md) |
| Working on screens, navigation, services in the app | [14 — Mobile app](14-mobile-app.md) |
| Adding tests, debugging CI, deploying | [15 — Testing & deployment](15-testing-and-deployment.md) |
| Looking up a domain term | [16 — Glossary](16-glossary.md) |

---

## Reading conventions in this handbook

- File paths are written relative to the repo root, e.g. `backend/src/modules/auth/auth.service.ts`.
- API paths assume the `/api/v1` global prefix is already applied — so `/auth/login` is really mounted at `http://localhost:3000/api/v1/auth/login`.
- "Trader" is shorthand for any non-admin user (buyer, seller, broker). They share one auth flow.
- "User story" identifiers like `G1-US06` map to issues in `docs/requirements/`.

---

## Living documents

This handbook describes the codebase as of the merge of the Certificates admin section (commit `7df038b` on `develop`). When you change a domain (e.g. add an admin endpoint, ship Phase F of the mobile app, swap the escrow stub for a real gateway), update the matching chapter in the same PR. The handbook only earns its keep when it stays accurate.

For project-level planning material (goals, user-story requirements, implementation plans) see the sibling folders `docs/specs/`, `docs/requirements/`, and `docs/plans/`. This handbook is the *engineering* counterpart to those product docs.
