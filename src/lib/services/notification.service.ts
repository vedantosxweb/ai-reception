import twilio from 'twilio';
import { log } from '@/lib/logger';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export class NotificationService {
  /**
   * Sends a WhatsApp notification to a business owner
   */
  static async sendWhatsAppEscalationAlert(options: {
    to: string;
    businessName: string;
    callerNumber: string;
    reason: string;
  }) {
    try {
      const from = process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
      const to = options.to.startsWith('whatsapp:') ? options.to : `whatsapp:${options.to}`;

      const message = await client.messages.create({
        from,
        to,
        body: `🚨 *Escalation Alert* for ${options.businessName}\n\nAn urgent call from ${options.callerNumber} was not answered and requires immediate attention.\nReason: ${options.reason}`,
      });

      log.telephony.info({ messageSid: message.sid, to }, 'WhatsApp escalation alert sent');
      return message;
    } catch (error) {
      log.telephony.error({ error, to: options.to }, 'Failed to send WhatsApp alert');
      throw error;
    }
  }

  /**
   * Sends a WhatsApp notification for a missed call
   */
  static async sendWhatsAppMissedCallAlert(options: {
    to: string;
    businessName: string;
    callerNumber: string;
    status: string;
  }) {
    try {
      const from = process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
      const to = options.to.startsWith('whatsapp:') ? options.to : `whatsapp:${options.to}`;

      const message = await client.messages.create({
        from,
        to,
        body: `📵 *Missed Call* for ${options.businessName}\n\nYou missed a call from ${options.callerNumber}.\nStatus: ${options.status}\n\nYou can view details on your dashboard.`,
      });

      log.telephony.info({ messageSid: message.sid, to }, 'WhatsApp missed call alert sent');
      return message;
    } catch (error) {
      log.telephony.error({ error, to: options.to }, 'Failed to send WhatsApp missed call alert');
      throw error;
    }
  }

  /**
   * Broadcasts a missed call alert to all configured channels (Email, WhatsApp)
   */
  static async broadcastMissedCallAlert(options: {
    tenantId: string;
    callerNumber: string;
    dialedNumber: string;
    status: string;
    startedAt: Date | string;
    contactName?: string;
    receptionistName?: string;
  }) {
    const { db } = await import('@/lib/db');
    const { enqueueEmailNotification } = await import('@/lib/queue');
    const tenant = await db.tenant.findUnique({
      where: { id: options.tenantId },
      include: { users: { where: { role: 'OWNER', status: 'ACTIVE' } } }
    });

    if (!tenant) return;

    // 1. Queue Email Notification
    await enqueueEmailNotification({
      type: 'missed_call',
      tenantId: options.tenantId,
      data: options as unknown as Record<string, unknown>,
    });

    // 2. Send WhatsApp Notifications to Owners
    for (const owner of tenant.users) {
      if (owner.phone) {
        await this.sendWhatsAppMissedCallAlert({
          to: owner.phone,
          businessName: tenant.name,
          callerNumber: options.callerNumber,
          status: options.status,
        }).catch(err => log.telephony.error({ err }, 'Failed to send owner WhatsApp alert'));
      }
    }
  }
}
