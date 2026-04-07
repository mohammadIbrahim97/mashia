# Goal 2 Requirements: Mobile App (App Store & Google Play)

**Goal:** Deliver a React Native app with full buyer/seller flows, RTL Arabic support, and trilingual UI published on App Store + Google Play.
**Traces to:** Ultimate Goal → Goal 2

---

## G2-US01: Onboarding & Authentication Screens

> **As a** new user, **I want to** register and log in using my phone number with OTP verification, **so that** I can start using the app quickly.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US01-01 | Create phone input screen with E.164 validation and country code picker | Mobile | Must |
| G2-US01-02 | Create OTP verification screen with 6-digit input and countdown timer | Mobile | Must |
| G2-US01-03 | Create role selection screen (Seller / Buyer / Broker) | Mobile | Must |
| G2-US01-04 | Create profile completion screen (name, country, city) | Mobile | Must |
| G2-US01-05 | Implement secure JWT token storage (react-native-keychain) | Mobile | Must |
| G2-US01-06 | Implement auto-refresh of expired access tokens using refresh token | Mobile | Must |
| G2-US01-07 | Implement auto-redirect to login when refresh token expires | Mobile | Must |

---

## G2-US02: KYC Document Upload

> **As a** seller or broker, **I want to** photograph and upload my ID and trade license from my phone, **so that** I can get verified and start trading.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US02-01 | Create KYC upload screen with camera/gallery picker | Mobile | Must |
| G2-US02-02 | Implement image compression before upload (max 2MB) | Mobile | Must |
| G2-US02-03 | Show KYC status indicator on profile (pending/verified/rejected) | Mobile | Must |
| G2-US02-04 | Show "Pending Verification" banner until KYC is approved | Mobile | Must |

---

## G2-US03: Browsing & Searching Listings

> **As a** buyer, **I want to** browse and search sheep listings with filters, **so that** I can find the right livestock for my needs.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US03-01 | Create home screen with listing feed (card layout: photo, breed, price, quantity, origin) | Mobile | Must |
| G2-US03-02 | Implement pull-to-refresh and infinite scroll pagination | Mobile | Must |
| G2-US03-03 | Create filter bottom sheet (breed, price range, quantity, origin, health status) | Mobile | Must |
| G2-US03-04 | Create sort selector (newest, price low→high, price high→low) | Mobile | Must |
| G2-US03-05 | Create listing detail screen (photo carousel, video player, full details, seller card) | Mobile | Must |
| G2-US03-06 | Add "Message Seller" and "Place Order" action buttons on detail screen | Mobile | Must |
| G2-US03-07 | Implement search text input with debounced API calls | Mobile | Should |

---

## G2-US04: Creating Listings (Seller)

> **As a** verified seller, **I want to** create a listing with photos, breed details, and pricing from my phone, **so that** buyers can find my livestock.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US04-01 | Create listing form screen (breed picker, quantity, age, weight, price, currency) | Mobile | Must |
| G2-US04-02 | Implement multi-image picker (min 2, max 10) with reorder and delete | Mobile | Must |
| G2-US04-03 | Implement optional video capture/selection | Mobile | Must |
| G2-US04-04 | Implement S3 presigned URL upload for images and video | Mobile | Must |
| G2-US04-05 | Create "My Listings" screen showing seller's own listings with status | Mobile | Must |
| G2-US04-06 | Allow editing and deleting own listings | Mobile | Must |

---

## G2-US05: Placing & Tracking Orders

> **As a** verified buyer, **I want to** place an order and track its status, **so that** I know when my sheep will arrive.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US05-01 | Create order placement screen (quantity, agreed price, delivery address form) | Mobile | Must |
| G2-US05-02 | Create order confirmation screen with total price and commission breakdown | Mobile | Must |
| G2-US05-03 | Create "My Orders" screen with status badges (pending, accepted, paid, in_transit, delivered, completed) | Mobile | Must |
| G2-US05-04 | Create order detail screen with timeline/progress tracker | Mobile | Must |
| G2-US05-05 | Implement "Confirm Delivery" button for buyer (triggers escrow release) | Mobile | Must |
| G2-US05-06 | Implement "Accept / Reject Order" actions for seller | Mobile | Must |

---

## G2-US06: Payment Flow

> **As a** buyer, **I want to** pay for my order using STC Pay, Mada, or bank transfer, **so that** my funds are held safely in escrow.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US06-01 | Create payment method selection screen (STC Pay, Mada, bank transfer) | Mobile | Must |
| G2-US06-02 | Create payment confirmation screen with amount and escrow explanation | Mobile | Must |
| G2-US06-03 | Implement payment gateway integration (deep link / webview for STC Pay / Mada) | Mobile | Must |
| G2-US06-04 | Show escrow status on order detail (held → released / refunded) | Mobile | Must |
| G2-US06-05 | Implement payment success/failure feedback screens | Mobile | Must |

---

## G2-US07: Real-Time Messaging

