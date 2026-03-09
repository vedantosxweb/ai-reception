// =============================================================================
// Availability Exceptions API - Block specific times (recurring or one-off)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

// GET - List exceptions for the tenant
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const list = await db.availabilityException.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return NextResponse.json({ success: true, data: list });
}

// POST - Create exception
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { dayOfWeek, exceptionDate, startTime, endTime, label } = body;

    if (startTime == null || endTime == null) {
      return NextResponse.json(
        { success: false, error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }
    const dow = exceptionDate == null ? (typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : 0) : 0;
    const exDate = exceptionDate ? new Date(exceptionDate) : null;

    const row = await db.availabilityException.create({
      data: {
        tenantId: session.user.tenantId,
        dayOfWeek: dow,
        exceptionDate: exDate,
        startTime: String(startTime),
        endTime: String(endTime),
        label: label || null,
      },
    });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    console.error('[AvailabilityExceptions] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create exception' }, { status: 500 });
  }
}

// DELETE - Remove exception
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const existing = await db.availabilityException.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await db.availabilityException.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
