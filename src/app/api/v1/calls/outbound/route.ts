// =============================================================================
// Outbound Call API - Make outbound calls via AI receptionist
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, checkRateLimit } from '@/lib/api-auth';
import { makeOutboundCall } from '@/lib/telephony/twilio.service';
import { setActiveCall } from '@/lib/redis';

// POST /api/v1/calls/outbound - Initiate an outbound call
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  // Rate limit: 10 outbound calls per minute per tenant
  const rateLimit = await checkRateLimit(`outbound:${session.user.tenantId}`, 10, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { to, receptionistId, phoneNumberId, message } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: to (phone number)' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!/^\+?[\d\s()-]{10,}$/.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    // Normalize to E.164
    const normalizedTo = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`;

    // Get the phone number to call from
    let fromNumber: string | undefined;
    if (phoneNumberId) {
      const phoneRecord = await db.phoneNumber.findFirst({
        where: { id: phoneNumberId, tenantId: session.user.tenantId, status: 'ACTIVE' },
      });
      if (!phoneRecord) {
        return NextResponse.json(
          { success: false, error: 'Phone number not found or inactive' },
          { status: 404 }
        );
      }
      fromNumber = phoneRecord.number;
    } else {
      // Use the first active phone number for this tenant
      const phoneRecord = await db.phoneNumber.findFirst({
        where: { tenantId: session.user.tenantId, status: 'ACTIVE' },
      });
      if (!phoneRecord) {
        return NextResponse.json(
          { success: false, error: 'No active phone numbers. Please provision a phone number first.' },
          { status: 400 }
        );
      }
      fromNumber = phoneRecord.number;
    }

    // Get the receptionist (optional - for custom greeting)
    let receptionist: Awaited<ReturnType<typeof db.aIReceptionist.findFirst>> = null;
    if (receptionistId) {
      receptionist = await db.aIReceptionist.findFirst({
        where: { id: receptionistId, tenantId: session.user.tenantId, status: 'ACTIVE' },
      });
    } else {
      // Use first active receptionist
      receptionist = await db.aIReceptionist.findFirst({
        where: { tenantId: session.user.tenantId, status: 'ACTIVE' },
      });
    }

    // Get the phone number record for DB
    const phoneRecord = await db.phoneNumber.findFirst({
      where: { tenantId: session.user.tenantId, number: fromNumber },
    });

    // Create call record first
    const now = new Date();
    const call = await db.call.create({
      data: {
        tenantId: session.user.tenantId,
        receptionistId: receptionist?.id,
        phoneNumberId: phoneRecord?.id,
        callerNumber: fromNumber,
        dialedNumber: normalizedTo,
        direction: 'OUTBOUND',
        status: 'RINGING',
        startedAt: now,
      },
    });

    // Build custom TwiML if a message is provided
    let twiml: string | undefined;
    if (message) {
      twiml = `<Response><Say voice="Polly.Joanna">${message}</Say><Pause length="1"/><Gather action="${process.env.TWILIO_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/twilio/voice'}" input="speech dtmf" speechTimeout="auto" method="POST"><Say voice="Polly.Joanna">How can I help you?</Say></Gather></Response>`;
    }

    // Make the outbound call via Twilio
    const result = await makeOutboundCall(normalizedTo, {
      from: fromNumber,
      twiml,
    });

    if (!result.success) {
      // Update call as failed
      await db.call.update({
        where: { id: call.id },
        data: { status: 'FAILED', endedAt: new Date() },
      });

      return NextResponse.json(
        { success: false, error: `Failed to initiate call: ${result.error}` },
        { status: 500 }
      );
    }

    // Update call with Twilio SID
    await db.call.update({
      where: { id: call.id },
      data: { providerCallSid: result.callSid },
    });

    // Store active call session in Redis
    if (result.callSid) {
      await setActiveCall(result.callSid, {
        tenantId: session.user.tenantId,
        receptionistId: receptionist?.id || '',
        phoneNumberId: phoneRecord?.id || '',
        callId: call.id,
        callerNumber: fromNumber,
        startedAt: now.toISOString(),
      });
    }

    // Log call event
    await db.callEvent.create({
      data: {
        tenantId: session.user.tenantId,
        callId: call.id,
        type: 'outbound_call_initiated',
        data: {
          to: normalizedTo,
          from: fromNumber,
          callSid: result.callSid,
          initiatedBy: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        callId: call.id,
        callSid: result.callSid,
        to: normalizedTo,
        from: fromNumber,
        status: 'initiated',
      },
    });
  } catch (err) {
    console.error('[Outbound Call API] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
