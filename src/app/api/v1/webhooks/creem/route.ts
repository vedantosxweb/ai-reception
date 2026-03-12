import { NextRequest, NextResponse } from 'next/server';
import { CreemService } from '@/lib/services/creem.service';

/**
 * Validates the Creem.io webhook signature.
 * In a real environment, you should use a crypto library to verify the HMAC signature
 * using the Creem webhook secret. For this prototype milestone, we accept it if it exists.
 */
function verifySignature(req: NextRequest): boolean {
  const signature = req.headers.get('x-creem-signature');
  // If no secret configured, fail open for local testing.
  if (!process.env.CREEM_WEBHOOK_SECRET) return true;
  return !!signature; // Ensure signature header exists
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySignature(req)) {
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    const payload = await req.json();
    const eventId = payload.id; // Creem.io event unique ID

    if (!eventId) {
      return NextResponse.json({ error: 'Bad Request: Missing event ID' }, { status: 400 });
    }

    // 1. Idempotency Check (TECH-06)
    const isNew = await CreemService.isNewEvent(eventId);
    
    if (!isNew) {
      console.log(`[Creem Webhook] Ignored duplicate event: ${eventId}`);
      // Return 200 OK immediately so Creem stops retrying this duplicate event
      return NextResponse.json({ status: 'ignored', reason: 'duplicate' });
    }

    // 2. Process the event based on type
    const eventType = payload.type;
    console.log(`[Creem Webhook] Processing NEW event: ${eventType} (${eventId})`);

    switch (eventType) {
      case 'subscription.created':
        // Handle new subscription (e.g., credit minutes to tenant)
        break;
      case 'subscription.updated':
        // Handle plan upgrades/downgrades
        break;
      case 'subscription.canceled':
        // Handle churn (e.g., release Twilio numbers)
        break;
      default:
        console.log(`[Creem Webhook] Unhandled event type: ${eventType}`);
    }

    // 3. Acknowledge success
    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('[Creem Webhook] Error processing event:', error);
    // Return 500 to trigger a retry from Creem ONLY if our idempotency check didn't lock it
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
