
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { CalendarService } from '@/lib/services/calendar.service';

export async function POST(req: Request) {
  const body = await req.json();
  log.webhook.info({ body }, 'Vapi webhook raw payload');

  try {
    const { type, message } = body;

    log.webhook.info({ type, callId: body.call?.id || body.message?.call?.id }, 'Vapi webhook received');

    // Vapi sometimes nests the call object or handles errors via 'error' type
    if (type === 'error') {
      log.webhook.error({ body }, 'Vapi reported an error');
      return NextResponse.json({ success: true });
    }

    switch (type) {
      case 'tool-call':
        return await handleToolCalls(body.message || body);
      case 'end-of-call-report':
        await handleEndOfCallReport(body.message || body);
        return NextResponse.json({ success: true });
      default:
        log.webhook.warn({ type }, 'Unhandled Vapi webhook type');
        return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    log.webhook.error({ error: error.message, stack: error.stack }, 'Vapi webhook processing exception');
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

async function handleToolCalls(payload: any) {
  const { toolCalls, call } = payload;
  
  if (!toolCalls || !call) {
    log.webhook.error({ payload }, 'Malformed Vapi tool-call payload');
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const results = [];
  const assistantId = call.assistantId;

  log.webhook.info({ assistantId, toolCount: toolCalls.length }, 'Processing Vapi tool calls');

  // Lookup tenant/receptionist context
  const receptionist = await (db as any).aIReceptionist.findFirst({
    where: { vapiAssistantId: assistantId },
    include: { tenant: true }
  });

  if (!receptionist) {
    log.webhook.error({ assistantId }, 'Receptionist not found for Vapi assistantId');
    // We return success: true but empty results or an error result so Vapi knows
    return NextResponse.json({ 
      results: toolCalls.map((t: any) => ({
        toolCallId: t.id,
        error: `Assistant context for ${assistantId} not found in database.`
      }))
    });
  }

  for (const toolCall of toolCalls) {
    const { name, parameters, id } = toolCall;
    let result;

    try {
      log.webhook.info({ tool: name, parameters }, 'Executing tool');

      switch (name) {
        case 'checkAvailability':
          if (!parameters?.date) throw new Error('Missing required parameter: date');
          const slots = await CalendarService.getAvailability(
            receptionist.tenantId,
            new Date(parameters.date),
            parameters.duration || 30
          );
          result = { slots: slots.map(s => ({ start: s.start, end: s.end })) };
          break;

        case 'bookAppointment':
          if (!parameters?.startTime) throw new Error('Missing required parameter: startTime');
          
          // Lookup or create contact
          const customerNumber = call.customer?.number || 'unknown';
          let contact = await db.contact.findFirst({
            where: { tenantId: receptionist.tenantId, phone: customerNumber }
          });

          if (!contact && customerNumber !== 'unknown') {
            const fullName = parameters.name || 'Valued Customer';
            const [firstName, ...lastNameParts] = fullName.split(' ');
            contact = await db.contact.create({
              data: {
                tenantId: receptionist.tenantId,
                phone: customerNumber,
                firstName,
                lastName: lastNameParts.join(' ') || 'Caller',
                source: 'vapi'
              }
            });
          }

          const bookingResult = await CalendarService.createAppointment({
            tenantId: receptionist.tenantId,
            contactId: contact?.id || '', // Handled by service if missing
            title: `Vapi Booking: ${parameters.name || 'Caller'}`,
            startTime: new Date(parameters.startTime),
            endTime: new Date(new Date(parameters.startTime).getTime() + (parameters.duration || 30) * 60000),
            source: 'vapi',
            notes: parameters.notes
          });
          result = bookingResult;
          break;

        default:
          log.webhook.warn({ tool: name }, 'Tool not implemented');
          result = { error: `Tool ${name} not implemented` };
      }
    } catch (err: any) {
      log.webhook.error({ err: err.message, tool: name }, 'Tool execution error');
      result = { error: err.message || 'Internal service error during tool execution' };
    }

    results.push({
      toolCallId: id,
      result
    });
  }

  return NextResponse.json({ results });
}

async function handleEndOfCallReport(payload: any) {
  try {
    const { call, analysis, artifact } = payload;
    if (!call || !analysis) {
      log.webhook.error({ payload }, 'Incomplete Vapi call report');
      return;
    }

    // Lookup receptionist
    const receptionist = await (db as any).aIReceptionist.findFirst({
      where: { vapiAssistantId: call.assistantId },
    });

    if (!receptionist) {
      log.webhook.error({ assistantId: call.assistantId }, 'Receptionist not found for end-of-call report');
      return;
    }

    // Find or create call record
    const callRecord = await db.call.upsert({
      where: { providerCallSid: call.id },
      create: {
        tenantId: receptionist.tenantId,
        receptionistId: receptionist.id,
        providerCallSid: call.id,
        callerNumber: call.customer?.number || 'unknown',
        dialedNumber: call.phoneNumber?.number || 'unknown',
        direction: 'INBOUND',
        status: 'COMPLETED',
        duration: Math.round(call.duration || 0),
        summary: analysis.summary || 'No summary provided',
        intent: analysis.structuredData?.intent,
        sentiment: (analysis.structuredData?.sentiment?.toUpperCase() || 'NEUTRAL') as any,
      },
      update: {
        status: 'COMPLETED',
        duration: Math.round(call.duration || 0),
        summary: analysis.summary || 'No summary provided',
        intent: analysis.structuredData?.intent,
        sentiment: (analysis.structuredData?.sentiment?.toUpperCase() || 'NEUTRAL') as any,
        endedAt: new Date(),
      }
    });

    // Sync Transcripts
    if (artifact?.transcript) {
      log.webhook.info({ callId: call.id }, 'Syncing transcripts');
      const transcriptLines = artifact.transcript.split('\n').filter(Boolean);
      const data = transcriptLines.map((line: string) => {
        const isAI = line.toLowerCase().startsWith('ai:') || line.toLowerCase().startsWith('assistant:');
        return {
          tenantId: receptionist.tenantId,
          callId: callRecord.id,
          speaker: isAI ? 'AI' as const : 'CALLER' as const,
          content: line.replace(/^(AI|Assistant|Customer|User|Caller): /i, ''),
        };
      });

      if (data.length > 0) {
        await db.transcript.createMany({ data });
      }
    }

    log.webhook.info({ callId: call.id, recordId: callRecord.id }, 'Vapi call report synced successfully');
  } catch (err: any) {
    log.webhook.error({ err: err.message, stack: err.stack }, 'Error in handleEndOfCallReport');
  }
}
