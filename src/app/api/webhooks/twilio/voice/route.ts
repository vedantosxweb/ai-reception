// =============================================================================
// Twilio Voice Webhook - Handles incoming calls with AI pipeline
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { generateAIResponse, getOrCreateSession, buildReceptionistPrompt } from '@/lib/ai';
import { buildCustomerMemoryContext } from '@/lib/ai/memory';
import { KnowledgeBaseService } from '@/lib/knowledge/knowledge.service';
import { BillingService } from '@/lib/billing/creem.service';
import {
  buildGreetingTwiML,
  buildResponseTwiML,
  buildTransferTwiML,
  buildVoicemailTwiML,
  validateTwilioWebhook,
  startCallRecording,
} from '@/lib/telephony/twilio.service';
import { buildTwilioWebhookUrl, shouldEnforceTwilioWebhookSignature } from '@/lib/telephony/webhook';
import {
  setActiveCall,
  getActiveCall,
  deleteActiveCall,
  setAISession,
  type ActiveCallSession,
} from '@/lib/redis';
import type { BookingData } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const callSid = data.CallSid || '';
    const from = data.From || '';
    const to = data.To || '';
    const callStatus = data.CallStatus || '';
    const speechResult = data.SpeechResult || '';
    const digits = data.Digits || '';

    // Validate Twilio webhook signature
    if (shouldEnforceTwilioWebhookSignature()) {
      const twilioSignature = req.headers.get('x-twilio-signature') || '';
      const webhookUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/voice', req);
      if (!validateTwilioWebhook(webhookUrl, data, twilioSignature)) {
        log.webhook.warn({ callSid }, 'Invalid Twilio signature on voice webhook');
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    log.webhook.info({ callSid, from, to, status: callStatus, hasSpeech: !!speechResult }, 'Voice webhook received');

    // Retrieve active call session from Redis
    const existingSession = await getActiveCall(callSid);

    // Route based on status
    if (callStatus === 'ringing' || callStatus === 'queued' || (!speechResult && !digits && !existingSession)) {
      return handleIncomingCall(callSid, from, to);
    }

    if (speechResult || digits) {
      return handleUserInput(callSid, from, speechResult || digits);
    }

    if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed') {
      return handleCallEnd(callSid, callStatus);
    }

    // Default: gather more input
    const defaultLang = existingSession?.voiceLanguage;
    return twimlResponse(buildResponseTwiML({
      text: 'I\'m still here. How can I help you?',
      gatherUrl: buildTwilioWebhookUrl('/api/webhooks/twilio/voice', req),
      voiceName: 'Polly.Joanna',
      language: defaultLang,
    }));
  } catch (error) {
    log.webhook.error({ error }, 'Voice webhook error');
    return twimlResponse(
      '<Response><Say voice="Polly.Joanna">We apologize, but an error occurred. Please try again later.</Say><Hangup/></Response>'
    );
  }
}

