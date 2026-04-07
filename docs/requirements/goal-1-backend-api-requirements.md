# Goal 1 Requirements: Production-Ready Backend API

**Goal:** Deliver a fully tested, containerized NestJS backend with all 8 modules deployed on AWS ECS Bahrain.
**Traces to:** Ultimate Goal → Goal 1

---

## G1-US01: User Registration & Authentication

> **As a** new user (seller/buyer/broker), **I want to** register with my phone number and verify via OTP, **so that** I can securely access the platform.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US01-01 | Implement SMS OTP generation and storage in Redis with 5-min expiry | Backend | Must |
| G1-US01-02 | Implement OTP verification endpoint with rate limiting (5 attempts/hour) | Backend | Must |
| G1-US01-03 | Implement user registration endpoint (phone, role, name, country, city) | Backend | Must |
| G1-US01-04 | Implement JWT access token (15min) + refresh token (7d) generation | Backend | Must |
| G1-US01-05 | Implement token refresh endpoint with rotation | Backend | Must |
| G1-US01-06 | Implement JWT strategy for Passport with user lookup | Backend | Must |
| G1-US01-07 | Write unit tests for auth controller (send OTP, register, login, refresh) | Test | Must |

---

## G1-US02: KYC Verification

> **As a** seller or broker, **I want to** upload my identity documents, **so that** the platform can verify me and I can start trading.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US02-01 | Implement KYC document upload endpoint with S3 storage | Backend | Must |
| G1-US02-02 | Implement KYC status tracking (pending/verified/rejected) on user entity | Backend | Must |
| G1-US02-03 | Add KYC guard — block sellers/brokers from listing/transacting until verified | Backend | Must |
| G1-US02-04 | Add KYC guard — block buyers from placing orders until verified (browsing/messaging allowed) | Backend | Must |
| G1-US02-05 | Write unit tests for KYC upload and status transitions | Test | Must |

---

## G1-US03: User Profile Management

> **As a** registered user, **I want to** view and update my profile, **so that** my information stays accurate and buyers/sellers can trust me.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US03-01 | Implement GET /users/me endpoint returning full profile | Backend | Must |
| G1-US03-02 | Implement PATCH /users/me endpoint for updating name, email, city, language | Backend | Must |
| G1-US03-03 | Validate language preference is one of (ar, tr, en) | Backend | Must |
| G1-US03-04 | Write unit tests for profile retrieval and update | Test | Must |

---

## G1-US04: Livestock Listing Creation

> **As a** verified seller, **I want to** create a listing for my sheep with details, photos, and pricing, **so that** Gulf buyers can discover and purchase them.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US04-01 | Implement Listing entity with all fields (breed, quantity, age, weight, price, currency, origin, images, video, status) | Backend | Must |
| G1-US04-02 | Implement POST /listings endpoint restricted to verified sellers | Backend | Must |
| G1-US04-03 | Validate minimum 2 images, maximum 10 images per listing | Backend | Must |
| G1-US04-04 | Implement PATCH /listings/:id restricted to listing owner | Backend | Must |
| G1-US04-05 | Implement DELETE /listings/:id restricted to listing owner | Backend | Must |
| G1-US04-06 | Write unit tests for listing CRUD operations | Test | Must |

---

## G1-US05: Livestock Search & Discovery

> **As a** buyer, **I want to** search and filter livestock listings by breed, price, origin, and health status, **so that** I can find exactly what I need.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US05-01 | Implement GET /listings with pagination (default 20 per page) | Backend | Must |
| G1-US05-02 | Add filter by breed (awassi, najdi, arabi, shami, other) | Backend | Must |
| G1-US05-03 | Add filter by price range (min/max) | Backend | Must |
| G1-US05-04 | Add filter by minimum quantity | Backend | Must |
| G1-US05-05 | Add filter by origin country and health status | Backend | Must |
| G1-US05-06 | Add sort options: newest, price ascending, price descending | Backend | Must |
| G1-US05-07 | Implement GET /listings/:id with seller profile joined | Backend | Must |
| G1-US05-08 | Write unit tests for search with various filter combinations | Test | Must |

