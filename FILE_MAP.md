# Mashia — Project File Map

**Complete file structure for the Sheep Marketplace Platform**

---

## Root

```
mashia/
├── docs/                                               ← Project documentation
├── backend/                                            ← NestJS modular monolith API
├── mobile/                                             ← React Native app (iOS + Android)
├── admin/                                              ← Next.js admin dashboard
├── docker-compose.yml                                  ← Local dev (PostgreSQL + Redis)
├── .env.example                                        ← Environment variable template
├── .gitignore                                          ← Git ignore rules
├── FILE_MAP.md                                         ← This file
└── README.md                                           ← Project overview
```

---

## Documentation

```
docs/
├── README.md                                           ← Document index
├── project-goals.md                                    ← Ultimate goal + 3 main goals
├── specs/
│   └── design-specification.md                         ← Full product spec
├── requirements/
│   ├── goal-1-backend-api-requirements.md              ← 11 user stories, 82 issues
│   ├── goal-2-mobile-app-requirements.md               ← 12 user stories, 67 issues
│   └── goal-3-admin-dashboard-requirements.md          ← 9 user stories, 45 issues
└── plans/
    ├── backend-api-implementation-plan.md              ← Backend plan (13 tasks)
    ├── mobile-app-implementation-plan.md               ← Mobile plan (TBD)
    └── admin-dashboard-implementation-plan.md          ← Admin plan (TBD)
```

---

## Backend API (NestJS)

