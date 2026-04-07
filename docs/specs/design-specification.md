# Sheep Marketplace Platform — Design Specification

**Date:** 2026-04-06
**Status:** Draft
**Author:** Mohammad Ibrahim (Founder & Lead Dev)

---

## 1. Product Overview

### What It Is
A B2B/B2C mobile marketplace connecting Syrian sheep sellers with buyers across all 6 GCC countries. The platform modernizes livestock trade that currently runs on phone calls, brokers, and personal networks.

### Target Corridor
**Supply:** Syria (primary source — Awassi breed sheep)
**Demand:** Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman

### User Types

| Role | Description |
|---|---|
| **Seller** | Syrian farmers/ranchers listing sheep for export |
| **Buyer** | Gulf-based wholesalers, butchers, restaurants, individual Eid buyers |
| **Broker** | Middlemen who facilitate deals between sellers and buyers |
| **Admin** | Platform operators managing users, disputes, commissions |

### Revenue Model
1. **Commission per transaction** — configurable percentage per transaction (default: 5%, adjustable per user tier or volume via admin dashboard)
2. **Logistics markup** — margin on transport services (partner-based initially, owned fleet later)

### Languages
- Arabic (primary)
- Turkish
- English

---

## 2. Architecture & Tech Stack

### Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (iOS + Android) — migrate to Kotlin/Swift post-traction |
| Admin Dashboard | Next.js (React + TypeScript) |
| Backend API | NestJS (TypeScript) — modular monolith |
| Database | PostgreSQL on AWS RDS (Bahrain `me-south-1`) |
| Cache/Realtime | Redis (ElastiCache) |
| File Storage | AWS S3 (Bahrain) — images, videos, vet certificates |
| Auth | JWT + refresh tokens, SMS OTP (Unifonic or similar MENA provider) |
| Payments | STC Pay, Mada, bank transfers + escrow logic |
| Messaging | Socket.io via Redis adapter |
| Infrastructure | AWS Bahrain region throughout |

### Why AWS Bahrain
- ~10-20ms latency across GCC
- Saudi PDPL data residency compliance
- Full AWS service availability

### Modular Monolith Structure

The monolith is designed with strict module boundaries for future microservice extraction.

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/           → user registration, KYC, JWT, OTP
│   │   ├── users/          → profiles, roles, verification status
│   │   ├── listings/       → sheep listings, search, filters
│   │   ├── orders/         → order lifecycle, status tracking
│   │   ├── payments/       → escrow, commission, payment gateway
│   │   ├── messaging/      → buyer-seller chat, notifications
│   │   ├── certificates/   → vet certificate upload & verification
│   │   └── admin/          → dashboard API, disputes, analytics
│   ├── shared/
│   │   ├── database/       → TypeORM entities, migrations
│   │   ├── guards/         → auth guards, role guards
│   │   ├── interceptors/   → logging, transform
│   │   ├── interfaces/     → cross-module contracts (microservice-ready)
│   │   └── utils/          → common helpers
│   └── config/             → env, database, redis, s3 config
```

### Module Isolation Rules (Microservice-Ready)
1. No direct cross-module database queries — modules talk through service interfaces
2. Each module owns its own DB tables — no shared tables between modules
3. Event-driven communication — NestJS EventEmitter now, RabbitMQ/SQS later
4. Each module has its own DTOs — no shared request/response objects

### Mobile App Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── auth/           → login, register, OTP
│   │   ├── listings/       → browse, search, detail, create
│   │   ├── orders/         → order flow, tracking
│   │   ├── messaging/      → chat list, conversation
│   │   ├── profile/        → user profile, settings
│   │   └── certificates/   → upload, view status
│   ├── services/           → API client per module
│   ├── store/              → state management (Zustand or Redux)
│   ├── components/         → shared UI components
│   ├── i18n/               → ar, tr, en translations
│   └── navigation/         → React Navigation setup (RTL support)
```

### Admin Dashboard Structure

```
admin/
├── src/
│   ├── pages/
│   │   ├── dashboard/      → overview, KPIs
│   │   ├── users/          → manage sellers, buyers, brokers
│   │   ├── listings/       → moderate listings
│   │   ├── orders/         → track orders, disputes
│   │   ├── payments/       → commission tracking, escrow status
│   │   └── analytics/      → revenue, volume, seasonal trends
│   ├── services/           → API client
│   ├── components/         → shared UI
│   └── i18n/               → ar, tr, en
```

---

## 3. Data Model

### Entity Relationships

