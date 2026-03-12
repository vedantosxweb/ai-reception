// =============================================================================
// Twilio Outbound Voice Webhook - Handles answering of outbound calls
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { 
  buildGreetingTwiML, 
  validateTwilioWebhook, 
  startCallRecording 
} from '@/lib/telephony/twilio.service';
import { buildTwilioWebhookUrl, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';
import { setActiveCall } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const callSid = data.CallSid || '';
    const from = data.From || ''; // This is OUR number
    const to = data.To || '';     // This is the CUSTOMER number
    
    log.webhook.info({ callSid, from, to }, 'Outbound voice call answered');

    // 1. Validate signature
    if (shouldEnforceTwilioWebhookSignature()) {
      const signature = req.headers.get('x-twilio-signature') || '';
      const url = buildTwilioWebhookUrl('/api/webhooks/twilio/voice/outbound', req);
      if (!validateTwilioWebhook(url, data, signature)) {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // 2. Identify receptionist from 'from' number
    const phoneRecord = await db.phoneNumber.findUnique({
      where: { number: from },
      include: { tenant: true, receptionist: true },
    });

    if (!phoneRecord || !phoneRecord.receptionist) {
      return new NextResponse('<Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>', {
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    const { receptionist, tenant } = phoneRecord;

    // 3. Create Call record
    const call = await db.call.create({
      data: {
        tenantId: tenant.id,
        receptionistId: receptionist.id,
        phoneNumberId: phoneRecord.id,
        providerCallSid: callSid,
        callerNumber: to, // The person we are calling
        dialedNumber: from,
        direction: 'OUTBOUND',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // 4. Setup Redis session
    await setActiveCall(callSid, {
      tenantId: tenant.id,
      receptionistId: receptionist.id,
      phoneNumberId: phoneRecord.id,
      callId: call.id,
      callerNumber: to,
      dialedNumber: from,
      startedAt: new Date().toISOString(),
      voiceLanguage: receptionist.voiceLanguage || 'en',
    });

    // 5. Start recording
    await startCallRecording(callSid).catch(err => log.telephony.error({ err }, 'Failed to start recording'));

    // 6. Return greeting TwiML
    // Use a specific follow-up greeting if needed, or default
    const greeting = `Hi, this is ${receptionist.name} calling from ${tenant.name}. How can I help you today?`;
    
    const twiml = buildGreetingTwiML({
      text: greeting,
      gatherUrl: buildTwilioWebhookUrl('/api/webhooks/twilio/voice'), // Subsequent input goes to main handler
      voiceName: 'Polly.Joanna',
      language: receptionist.voiceLanguage || 'en',
    });

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'application/xml' },
    });

  } catch (error) {
    log.webhook.error({ error }, 'Outbound voice webhook error');
    return new NextResponse('<Response><Say>A system error occurred. Goodbye.</Say><Hangup/></Response>', {
      headers: { 'Content-Type': 'application/xml' },
    });
  }
}
