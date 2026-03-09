# Stripe → Creem.io Migration Plan

## Overview
Replace all Stripe billing integration with Creem.io (Merchant of Record platform).
Creem uses hosted checkout (redirect to checkout_url) instead of Stripe's inline payment.
Creem has no metered billing — keep local DB usage tracking, remove Stripe metered reporting.

## Creem API Endpoints Used
- `POST /v1/checkouts` — Create checkout session → returns `checkout_url`
- `POST /v1/subscriptions/{id}/cancel` — Cancel subscription (mode: immediate|scheduled)
- `POST /v1/customers/billing` — Get customer portal link → returns `customer_portal_link`

## Creem Credentials (Test Mode)
- API Key: `creem_test_7ccWV6JXVIvEcVSr0k5L1u`
- Webhook Secret: `whsec_7DCmo1xyLtQpSILhbZTDxu`
- Product IDs:
  - Starter ($49/mo): `prod_31eakiw5U7lrRq3v3JkiKR`
  - Growth ($149/mo): `prod_2PhxTtkeiNvNKWeOqRnaw`
  - Pro ($399/mo): `prod_1LwA6m8totx85XoHPXIfud`
  - Enterprise ($999/mo): `prod_6lpokFJawDU8gv5ynOt0H5`

## Steps

### Step 1: Prisma Schema Migration
Rename columns:
- `Tenant.stripeCustomerId` → `billingCustomerId`
- `Tenant.stripeSubscriptionId` → `billingSubscriptionId`
- `Tenant` index: `stripeCustomerId` → `billingCustomerId`
- `Subscription.stripeSubscriptionId` → `externalSubscriptionId`
- `Subscription.stripePriceId` → `externalProductId`
- `Subscription` index: `stripeSubscriptionId` → `externalSubscriptionId`
- `Invoice.stripeInvoiceId` → `externalInvoiceId`
- `Invoice` index: `stripeInvoiceId` → `externalInvoiceId`
Run: `npx prisma migrate dev --name rename-stripe-to-billing`

### Step 2: Create creem.service.ts
File: `src/lib/billing/creem.service.ts`
BillingService class with methods:
- `createCheckout(tenantId, plan)` — POST /v1/checkouts → returns { checkoutUrl }
- `cancelSubscription(tenantId, immediately)` — POST /v1/subscriptions/{id}/cancel
- `changePlan(tenantId, newPlan)` — creates new checkout (webhook cancels old sub)
- `createPortalSession(tenantId)` — POST /v1/customers/billing → portal URL
- `reportUsage(tenantId, minutes, callId)` — local DB only
- `getUsageSummary(tenantId)` — pure DB query (unchanged)
- `handleWebhook(event)` — processes Creem webhook events

### Step 3: Create Creem webhook handler
File: `src/app/api/webhooks/creem/route.ts`
- HMAC-SHA256 signature verification
- Handle: checkout.completed, subscription.paid, subscription.canceled, subscription.scheduled_cancel, subscription.past_due

### Step 4: Update billing route
File: `src/app/api/v1/billing/route.ts`
- Change import to creem.service
- subscribe action returns { checkoutUrl }
- change_plan action returns { checkoutUrl }

### Step 5: Update portal route
File: `src/app/api/v1/billing/portal/route.ts`
- Change import + error message

### Step 6: Update billing panel
File: `src/components/dashboard/billing-panel.tsx`
- Handle checkoutUrl redirects for subscribe/change plan

### Step 7-8: Update imports
- `src/app/api/webhooks/twilio/voice/route.ts` — import path only
- `src/app/api/v1/analytics/route.ts` — import path only

### Step 9: Update health route
- Change STRIPE_SECRET_KEY → CREEM_API_KEY

### Step 10: Update env.ts
- Replace 8 Stripe vars with CREEM_API_KEY, CREEM_WEBHOOK_SECRET, CREEM_PRODUCT_*

### Step 11: Update .env and .env.example

### Step 12: Delete old files
- src/lib/billing/stripe.service.ts
- src/app/api/webhooks/stripe/route.ts

### Step 13: npm uninstall stripe @stripe/stripe-js

### Step 14: Vercel env var update (manual instructions)

### Step 15: Build, commit, push, deploy