```
backend/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── Dockerfile                                          ← Multi-stage production build
├── .env                                                ← Local env (gitignored)
├── src/
│   ├── main.ts                                         ← App bootstrap, global pipes, CORS
│   ├── app.module.ts                                   ← Root module, all imports
│   │
│   ├── config/
│   │   ├── app.config.ts                               ← Port, NODE_ENV
│   │   ├── database.config.ts                          ← PostgreSQL connection (TypeORM)
│   │   ├── redis.config.ts                             ← Redis connection
│   │   └── s3.config.ts                                ← AWS S3 (Bahrain me-south-1)
│   │
│   ├── shared/
│   │   ├── enums/
│   │   │   └── index.ts                                ← UserRole, KycStatus, Breed, Currency,
│   │   │                                                  ListingStatus, HealthStatus, OrderStatus,
│   │   │                                                  PaymentMethod, EscrowStatus, CertificateType,
│   │   │                                                  VerificationStatus, MessageType, PreferredLanguage
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts                       ← JWT authentication guard
│   │   │   └── roles.guard.ts                          ← RBAC role-based guard
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts                      ← @Roles(UserRole.SELLER)
│   │   │   └── current-user.decorator.ts               ← @CurrentUser() param decorator
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts                ← { success, data, timestamp } wrapper
│   │   └── interfaces/
│   │       └── module-events.ts                        ← Event contracts: OrderCreatedEvent,
│   │                                                      PaymentCompletedEvent, CertificateVerifiedEvent,
│   │                                                      OrderDeliveredEvent, UserVerifiedEvent
│   │
│   └── modules/
│       │
│       ├── auth/                                       ← G1-US01: Registration & Authentication
│       │   ├── auth.module.ts                          ← Imports UsersModule, JwtModule, PassportModule
│       │   ├── auth.controller.ts                      ← POST /auth/otp/send
│       │   │                                              POST /auth/register
│       │   │                                              POST /auth/login
│       │   │                                              POST /auth/refresh
│       │   ├── auth.service.ts                         ← OTP verification, user creation, token generation
│       │   ├── otp.service.ts                          ← Generate 6-digit OTP, verify with expiry + rate limit
│       │   ├── jwt.strategy.ts                         ← Passport JWT strategy, user lookup
│       │   ├── dto/
│       │   │   ├── send-otp.dto.ts                     ← { phone } E.164 validated
│       │   │   ├── verify-otp.dto.ts                   ← { phone, code }
│       │   │   └── register.dto.ts                     ← { phone, code, role, fullName, country, city, email?, preferredLanguage? }
│       │   └── auth.controller.spec.ts                 ← 4 tests: sendOtp, register, login, refresh
│       │
│       ├── users/                                      ← G1-US02, G1-US03: KYC & Profile
│       │   ├── users.module.ts                         ← Exports UsersService (used by AuthModule)
│       │   ├── users.controller.ts                     ← GET    /users/me
│       │   │                                              PATCH  /users/me
│       │   │                                              POST   /users/me/kyc
│       │   ├── users.service.ts                        ← createUser, findByPhone, findById,
│       │   │                                              updateProfile, updateKycStatus, updateKycDocuments
│       │   ├── user.entity.ts                          ← users table: id, role, full_name, phone, email,
│       │   │                                              country, city, kyc_status, kyc_documents,
│       │   │                                              preferred_language, created_at, updated_at
│       │   ├── dto/
│       │   │   ├── update-profile.dto.ts               ← { fullName?, email?, country?, city?, preferredLanguage? }
│       │   │   └── kyc-upload.dto.ts                   ← { documentType, documentUrl }
│       │   ├── users.service.spec.ts                   ← 5 tests: create, findByPhone, findById, updateProfile, updateKyc
│       │   └── users.controller.spec.ts                ← 3 tests: getProfile, updateProfile, uploadKyc
│       │
│       ├── listings/                                   ← G1-US04, G1-US05: Listing CRUD & Search
│       │   ├── listings.module.ts                      ← Exports ListingsService
│       │   ├── listings.controller.ts                  ← POST   /listings              (seller only)
│       │   │                                              GET    /listings              (public, filtered)
│       │   │                                              GET    /listings/:id          (public)
│       │   │                                              PATCH  /listings/:id          (owner only)
│       │   │                                              DELETE /listings/:id          (owner only)
│       │   ├── listings.service.ts                     ← create, findAll (search/filter/sort/paginate),
│       │   │                                              findById, update, remove
│       │   ├── listing.entity.ts                       ← listings table: id, seller_id, title, breed,
│       │   │                                              quantity, age_months, weight_kg, price_per_head,
│       │   │                                              currency, origin_country, origin_city, description,
│       │   │                                              images, video_url, health_status, certificate_id,
│       │   │                                              status, created_at, updated_at
│       │   ├── dto/
│       │   │   ├── create-listing.dto.ts               ← { title, breed, quantity, ageMonths, weightKg,
│       │   │   │                                            pricePerHead, currency, originCountry, originCity,
│       │   │   │                                            description?, images[2-10], videoUrl? }
│       │   │   ├── update-listing.dto.ts               ← PartialType(CreateListingDto)
│       │   │   └── search-listings.dto.ts              ← { breed?, minPrice?, maxPrice?, minQuantity?,
│       │   │                                                originCountry?, healthStatus?, sortBy?, page?, limit? }
│       │   └── listings.controller.spec.ts             ← 5 tests: create, findAll, findOne, update, remove
│       │
│       ├── orders/                                     ← G1-US06: Order Lifecycle
│       │   ├── orders.module.ts                        ← Exports OrdersService
│       │   ├── orders.controller.ts                    ← POST   /orders                (buyer)
│       │   │                                              GET    /orders                (user's orders)
│       │   │                                              GET    /orders/:id
│       │   │                                              PATCH  /orders/:id/status     (buyer/seller)
│       │   ├── orders.service.ts                       ← create (auto-calc commission), findByUser,
│       │   │                                              findById, updateStatus (with event emission)
│       │   ├── order.entity.ts                         ← orders table: id, listing_id, buyer_id, seller_id,
│       │   │                                              broker_id, quantity, unit_price, total_price,
│       │   │                                              commission_rate, commission_amount, status,
│       │   │                                              delivery_country, delivery_city, delivery_address,
│       │   │                                              created_at, updated_at
│       │   ├── dto/
│       │   │   ├── create-order.dto.ts                 ← { listingId, quantity, unitPrice, deliveryCountry,
│       │   │   │                                            deliveryCity, deliveryAddress, brokerId? }
│       │   │   └── update-order-status.dto.ts          ← { status: OrderStatus }
│       │   └── orders.controller.spec.ts               ← 4 tests: create, findMyOrders, findOne, updateStatus
│       │
│       ├── payments/                                   ← G1-US07: Escrow Payments
│       │   ├── payments.module.ts                      ← Exports PaymentsService
│       │   ├── payments.controller.ts                  ← POST   /payments/initiate     (buyer)
│       │   │                                              POST   /payments/release
│       │   │                                              GET    /payments/order/:orderId
│       │   ├── payments.service.ts                     ← initiatePayment, releasePayment, refundPayment,
│       │   │                                              findByOrder (with event emission)
│       │   ├── escrow.service.ts                       ← holdFunds, releaseFunds, refundFunds
│       │   │                                              (stub for MVP → real gateway later)
│       │   ├── payment.entity.ts                       ← payments table: id, order_id, payer_id, amount,
│       │   │                                              seller_amount, commission_amount, method,
│       │   │                                              escrow_status, transaction_ref, paid_at,
│       │   │                                              released_at, updated_at
│       │   ├── dto/
│       │   │   ├── initiate-payment.dto.ts             ← { orderId, method: PaymentMethod }
│       │   │   └── release-payment.dto.ts              ← { paymentId }
│       │   └── payments.controller.spec.ts             ← 3 tests: initiate, release, findByOrder
│       │
│       ├── certificates/                               ← G1-US08: Vet Certificates
│       │   ├── certificates.module.ts                  ← Exports CertificatesService
│       │   ├── certificates.controller.ts              ← POST   /certificates           (seller)
│       │   │                                              GET    /certificates/listing/:listingId
│       │   │                                              PATCH  /certificates/:id/verify (admin)
│       │   ├── certificates.service.ts                 ← upload, findByListing, verify (with event emission)
│       │   ├── certificate.entity.ts                   ← certificates table: id, listing_id, uploaded_by,
│       │   │                                              type, file_url, issuing_authority, issue_date,
│       │   │                                              expiry_date, verification_status, verified_by,
│       │   │                                              created_at, updated_at
│       │   ├── dto/
│       │   │   ├── upload-certificate.dto.ts           ← { listingId, type, fileUrl, issuingAuthority,
│       │   │   │                                            issueDate, expiryDate }
│       │   │   └── verify-certificate.dto.ts           ← { status: VerificationStatus }
│       │   └── certificates.controller.spec.ts         ← 3 tests: upload, findByListing, verify
│       │
│       ├── messaging/                                  ← G1-US09: Real-Time Chat
│       │   ├── messaging.module.ts                     ← Exports MessagingService
│       │   ├── messaging.controller.ts                 ← POST   /messaging/conversations
│       │   │                                              GET    /messaging/conversations
│       │   │                                              GET    /messaging/conversations/:id/messages
│       │   ├── messaging.service.ts                    ← createConversation, sendMessage, getConversations,
│       │   │                                              getMessages, markAsRead
│       │   ├── messaging.gateway.ts                    ← Socket.io gateway (/chat namespace)
│       │   │                                              Events: joinConversation, sendMessage, markRead
│       │   │                                              Broadcasts: newMessage, messagesRead
│       │   ├── conversation.entity.ts                  ← conversations table: id, participant_ids[],
│       │   │                                              listing_id, order_id, created_at
│       │   ├── message.entity.ts                       ← messages table: id, conversation_id, sender_id,
│       │   │                                              content, type, read_at, created_at
│       │   ├── dto/
│       │   │   ├── create-conversation.dto.ts          ← { participantIds[], listingId?, orderId? }
│       │   │   └── send-message.dto.ts                 ← { conversationId, content, type? }
│       │   └── messaging.gateway.spec.ts               ← 2 tests: gateway defined, sendMessage
│       │
│       └── admin/                                      ← G1-US10: Admin Management
│           ├── admin.module.ts                         ← Imports all entity repositories
│           ├── admin.controller.ts                     ← GET    /admin/dashboard
│           │                                              GET    /admin/users
│           │                                              PATCH  /admin/users/:id/kyc
│           │                                              PATCH  /admin/users/:id/suspend
│           │                                              GET    /admin/orders
│           │                                              PATCH  /admin/listings/:id/flag
│           ├── admin.service.ts                        ← getDashboardKpis, getUsers, updateUserKyc,
│           │                                              suspendUser, getOrders, flagListing
│           ├── dto/
│           │   └── admin-query.dto.ts                  ← AdminUserQueryDto, AdminOrderQueryDto
│           └── admin.controller.spec.ts                ← 4 tests: dashboard, getUsers, updateKyc, flagListing
│
└── test/
    └── jest-e2e.json                                   ← E2E test config
```

