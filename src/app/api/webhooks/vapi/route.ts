
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { CalendarService } from '@/lib/services/calendar.service';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { type, message } = payload;

    log.webhook.info({ type, callId: payload.call?.id }, 'Vapi webhook received');

    switch (type) {
      case 'tool-call':
        return await handleToolCalls(payload);
      case 'end-of-call-report':
        await handleEndOfCallReport(payload);
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    log.webhook.error({ error }, 'Vapi webhook error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleToolCalls(payload: any) {
  const { toolCalls, call } = payload;
  const results = [];

  // Lookup tenant/receptionist context
  const receptionist = await db.aIReceptionist.findFirst({
    where: { vapiAssistantId: call.assistantId },
    include: { tenant: true }
  });

  if (!receptionist) {
    log.webhook.error({ assistantId: call.assistantId }, 'Receptionist not found for Vapi tool-call');
    return NextResponse.json({ error: 'Context not found' }, { status: 404 });
  }

  for (const toolCall of toolCalls) {
    const { name, parameters, id } = toolCall;
    let result;

    try {
      switch (name) {
        case 'checkAvailability':
          const slots = await CalendarService.getAvailability(
            receptionist.tenantId,
            new Date(parameters.date),
            parameters.duration
          );
          result = { slots: slots.map(s => ({ start: s.start, end: s.end })) };
          break;

        case 'bookAppointment':
          // Lookup or create contact
          let contact = await db.contact.findFirst({
            where: { tenantId: receptionist.tenantId, phone: call.customer.number }
          });

          if (!contact) {
            const [firstName, ...lastNameParts] = (parameters.name || 'Valued Customer').split(' ');
            contact = await db.contact.create({
              data: {
                tenantId: receptionist.tenantId,
                phone: call.customer.number,
                firstName,
                lastName: lastNameParts.join(' ') || 'Caller',
                source: 'vapi'
              }
            });
          }

          const bookingResult = await CalendarService.createAppointment({
            tenantId: receptionist.tenantId,
            contactId: contact.id,
            title: `Vapi Booking: ${parameters.name || 'Caller'}`,
            startTime: new Date(parameters.startTime),
            endTime: new Date(new Date(parameters.startTime).getTime() + (parameters.duration || 30) * 60000),
            source: 'vapi',
            notes: parameters.notes
          });
          result = bookingResult;
          break;

        default:
          result = { error: `Tool ${name} not implemented` };
      }
    } catch (err) {
      log.webhook.error({ err, tool: name }, 'Tool execution error');
      result = { error: 'Internal service error during tool execution' };
    }

    results.push({
      toolCallId: id,
      result
    });
  }

  return NextResponse.json({ results });
}

async function handleEndOfCallReport(payload: any) {
  const { call, analysis, artifact } = payload;
  
  // Lookup receptionist
  const receptionist = await db.aIReceptionist.findFirst({
    where: { vapiAssistantId: call.assistantId },
  });

  if (!receptionist) return;

  // Find or create call record
  const callRecord = await db.call.upsert({
    where: { providerCallSid: call.id },
    create: {
      tenantId: receptionist.tenantId,
      receptionistId: receptionist.id,
      providerCallSid: call.id,
      callerNumber: call.customer.number,
      dialedNumber: call.phoneNumber?.number || 'unknown',
      direction: 'INBOUND',
      status: 'COMPLETED',
      duration: Math.round(call.duration),
      summary: analysis.summary,
      intent: analysis.structuredData?.intent,
      sentiment: analysis.structuredData?.sentiment?.toUpperCase() as any,
    },
    update: {
      status: 'COMPLETED',
      duration: Math.round(call.duration),
      summary: analysis.summary,
      intent: analysis.structuredData?.intent,
      sentiment: analysis.structuredData?.sentiment?.toUpperCase() as any,
      endedAt: new Date(),
    }
  });

  // Sync Transcripts
  if (artifact.transcript) {
    const transcriptLines = artifact.transcript.split('\n').filter(Boolean);
    const data = transcriptLines.map((line: string) => {
      const isAI = line.startsWith('AI:') || line.startsWith('Assistant:');
      return {
        tenantId: receptionist.tenantId,
        callId: callRecord.id,
        speaker: isAI ? 'AI' : 'CALLER',
        content: line.replace(/^(AI|Assistant|Customer|User): /, ''),
      };
    });

    await db.transcript.createMany({ data });
  }

  log.webhook.info({ callId: call.id }, 'Vapi call report synced');
}
