// =============================================================================
// Twilio Status Callback Webhook
// =============================================================================
// NOTE: Usage reporting is handled in the voice webhook (handleCallEnd).
// This webhook only updates call status/duration in the DB to avoid
// double-reporting usage to Stripe.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendMissedCallAlert } from '@/lib/email/email.service';
import { sendSMS, validateTwilioWebhook } from '@/lib/telephony/twilio.service';
import { buildTwilioWebhookUrl, isSmsEnabled, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/status', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ callSid: data.CallSid }, 'Invalid Twilio signature on status webhook');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const callSid = data.CallSid || '';
    const callStatus = data.CallStatus || '';
    const callDuration = data.CallDuration ? parseInt(data.CallDuration) : undefined;

    log.webhook.info({ callSid, callStatus, callDuration }, 'Call status webhook received');

    const call = await db.call.findFirst({
      where: { providerCallSid: callSid },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        receptionist: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });

    if (call) {
      const statusMap: Record<string, 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BUSY' | 'NO_ANSWER'> = {
        ringing: 'RINGING',
        'in-progress': 'IN_PROGRESS',
        completed: 'COMPLETED',
        failed: 'FAILED',
        busy: 'BUSY',
        'no-answer': 'NO_ANSWER',
      };

      const mappedStatus = statusMap[callStatus] || call.status;

      await db.call.update({
        where: { id: call.id },
        data: {
          status: mappedStatus,
          duration: callDuration ?? call.duration,
          endedAt: ['completed', 'failed', 'busy', 'no-answer'].includes(callStatus) ? new Date() : undefined,
        },
      });

      // Send missed call email alert (fire-and-forget)
      if (['failed', 'busy', 'no-answer'].includes(callStatus)) {
        const alertEventType = `missed_call_alert_sent_${mappedStatus.toLowerCase()}`;
        const alertAlreadySent = await db.callEvent.findFirst({
          where: { callId: call.id, type: alertEventType },
          select: { id: true },
        });

        if (!alertAlreadySent) {
          const contactName = call.contact
            ? `${call.contact.firstName} ${call.contact.lastName}`.trim()
            : undefined;

          sendMissedCallAlert({
            tenantId: call.tenantId,
            callerNumber: call.callerNumber,
            dialedNumber: call.dialedNumber,
            status: mappedStatus,
            startedAt: call.startedAt,
            contactName: contactName || undefined,
            receptionistName: call.receptionist?.name,
          }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Missed call alert send failed'));

          await db.callEvent.create({
            data: {
              tenantId: call.tenantId,
              callId: call.id,
              type: alertEventType,
              data: { callSid, callStatus },
            },
          }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Missed call alert marker write failed'));
        }

        // Missed-call money recovery via immediate SMS
        if (call.direction === 'INBOUND' && isSmsEnabled()) {
          const recoveryEventType = 'missed_call_recovery_sms_sent';
          const recoveryAlreadySent = await db.callEvent.findFirst({
            where: { callId: call.id, type: recoveryEventType },
            select: { id: true },
          });

          if (!recoveryAlreadySent) {
            const businessName = call.tenant?.name || 'our team';
            const recoveryText = `Hey! Sorry we missed your call. I'm the AI receptionist for ${businessName}. Reply here and I can help right away, including booking an appointment.`;
            const smsResult = await sendSMS(call.callerNumber, recoveryText, call.dialedNumber);

            if (smsResult.success) {
              await db.callEvent.create({
                data: {
                  tenantId: call.tenantId,
                  callId: call.id,
                  type: recoveryEventType,
                  data: { messageSid: smsResult.messageSid, to: call.callerNumber },
                },
              });
            } else {
              log.webhook.warn({ callSid, error: smsResult.error }, 'Missed call recovery SMS failed');
            }
          }
        }
      }

      // NOTE: Usage reporting is intentionally NOT done here.
      // It is handled in the voice webhook's handleCallEnd to prevent double-reporting.
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.webhook.error({ error }, 'Status webhook error');
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'status-webhook' });
}