---

## G1-US06: Order Placement & Lifecycle

> **As a** verified buyer, **I want to** place an order on a listing with my delivery details, **so that** the seller knows what I want and where to ship.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US06-01 | Implement Order entity with full lifecycle status enum | Backend | Must |
| G1-US06-02 | Implement POST /orders — buyer places order with quantity, agreed price, delivery address | Backend | Must |
| G1-US06-03 | Auto-calculate total_price and commission_amount (5% default) on order creation | Backend | Must |
| G1-US06-04 | Implement PATCH /orders/:id/status — seller accepts/rejects, buyer confirms delivery | Backend | Must |
| G1-US06-05 | Enforce valid status transitions (pending→accepted, accepted→paid, etc.) | Backend | Must |
| G1-US06-06 | Implement GET /orders — return orders for current user (as buyer, seller, or broker) | Backend | Must |
| G1-US06-07 | Emit order.created and order.delivered events via EventEmitter | Backend | Should |
| G1-US06-08 | Write unit tests for order creation, status transitions, and access control | Test | Must |

---

## G1-US07: Escrow Payment System

> **As a** buyer, **I want to** pay into escrow using my preferred method (STC Pay/Mada/bank transfer), **so that** my money is protected until I confirm delivery.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US07-01 | Implement Payment entity with escrow status (held/released/refunded) | Backend | Must |
| G1-US07-02 | Implement POST /payments/initiate — hold buyer funds in escrow | Backend | Must |
| G1-US07-03 | Implement EscrowService with holdFunds/releaseFunds/refundFunds (stub for MVP, real gateway integration later) | Backend | Must |
| G1-US07-04 | Implement POST /payments/release — release funds to seller after delivery confirmation | Backend | Must |
| G1-US07-05 | Implement refund flow for disputed orders | Backend | Must |
| G1-US07-06 | Implement auto-release after 7 days if buyer doesn't confirm or dispute | Backend | Should |
| G1-US07-07 | Calculate seller_amount = total - commission on every payment | Backend | Must |
| G1-US07-08 | Emit payment.completed event via EventEmitter | Backend | Should |
| G1-US07-09 | Write unit tests for escrow hold, release, refund flows | Test | Must |

---

## G1-US08: Veterinary Certificate Management

> **As a** seller, **I want to** upload veterinary certificates for my livestock, **so that** buyers can trust the health status and legal compliance of my sheep.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US08-01 | Implement Certificate entity with type (health/export/import/halal), issuing authority, dates | Backend | Must |
| G1-US08-02 | Implement POST /certificates — seller uploads certificate linked to a listing | Backend | Must |
| G1-US08-03 | Implement GET /certificates/listing/:id — return all certificates for a listing | Backend | Must |
| G1-US08-04 | Implement PATCH /certificates/:id/verify — admin approves/rejects | Backend | Must |
| G1-US08-05 | On verification, update linked listing health_status to "certified" via event | Backend | Should |
| G1-US08-06 | Flag certificates past expiry_date automatically | Backend | Should |
| G1-US08-07 | Write unit tests for certificate upload, retrieval, and verification | Test | Must |

---

## G1-US09: Real-Time Messaging

> **As a** buyer, **I want to** message a seller directly from their listing, **so that** I can negotiate price, quantity, and delivery terms before placing an order.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US09-01 | Implement Conversation entity with participant_ids array and optional listing/order link | Backend | Must |
| G1-US09-02 | Implement Message entity with type (text/image/certificate/offer) and read_at | Backend | Must |
| G1-US09-03 | Implement POST /messaging/conversations — create or return existing conversation | Backend | Must |
| G1-US09-04 | Implement GET /messaging/conversations — list user's conversations | Backend | Must |
| G1-US09-05 | Implement GET /messaging/conversations/:id/messages — fetch message history | Backend | Must |
| G1-US09-06 | Implement Socket.io gateway — joinConversation, sendMessage, markRead events | Backend | Must |
| G1-US09-07 | Broadcast new messages to all conversation participants via Socket.io rooms | Backend | Must |
| G1-US09-08 | Verify sender is a participant before allowing message send | Backend | Must |
| G1-US09-09 | Write unit tests for messaging gateway and service | Test | Must |