---

## Mobile App (React Native)

```
mobile/
├── package.json
├── tsconfig.json
├── app.json                                            ← App name, bundle ID, version
├── index.js                                            ← Entry point
├── babel.config.js
├── metro.config.js
├── android/                                            ← Android native project
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── java/.../MainActivity.kt
│   ├── build.gradle
│   ├── gradle.properties
│   └── settings.gradle
├── ios/                                                ← iOS native project
│   ├── Mashia/
│   │   ├── AppDelegate.mm
│   │   ├── Info.plist
│   │   └── LaunchScreen.storyboard
│   ├── Mashia.xcodeproj/
│   └── Podfile
├── src/
│   ├── App.tsx                                         ← Root component, providers, navigation container
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx                           ← Auth stack vs Main tabs switch
│   │   ├── AuthStack.tsx                               ← Login → OTP → Role → Profile
│   │   ├── MainTabs.tsx                                ← Home, Orders, Messages, Profile tabs
│   │   ├── ListingsStack.tsx                           ← Home → Detail → Create
│   │   ├── OrdersStack.tsx                             ← Orders list → Detail → Payment
│   │   ├── MessagingStack.tsx                          ← Conversations → Chat
│   │   └── ProfileStack.tsx                            ← Profile → Edit → KYC → Settings
│   │
│   ├── screens/
│   │   ├── auth/                                       ← G2-US01: Onboarding
│   │   │   ├── PhoneInputScreen.tsx                    ← Phone number + country code
│   │   │   ├── OtpVerificationScreen.tsx               ← 6-digit OTP input + countdown
│   │   │   ├── RoleSelectionScreen.tsx                 ← Seller / Buyer / Broker picker
│   │   │   └── ProfileCompletionScreen.tsx             ← Name, country, city form
│   │   │
│   │   ├── listings/                                   ← G2-US03, G2-US04: Browse & Create
│   │   │   ├── HomeScreen.tsx                          ← Listing feed with cards
│   │   │   ├── ListingDetailScreen.tsx                 ← Full detail with photos, seller, actions
│   │   │   ├── CreateListingScreen.tsx                 ← Listing form with image picker
│   │   │   ├── MyListingsScreen.tsx                    ← Seller's own listings
│   │   │   └── FilterSheet.tsx                         ← Bottom sheet with filters/sort
│   │   │
│   │   ├── orders/                                     ← G2-US05, G2-US06: Orders & Payment
│   │   │   ├── PlaceOrderScreen.tsx                    ← Quantity, price, delivery form
│   │   │   ├── OrderConfirmationScreen.tsx             ← Summary + commission breakdown
│   │   │   ├── MyOrdersScreen.tsx                      ← Order list with status badges
│   │   │   ├── OrderDetailScreen.tsx                   ← Timeline, actions (accept/deliver)
│   │   │   ├── PaymentMethodScreen.tsx                 ← STC Pay / Mada / bank selection
│   │   │   └── PaymentResultScreen.tsx                 ← Success / failure feedback
│   │   │
│   │   ├── messaging/                                  ← G2-US07: Chat
│   │   │   ├── ConversationsScreen.tsx                 ← Conversation list + unread badges
│   │   │   └── ChatScreen.tsx                          ← Message bubbles, input, send image
│   │   │
│   │   ├── certificates/                               ← G2-US08: Vet Certificates
│   │   │   ├── UploadCertificateScreen.tsx             ← Type, authority, dates, file picker
│   │   │   └── CertificateDetailScreen.tsx             ← View certificate + status
│   │   │
│   │   └── profile/                                    ← G2-US02, G2-US09: Profile & KYC
│   │       ├── ProfileScreen.tsx                       ← User info, role, KYC badge
│   │       ├── EditProfileScreen.tsx                   ← Edit name, email, city
│   │       ├── KycUploadScreen.tsx                     ← Camera/gallery document upload
│   │       └── SettingsScreen.tsx                      ← Language switch, logout
│   │
│   ├── services/                                       ← API client layer (one per backend module)
│   │   ├── api.ts                                      ← Axios instance, base URL, interceptors, token refresh
│   │   ├── auth.service.ts                             ← sendOtp, verifyOtp, register, login, refresh
│   │   ├── users.service.ts                            ← getProfile, updateProfile, uploadKyc
│   │   ├── listings.service.ts                         ← getListings, getListing, createListing, updateListing, deleteListing
│   │   ├── orders.service.ts                           ← createOrder, getOrders, getOrder, updateOrderStatus
│   │   ├── payments.service.ts                         ← initiatePayment, getPaymentByOrder
│   │   ├── messaging.service.ts                        ← getConversations, getMessages, createConversation
│   │   ├── certificates.service.ts                     ← uploadCertificate, getCertificatesByListing
│   │   └── socket.service.ts                           ← Socket.io connection, events, reconnect
│   │
│   ├── store/                                          ← State management (Zustand)
│   │   ├── auth.store.ts                               ← User, tokens, isAuthenticated, login/logout actions
│   │   ├── listings.store.ts                           ← Listings cache, filters, pagination
│   │   ├── orders.store.ts                             ← Orders cache
│   │   └── messaging.store.ts                          ← Conversations, active chat, unread counts
│   │
│   ├── components/                                     ← Shared UI components
│   │   ├── ListingCard.tsx                             ← Card: photo, breed, price, quantity, origin
│   │   ├── OrderStatusBadge.tsx                        ← Colored badge per status
│   │   ├── KycStatusBanner.tsx                         ← "Pending Verification" banner
│   │   ├── ImagePicker.tsx                             ← Multi-image selector with reorder
│   │   ├── LoadingSpinner.tsx                          ← Activity indicator
│   │   ├── EmptyState.tsx                              ← "No results" placeholder
│   │   ├── ErrorMessage.tsx                            ← Error display with retry
│   │   └── LanguageSwitcher.tsx                        ← AR / TR / EN selector
│   │
│   ├── i18n/                                           ← G2-US10: Internationalization
│   │   ├── index.ts                                    ← i18next setup, language detection
│   │   ├── ar.json                                     ← Arabic translations (all screens)
│   │   ├── tr.json                                     ← Turkish translations (all screens)
│   │   └── en.json                                     ← English translations (all screens)
│   │
│   ├── hooks/                                          ← Custom React hooks
│   │   ├── useAuth.ts                                  ← Auth state + actions
│   │   ├── useSocket.ts                                ← Socket.io connection lifecycle
│   │   └── useImageUpload.ts                           ← S3 presigned URL upload
│   │
│   ├── utils/
│   │   ├── format.ts                                   ← Price formatting, date formatting
│   │   ├── validation.ts                               ← Phone E.164 check, form validators
│   │   └── constants.ts                                ← API_URL, breeds list, countries list
│   │
│   └── theme/
│       ├── colors.ts                                   ← Brand colors
│       ├── typography.ts                               ← Font families (Arabic/Latin)
│       └── spacing.ts                                  ← Consistent spacing scale
│
├── assets/
│   ├── icon.png                                        ← App icon
│   ├── splash.png                                      ← Splash screen
│   └── images/                                         ← Static images
│
└── __tests__/                                          ← Unit tests
    ├── screens/
    ├── services/
    └── components/
```

