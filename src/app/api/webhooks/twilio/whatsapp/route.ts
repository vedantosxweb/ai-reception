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
      log.webhook.info({ to, rawTo }, 'No direct phone record with tenant/receptionist found, trying fallback');
      // Try matching with just the whatsapp number env var
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
      if (whatsappNumber) {
        const fallbackRecord = await db.phoneNumber.findFirst({
          where: { number: whatsappNumber },
          include: { tenant: true, receptionist: true },
        });
        if (fallbackRecord?.tenant && fallbackRecord.receptionist) {
          log.webhook.info({ whatsappNumber }, 'Found fallback phone record, processing message');
          return handleWhatsAppMessage(fallbackRecord, from, body, data.MessageSid);
        } else {
          log.webhook.warn({ whatsappNumber, hasFallback: !!fallbackRecord }, 'Fallback phone record found but missing tenant/receptionist');
        }
      } else {
        log.webhook.warn('No TWILIO_WHATSAPP_NUMBER env var set for fallback lookup');
      }
      return twimlResponse('<Response></Response>');
    }

    log.webhook.info('Found phone record, routing to handler');

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

interface BookingDataLike {
  name?: string;
  date?: string;
  time?: string;
  service?: string;
}

function cleanAIText(text: string): string {
  return (text || '')
    .replace(/\[CHECK_AVAILABILITY:[^\]]+\]/g, '')
    .replace(/\[TRANSFER:[^\]]+\]/g, '')
    .replace(/\[BOOKING:[^\]]+\]/g, '')
    .replace(/\[CANCEL_BOOKING\]/g, '')
    .trim();
}

async function sendAndStoreWhatsAppMessage(params: {
  tenantId: string;
  phoneNumberId: string;
  contactId?: string;
  fromNumber: string;
  toNumber: string;
  body: string;
}) {
  const { sendWhatsApp } = await import('@/lib/telephony/twilio.service');
  const result = await sendWhatsApp(params.toNumber, params.body, params.fromNumber);

  const outgoingExists = result.messageSid
    ? await db.sMSMessage.findFirst({
        where: {
          tenantId: params.tenantId,
          providerSid: result.messageSid,
          direction: 'OUTBOUND',
        },
        select: { id: true },
      })
    : null;

  if (!outgoingExists) {
    await db.sMSMessage.create({
      data: {
        tenantId: params.tenantId,
        phoneNumberId: params.phoneNumberId,
        contactId: params.contactId,
        direction: 'OUTBOUND',
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        body: params.body,
        providerSid: result.messageSid,
        status: result.success ? 'sent' : 'failed',
        messageType: 'text',
      },
    });

    await db.usageRecord.create({
      data: {
        tenantId: params.tenantId,
        type: 'SMS_SENT',
        quantity: 1,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      },
    });
  }
}

async function buildAvailabilityMessage(
  tenantId: string,
  date: string,
  time: string
): Promise<string> {
  try {
    const { CalendarService } = await import('@/lib/services/calendar.service');
    const checkDate = new Date(`${date}T${time}:00`);
    if (isNaN(checkDate.getTime())) {
      return 'SLOT_UNAVAILABLE: The requested date/time format was invalid. Please ask for date in YYYY-MM-DD and time in HH:MM.';
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultMeetingDurationMinutes: true },
    });
    const durationMin = tenant?.defaultMeetingDurationMinutes ?? 30;
    const requestedEnd = new Date(checkDate.getTime() + durationMin * 60 * 1000);

    const conflict = await db.appointment.findFirst({
      where: {
        tenantId,
        status: { in: ['scheduled', 'confirmed'] },
        startTime: { lt: requestedEnd },
        endTime: { gt: checkDate },
      },
    });

    if (!conflict) {
      const friendlyDate = checkDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
      const friendlyTime = checkDate.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
      return `SLOT_AVAILABLE: ${friendlyTime} on ${friendlyDate} is free and available for booking.`;
    }

    const slots = await CalendarService.getAvailability(tenantId, checkDate, durationMin);
    const requestedMs = checkDate.getTime();
    const sorted = slots
      .sort((a, b) => Math.abs(a.start.getTime() - requestedMs) - Math.abs(b.start.getTime() - requestedMs))
      .slice(0, 3);

    const requestedTimeStr = checkDate.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

    if (sorted.length > 0) {
      const altList = sorted.map((s) =>
        s.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      ).join(', ');
      return `SLOT_UNAVAILABLE: ${requestedTimeStr} is already taken. 3 nearest available times: ${altList}. Please offer these to the caller.`;
    }

    return `SLOT_UNAVAILABLE: ${requestedTimeStr} is taken and there are no more available slots today. Please ask the caller to choose a different date.`;
  } catch (error) {
    log.webhook.error({ error, tenantId, date, time }, 'WhatsApp availability check error');
    return 'SLOT_AVAILABLE: Unable to verify right now. Ask the caller to confirm if they want to proceed.';
  }
}

