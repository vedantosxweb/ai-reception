// =============================================================================
// Tenant API - Manage tenant settings
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';

// GET /api/v1/tenants - Get current tenant
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenant = await db.tenant.findUnique({
    where: { id: session.user.tenantId },
    include: {
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      availabilityExceptions: { orderBy: { dayOfWeek: 'asc' } },
      _count: {
        select: {
          users: true,
          aiReceptionists: true,
          phoneNumbers: true,
          calls: true,
          knowledgeSources: true,
        },
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: tenant });
}

// PATCH /api/v1/tenants - Update tenant
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const {
      name, website, description, logoUrl, industry, timezone, defaultLanguage,
      defaultMeetingDurationMinutes,
      meetingBufferMinutes,
      slotStepMinutes,
      businessHours, // Array of { dayOfWeek, openTime, closeTime, isOpen }
    } = body;

    const updated = await db.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        ...(name ? { name } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(timezone ? { timezone } : {}),
        ...(defaultLanguage ? { defaultLanguage } : {}),
        ...(typeof defaultMeetingDurationMinutes === 'number' && defaultMeetingDurationMinutes >= 15 && defaultMeetingDurationMinutes <= 480
          ? { defaultMeetingDurationMinutes } : {}),
        ...(typeof meetingBufferMinutes === 'number' && meetingBufferMinutes >= 0 && meetingBufferMinutes <= 120
          ? { meetingBufferMinutes } : {}),
        ...(typeof slotStepMinutes === 'number' && [5, 10, 15, 30, 60].includes(slotStepMinutes)
          ? { slotStepMinutes } : {}),
      },
    });

    // Update business hours if provided
    if (businessHours && Array.isArray(businessHours)) {
      for (const hour of businessHours) {
        await db.businessHour.upsert({
          where: {
            tenantId_dayOfWeek: {
              tenantId: session.user.tenantId,
              dayOfWeek: hour.dayOfWeek,
            },
          },
          create: {
            tenantId: session.user.tenantId,
            dayOfWeek: hour.dayOfWeek,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isOpen: hour.isOpen,
          },
          update: {
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isOpen: hour.isOpen,
          },
        });
      }
    }

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'tenant.updated',
        resource: 'tenant',
        resourceId: session.user.tenantId,
        details: { fields: Object.keys(body) },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Tenant] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update tenant' }, { status: 500 });
  }
}