---

## Admin Dashboard (Next.js)

```
admin/
├── package.json
├── tsconfig.json
├── next.config.js
├── Dockerfile                                          ← Production build
├── tailwind.config.js                                  ← Tailwind CSS config
├── postcss.config.js
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── src/
│   ├── app/                                            ← Next.js App Router
│   │   ├── layout.tsx                                  ← Root layout: sidebar + header + RTL support
│   │   ├── page.tsx                                    ← Redirect to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx                                ← G3-US01: Admin login (phone + OTP)
│   │   ├── dashboard/
│   │   │   └── page.tsx                                ← G3-US02: KPI cards + overview
│   │   ├── users/
│   │   │   ├── page.tsx                                ← G3-US03: Users table with filters
│   │   │   └── [id]/
│   │   │       └── page.tsx                            ← User detail: profile + KYC docs + actions
│   │   ├── listings/
│   │   │   ├── page.tsx                                ← G3-US04: Listings table with moderation
│   │   │   └── [id]/
│   │   │       └── page.tsx                            ← Listing detail: photos, info, flag/remove
│   │   ├── orders/
│   │   │   ├── page.tsx                                ← G3-US06: Orders table with filters
│   │   │   └── [id]/
│   │   │       └── page.tsx                            ← Order detail: timeline, payment, dispute actions
│   │   ├── certificates/
│   │   │   └── page.tsx                                ← G3-US05: Pending certificates queue
│   │   ├── payments/
│   │   │   └── page.tsx                                ← G3-US07: Payments table + revenue summary
│   │   └── settings/
│   │       └── page.tsx                                ← Commission rate config, platform settings
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx                             ← Navigation: Dashboard, Users, Listings,
│   │   │   │                                              Orders, Certificates, Payments, Settings
│   │   │   ├── Header.tsx                              ← Language switcher, admin name, logout
│   │   │   └── Breadcrumbs.tsx                         ← Page breadcrumb trail
│   │   ├── ui/
│   │   │   ├── DataTable.tsx                           ← Reusable table with sorting, pagination
│   │   │   ├── KpiCard.tsx                             ← Dashboard stat card
│   │   │   ├── StatusBadge.tsx                         ← Colored badge for any status enum
│   │   │   ├── ConfirmDialog.tsx                       ← "Are you sure?" modal
│   │   │   ├── FilterBar.tsx                           ← Reusable filter row
│   │   │   ├── SearchInput.tsx                         ← Debounced search input
│   │   │   ├── DocumentViewer.tsx                      ← Inline PDF/image viewer for KYC + certs
│   │   │   └── LoadingState.tsx                        ← Skeleton loaders
│   │   └── charts/
│   │       ├── RevenueChart.tsx                        ← Revenue over time (line chart)
│   │       └── OrdersChart.tsx                         ← Orders by status (bar chart)
│   │
│   ├── services/
│   │   ├── api.ts                                      ← Axios instance, token interceptors
│   │   ├── auth.service.ts                             ← login, refresh, logout
│   │   ├── admin.service.ts                            ← getDashboard, getUsers, updateKyc, suspend,
│   │   │                                                  getOrders, flagListing, getPayments
│   │   └── certificates.service.ts                     ← getPendingCerts, verifyCert
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                                  ← Auth state, route protection
│   │   ├── useTable.ts                                 ← Pagination, sorting, filtering state
│   │   └── useApi.ts                                   ← SWR/React Query wrapper for data fetching
│   │
│   ├── i18n/                                           ← G3-US08: Internationalization
│   │   ├── config.ts                                   ← next-i18next setup
│   │   ├── ar.json                                     ← Arabic translations
│   │   ├── tr.json                                     ← Turkish translations
│   │   └── en.json                                     ← English translations
│   │
│   ├── middleware.ts                                    ← Auth middleware: redirect to /login if no token
│   │
│   └── utils/
│       ├── format.ts                                   ← Currency, date, number formatting
│       └── constants.ts                                ← API_URL, role labels, status labels
│
└── __tests__/
    ├── pages/
    └── components/
```