async function createWhatsAppBooking(params: {
  tenantId: string;
  contactId?: string;
  from: string;
  bookingData?: BookingDataLike;
  durationMinutes?: number;
}) {
  const bd = params.bookingData || {};
  if (!params.contactId || !bd.date || !bd.time) return;

  const startTime = new Date(`${bd.date}T${bd.time}:00`);
  if (isNaN(startTime.getTime())) return;

  const durationMin = params.durationMinutes ?? 30;
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

  try {
    const { CalendarService } = await import('@/lib/services/calendar.service');
    await CalendarService.createAppointment({
      tenantId: params.tenantId,
      contactId: params.contactId,
      title: `Appointment: ${bd.name || 'WhatsApp User'} - ${bd.service || 'General'}`,
      description: `Booked via WhatsApp AI receptionist. Phone: ${params.from}`,
      startTime,
      endTime,
      source: 'whatsapp',
      notes: bd.service ? `Service: ${bd.service}` : undefined,
    });
    log.webhook.info({ bookingData: bd }, 'WhatsApp booking created');
  } catch (error) {
    log.webhook.error({ error, bookingData: bd }, 'WhatsApp booking creation error');
  }
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
    log.webhook.warn({ tenantStatus: tenant.status, receptionistId: receptionist?.id, receptionistStatus: receptionist?.status }, 'Tenant or Receptionist is inactive/cancelled');
    return twimlResponse('<Response></Response>');
  }

  log.webhook.info('Checking idempotency guard');

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
      log.webhook.info('Message already processed (idempotency guard caught)');
      return twimlResponse('<Response></Response>');
    }
  }

  log.webhook.info('Finding or creating contact');

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

  const aiConfig = {
    llmProvider: receptionist.llmProvider,
    llmModel: receptionist.llmModel,
    temperature: receptionist.temperature,
    maxTokens: receptionist.maxTokens,
    systemPrompt,
    knowledgeContext: knowledgeContext || undefined,
  };

  log.webhook.info('Generating AI Response');
  const aiResponse = await generateAIResponse(body, context, aiConfig);

  const cleanText = cleanAIText(aiResponse.text);
  log.webhook.info({ cleanTextLength: cleanText.length }, 'AI response generated');

  // Handle booking completion — create appointment via CalendarService
  if (aiResponse.bookingComplete && aiResponse.text.match(/\[BOOKING:/)) {
    await createWhatsAppBooking({
      tenantId: tenant.id,
      contactId,
      from,
      bookingData: context.metadata?.bookingData as BookingDataLike | undefined,
      durationMinutes: tenant.defaultMeetingDurationMinutes ?? 30,
    });
  }

  await sendAndStoreWhatsAppMessage({
    tenantId: tenant.id,
    phoneNumberId: phoneRecord.id,
    contactId,
    fromNumber: phoneRecord.number,
    toNumber: from,
    body: cleanText || 'Thank you for your message.',
  });

  if (aiResponse.availabilityCheckRequest) {
    const { date, time } = aiResponse.availabilityCheckRequest;
    const availabilityMessage = await buildAvailabilityMessage(tenant.id, date, time);

    const followupResponse = await generateAIResponse(
      `[SYSTEM: Availability check result] ${availabilityMessage}`,
      context,
      aiConfig
    );

    if (followupResponse.bookingComplete && followupResponse.text.match(/\[BOOKING:/)) {
      await createWhatsAppBooking({
        tenantId: tenant.id,
        contactId,
        from,
        bookingData: context.metadata?.bookingData as BookingDataLike | undefined,
        durationMinutes: tenant.defaultMeetingDurationMinutes ?? 30,
      });
    }

    const followupCleanText = cleanAIText(followupResponse.text);
    await sendAndStoreWhatsAppMessage({
      tenantId: tenant.id,
      phoneNumberId: phoneRecord.id,
      contactId,
      fromNumber: phoneRecord.number,
      toNumber: from,
      body: followupCleanText || 'I checked availability. Please share another time if needed.',
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
