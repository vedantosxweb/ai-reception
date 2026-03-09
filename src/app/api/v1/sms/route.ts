// =============================================================================
// SMS API - Send SMS messages and view SMS history
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { isTwilioConfigured, sendSMS } from '@/lib/telephony/twilio.service';

// GET /api/v1/sms - List SMS messages for the tenant
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const direction = searchParams.get('direction');
  const contactId = searchParams.get('contactId');
  const phoneNumberId = searchParams.get('phoneNumberId');
  const search = searchParams.get('search');

  const where: Record<string, unknown> = {
    tenantId: session.user.tenantId,
  };

  if (direction) where.direction = direction.toUpperCase();
  if (contactId) where.contactId = contactId;
  if (phoneNumberId) where.phoneNumberId = phoneNumberId;
  if (search) {
    where.OR = [
      { body: { contains: search, mode: 'insensitive' } },
      { fromNumber: { contains: search } },
      { toNumber: { contains: search } },
    ];
  }

  const [messages, total] = await Promise.all([
    db.sMSMessage.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        phoneNumber: { select: { id: true, number: true, friendlyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.sMSMessage.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: messages,
    meta: { page, limit, total },
  });
}

// POST /api/v1/sms - Send an SMS message
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { to, message, fromPhoneNumberId } = body;

    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: 'to and message are required' },
        { status: 400 }
      );
    }

    if (message.length > 1600) {
      return NextResponse.json(
        { success: false, error: 'Message exceeds 1600 character limit' },
        { status: 400 }
      );
    }

    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { success: false, error: 'SMS provider not configured' },
        { status: 503 }
      );
    }

    // Determine from number
    let fromNumber: string | undefined;
    if (fromPhoneNumberId) {
      const phoneRecord = await db.phoneNumber.findFirst({
        where: { id: fromPhoneNumberId, tenantId: session.user.tenantId, status: 'ACTIVE' },
      });
      if (!phoneRecord) {
        return NextResponse.json({ success: false, error: 'From phone number not found or inactive' }, { status: 404 });
      }
      fromNumber = phoneRecord.number;
    }

    const result = await sendSMS(to, message, fromNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    // Find or create contact
    let contact = await db.contact.findFirst({
      where: { tenantId: session.user.tenantId, phone: to },
    });

    if (!contact) {
      contact = await db.contact.create({
        data: {
          tenantId: session.user.tenantId,
          firstName: 'Unknown',
          lastName: '',
          phone: to,
          source: 'manual_sms',
        },
      });
    }

    // Store the message
    const smsRecord = await db.sMSMessage.create({
      data: {
        tenantId: session.user.tenantId,
        phoneNumberId: fromPhoneNumberId || null,
        contactId: contact.id,
        direction: 'OUTBOUND',
        fromNumber: fromNumber || process.env.TWILIO_PHONE_NUMBER || '',
        toNumber: to,
        body: message,
        providerSid: result.messageSid,
        status: 'sent',
        messageType: 'text',
      },
    });

    // Track usage
    const now = new Date();
    await db.usageRecord.create({
      data: {
        tenantId: session.user.tenantId,
        type: 'SMS_SENT',
        quantity: 1,
        periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
        periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'sms.sent',
        resource: 'SMSMessage',
        resourceId: smsRecord.id,
        details: { to, messageLength: message.length },
      },
    });

    return NextResponse.json({ success: true, data: smsRecord }, { status: 201 });
  } catch (err) {
    console.error('[SMS] Send error:', err);
    return NextResponse.json({ success: false, error: 'Failed to send SMS' }, { status: 500 });
  }
}