---

## Infrastructure

```
mashia/
├── docker-compose.yml                                  ← Local dev: PostgreSQL 16 + Redis 7
├── .env.example                                        ← All environment variables
├── .github/
│   └── workflows/
│       ├── backend-ci.yml                              ← Lint → Test → Build backend
│       ├── backend-cd.yml                              ← Push Docker → Deploy ECS Fargate
│       ├── mobile-ci.yml                               ← Lint → Test → Build Android/iOS
│       ├── admin-ci.yml                                ← Lint → Build admin dashboard
│       └── admin-cd.yml                                ← Deploy admin to ECS/Vercel
└── infra/                                              ← AWS infrastructure (optional IaC)
    ├── ecs-task-definition.json                        ← ECS Fargate task config
    ├── rds-config.md                                   ← RDS PostgreSQL Multi-AZ setup notes
    └── s3-bucket-policy.json                           ← S3 encryption + access policy
```

---

## File Counts

| Area | Files | Purpose |
|---|---|---|
| Backend | ~55 | NestJS API (8 modules) |
| Mobile | ~60 | React Native app (12 screen groups) |
| Admin | ~35 | Next.js dashboard (9 pages) |
| Docs | 7 | Specs, requirements, plans |
| Infra | ~8 | Docker, CI/CD, AWS config |
| **Total** | **~165** | |
