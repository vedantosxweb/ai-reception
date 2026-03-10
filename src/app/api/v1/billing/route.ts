// =============================================================================
// Billing API - Plans, subscription, usage, portal
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { BillingService } from '@/lib/billing/creem.service';
import { PLAN_CONFIG } from '@/lib/config/env';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import type { PlanTier } from '@prisma/client';

// GET /api/v1/billing - Get billing info & usage
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const [usage, tenant] = await Promise.all([
      BillingService.getUsageSummary(session.user.tenantId),
      db.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: {
          billingCustomerId: true,
          billingSubscriptionId: true,
        },
      }),
    ]);

    const activeSubscription = tenant?.billingSubscriptionId
      ? await db.subscription.findFirst({
          where: {
            tenantId: session.user.tenantId,
            externalSubscriptionId: tenant.billingSubscriptionId,
            status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
          },
          select: { id: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        plan: session.user.plan,
        planConfig: PLAN_CONFIG[session.user.plan as keyof typeof PLAN_CONFIG],
        usage,
        hasSubscription: !!activeSubscription,
        cancelAtPeriodEnd: activeSubscription?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: activeSubscription?.currentPeriodEnd ?? null,
        allPlans: Object.entries(PLAN_CONFIG).map(([key, config]) => ({
          id: key,
          ...config,
          current: key === session.user.plan,
        })),
      },
    });
  } catch (err) {
    log.billing.error({ error: err }, 'Failed to load billing info');
    return NextResponse.json({ success: false, error: 'Failed to load billing' }, { status: 500 });
  }
}

// POST /api/v1/billing - Create or change subscription
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const { action, plan } = await req.json();

    switch (action) {
      case 'subscribe': {
        if (!plan) return NextResponse.json({ success: false, error: 'Plan required' }, { status: 400 });
        const result = await BillingService.createCheckout(session.user.tenantId, plan as PlanTier);
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Billing not configured. Please add CREEM_API_KEY and product IDs to your environment.' },
            { status: 503 }
          );
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'change_plan': {
        if (!plan) return NextResponse.json({ success: false, error: 'Plan required' }, { status: 400 });
        const result = await BillingService.changePlan(session.user.tenantId, plan as PlanTier);
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Billing not configured.' },
            { status: 503 }
          );
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'cancel': {
        const cancelled = await BillingService.cancelSubscription(session.user.tenantId, false);
        if (!cancelled) {
          return NextResponse.json(
            { success: false, error: 'No active subscription found, or billing is not configured.' },
            { status: 400 }
          );
        }
        return NextResponse.json({ success: true, message: 'Subscription will cancel at end of billing period.' });
      }

      case 'cancel_immediately': {
        const cancelled = await BillingService.cancelSubscription(session.user.tenantId, true);
        if (!cancelled) {
          return NextResponse.json(
            { success: false, error: 'No active subscription to cancel.' },
            { status: 400 }
          );
        }
        return NextResponse.json({ success: true, message: 'Subscription cancelled immediately.' });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (err) {
    log.billing.error({ error: err }, 'Billing operation failed');
    return NextResponse.json({ success: false, error: 'Billing operation failed' }, { status: 500 });
  }
}