```
User (1) ──→ (N) Listing
User (1) ──→ (N) Order (as buyer)
User (1) ──→ (N) Order (as seller)
User (1) ──→ (N) Order (as broker, optional)
Listing (1) ──→ (N) Order
Order (1) ──→ (1) Payment
Order (1) ──→ (1) Certificate
User (1) ←──→ (N) Message (conversations)
User (1) ──→ (N) Review
```

### Tables

#### users
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| role | ENUM | seller, buyer, broker, admin |
| full_name | VARCHAR | |
| phone | VARCHAR | primary identifier (OTP login) |
| email | VARCHAR | optional |
| country | VARCHAR | SY, SA, AE, KW, QA, BH, OM |
| city | VARCHAR | |
| kyc_status | ENUM | pending, verified, rejected |
| kyc_documents | JSONB | ID, trade license, etc. |
| preferred_language | ENUM | ar, tr, en |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### listings
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| seller_id | UUID | FK → users |
| title | VARCHAR | trilingual |
| breed | ENUM | awassi, najdi, arabi, shami, other |
| quantity | INT | head count |
| age_months | INT | average age |
| weight_kg | DECIMAL | average weight per head |
| price_per_head | DECIMAL | |
| currency | ENUM | SYP, SAR, AED, USD |
| origin_country | VARCHAR | |
| origin_city | VARCHAR | |
| description | TEXT | |
| images | JSONB | S3 URLs array |
| video_url | VARCHAR | S3 URL |
| health_status | ENUM | certified, pending, unchecked |
| certificate_id | UUID | FK → certificates (nullable) |
| status | ENUM | active, sold, expired, flagged |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### orders
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| listing_id | UUID | FK → listings |
| buyer_id | UUID | FK → users |
| seller_id | UUID | FK → users |
| broker_id | UUID | FK → users (nullable) |
| quantity | INT | heads ordered |
| unit_price | DECIMAL | agreed price per head |
| total_price | DECIMAL | |
| commission_rate | DECIMAL | platform % |
| commission_amount | DECIMAL | |
| status | ENUM | pending, accepted, paid, in_transit, delivered, completed, disputed, cancelled |
| delivery_country | VARCHAR | |
| delivery_city | VARCHAR | |
| delivery_address | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### payments
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| payer_id | UUID | FK → users (buyer) |
| amount | DECIMAL | total amount held |
| seller_amount | DECIMAL | amount after commission |
| commission_amount | DECIMAL | platform earnings |
| method | ENUM | stc_pay, mada, bank_transfer |
| escrow_status | ENUM | held, released, refunded |
| transaction_ref | VARCHAR | gateway reference |
| paid_at | TIMESTAMP | |
| released_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### certificates
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| listing_id | UUID | FK → listings |
| uploaded_by | UUID | FK → users |
| type | ENUM | health, export, import, halal |
| file_url | VARCHAR | S3 URL |
| issuing_authority | VARCHAR | |
| issue_date | DATE | |
| expiry_date | DATE | |
| verification_status | ENUM | pending, verified, rejected |
| verified_by | UUID | FK → users (admin) |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### conversations
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| participant_ids | UUID[] | buyer + seller (+ broker) |
| listing_id | UUID | FK → listings (nullable) |
| order_id | UUID | FK → orders (nullable) |
| created_at | TIMESTAMP | |

#### messages
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| sender_id | UUID | FK → users |
| content | TEXT | |
| type | ENUM | text, image, certificate, offer |
| read_at | TIMESTAMP | nullable |
| created_at | TIMESTAMP | |

#### reviews
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| reviewer_id | UUID | FK → users |
| reviewed_id | UUID | FK → users |
| rating | INT | 1-5 |
| comment | TEXT | |
| created_at | TIMESTAMP | |

---

## 4. MVP Feature Flows

### 4.1 — User Registration & KYC

```
Phone + OTP → Select Role (seller/buyer/broker)
  → Fill profile (name, country, city)
  → Upload KYC docs (ID, trade license for sellers/brokers)
  → Status: pending verification
  → Admin verifies → kyc_status: verified
  → User can now trade
```

- Sellers/brokers cannot list or transact until KYC is verified
- Buyers can browse and message but cannot place orders until verified
- SMS OTP via regional provider (e.g., Unifonic)

### 4.2 — Listing Creation (Seller Flow)

```
Seller → "Create Listing"
  → Select breed (Awassi, Najdi, Arabi, Shami, Other)
  → Enter: quantity, age, weight, price per head, currency
  → Upload photos (min 2, max 10) + optional video
  → Upload veterinary certificate (optional at creation, required before order completion)
  → Set origin location (city, country)
  → Submit → status: active
  → Admin can flag/remove inappropriate listings
```

### 4.3 — Search & Discovery (Buyer Flow)

