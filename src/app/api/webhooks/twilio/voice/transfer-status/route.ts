import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { NotificationService } from '@/lib/services/notification.service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries()) as Record<string, string>;

    const callSid = data.CallSid;
    const dialSid = data.DialSid;
    const dialCallStatus = data.DialCallStatus; // completed, answered, busy, no-answer, failed
    const to = data.To;

    log.telephony.info({ callSid, dialCallStatus, to }, 'Transfer status callback received');

    // Find the transfer record
    const transfer = await db.transfer.findFirst({
      where: { call: { callSid } },
      include: { tenant: true, call: true },
      orderBy: { createdAt: 'desc' }
    }) as any;

    if (!transfer) {
      return new NextResponse('OK', { status: 200 });
    }

    // Update transfer status
    await db.transfer.update({
      where: { id: transfer.id },
      data: { 
        status: dialCallStatus === 'answered' ? 'COMPLETED' : 'FAILED',
        error: dialCallStatus !== 'answered' ? dialCallStatus : undefined
      }
    });

    // AI-11: If it was an escalation and it failed/unanswered, send WhatsApp
    if (transfer.reason === 'escalation' && dialCallStatus !== 'answered') {
      const tenant = transfer.tenant;
      // In a real app, we'd look up the owner's WhatsApp number from tenant settings
      const ownerWhatsApp = process.env.OWNER_WHATSAPP_NUMBER; 

      if (ownerWhatsApp) {
        await NotificationService.sendWhatsAppEscalationAlert({
          to: ownerWhatsApp,
          businessName: tenant.name,
          callerNumber: transfer.call.callerNumber || 'Unknown',
          reason: `Escalation transfer to ${transfer.targetName || transfer.target} was ${dialCallStatus}`
        }).catch(err => log.telephony.error({ err }, 'Failed to send WhatsApp escalation alert from callback'));
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    log.telephony.error({ error }, 'Transfer status callback error');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
