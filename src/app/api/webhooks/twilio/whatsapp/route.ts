// =============================================================================
// Twilio WhatsApp Webhook - Handles WhatsApp messages with AI pipeline
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAIResponse, getOrCreateSession, buildReceptionistPrompt } from '@/lib/ai';
import { buildCustomerMemoryContext } from '@/lib/ai/memory';
import { KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';
import { validateTwilioWebhook } from '@/lib/telephony/twilio.service';
import { checkRateLimitRedis } from '@/lib/redis';
import { buildTwilioWebhookUrl, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const rawFrom = data.From || '';
    const rawTo = data.To || '';
    const body = data.Body || '';

    // WhatsApp messages come with 'whatsapp:+number' prefix
    const from = rawFrom.replace('whatsapp:', '');
    const to = rawTo.replace('whatsapp:', '');

    // Validate Twilio webhook signature
    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/whatsapp', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ from, to: rawTo }, 'Invalid Twilio signature on WhatsApp webhook');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Check feature flag
    if (process.env.ENABLE_WHATSAPP !== 'true') {
      log.webhook.info('WhatsApp feature is disabled');
      return twimlResponse('<Response></Response>');
    }

    // Rate limit per sender (max 20 messages per minute for WhatsApp)
    const rateLimit = await checkRateLimitRedis(`whatsapp:${from}`, 20, 60);
    if (!rateLimit.allowed) {
      log.webhook.warn({ from }, 'WhatsApp sender rate limited');
      return twimlResponse('<Response></Response>');
    }

    log.webhook.info({ from, to, bodyPreview: body.slice(0, 50) }, 'WhatsApp webhook received');

    // Skip messages sent by our own Twilio/WhatsApp number (outbound echo)
    const ownWhatsAppNumber = (process.env.TWILIO_WHATSAPP_NUMBER || '').replace('whatsapp:', '');
    if (from === to || from === ownWhatsAppNumber) {
      log.webhook.info({ from, to }, 'Ignoring WhatsApp self-message');
      return twimlResponse('<Response></Response>');
    }

    // Look up phone number (use the raw number without whatsapp: prefix)
    const phoneRecord = await db.phoneNumber.findFirst({
      where: {
        OR: [
          { number: to },
          { number: rawTo },
          { number: `whatsapp:${to}` },
        ],
      },
      include: { tenant: true, receptionist: true },
    });

    if (!phoneRecord?.tenant || !phoneRecord.receptionist) {
      // Try matching with just the whatsapp number env var
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
      if (whatsappNumber) {
        const fallbackRecord = await db.phoneNumber.findFirst({
          where: { number: whatsappNumber },
          include: { tenant: true, receptionist: true },
        });
        if (fallbackRecord?.tenant && fallbackRecord.receptionist) {
          return handleWhatsAppMessage(fallbackRecord, from, body, data.MessageSid);
        }
      }
      return twimlResponse('<Response></Response>');
    }

    return handleWhatsAppMessage(phoneRecord as PhoneRecordWithRelations, from, body, data.MessageSid);
  } catch (error) {
    log.webhook.error({ error }, 'WhatsApp webhook error');
    return twimlResponse('<Response></Response>');
  }
}

interface PhoneRecordWithRelations {
  id: string;
  number: string;
  tenant: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    timezone?: string | null;
    defaultMeetingDurationMinutes?: number;
  };
  receptionist: {
    id: string;
    status: string;
    greeting: string;
    llmProvider: string;
    llmModel: string;
    temperature: number;
    maxTokens: number;
    operatingMode: string;
    systemPrompt?: string | null;
    voiceLanguage?: string | null;
    enableSmsFollowup: boolean;
  } | null;
}

async function handleWhatsAppMessage(
  phoneRecord: PhoneRecordWithRelations,
  from: string,
  body: string,
  messageSid?: string
) {
  const tenant = phoneRecord.tenant;
  const receptionist = phoneRecord.receptionist;

  if (tenant.status === 'CANCELLED' || !receptionist || receptionist.status !== 'ACTIVE') {
    return twimlResponse('<Response></Response>');
  }

  // Idempotency guard for Twilio retries
  if (messageSid) {
    const existingInbound = await db.sMSMessage.findFirst({
      where: {
        tenantId: tenant.id,
        providerSid: messageSid,
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
        firstName: 'WhatsApp',
        lastName: from.slice(-4),
        phone: from,
        source: 'whatsapp',
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
      toNumber: phoneRecord.number,
      body,
      providerSid: messageSid,
      messageType: 'text',
    },
  });

  // Get AI session (keyed by whatsapp + tenant + sender)
  const sessionId = `whatsapp_${tenant.id}_${from}`;
  const context = await getOrCreateSession(sessionId, tenant.id, receptionist.id, 'whatsapp');

  // Get knowledge context
  const knowledgeContext = await KnowledgeBaseService.getRelevantContext(
    tenant.id,
    receptionist.id,
    body
  );

  const systemPrompt = buildReceptionistPrompt({
    businessName: tenant.name,
    description: tenant.description || undefined,
    greeting: receptionist.greeting,
    customPrompt: receptionist.systemPrompt || undefined,
    channel: 'whatsapp',
    operatingMode: receptionist.operatingMode,
    language: receptionist.voiceLanguage || 'en',
    timezone: tenant.timezone || 'UTC',
    defaultMeetingDurationMinutes: tenant.defaultMeetingDurationMinutes ?? 30,
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

  // Clean response text — remove [TRANSFER:...], [BOOKING:...], [CANCEL_BOOKING] markers
  const cleanText = aiResponse.text
    .replace(/\[TRANSFER:[^\]]+\]/g, '')
    .replace(/\[BOOKING:[^\]]+\]/g, '')
    .replace(/\[CANCEL_BOOKING\]/g, '')
    .trim();

  // Handle booking completion — create appointment via CalendarService
  if (aiResponse.bookingComplete && (aiResponse as any).text.match(/\[BOOKING:/)) {
    try {
      const { CalendarService } = await import('@/lib/services/calendar.service');
      const bd = context.metadata?.bookingData || {};
      const startTime = new Date(`${bd.date}T${bd.time}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      await CalendarService.createAppointment({
        tenantId: tenant.id,
        contactId,
        title: `Appointment: ${bd.name || 'WhatsApp User'} - ${bd.service || 'General'}`,
        description: `Booked via WhatsApp AI receptionist. Phone: ${from}`,
        startTime,
        endTime,
        source: 'whatsapp',
        notes: bd.service ? `Service: ${bd.service}` : undefined,
      });
      log.webhook.info({ bookingData: bd }, 'WhatsApp booking created');
    } catch (err) {
      log.webhook.error({ error: err }, 'WhatsApp booking creation error');
    }
  }

  // Send WhatsApp reply via Twilio
  const { sendWhatsApp } = await import('@/lib/telephony/twilio.service');
  const result = await sendWhatsApp(from, cleanText || 'Thank you for your message.', phoneRecord.number);

  // Store outgoing message
  const outgoingExists = result.messageSid
    ? await db.sMSMessage.findFirst({
        where: {
          tenantId: tenant.id,
          providerSid: result.messageSid,
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
        fromNumber: phoneRecord.number,
        toNumber: from,
        body: cleanText,
        providerSid: result.messageSid,
        status: result.success ? 'sent' : 'failed',
        messageType: 'text',
      },
    });

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

  // Return empty TwiML (we already sent via REST API)
  return twimlResponse('<Response></Response>');
}

function twimlResponse(xml: string): NextResponse {
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'whatsapp-webhook',
    enabled: process.env.ENABLE_WHATSAPP === 'true',
  });
}