async function handleIncomingCall(callSid: string, from: string, to: string) {
  const gatherUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/voice');

  // Look up phone number to find tenant and receptionist
  const phoneRecord = await db.phoneNumber.findUnique({
    where: { number: to },
    include: {
      tenant: true,
      receptionist: true,
    },
  });

  if (!phoneRecord || !phoneRecord.tenant || phoneRecord.tenant.status === 'CANCELLED') {
    return twimlResponse(
      '<Response><Say voice="Polly.Joanna">This number is not currently in service. Goodbye.</Say><Hangup/></Response>'
    );
  }

  const tenant = phoneRecord.tenant;
  const receptionist = phoneRecord.receptionist;

  if (!receptionist || receptionist.status !== 'ACTIVE') {
    return twimlResponse(
      '<Response><Say voice="Polly.Joanna">Thank you for calling. We are currently unable to take calls. Please try again later.</Say><Hangup/></Response>'
    );
  }

  // Check business hours with proper time comparison
  const now = new Date();
  const dayOfWeek = now.getDay();
  const businessHour = await db.businessHour.findFirst({
    where: { tenantId: tenant.id, dayOfWeek },
  });

  let isOpen = true; // Default to open if no hours configured
  if (businessHour) {
    if (!businessHour.isOpen) {
      isOpen = false;
    } else if (businessHour.openTime && businessHour.closeTime) {
      // Parse HH:MM format and compare against current time
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = businessHour.openTime.split(':').map(Number);
      const [closeH, closeM] = businessHour.closeTime.split(':').map(Number);
      const openMinutes = openH * 60 + (openM || 0);
      const closeMinutes = closeH * 60 + (closeM || 0);
      isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }
  }

  // Create contact if not exists
  let contactId: string | undefined;
  try {
    let contact = await db.contact.findFirst({ where: { tenantId: tenant.id, phone: from } });
    if (!contact) {
      contact = await db.contact.create({
        data: {
          tenantId: tenant.id,
          firstName: 'Caller',
          lastName: from.slice(-4),
          phone: from,
          source: 'voice',
          status: 'lead',
          lastContactAt: new Date(),
        },
      });
    } else {
      await db.contact.update({ where: { id: contact.id }, data: { lastContactAt: new Date() } });
    }
    contactId = contact.id;
  } catch (err) {
    log.webhook.error({ error: err, callSid }, 'Voice contact creation error');
  }

  // Create or reuse call record (idempotent for Twilio retries)
  const call = callSid
    ? await db.call.upsert({
        where: { providerCallSid: callSid },
        create: {
          tenantId: tenant.id,
          receptionistId: receptionist.id,
          phoneNumberId: phoneRecord.id,
          contactId,
          providerCallSid: callSid,
          callerNumber: from,
          dialedNumber: to,
          direction: 'INBOUND',
          status: 'IN_PROGRESS',
          startedAt: now,
          answeredAt: now,
        },
        update: {
          status: 'IN_PROGRESS',
          answeredAt: now,
        },
      })
    : await db.call.create({
        data: {
          tenantId: tenant.id,
          receptionistId: receptionist.id,
          phoneNumberId: phoneRecord.id,
          contactId,
          providerCallSid: callSid || undefined,
          callerNumber: from,
          dialedNumber: to,
          direction: 'INBOUND',
          status: 'IN_PROGRESS',
          startedAt: now,
          answeredAt: now,
        },
      });

  // Store session in Redis
  await setActiveCall(callSid, {
    tenantId: tenant.id,
    receptionistId: receptionist.id,
    phoneNumberId: phoneRecord.id,
    callId: call.id,
    callerNumber: from,
    startedAt: now.toISOString(),
    voiceLanguage: receptionist.voiceLanguage || 'en',
  });

  // Start call recording (fire-and-forget, don't block greeting)
  startCallRecording(callSid).then((res) => {
    if (res.success && res.recordingSid) {
      db.call.update({
        where: { id: call.id },
        data: { recordingSid: res.recordingSid },
      }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Failed to persist recording SID'));
    }
  }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Failed to start call recording'));

  // Build greeting
  let greeting = receptionist.greeting;
  const voiceLang = receptionist.voiceLanguage || 'en';
  if (!isOpen) {
    greeting = `Thank you for calling ${tenant.name}. We are currently closed. Our business hours are listed on our website. You can leave a message and we'll get back to you as soon as possible.`;

    if (!receptionist.neverSendToVoicemail) {
      return twimlResponse(buildVoicemailTwiML({
        message: greeting,
        callbackUrl: gatherUrl,
        language: voiceLang,
      }));
    }
  }

  // Log call event
  await db.callEvent.create({
    data: {
      tenantId: tenant.id,
      callId: call.id,
      type: 'call_started',
      data: { from, to, isOpen },
    },
  });

  return twimlResponse(buildGreetingTwiML({
    greeting,
    gatherUrl,
    voiceName: 'Polly.Joanna',
    language: voiceLang,
  }));
}

async function handleUserInput(callSid: string, from: string, input: string) {
  const gatherUrl = buildTwilioWebhookUrl('/api/webhooks/twilio/voice');
  const session = await getActiveCall(callSid);

  if (!session) {
    return twimlResponse(
      '<Response><Say voice="Polly.Joanna">I apologize, but there was a session error. Please call again.</Say><Hangup/></Response>'
    );
  }

  // Get receptionist config
  const receptionist = await db.aIReceptionist.findUnique({
    where: { id: session.receptionistId },
  });

  if (!receptionist) {
    return twimlResponse(buildResponseTwiML({
      text: 'I apologize, I\'m unable to assist right now. Goodbye.',
      gatherUrl,
      shouldHangup: true,
      language: session.voiceLanguage,
    }));
  }

  const voiceLang = session.voiceLanguage || receptionist.voiceLanguage || 'en';

  // Get knowledge context
  const knowledgeContext = await KnowledgeBaseService.getRelevantContext(
    session.tenantId,
    session.receptionistId,
    input
  );

  // Get tenant info
  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true, description: true, timezone: true, defaultMeetingDurationMinutes: true },
  });
  const customerMemory = await buildCustomerMemoryContext(session.tenantId, session.callerNumber || from);

  // Get directory
  const directory = await db.directoryEntry.findMany({
    where: { tenantId: session.tenantId },
  });

  // Get transfer rules
  const transferRules = await db.transferRule.findMany({
    where: { tenantId: session.tenantId, isActive: true },
    orderBy: { priority: 'desc' },
  });

  // Build business hours string
  const businessHours = await db.businessHour.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { dayOfWeek: 'asc' },
  });
  const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hoursStr = businessHours
    .filter((h) => h.isOpen)
    .map((h) => `${daysMap[h.dayOfWeek]}: ${h.openTime} - ${h.closeTime}`)
    .join(', ');

  // Get conversation context from Redis
  const context = await getOrCreateSession(callSid, session.tenantId, session.receptionistId, 'voice');

  // Build system prompt
  const systemPrompt = buildReceptionistPrompt({
    businessName: tenant?.name || 'Business',
    description: tenant?.description || undefined,
    greeting: receptionist.greeting,
    businessHours: hoursStr,
    customPrompt: receptionist.systemPrompt || undefined,
    channel: 'voice',
    operatingMode: receptionist.operatingMode,
    language: voiceLang,
    timezone: tenant?.timezone || 'UTC',
    defaultMeetingDurationMinutes: tenant?.defaultMeetingDurationMinutes ?? 30,
    customerMemory,
  });

  // Generate AI response
  const aiResponse = await generateAIResponse(input, context, {
    llmProvider: receptionist.llmProvider,
    llmModel: receptionist.llmModel,
    temperature: receptionist.temperature,
    maxTokens: receptionist.maxTokens,
    systemPrompt,
    knowledgeContext: knowledgeContext || undefined,
    transferRules: transferRules.map((r) => ({
      triggerType: r.triggerType,
      triggerValue: r.triggerValue,
      targetType: r.targetType,
      targetValue: r.targetValue,
    })),
    directory: directory.map((d) => ({
      name: d.name,
      department: d.department || undefined,
      phoneNumber: d.phoneNumber || undefined,
      extension: d.extension || undefined,
    })),
  });

  // Log transcript
  await db.transcript.createMany({
    data: [
      {
        tenantId: session.tenantId,
        callId: session.callId,
        speaker: 'CALLER',
        content: input,
      },
      {
        tenantId: session.tenantId,
        callId: session.callId,
        speaker: 'AI',
        content: aiResponse.text,
      },
    ],
  });

  // Log call event
  await db.callEvent.create({
    data: {
      tenantId: session.tenantId,
      callId: session.callId,
      type: 'ai_response',
      latencyMs: aiResponse.latencyMs,
      data: {
        intent: aiResponse.intent,
        sentiment: aiResponse.sentiment,
        confidence: aiResponse.confidence,
        leadScore: aiResponse.leadScore,
        tokenUsage: aiResponse.tokenUsage,
      },
    },
  });

  if (aiResponse.leadScore >= 80) {
    const alreadyFlagged = await db.callEvent.findFirst({
      where: { callId: session.callId, type: 'high_value_lead' },
      select: { id: true },
    });
    if (!alreadyFlagged) {
      await db.callEvent.create({
        data: {
          tenantId: session.tenantId,
          callId: session.callId,
          type: 'high_value_lead',
          data: { leadScore: aiResponse.leadScore, intent: aiResponse.intent },
        },
      });
    }
  }

  // Update call with latest analysis
  await db.call.update({
    where: { id: session.callId },
    data: {
      intent: aiResponse.intent,
      sentiment: aiResponse.sentiment,
      escalated: aiResponse.shouldEscalate,
    },
  });

  // Handle transfer
  if (aiResponse.shouldTransfer && aiResponse.transferTarget) {
    // Find transfer target in directory
    const directoryMatch = directory.find(
      (d) => d.name.toLowerCase().includes((aiResponse.transferTarget || '').toLowerCase()) ||
             d.phoneNumber === aiResponse.transferTarget
    );

    const transferNumber = directoryMatch?.phoneNumber || aiResponse.transferTarget;

    if (transferNumber && /^[\d+]/.test(transferNumber)) {
      await db.transfer.create({
        data: {
          tenantId: session.tenantId,
          callId: session.callId,
          type: 'BLIND',
          target: transferNumber,
          targetName: directoryMatch?.name,
          department: directoryMatch?.department || aiResponse.transferDepartment,
          reason: aiResponse.intent,
          status: 'INITIATED',
        },
      });

      // Clean transfer text (remove [TRANSFER:...] markers)
      const cleanText = aiResponse.text.replace(/\[TRANSFER:[^\]]+\]/g, '').trim();

      // Look up the dialed number to use as callerId
      const phoneRecord = await db.phoneNumber.findUnique({
        where: { id: session.phoneNumberId },
      });

      return twimlResponse(buildTransferTwiML({
        message: cleanText || 'Let me transfer you now. Please hold.',
        transferTo: transferNumber,
        callerId: phoneRecord?.number || process.env.TWILIO_PHONE_NUMBER,
        language: voiceLang,
      }));
    }
  }

  // =========================================================================
  // AVAILABILITY CHECK — Rule 1: Always check before confirming booking
  // =========================================================================
  if (aiResponse.availabilityCheckRequest) {
    const { date, time } = aiResponse.availabilityCheckRequest;
    let availabilityMessage = '';

    try {
      const { CalendarService } = await import('@/lib/services/calendar.service');
      const checkDate = new Date(`${date}T${time}:00`);
      const tenant = await db.tenant.findUnique({
        where: { id: session.tenantId },
        select: { defaultMeetingDurationMinutes: true, meetingBufferMinutes: true, slotStepMinutes: true },
      });
      const durationMin = tenant?.defaultMeetingDurationMinutes ?? 30;
      const requestedEnd = new Date(checkDate.getTime() + durationMin * 60 * 1000);

      // Check if requested slot conflicts with existing appointments
      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: session.tenantId,
          status: { in: ['scheduled', 'confirmed'] },
          startTime: { lt: requestedEnd },
          endTime: { gt: checkDate },
        },
      });

      if (!conflict) {
        // SLOT AVAILABLE
        const friendlyDate = checkDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });
        const friendlyTime = checkDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        availabilityMessage = `SLOT_AVAILABLE: ${friendlyTime} on ${friendlyDate} is free and available for booking.`;
      } else {
        // SLOT UNAVAILABLE — find 3 nearest alternatives (Rule 2)
        const slots = await CalendarService.getAvailability(session.tenantId, checkDate, durationMin);
        // Sort by proximity to requested time
        const requestedMs = checkDate.getTime();
        const sorted = slots
          .sort((a, b) => Math.abs(a.start.getTime() - requestedMs) - Math.abs(b.start.getTime() - requestedMs))
          .slice(0, 3);

        if (sorted.length > 0) {
          const altList = sorted.map((s) =>
            s.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          ).join(', ');
          const requestedTimeStr = checkDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          availabilityMessage = `SLOT_UNAVAILABLE: ${requestedTimeStr} is already taken. 3 nearest available times: ${altList}. Please offer these to the caller.`;
        } else {
          // No available slots on that day
          const requestedTimeStr = checkDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          availabilityMessage = `SLOT_UNAVAILABLE: ${requestedTimeStr} is taken and there are no more available slots today. Please ask the caller to choose a different date.`;
        }
      }
    } catch (err) {
      log.webhook.error({ error: err, callSid }, 'Voice availability check error');
      availabilityMessage = 'SLOT_AVAILABLE: Unable to verify — proceed with booking as requested.';
    }

    // Feed availability result back into the conversation and re-run AI
    context.history.push({
      role: 'user',
      content: `[SYSTEM: Availability check result] ${availabilityMessage}`,
      timestamp: new Date(),
    });
    await setAISession(context.sessionId, context);

    // Re-run AI with the availability result so it can respond to the caller
    const availContext = await getOrCreateSession(callSid, session.tenantId, session.receptionistId, 'voice');
    const followupResponse = await generateAIResponse(
      `[SYSTEM: Availability check result] ${availabilityMessage}`,
      availContext,
      {
        llmProvider: receptionist.llmProvider,
        llmModel: receptionist.llmModel,
        temperature: receptionist.temperature,
        maxTokens: receptionist.maxTokens,
        systemPrompt: buildReceptionistPrompt({
          businessName: tenant?.name || 'Business',
          description: tenant?.description || undefined,
          greeting: receptionist.greeting,
          customPrompt: receptionist.systemPrompt || undefined,
          channel: 'voice',
          operatingMode: receptionist.operatingMode,
          language: voiceLang,
          timezone: tenant?.timezone || 'UTC',
          defaultMeetingDurationMinutes: tenant?.defaultMeetingDurationMinutes ?? 30,
          customerMemory,
        }),
      }
    );

    const cleanAvailText = followupResponse.text
      .replace(/\[CHECK_AVAILABILITY:[^\]]+\]/g, '')
      .replace(/\[TRANSFER:[^\]]+\]/g, '')
      .replace(/\[BOOKING:[^\]]+\]/g, '')
      .replace(/\[CANCEL_BOOKING\]/g, '')
      .trim();

    // If the follow-up also triggered a booking completion, handle it
    if (followupResponse.bookingComplete && availContext.metadata?.bookingData) {
      await createBookingFromVoice(session, availContext.metadata.bookingData, callSid);
    }

    return twimlResponse(buildResponseTwiML({
      text: cleanAvailText || 'Let me check another time for you.',
      gatherUrl,
      voiceName: 'Polly.Joanna',
      language: voiceLang,
    }));
  }

  // =========================================================================
  // BOOKING COMPLETION — Rule 3 & 4: Confirmed slot, create appointment
  // =========================================================================
  if (aiResponse.bookingComplete && context.metadata?.bookingData) {
    const bd = context.metadata.bookingData as BookingData;
    if (!bd.date || !bd.time) {
      log.webhook.warn({ callSid }, 'Booking completion skipped: missing date/time');
      return twimlResponse(buildResponseTwiML({
        text: 'I need the appointment date and time to complete your booking.',
        gatherUrl,
        voiceName: 'Polly.Joanna',
        language: voiceLang,
      }));
    }

    // Do a final availability double-check to prevent race conditions
    try {
      const { CalendarService } = await import('@/lib/services/calendar.service');
      const tenant = await db.tenant.findUnique({
        where: { id: session.tenantId },
        select: { defaultMeetingDurationMinutes: true },
      });
      const durationMin = tenant?.defaultMeetingDurationMinutes ?? 30;
      const startTime = new Date(`${bd.date}T${bd.time}:00`);
      const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: session.tenantId,
          status: { in: ['scheduled', 'confirmed'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (conflict) {
        // Slot was taken between check and booking — get alternatives and re-prompt
        const slots = await CalendarService.getAvailability(session.tenantId, startTime, durationMin);
        const sorted = slots
          .sort((a, b) => Math.abs(a.start.getTime() - startTime.getTime()) - Math.abs(b.start.getTime() - startTime.getTime()))
          .slice(0, 3);
        const altList = sorted.map((s) =>
          s.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        ).join(', ');

        const retryText = sorted.length > 0
          ? `I'm sorry, that time slot was just taken. Here are the next available times: ${altList}. Which would you prefer?`
          : `I'm sorry, that slot was just taken and I don't see other availability today. Would you like to try a different day?`;

        return twimlResponse(buildResponseTwiML({
          text: retryText,
          gatherUrl,
          voiceName: 'Polly.Joanna',
          language: voiceLang,
        }));
      }

      // Slot is confirmed free — create the appointment
      await createBookingFromVoice(session, bd, callSid);
    } catch (err) {
      log.webhook.error({ error: err, callSid }, 'Voice booking completion error');
    }
  }

  // Handle emergency
  if (aiResponse.emergencyDetected) {
    await db.callEvent.create({
      data: {
        tenantId: session.tenantId,
        callId: session.callId,
        type: 'emergency_detected',
        data: { userInput: input },
      },
    });
  }

  // Send SMS follow-up if configured
  if (aiResponse.sendSms && receptionist.enableSmsFollowup && session.callerNumber) {
    try {
      const { sendSMS } = await import('@/lib/telephony/twilio.service');
      // Look up the phone number to send from the same number
      const phoneRecord = await db.phoneNumber.findUnique({
        where: { id: session.phoneNumberId },
      });
      await sendSMS(
        session.callerNumber,
        aiResponse.smsContent || 'Thank you for calling. Visit our website for more information.',
        phoneRecord?.number
      );
    } catch (err) {
      log.webhook.error({ error: err, callSid }, 'Voice SMS follow-up error');
    }
  }

  // Clean text for TTS — remove [TRANSFER:...] and [BOOKING:...] markers
  const cleanResponseText = aiResponse.text.replace(/\[TRANSFER:[^\]]+\]/g, '').replace(/\[BOOKING:[^\]]+\]/g, '').replace(/\[CANCEL_BOOKING\]/g, '').trim();

  return twimlResponse(buildResponseTwiML({
    text: cleanResponseText,
    gatherUrl,
    voiceName: 'Polly.Joanna',
    shouldHangup: aiResponse.intent === 'closing',
    language: voiceLang,
  }));
}

