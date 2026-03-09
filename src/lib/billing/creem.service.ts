// =============================================================================
// Creem.io Billing Service - Subscriptions, usage tracking, webhooks
// =============================================================================

import * as crypto from 'crypto';
import { db } from '@/lib/db';
import { PLAN_CONFIG, type PlanKey } from '@/lib/config/env';
import type { PlanTier } from '@prisma/client';
import { log } from '@/lib/logger';
import { getAppBaseUrl } from '@/lib/app-url';

// ---------------------------------------------------------------------------
// Creem API helpers
// ---------------------------------------------------------------------------

const CREEM_API_URL =
  process.env.CREEM_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.creem.io/v1'
    : 'https://test-api.creem.io/v1');

function getApiKey(): string | null {
  return process.env.CREEM_API_KEY || null;
}

async function creemFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('CREEM_API_KEY is not configured');

  const res = await fetch(`${CREEM_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Creem API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types for Creem API responses / webhook payloads
// ---------------------------------------------------------------------------

interface CreemCheckout {
  id: string;
  checkout_url: string;
  status: string;
  subscription?: CreemSubscription | string;
  customer?: CreemCustomer | string;
  product?: CreemProduct | string;
  metadata?: Record<string, string>;
}

interface CreemSubscription {
  id: string;
  status: string;
  product: CreemProduct | string;
  customer: CreemCustomer | string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at?: string | null;
  metadata?: Record<string, string>;
}

interface CreemCustomer {
  id: string;
  email: string;
  name?: string;
  country?: string;
}

interface CreemProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
}

interface CreemWebhookEvent {
  id: string;
  eventType: string;
  created_at: number;
  object: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// BillingService
// ---------------------------------------------------------------------------

export class BillingService {
  // =========================================================================
  // Checkout (new subscription or plan change)
  // =========================================================================

  static async createCheckout(
    tenantId: string,
    plan: PlanTier,
  ): Promise<{ checkoutUrl: string } | null> {
    if (!getApiKey()) return null;

    const productId = this.getProductId(plan);
    if (!productId) throw new Error(`No Creem product configured for plan: ${plan}`);

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) throw new Error('Tenant not found');

    const appUrl = getAppBaseUrl();

    const checkout = await creemFetch<CreemCheckout>('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        success_url: `${appUrl}/dashboard?billing=success`,
        metadata: {
          tenantId,
          plan,
        },
        ...(tenant.users[0]?.email
          ? { customer: { email: tenant.users[0].email } }
          : {}),
      }),
    });

    return { checkoutUrl: checkout.checkout_url };
  }

  // =========================================================================
  // Plan Change (creates new checkout; webhook handles switchover)
  // =========================================================================

  static async changePlan(
    tenantId: string,
    newPlan: PlanTier,
  ): Promise<{ checkoutUrl: string } | null> {
    if (!getApiKey()) return null;

    const productId = this.getProductId(newPlan);
    if (!productId) throw new Error(`No Creem product configured for plan: ${newPlan}`);

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) throw new Error('Tenant not found');

    const appUrl = getAppBaseUrl();

    const checkout = await creemFetch<CreemCheckout>('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        success_url: `${appUrl}/dashboard?billing=success`,
        metadata: {
          tenantId,
          plan: newPlan,
          action: 'change_plan',
          previousSubscriptionId: tenant.billingSubscriptionId || '',
        },
        ...(tenant.users[0]?.email
          ? { customer: { email: tenant.users[0].email } }
          : {}),
      }),
    });

    return { checkoutUrl: checkout.checkout_url };
  }

  // =========================================================================
  // Cancel Subscription
  // =========================================================================

  static async cancelSubscription(
    tenantId: string,
    immediately: boolean = false,
  ): Promise<boolean> {
    if (!getApiKey()) return false;

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.billingSubscriptionId) return false;

    await creemFetch(`/subscriptions/${tenant.billingSubscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        mode: immediately ? 'immediate' : 'scheduled',
      }),
    });

    // Optimistic local update
    await db.subscription.updateMany({
      where: { externalSubscriptionId: tenant.billingSubscriptionId },
      data: {
        cancelAtPeriodEnd: !immediately,
        cancelledAt: immediately ? new Date() : undefined,
        status: immediately ? 'CANCELLED' : undefined,
      },
    });

    if (immediately) {
      await db.tenant.update({
        where: { id: tenantId },
        data: { status: 'CANCELLED' },
      });
    }

    return true;
  }

  // =========================================================================
  // Customer Portal
  // =========================================================================

  static async createPortalSession(
    tenantId: string,
    _returnUrl?: string,
  ): Promise<string | null> {
    if (!getApiKey()) return null;

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.billingCustomerId) return null;

    const result = await creemFetch<{ customer_portal_link: string }>(
      '/customers/billing',
      {
        method: 'POST',
        body: JSON.stringify({
          customer_id: tenant.billingCustomerId,
        }),
      },
    );

    return result.customer_portal_link;
  }

  // =========================================================================
  // Usage Reporting (local DB only — Creem has no metered billing)
  // =========================================================================

  static async reportUsage(
    tenantId: string,
    minutes: number,
    callId?: string,
  ): Promise<void> {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const planConfig = PLAN_CONFIG[tenant.plan as PlanKey];

    await db.usageRecord.create({
      data: {
        tenantId,
        type: 'VOICE_MINUTES',
        quantity: minutes,
        unitCost: planConfig.overagePerMinute,
        totalCost: minutes * planConfig.overagePerMinute,
        callId,
        periodStart,
        periodEnd,
      },
    });
  }

  // =========================================================================
  // Usage Summary (pure DB query)
  // =========================================================================

  static async getUsageSummary(tenantId: string): Promise<{
    totalMinutes: number;
    includedMinutes: number;
    overageMinutes: number;
    overageCost: number;
    totalCalls: number;
    smsSent: number;
    periodStart: Date;
    periodEnd: Date;
  }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const voiceUsage = await db.usageRecord.aggregate({
      where: {
        tenantId,
        type: 'VOICE_MINUTES',
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      _sum: { quantity: true },
    });

    const totalMinutes = Math.ceil(voiceUsage._sum.quantity || 0);
    const includedMinutes = tenant.monthlyMinutes;
    const overageMinutes = Math.max(0, totalMinutes - includedMinutes);
    const planConfig = PLAN_CONFIG[tenant.plan as PlanKey];
    const overageCost = overageMinutes * planConfig.overagePerMinute;

    const totalCalls = await db.call.count({
      where: {
        tenantId,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const smsSent = await db.sMSMessage.count({
      where: {
        tenantId,
        direction: 'OUTBOUND',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    return {
      totalMinutes,
      includedMinutes,
      overageMinutes,
      overageCost,
      totalCalls,
      smsSent,
      periodStart,
      periodEnd,
    };
  }

  // =========================================================================
  // Webhook Handling
  // =========================================================================

  static verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    const secret = process.env.CREEM_WEBHOOK_SECRET;
    if (!secret) return false;

    const computed = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  static async handleWebhook(event: CreemWebhookEvent): Promise<void> {
    log.billing.info({ eventType: event.eventType }, 'Billing webhook received');

    switch (event.eventType) {
      case 'checkout.completed': {
        await this.handleCheckoutCompleted(event.object as unknown as CreemCheckout);
        break;
      }
      case 'subscription.paid':
      case 'subscription.active': {
        await this.syncSubscription(event.object as unknown as CreemSubscription);
        break;
      }
      case 'subscription.canceled': {
        const sub = event.object as unknown as CreemSubscription;
        await this.handleSubscriptionCanceled(sub);
        break;
      }
      case 'subscription.scheduled_cancel': {
        const sub = event.object as unknown as CreemSubscription;
        await db.subscription.updateMany({
          where: { externalSubscriptionId: sub.id },
          data: { cancelAtPeriodEnd: true },
        });
        break;
      }
      case 'subscription.past_due': {
        const sub = event.object as unknown as CreemSubscription;
        await db.subscription.updateMany({
          where: { externalSubscriptionId: sub.id },
          data: { status: 'PAST_DUE' },
        });
        // Find tenant and suspend
        const pastDueSub = await db.subscription.findFirst({
          where: { externalSubscriptionId: sub.id },
        });
        if (pastDueSub) {
          await db.tenant.update({
            where: { id: pastDueSub.tenantId },
            data: { status: 'SUSPENDED' },
          });
        }
        break;
      }
      case 'subscription.expired': {
        const sub = event.object as unknown as CreemSubscription;
        await db.subscription.updateMany({
          where: { externalSubscriptionId: sub.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        const expiredSub = await db.subscription.findFirst({
          where: { externalSubscriptionId: sub.id },
        });
        if (expiredSub) {
          await db.tenant.update({
            where: { id: expiredSub.tenantId },
            data: { status: 'CANCELLED' },
          });
        }
        break;
      }
      default:
        log.billing.info({ eventType: event.eventType }, 'Unhandled billing webhook event');
    }
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private static getProductId(plan: PlanTier): string | null {
    const map: Record<string, string | undefined> = {
      STARTER: process.env.CREEM_PRODUCT_STARTER,
      GROWTH: process.env.CREEM_PRODUCT_GROWTH,
      PRO: process.env.CREEM_PRODUCT_PRO,
      ENTERPRISE: process.env.CREEM_PRODUCT_ENTERPRISE,
    };
    return map[plan] || null;
  }

  private static getplanFromProductId(productId: string): PlanTier | null {
    const map: Record<string, PlanTier> = {};
    if (process.env.CREEM_PRODUCT_STARTER) map[process.env.CREEM_PRODUCT_STARTER] = 'STARTER';
    if (process.env.CREEM_PRODUCT_GROWTH) map[process.env.CREEM_PRODUCT_GROWTH] = 'GROWTH';
    if (process.env.CREEM_PRODUCT_PRO) map[process.env.CREEM_PRODUCT_PRO] = 'PRO';
    if (process.env.CREEM_PRODUCT_ENTERPRISE) map[process.env.CREEM_PRODUCT_ENTERPRISE] = 'ENTERPRISE';
    return map[productId] || null;
  }

  private static async handleCheckoutCompleted(
    checkout: CreemCheckout,
  ): Promise<void> {
    const metadata = checkout.metadata || {};
    const tenantId = metadata.tenantId;
    if (!tenantId) {
      log.billing.error('checkout.completed missing tenantId in metadata');
      return;
    }

    const plan = (metadata.plan as PlanTier) || 'STARTER';
    const planConfig = PLAN_CONFIG[plan as PlanKey];

    // Extract IDs from the checkout object
    const subscription =
      typeof checkout.subscription === 'object' ? checkout.subscription : null;
    const customer =
      typeof checkout.customer === 'object' ? checkout.customer : null;
    const product =
      typeof checkout.product === 'object' ? checkout.product : null;

    const subscriptionId =
      subscription?.id ||
      (typeof checkout.subscription === 'string' ? checkout.subscription : null);
    const customerId =
      customer?.id ||
      (typeof checkout.customer === 'string' ? checkout.customer : null);
    const productId =
      product?.id ||
      (typeof checkout.product === 'string' ? checkout.product : null);

    // If this is a plan change, cancel the previous subscription
    if (metadata.action === 'change_plan' && metadata.previousSubscriptionId) {
      try {
        await creemFetch(
          `/subscriptions/${metadata.previousSubscriptionId}/cancel`,
          {
            method: 'POST',
            body: JSON.stringify({ mode: 'immediate' }),
          },
        );
        // Mark old subscription as cancelled locally
        await db.subscription.updateMany({
          where: { externalSubscriptionId: metadata.previousSubscriptionId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      } catch (err) {
        log.billing.error({ error: err }, 'Failed to cancel previous subscription');
      }
    }

    // Update tenant with billing IDs and new plan
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        billingCustomerId: customerId,
        billingSubscriptionId: subscriptionId,
        plan,
        status: 'ACTIVE',
        monthlyMinutes: planConfig.monthlyMinutes,
        maxReceptionists: planConfig.maxReceptionists,
        maxPhoneNumbers: planConfig.maxPhoneNumbers,
        maxKnowledgeSources: planConfig.maxKnowledgeSources,
      },
    });

    // Upsert subscription record
    if (subscriptionId) {
      const periodStart = subscription?.current_period_start_date
        ? new Date(subscription.current_period_start_date)
        : new Date();
      const periodEnd = subscription?.current_period_end_date
        ? new Date(subscription.current_period_end_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await db.subscription.upsert({
        where: { externalSubscriptionId: subscriptionId },
        create: {
          tenantId,
          externalSubscriptionId: subscriptionId,
          externalProductId: productId || '',
          status: 'ACTIVE',
          plan,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
        update: {
          status: 'ACTIVE',
          externalProductId: productId || undefined,
          plan,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });
    }

    log.billing.info({ tenantId, plan }, 'Checkout completed');
  }

  private static async syncSubscription(
    sub: CreemSubscription,
  ): Promise<void> {
    const existing = await db.subscription.findFirst({
      where: { externalSubscriptionId: sub.id },
    });
    if (!existing) return;

    const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING' | 'INCOMPLETE' | 'PAUSED'> = {
      active: 'ACTIVE',
      unpaid: 'PAST_DUE',
      canceled: 'CANCELLED',
      trialing: 'TRIALING',
      paused: 'PAUSED',
      scheduled_cancel: 'ACTIVE', // Still active until period end
    };

    const periodStart = sub.current_period_start_date
      ? new Date(sub.current_period_start_date)
      : existing.currentPeriodStart;
    const periodEnd = sub.current_period_end_date
      ? new Date(sub.current_period_end_date)
      : existing.currentPeriodEnd;

    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: statusMap[sub.status] || 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.status === 'scheduled_cancel',
      },
    });
  }

  private static async handleSubscriptionCanceled(
    sub: CreemSubscription,
  ): Promise<void> {
    const existing = await db.subscription.findFirst({
      where: { externalSubscriptionId: sub.id },
    });
    if (!existing) return;

    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: sub.canceled_at ? new Date(sub.canceled_at) : new Date(),
      },
    });

    await db.tenant.update({
      where: { id: existing.tenantId },
      data: { status: 'CANCELLED' },
    });
  }
}
