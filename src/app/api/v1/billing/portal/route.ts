// =============================================================================
// Billing Portal API - Creem Customer Portal redirect
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/api-auth';
import { BillingService } from '@/lib/billing/creem.service';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const { returnUrl } = await req.json();

    // Check if the tenant even has a billing customer ID
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { billingCustomerId: true, billingSubscriptionId: true },
    });

    if (!tenant?.billingCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'You do not have an active subscription yet. Please subscribe to a plan first to access the billing portal.',
        },
        { status: 400 }
      );
    }

    const url = await BillingService.createPortalSession(
      session.user.tenantId,
      returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    );

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Billing portal is not configured. Please add CREEM_API_KEY to your environment.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, data: { url } });
  } catch (err) {
    console.error('[Portal] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create billing portal session.' },
      { status: 500 }
    );
  }
}