---

## G1-US10: Admin Platform Management

> **As an** admin, **I want to** manage users, verify KYC, moderate listings, oversee orders, and track revenue, **so that** the platform runs safely and profitably.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US10-01 | Implement GET /admin/dashboard — return KPIs (users, listings, orders, revenue, disputes, pending KYC/certs) | Backend | Must |
| G1-US10-02 | Implement GET /admin/users — paginated user list with role/KYC filters | Backend | Must |
| G1-US10-03 | Implement PATCH /admin/users/:id/kyc — approve or reject KYC | Backend | Must |
| G1-US10-04 | Implement PATCH /admin/users/:id/suspend — suspend a user | Backend | Must |
| G1-US10-05 | Implement GET /admin/orders — paginated order list with status filter | Backend | Must |
| G1-US10-06 | Implement PATCH /admin/listings/:id/flag — flag inappropriate listing | Backend | Must |
| G1-US10-07 | All admin endpoints restricted to UserRole.ADMIN via RolesGuard | Backend | Must |
| G1-US10-08 | Write unit tests for dashboard KPIs, user management, listing moderation | Test | Must |

---

## G1-US11: Infrastructure & Deployment

> **As a** developer, **I want to** have a containerized, tested, and auto-deployed backend, **so that** the API runs reliably in production on AWS Bahrain.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G1-US11-01 | Create docker-compose.yml for local dev (PostgreSQL + Redis) | DevOps | Must |
| G1-US11-02 | Create backend Dockerfile (multi-stage build) | DevOps | Must |
| G1-US11-03 | Configure TypeORM migrations for production (synchronize=false) | Backend | Must |
| G1-US11-04 | Set up GitHub Actions CI pipeline: lint → test → build | DevOps | Must |
| G1-US11-05 | Set up GitHub Actions CD pipeline: push Docker image → deploy to ECS Fargate Bahrain | DevOps | Must |
| G1-US11-06 | Configure AWS RDS PostgreSQL Multi-AZ in me-south-1 | DevOps | Must |
| G1-US11-07 | Configure AWS ElastiCache Redis in me-south-1 | DevOps | Must |
| G1-US11-08 | Configure S3 bucket with server-side encryption in me-south-1 | DevOps | Must |
| G1-US11-09 | Set up CloudWatch monitoring + Sentry error tracking | DevOps | Should |
| G1-US11-10 | Configure CloudFront CDN for media files | DevOps | Should |
| G1-US11-11 | Set up structured JSON logging to CloudWatch Logs | DevOps | Should |

---

## Summary

| User Story | Issues | Must | Should |
|---|---|---|---|
| G1-US01: Registration & Auth | 7 | 7 | 0 |
| G1-US02: KYC Verification | 5 | 5 | 0 |
| G1-US03: Profile Management | 4 | 4 | 0 |
| G1-US04: Listing Creation | 6 | 6 | 0 |
| G1-US05: Search & Discovery | 8 | 8 | 0 |
| G1-US06: Order Lifecycle | 8 | 6 | 2 |
| G1-US07: Escrow Payments | 9 | 7 | 2 |
| G1-US08: Certificates | 7 | 5 | 2 |
| G1-US09: Real-Time Messaging | 9 | 9 | 0 |
| G1-US10: Admin Management | 8 | 8 | 0 |
| G1-US11: Infrastructure | 11 | 8 | 3 |
| **Total** | **82** | **73** | **9** |
