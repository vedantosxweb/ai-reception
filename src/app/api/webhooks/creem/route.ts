// =============================================================================
// Creem.io Webhook Handler - Signature verification + event routing
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/billing/creem.service';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('creem-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing creem-signature header' },
        { status: 401 },
      );
    }

    const rawBody = await req.text();

    // Verify HMAC-SHA256 signature
    if (!BillingService.verifyWebhookSignature(rawBody, signature)) {
      log.webhook.warn('Creem webhook signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 },
      );
    }

    const event = JSON.parse(rawBody);

    // Process the event
    await BillingService.handleWebhook(event);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    log.webhook.error({ error: err }, 'Creem webhook processing failed');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
