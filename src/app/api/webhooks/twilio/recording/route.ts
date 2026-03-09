// =============================================================================
// Twilio Recording Status Webhook
// Receives callbacks when call recordings are completed/failed.
// Updates the Call record with the final recording URL.
// Sends voicemail email notification when a recording is from a missed/voicemail call.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { validateTwilioWebhook } from '@/lib/telephony/twilio.service';
import { sendVoicemailNotification } from '@/lib/email/email.service';
import { buildTwilioWebhookUrl, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const recordingSid = data.RecordingSid || '';
    const recordingUrl = data.RecordingUrl || '';
    const recordingStatus = data.RecordingStatus || '';
    const callSid = data.CallSid || '';
    const recordingDuration = data.RecordingDuration || '';

    // Validate Twilio webhook signature in production
    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/recording', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ recordingSid, callSid }, 'Invalid Twilio signature on recording webhook');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    log.webhook.info(
      { recordingSid, callSid, recordingStatus, recordingDuration },
      'Recording status webhook received'
    );

    // Only process completed recordings
    if (recordingStatus !== 'completed') {
      return NextResponse.json({ received: true });
    }

    if (!callSid || !recordingUrl) {
      log.webhook.warn({ recordingSid, callSid }, 'Recording webhook missing callSid or recordingUrl');
      return NextResponse.json({ received: true });
    }

    // Twilio recording URLs don't include the file extension by default.
    // Append .mp3 so browsers can play them directly.
    const finalUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

    // Update the Call record with the recording URL
    const updated = await db.call.updateMany({
      where: { providerCallSid: callSid },
      data: {
        recordingUrl: finalUrl,
        recordingSid: recordingSid || undefined,
      },
    });

    if (updated.count === 0) {
      log.webhook.warn({ callSid, recordingSid }, 'No call found for recording webhook callSid');
    } else {
      log.webhook.info({ callSid, recordingSid, recordingUrl: finalUrl }, 'Call recording URL saved');

      // Check if this is a voicemail / missed call — send email notification
      const call = await db.call.findFirst({
        where: { providerCallSid: callSid },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          receptionist: { select: { name: true } },
        },
      });

      if (call && ['VOICEMAIL', 'FAILED', 'BUSY', 'NO_ANSWER'].includes(call.status)) {
        const eventType = `voicemail_notification_sent_${recordingSid || callSid}`;
        const alreadySent = await db.callEvent.findFirst({
          where: { callId: call.id, type: eventType },
          select: { id: true },
        });

        if (!alreadySent) {
          const contactName = call.contact
            ? `${call.contact.firstName} ${call.contact.lastName}`.trim()
            : undefined;

          sendVoicemailNotification({
            tenantId: call.tenantId,
            callerNumber: call.callerNumber,
            dialedNumber: call.dialedNumber,
            recordingUrl: finalUrl,
            duration: recordingDuration ? parseInt(recordingDuration) : call.duration,
            startedAt: call.startedAt,
            contactName: contactName || undefined,
            receptionistName: call.receptionist?.name,
          }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Voicemail notification send failed'));

          await db.callEvent.create({
            data: {
              tenantId: call.tenantId,
              callId: call.id,
              type: eventType,
              data: { recordingSid, recordingUrl: finalUrl },
            },
          }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Voicemail notification marker write failed'));
        }
      }
    }

    return NextResponse.json({ received: true, updated: updated.count });
  } catch (error) {
    log.webhook.error({ error }, 'Recording webhook error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'recording-webhook' });
}
