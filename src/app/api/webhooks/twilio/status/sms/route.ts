// =============================================================================
// SMS Status Callback Webhook - Tracks SMS delivery status
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateTwilioWebhook } from '@/lib/telephony/twilio.service';
import { buildTwilioWebhookUrl, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/status/sms', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ messageSid: data.MessageSid || data.SmsSid }, 'Invalid Twilio signature on SMS status webhook');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    const messageSid = data.MessageSid || data.SmsSid || '';
    const messageStatus = data.MessageStatus || data.SmsStatus || '';

    log.webhook.info({ messageSid, messageStatus }, 'SMS status webhook received');

    if (messageSid && messageStatus) {
      // Update SMS message status in DB
      const message = await db.sMSMessage.findFirst({
        where: { providerSid: messageSid },
      });

      if (message) {
        await db.sMSMessage.update({
          where: { id: message.id },
          data: { status: messageStatus },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.webhook.error({ error }, 'SMS status webhook error');
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'sms-status-webhook' });
}
