# 00 — Overview

## What is Mashia?

Mashia is a **cross-border livestock marketplace** for sheep, focused on flows between Syria (the main supply side) and the GCC countries — Saudi Arabia, the UAE, and Kuwait (the main demand side). The product:

1. Lets a verified **seller** publish a listing (breed, quantity, weight, price, photos, optionally a vet certificate).
2. Lets a verified **buyer** browse listings and place an order.
3. Holds the buyer's payment **in escrow** until the order is marked as delivered.
4. Releases funds to the seller once delivery is confirmed (with a 7-day auto-release as backstop).
5. Optionally lets a **broker** mediate deals (currently modelled in `orders.broker_id` but not yet wired through any UI).
6. Lets **admins** verify KYC, approve vet certificates, suspend bad actors, refund disputes, and read commission ledgers from a separate web dashboard.

The product also includes a real-time **chat** (Socket.io) for negotiation and a system of **vet certificates** that admins verify out of band.

## Why "three-sided" matters

Most flows in the codebase only make sense if you keep three sides in mind:

```
+---------+   list   +---------+   order   +---------+
| seller  | -------> | listing | <-------- |  buyer  |
+---------+          +---------+           +---------+
                                                |
                                                | initiate payment (held)
                                                v
                                          +----------+
                                          | payment  |
                                          |  escrow  |
                                          +----------+
                                            |     |
                              release       |     |  refund
                              (delivered)   |     |  (disputed)
                                            v     v
                                         seller   buyer
```

Both buyer and seller carry KYC obligations, both can dispute, both have visibility into the order. Authorisation in every endpoint asks "is this user the **buyer**, **seller**, or **broker** on this order?" — never "is this user the owner of this record?" in a single-tenant sense.

## Domain primitives (one-line each)

| Concept | One-liner | Source of truth |
|---|---|---|
| **Trader** | Any non-admin user (seller / buyer / broker) — they all log in with phone + OTP | `users` table, `role` ∈ `{seller, buyer, broker}` |
| **Admin** | Internal staff member — logs in with email + password + optional TOTP | `users` table, `role = admin`, `password_hash` set |
| **KYC** | Identity verification submitted as document images, reviewed by an admin | `users.kyc_status`, `users.kyc_documents` |
| **Listing** | A "I have N sheep of breed X to sell" advert with photos | `listings` |
| **Order** | A "I want to buy N of those" commitment that runs through a status machine | `orders`, see [chapter 08](08-orders-payments-escrow.md) |
| **Payment** | An escrow record tied to exactly one order | `payments` (unique index on `order_id`) |
| **Certificate** | A vaccination / health / origin certificate attached to a listing | `certificates` |
| **Conversation / Message** | A chat thread between users, optionally scoped to a listing or order | `conversations`, `messages` |

## Project goals (where we are today)

Three engineering goals, each with its own user-story doc in `docs/requirements/`.

| Goal | Done | In progress |
|---|---|---|
| **G1 — Backend API** | 9 modules, 322 tests passing, admin module bootstrapped | AWS provisioning (RDS / Redis / S3 / ECS), payment gateway, full admin endpoint set |
| **G2 — Mobile app** | Phases A–E (design system, auth, all core screens, certificates) | Phase F: i18n, RTL, push notifications |
| **G3 — Admin dashboard** | Login (with TOTP), dashboard, Certificates section live | Users/KYC, Listings moderation, Orders/dispute, Payments/revenue |

The `README.md` at the repo root has the authoritative status board and the open-issue mapping.

## The shape of the code

```
mashia/
├── backend/          NestJS modular monolith — 9 feature modules under src/modules/
│   ├── src/modules/  auth, users, kyc, uploads, listings, orders, payments,
│   │                 certificates, messaging, admin
│   ├── src/shared/   guards, decorators, S3, Redis, SMS, event contracts
│   └── db/migrations TypeORM migrations (Init, AdminAuth, CreateCertificates, …)
├── mobile/           React Native 0.73 — feature-screens under src/screens/, one
│   └── src/          service per backend module under src/services/
├── admin/            Next.js 14 App Router — pages under src/app/(admin)/
│   └── src/
├── docs/             Specs, requirements, plans, and this handbook
├── infra/            AWS task defs and config notes (not yet provisioned)
└── docker-compose.yml  PostgreSQL 16 + Redis 7 + LocalStack S3 for local dev
```

## One paragraph to take away

Mashia is a NestJS API in front of a single PostgreSQL database, with two clients — a React Native app for traders and a Next.js dashboard for admins. Auth uses phone-OTP for traders and email+password (+ optional TOTP) for admins, with short-lived JWT access tokens and refresh-token rotation backed by Redis. The business state machine is roughly `listing → order (pending→accepted→paid→in_transit→delivered→completed)`, with `payment.escrow_status` (`held → released | refunded`) running in lock-step via internal events. Everything else (KYC, certificates, chat, admin moderation) attaches to those primitives.

Read [01 — Getting started](01-getting-started.md) next to get the stack running on your machine, then [02 — Architecture](02-architecture.md) for the why behind the structure.