// =============================================================================
// Helper: Create booking from voice call data
// =============================================================================

async function createBookingFromVoice(
  session: import('@/lib/redis').ActiveCallSession,
  bookingData: BookingData,
  _callSid: string
): Promise<void> {
  try {
    const { CalendarService } = await import('@/lib/services/calendar.service');
    const alreadyBooked = await db.callEvent.findFirst({
      where: { callId: session.callId, type: 'booking_created' },
      select: { id: true },
    });
    if (alreadyBooked) {
      log.webhook.info({ callId: session.callId }, 'Skipping duplicate booking creation');
      return;
    }

    const callRecord = await db.call.findUnique({
      where: { id: session.callId },
      select: { contactId: true },
    });
    const contactId =
      callRecord?.contactId ??
      (await db.contact.findFirst({
        where: { tenantId: session.tenantId, phone: session.callerNumber },
        select: { id: true },
      }))?.id;

    if (!contactId) {
      log.webhook.error({ callerNumber: session.callerNumber, callId: session.callId }, 'Booking aborted: no contactId for caller');
      return;
    }

    const tenant = await db.tenant.findUnique({
      where: { id: session.tenantId },
      select: { defaultMeetingDurationMinutes: true },
    });
    const durationMin = tenant?.defaultMeetingDurationMinutes ?? 30;

    if (!bookingData.date || !bookingData.time) {
      log.webhook.warn({ callId: session.callId }, 'Booking creation skipped: missing date/time');
      return;
    }

    const startTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
    const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

    const result = await CalendarService.createAppointment({
      tenantId: session.tenantId,
      contactId,
      title: `Appointment: ${bookingData.name || 'Caller'} — ${bookingData.service || 'General'}`,
      description: `Booked via AI receptionist. Caller: ${session.callerNumber}`,
      startTime,
      endTime,
      source: 'voice',
      notes: bookingData.service ? `Service: ${bookingData.service}` : undefined,
    });

    if (result.success) {
      await db.callEvent.create({
        data: {
          tenantId: session.tenantId,
          callId: session.callId,
          type: 'booking_created',
          data: JSON.parse(JSON.stringify({ bookingData, appointmentId: result.appointmentId })),
        },
      });
      log.webhook.info(
        { appointmentId: result.appointmentId, callId: session.callId, bookingData },
        'Voice booking created'
      );
    } else {
      log.webhook.error({ callId: session.callId, error: result.error }, 'Voice booking creation failed');
    }
  } catch (err) {
    log.webhook.error({ error: err, callId: session.callId }, 'createBookingFromVoice error');
  }
}

