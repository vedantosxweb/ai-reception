// =============================================================================
// Phone Numbers API - Manage provisioned phone numbers
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { isTwilioConfigured, provisionPhoneNumber } from '@/lib/telephony/twilio.service';
import {
  phoneNumberProvisionSchema,
  phoneNumberUpdateSchema,
  validateRequest,
} from '@/lib/security/validation';

// GET /api/v1/phone-numbers - List phone numbers for the tenant
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const phoneNumbers = await db.phoneNumber.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      receptionist: { select: { id: true, name: true, status: true } },
      _count: { select: { calls: true, smsMessages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: phoneNumbers });
}

// POST /api/v1/phone-numbers - Provision a new phone number
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = validateRequest(phoneNumberProvisionSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { areaCode, receptionistId } = parsed.data;

    // Check plan limits
    const tenant = await db.tenant.findUnique({ where: { id: session.user.tenantId } });
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const currentCount = await db.phoneNumber.count({
      where: { tenantId: session.user.tenantId },
    });

    if (currentCount >= tenant.maxPhoneNumbers) {
      return NextResponse.json(
        {
          success: false,
          error: `Phone number limit reached (${currentCount}/${tenant.maxPhoneNumbers}). Upgrade your plan to add more.`,
        },
        { status: 403 }
      );
    }

    // If receptionistId provided, verify it belongs to the tenant
    if (receptionistId) {
      const receptionist = await db.aIReceptionist.findFirst({
        where: { id: receptionistId, tenantId: session.user.tenantId },
      });
      if (!receptionist) {
        return NextResponse.json({ success: false, error: 'Receptionist not found' }, { status: 404 });
      }
    }

    // Provision through Twilio
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Telephony provider not configured' },
        { status: 503 }
      );
    }

    const result = await provisionPhoneNumber(
      session.user.tenantId,
      areaCode || undefined
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to provision phone number. No numbers available for the requested area code.' },
        { status: 500 }
      );
    }

    // Look up the newly created phone number record
    const phoneRecord = await db.phoneNumber.findFirst({
      where: { tenantId: session.user.tenantId, number: result.number },
    });

    if (!phoneRecord) {
      return NextResponse.json(
        { success: false, error: 'Phone number provisioned but record not found' },
        { status: 500 }
      );
    }

    // Assign to receptionist if provided
    if (receptionistId) {
      await db.phoneNumber.update({
        where: { id: phoneRecord.id },
        data: { receptionistId },
      });
    }

    const phoneNumber = await db.phoneNumber.findUnique({
      where: { id: phoneRecord.id },
      include: { receptionist: { select: { id: true, name: true } } },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'phone_number.provisioned',
        resource: 'PhoneNumber',
        resourceId: phoneRecord.id,
        details: { number: result.number, areaCode },
      },
    });

    return NextResponse.json({ success: true, data: phoneNumber }, { status: 201 });
  } catch (err) {
    console.error('[PhoneNumbers] Provision error:', err);
    return NextResponse.json({ success: false, error: 'Failed to provision phone number' }, { status: 500 });
  }
}

// PATCH /api/v1/phone-numbers - Update phone number assignment
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const normalized = {
      ...body,
      status: typeof body?.status === 'string' ? body.status.toUpperCase() : body?.status,
    };
    const parsed = validateRequest(phoneNumberUpdateSchema, normalized);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { id, receptionistId, friendlyName, status } = parsed.data;

    const existing = await db.phoneNumber.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Phone number not found' }, { status: 404 });
    }

    // Validate receptionist if provided
    if (receptionistId) {
      const receptionist = await db.aIReceptionist.findFirst({
        where: { id: receptionistId, tenantId: session.user.tenantId },
      });
      if (!receptionist) {
        return NextResponse.json({ success: false, error: 'Receptionist not found' }, { status: 404 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (receptionistId !== undefined) updateData.receptionistId = receptionistId || null;
    if (friendlyName !== undefined) updateData.friendlyName = friendlyName;
    if (status) updateData.status = status;

    const updated = await db.phoneNumber.update({
      where: { id },
      data: updateData,
      include: { receptionist: { select: { id: true, name: true } } },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'phone_number.updated',
        resource: 'PhoneNumber',
        resourceId: id,
        details: { updatedFields: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[PhoneNumbers] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update phone number' }, { status: 500 });
  }
}

// DELETE /api/v1/phone-numbers - Release a phone number
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Phone number ID required' }, { status: 400 });
  }

  const existing = await db.phoneNumber.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Phone number not found' }, { status: 404 });
  }

  // Check for active calls before deleting
  const activeCalls = await db.call.count({
    where: { phoneNumberId: id, status: 'IN_PROGRESS' },
  });

  if (activeCalls > 0) {
    return NextResponse.json(
      { success: false, error: 'Cannot release phone number with active calls' },
      { status: 409 }
    );
  }

  // Mark as inactive rather than hard deleting (preserves call history)
  await db.phoneNumber.update({
    where: { id },
    data: { status: 'INACTIVE', receptionistId: null },
  });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'phone_number.released',
      resource: 'PhoneNumber',
      resourceId: id,
      details: { number: existing.number },
    },
  });

  return NextResponse.json({ success: true, message: 'Phone number released' });
}
