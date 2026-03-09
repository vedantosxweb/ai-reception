// =============================================================================
// Twilio SMS Webhook
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAIResponse, getOrCreateSession, buildReceptionistPrompt } from '@/lib/ai';
import { buildCustomerMemoryContext } from '@/lib/ai/memory';
import { KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';
import { sendSMS, validateTwilioWebhook } from '@/lib/telephony/twilio.service';
import { checkRateLimitRedis } from '@/lib/redis';
import { log } from '@/lib/logger';
import {
  buildTwilioWebhookUrl,
  isSmsEnabled,
  shouldEnforceTwilioWebhookSignature,
} from '@/lib/telephony/webhook';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const from = data.From || '';
    const to = data.To || '';
    const body = data.Body || '';

    // Validate Twilio webhook signature
    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/sms', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ from, to }, 'Invalid Twilio signature');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Check if SMS is enabled
    if (!isSmsEnabled()) {
      log.webhook.info('SMS feature is disabled');
      return twimlResponse('<Response></Response>');
    }

    // Rate limit per sender number (max 10 SMS per minute)
    const rateLimit = await checkRateLimitRedis(`sms:${from}`, 10, 60);
    if (!rateLimit.allowed) {
      log.webhook.warn({ from }, 'SMS sender rate limited');
      return twimlResponse('<Response></Response>');
    }

    log.webhook.info({ from, to, bodyPreview: body.slice(0, 50) }, 'SMS webhook received');

    // Look up phone number
    const phoneRecord = await db.phoneNumber.findUnique({
      where: { number: to },
      include: { tenant: true, receptionist: true },
    });

    if (!phoneRecord?.tenant || !phoneRecord.receptionist) {
      return twimlResponse('<Response></Response>');
    }

    const tenant = phoneRecord.tenant;
    const receptionist = phoneRecord.receptionist;

    if (tenant.status === 'CANCELLED' || receptionist.status !== 'ACTIVE') {
      return twimlResponse('<Response></Response>');
    }

    // Idempotency guard: Twilio may retry the same inbound message
    if (data.MessageSid) {
      const existingInbound = await db.sMSMessage.findFirst({
        where: {
          tenantId: tenant.id,
          providerSid: data.MessageSid,
          direction: 'INBOUND',
        },
        select: { id: true },
      });
      if (existingInbound) {
        return twimlResponse('<Response></Response>');
      }
    }

    // Find or create contact
    let contactId: string | undefined;
    let contact = await db.contact.findFirst({ where: { tenantId: tenant.id, phone: from } });
    if (!contact) {
      contact = await db.contact.create({
        data: {
          tenantId: tenant.id,
          firstName: 'SMS',
          lastName: from.slice(-4),
          phone: from,
          source: 'sms',
          status: 'lead',
          lastContactAt: new Date(),
        },
      });
    } else {
      await db.contact.update({ where: { id: contact.id }, data: { lastContactAt: new Date() } });
    }
    contactId = contact.id;

    // Store incoming message
    await db.sMSMessage.create({
      data: {
        tenantId: tenant.id,
        phoneNumberId: phoneRecord.id,
        contactId,
        direction: 'INBOUND',
        fromNumber: from,
        toNumber: to,
        body,
        providerSid: data.MessageSid,
      },
    });

    // Get AI session (now async with Redis)
    const sessionId = `sms_${tenant.id}_${from}`;
    const context = await getOrCreateSession(sessionId, tenant.id, receptionist.id, 'sms');

    // Get knowledge
    const knowledgeContext = await KnowledgeBaseService.getRelevantContext(
      tenant.id,
      receptionist.id,
      body
    );

    const systemPrompt = buildReceptionistPrompt({
      businessName: tenant.name,
      description: tenant.description || undefined,
      greeting: receptionist.greeting,
      channel: 'sms',
      operatingMode: receptionist.operatingMode,
      defaultMeetingDurationMinutes: (tenant as { defaultMeetingDurationMinutes?: number }).defaultMeetingDurationMinutes ?? 30,
      customerMemory: await buildCustomerMemoryContext(tenant.id, from),
    });

    const aiResponse = await generateAIResponse(body, context, {
      llmProvider: receptionist.llmProvider,
      llmModel: receptionist.llmModel,
      temperature: receptionist.temperature,
      maxTokens: receptionist.maxTokens,
      systemPrompt,
      knowledgeContext: knowledgeContext || undefined,
    });

    // Send reply
    const smsResult = await sendSMS(from, aiResponse.text, to);

    // Store outgoing message
    const outgoingExists = smsResult.messageSid
      ? await db.sMSMessage.findFirst({
          where: {
            tenantId: tenant.id,
            providerSid: smsResult.messageSid,
            direction: 'OUTBOUND',
          },
          select: { id: true },
        })
      : null;

    if (!outgoingExists) {
      await db.sMSMessage.create({
        data: {
          tenantId: tenant.id,
          phoneNumberId: phoneRecord.id,
          contactId,
          direction: 'OUTBOUND',
          fromNumber: to,
          toNumber: from,
          body: aiResponse.text,
          providerSid: smsResult.messageSid,
          status: smsResult.success ? 'sent' : 'failed',
        },
      });

      // Track usage only once per successfully persisted outbound message
      await db.usageRecord.create({
        data: {
          tenantId: tenant.id,
          type: 'SMS_SENT',
          quantity: 1,
          periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        },
      });
    }

    return twimlResponse('<Response></Response>');
  } catch (error) {
    log.webhook.error({ error }, 'SMS webhook error');
    return twimlResponse('<Response></Response>');
  }
}

function twimlResponse(xml: string): NextResponse {
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'sms-webhook' });
}