```
Buyer → Browse/Search
  → Filter by: breed, price range, quantity, origin, health status
  → Sort by: newest, price low→high, price high→low
  → View listing detail: photos, video, breed info, seller profile, rating
  → Actions: message seller, make offer, save to favorites
```

### 4.4 — Negotiation & Order Flow

```
Buyer messages Seller (or Broker facilitates)
  → Negotiate price, quantity, delivery terms
  → Buyer places order (quantity, agreed price, delivery address)
  → Seller accepts/rejects
  → If accepted → order status: accepted
  → Buyer pays into escrow
  → Escrow status: held
  → Seller arranges transport (manual in Phase 1)
  → Seller marks as "in transit"
  → Buyer confirms delivery
  → Escrow releases: seller_amount to seller, commission to platform
  → Both parties can leave reviews
```

### 4.5 — Payment & Escrow Flow

```
Buyer initiates payment
  → Selects method: STC Pay / Mada / Bank Transfer
  → Payment processed → escrow_status: held
  → Platform holds funds
  → On delivery confirmation by buyer:
      → seller_amount = total - commission
      → Release to seller
      → commission_amount credited to platform
  → Dispute? → Admin intervenes, can refund or release
  → Auto-release after 7 days if buyer doesn't confirm/dispute
```

### 4.6 — Veterinary Certificates

```
Seller uploads certificate
  → type: health / export / import / halal
  → Includes issuing authority, dates
  → Admin verifies authenticity
  → verification_status: verified
  → Linked to listing → health_status: certified
  → Buyers can view certificate on listing
  → Expired certificates auto-flagged
```

### 4.7 — In-App Messaging

```
Buyer taps "Message Seller" on listing
  → Conversation created (linked to listing)
  → Real-time chat via Socket.io
  → Message types: text, image, certificate share, price offer
  → Push notifications for new messages
  → After order placed, conversation links to order
  → Broker can join conversation if involved
```

### 4.8 — Admin Dashboard

```
Dashboard home → KPIs: active users, listings, orders, revenue, disputes
  → User management: verify KYC, suspend/ban users
  → Listing moderation: flag, remove inappropriate listings
  → Order oversight: view all orders, intervene in disputes
  → Payment tracking: escrow status, commission earned, payouts
  → Certificate verification: approve/reject uploaded certs
```

---

## 5. Phase 2 Features (Post-MVP)

To be built after initial traction and market validation:

1. **Logistics Booking** — in-app transport quotes, real-time tracking, delivery confirmation (partner-based → owned fleet)
2. **Ratings & Reviews** — full review system with seller/buyer reputation scores
3. **Eid/Hajj Demand Forecasting** — seasonal alerts, price trend analytics, demand heatmaps
4. **Advanced Admin Analytics** — revenue dashboards, user growth, conversion funnels

---

## 6. Non-Functional Requirements

### Security
- JWT + refresh token rotation for auth
- SMS OTP — rate-limited (5 attempts per hour)
- Role-based access control (RBAC) — seller, buyer, broker, admin
- Encrypted file storage — S3 server-side encryption for certificates and KYC docs
- HTTPS everywhere — TLS 1.3
- Input validation — NestJS pipes + class-validator on all endpoints
- SQL injection protection — TypeORM parameterized queries
- Saudi PDPL compliance — all data stored in AWS Bahrain region

### Performance Targets
- API response time: < 200ms (p95) within GCC
- Chat message delivery: < 500ms
- Image upload: < 5s for 5MB photo
- Search results: < 300ms with filters
- App cold start: < 3s

### Scalability Path

| Stage | Users | Architecture |
|---|---|---|
| MVP | 0–1,000 | Monolith, single RDS instance, 1 EC2/ECS |
| Growth | 1K–10K | Add read replicas, Redis cluster, CDN for media |
| Scale | 10K–100K | Extract messaging + payments into microservices |
| Mature | 100K+ | Full microservices, event-driven (RabbitMQ/SQS), owned fleet logistics module |

### Deployment
- Containerized — Docker for all services
- AWS ECS Fargate (Bahrain) — serverless containers
- CI/CD — GitHub Actions → build → test → deploy to ECS
- Database — RDS PostgreSQL Multi-AZ for failover
- CDN — CloudFront for static assets and media files
- Monitoring — CloudWatch + Sentry for error tracking
- Logging — structured JSON logs → CloudWatch Logs

### RTL Support
- Arabic UI requires full RTL layout
- React Native `I18nManager.forceRTL()` for mobile
- Next.js `dir="rtl"` with CSS logical properties for admin
- All text inputs support Arabic/Turkish character sets

### Push Notifications
- Firebase Cloud Messaging (FCM) for both iOS and Android
- Triggers: new message, order status change, KYC approval, listing flagged, payment released
