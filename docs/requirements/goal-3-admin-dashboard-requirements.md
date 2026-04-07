# Goal 3 Requirements: Admin Dashboard

**Goal:** Deliver a Next.js web dashboard where admins can manage the full platform lifecycle without touching the database directly.
**Traces to:** Ultimate Goal → Goal 3

---

## G3-US01: Admin Authentication

> **As an** admin, **I want to** log in securely to the dashboard, **so that** only authorized personnel can access platform management.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US01-01 | Create admin login page with phone + OTP (reuses backend auth) | Frontend | Must |
| G3-US01-02 | Implement JWT token storage and auto-refresh in browser | Frontend | Must |
| G3-US01-03 | Implement route guards — redirect to login if unauthenticated or non-admin role | Frontend | Must |
| G3-US01-04 | Implement logout with token cleanup | Frontend | Must |

---

## G3-US02: Dashboard Overview & KPIs

> **As an** admin, **I want to** see platform health at a glance, **so that** I can make informed operational decisions.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US02-01 | Create dashboard page with KPI cards (total users, active listings, active orders, revenue, pending KYC, pending certificates, open disputes) | Frontend | Must |
| G3-US02-02 | Implement API call to GET /admin/dashboard and display data | Frontend | Must |
| G3-US02-03 | Add auto-refresh of KPIs every 60 seconds | Frontend | Should |
| G3-US02-04 | Add date range filter for revenue KPI | Frontend | Should |

---

## G3-US03: User Management

> **As an** admin, **I want to** view all users, verify KYC documents, and suspend bad actors, **so that** only trusted traders use the platform.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US03-01 | Create users list page with table (name, phone, role, country, KYC status, date) | Frontend | Must |
| G3-US03-02 | Implement filters by role (seller/buyer/broker) and KYC status (pending/verified/rejected) | Frontend | Must |
| G3-US03-03 | Implement pagination and search by name/phone | Frontend | Must |
| G3-US03-04 | Create user detail page showing profile info and KYC documents | Frontend | Must |
| G3-US03-05 | Add "Approve KYC" and "Reject KYC" action buttons with confirmation dialog | Frontend | Must |
| G3-US03-06 | Add "Suspend User" action button with confirmation dialog | Frontend | Must |
| G3-US03-07 | Show inline preview/download of uploaded KYC documents | Frontend | Must |

---

## G3-US04: Listing Moderation

> **As an** admin, **I want to** review and moderate livestock listings, **so that** the platform only shows legitimate, appropriate content.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US04-01 | Create listings list page with table (title, seller, breed, price, status, date) | Frontend | Must |
| G3-US04-02 | Implement filters by status (active/sold/expired/flagged) and breed | Frontend | Must |
| G3-US04-03 | Create listing detail view with photos, video, and full information | Frontend | Must |
| G3-US04-04 | Add "Flag Listing" and "Remove Listing" action buttons | Frontend | Must |
| G3-US04-05 | Implement pagination and search by title/seller | Frontend | Must |

---

## G3-US05: Certificate Verification

> **As an** admin, **I want to** review and verify veterinary certificates, **so that** buyers can trust the health status of listed livestock.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US05-01 | Create certificates page showing pending certificates queue | Frontend | Must |
| G3-US05-02 | Show certificate details: type, issuing authority, dates, linked listing | Frontend | Must |
| G3-US05-03 | Add inline PDF/image viewer for certificate documents | Frontend | Must |
| G3-US05-04 | Add "Approve" and "Reject" action buttons with confirmation | Frontend | Must |
| G3-US05-05 | After verification, show updated listing health status | Frontend | Must |

---

## G3-US06: Order Oversight & Dispute Management

> **As an** admin, **I want to** view all orders and intervene in disputes, **so that** I can resolve conflicts and protect both buyers and sellers.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US06-01 | Create orders list page with table (order ID, buyer, seller, amount, status, date) | Frontend | Must |
| G3-US06-02 | Implement filters by status (pending/accepted/paid/in_transit/delivered/completed/disputed/cancelled) | Frontend | Must |
| G3-US06-03 | Create order detail page with full info: listing, buyer, seller, payment, timeline | Frontend | Must |
| G3-US06-04 | Add "Release Payment" action for escrow held orders | Frontend | Must |
| G3-US06-05 | Add "Refund Buyer" action for disputed orders | Frontend | Must |
| G3-US06-06 | Implement pagination and search by order ID/buyer/seller | Frontend | Must |

---

## G3-US07: Payment & Revenue Tracking

> **As an** admin, **I want to** track all payments, escrow status, and platform commission earned, **so that** I have full financial visibility.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US07-01 | Create payments list page with table (order, buyer, amount, method, escrow status, date) | Frontend | Must |
| G3-US07-02 | Implement filters by escrow status (held/released/refunded) and payment method | Frontend | Must |
| G3-US07-03 | Show total commission earned summary at top of page | Frontend | Must |
| G3-US07-04 | Implement pagination | Frontend | Must |

---

## G3-US08: Internationalization & RTL

> **As an** admin, **I want to** use the dashboard in Arabic, Turkish, or English, **so that** I can operate comfortably in my language.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US08-01 | Set up next-i18next with ar, tr, en translation files | Frontend | Must |
| G3-US08-02 | Implement RTL layout via dir="rtl" and CSS logical properties for Arabic | Frontend | Must |
| G3-US08-03 | Create language switcher in dashboard header | Frontend | Must |
| G3-US08-04 | Translate all pages, labels, buttons, and error messages to Arabic | Frontend | Must |
| G3-US08-05 | Translate all pages, labels, buttons, and error messages to Turkish | Frontend | Must |

---

## G3-US09: Dashboard Deployment

> **As a** developer, **I want to** deploy the admin dashboard to production, **so that** admins can access it from any browser.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G3-US09-01 | Create Next.js production build configuration | DevOps | Must |
| G3-US09-02 | Create Dockerfile for admin dashboard | DevOps | Must |
| G3-US09-03 | Deploy to AWS ECS Fargate (or Vercel) with custom domain | DevOps | Must |
| G3-US09-04 | Configure CORS on backend to allow dashboard origin | DevOps | Must |
| G3-US09-05 | Set up CI/CD for admin dashboard (lint → build → deploy) | DevOps | Must |

---

## Summary

| User Story | Issues | Must | Should |
|---|---|---|---|
| G3-US01: Admin Auth | 4 | 4 | 0 |
| G3-US02: Dashboard KPIs | 4 | 2 | 2 |
| G3-US03: User Management | 7 | 7 | 0 |
| G3-US04: Listing Moderation | 5 | 5 | 0 |
| G3-US05: Certificate Verification | 5 | 5 | 0 |
| G3-US06: Order & Disputes | 6 | 6 | 0 |
| G3-US07: Payment Tracking | 4 | 4 | 0 |
| G3-US08: i18n & RTL | 5 | 5 | 0 |
| G3-US09: Deployment | 5 | 5 | 0 |
| **Total** | **45** | **43** | **2** |