async function handleCallEnd(callSid: string, status: string) {
  const session = await getActiveCall(callSid);

  if (session) {
    const startedAt = new Date(session.startedAt);
    const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000);

    await db.call.update({
      where: { id: session.callId },
      data: {
        status: status === 'completed' ? 'COMPLETED' : 'FAILED',
        duration,
        endedAt: new Date(),
      },
    }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Failed to update call on call end'));

    // Report usage (only here, NOT in the status webhook to avoid double-reporting)
    const minutes = Math.ceil(duration / 60);
    if (minutes > 0) {
      BillingService.reportUsage(session.tenantId, minutes, session.callId)
        .catch((err: unknown) => log.billing.error({ error: err, callSid }, 'Usage reporting failed'));
    }

    // Log event
    await db.callEvent.create({
      data: {
        tenantId: session.tenantId,
        callId: session.callId,
        type: 'call_ended',
        data: { status, duration },
      },
    }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'Failed to write call end event'));

    // HubSpot CRM sync — fire-and-forget
    try {
      const { HubSpotService } = await import('@/lib/services/hubspot.service');

      // Sync contact to HubSpot
      const contact = await db.contact.findFirst({
        where: { tenantId: session.tenantId, phone: session.callerNumber },
      });
      if (contact) {
        HubSpotService.syncContact(session.tenantId, contact.id)
          .catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'HubSpot contact sync error'));

        // Log call engagement to HubSpot
        HubSpotService.logCallEngagement(session.tenantId, {
          contactId: contact.id,
          callDuration: duration,
          sentiment: undefined,
          intent: undefined,
          direction: 'INBOUND',
        }).catch((err: unknown) => log.webhook.error({ error: err, callSid }, 'HubSpot call log error'));
      }
    } catch (err) {
      // Non-fatal — HubSpot may not be configured
      log.webhook.warn({ error: err, callSid }, 'HubSpot sync skipped');
    }

    // Clean up Redis sessions
    await deleteActiveCall(callSid);
  }

  return twimlResponse('<Response></Response>');
}

function twimlResponse(twiml: string): NextResponse {
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'voice-webhook',
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  });
}