> **As a** buyer or seller, **I want to** chat in real time within the app, **so that** I can negotiate and coordinate without leaving the platform.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US07-01 | Create conversations list screen with last message preview and unread badge | Mobile | Must |
| G2-US07-02 | Create chat screen with message bubbles, timestamps, and read receipts | Mobile | Must |
| G2-US07-03 | Implement Socket.io connection with auto-reconnect | Mobile | Must |
| G2-US07-04 | Implement real-time message receiving and sending | Mobile | Must |
| G2-US07-05 | Support sending images in chat (camera/gallery → S3 upload → image message) | Mobile | Must |
| G2-US07-06 | Implement "Message Seller" from listing detail → auto-create conversation | Mobile | Must |
| G2-US07-07 | Show typing indicator | Mobile | Should |

---

## G2-US08: Veterinary Certificates

> **As a** seller, **I want to** upload vet certificates from my phone, **so that** buyers can verify my livestock health status.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US08-01 | Create certificate upload screen (type picker, authority, dates, file/photo) | Mobile | Must |
| G2-US08-02 | Show certificate status on listing detail (pending/verified/rejected) | Mobile | Must |
| G2-US08-03 | Allow buyers to view/download certificates from listing detail | Mobile | Must |

---

## G2-US09: User Profile & Settings

> **As a** user, **I want to** manage my profile and app settings, **so that** I can keep my info updated and use the app in my preferred language.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US09-01 | Create profile screen showing user info, role, KYC status | Mobile | Must |
| G2-US09-02 | Create edit profile screen (name, email, city) | Mobile | Must |
| G2-US09-03 | Create language switcher (Arabic, Turkish, English) with instant UI update | Mobile | Must |
| G2-US09-04 | Implement logout with token cleanup | Mobile | Must |

---

## G2-US10: Internationalization & RTL

> **As a** user, **I want to** use the app in Arabic, Turkish, or English with proper layout direction, **so that** I can navigate comfortably in my language.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US10-01 | Set up i18n framework (react-i18next) with ar, tr, en translation files | Mobile | Must |
| G2-US10-02 | Implement RTL layout switching via I18nManager.forceRTL() for Arabic | Mobile | Must |
| G2-US10-03 | Translate all screens, buttons, labels, error messages to Arabic | Mobile | Must |
| G2-US10-04 | Translate all screens, buttons, labels, error messages to Turkish | Mobile | Must |
| G2-US10-05 | Test all screens in RTL mode for layout correctness | Test | Must |

---

## G2-US11: Push Notifications

> **As a** user, **I want to** receive push notifications for important events, **so that** I don't miss messages, order updates, or KYC approvals.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US11-01 | Integrate Firebase Cloud Messaging (FCM) for iOS and Android | Mobile | Must |
| G2-US11-02 | Implement notification for new chat messages | Mobile | Must |
| G2-US11-03 | Implement notification for order status changes | Mobile | Must |
| G2-US11-04 | Implement notification for KYC approval/rejection | Mobile | Must |
| G2-US11-05 | Implement notification tap → deep link to relevant screen | Mobile | Must |

---

## G2-US12: App Store & Google Play Submission

> **As the** founder, **I want to** publish the app on both stores, **so that** users in Syria and GCC can download and use it.

| Issue ID | Issue | Type | Priority |
|---|---|---|---|
| G2-US12-01 | Create app icons and splash screen (Arabic/English branded) | Design | Must |
| G2-US12-02 | Create App Store screenshots (Arabic + English) for all required device sizes | Design | Must |
| G2-US12-03 | Write App Store description in Arabic and English | Content | Must |
| G2-US12-04 | Configure iOS build with proper certificates and provisioning profiles | DevOps | Must |
| G2-US12-05 | Configure Android build with signing key and Play Store listing | DevOps | Must |
| G2-US12-06 | Submit to Apple App Store review | Release | Must |
| G2-US12-07 | Submit to Google Play Store review | Release | Must |
| G2-US12-08 | Set up CodePush or EAS Update for over-the-air JS updates | DevOps | Should |

---

## Summary

| User Story | Issues | Must | Should |
|---|---|---|---|
| G2-US01: Onboarding & Auth | 7 | 7 | 0 |
| G2-US02: KYC Upload | 4 | 4 | 0 |
| G2-US03: Browse & Search | 7 | 6 | 1 |
| G2-US04: Create Listings | 6 | 6 | 0 |
| G2-US05: Orders | 6 | 6 | 0 |
| G2-US06: Payments | 5 | 5 | 0 |
| G2-US07: Messaging | 7 | 6 | 1 |
| G2-US08: Certificates | 3 | 3 | 0 |
| G2-US09: Profile & Settings | 4 | 4 | 0 |
| G2-US10: i18n & RTL | 5 | 5 | 0 |
| G2-US11: Push Notifications | 5 | 5 | 0 |
| G2-US12: Store Submission | 8 | 7 | 1 |
| **Total** | **67** | **64** | **3** |
