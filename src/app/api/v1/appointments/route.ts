// =============================================================================
// Appointments API - CRUD + availability check
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { CalendarService } from '@/lib/services/calendar.service';
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  validateRequest,
} from '@/lib/security/validation';

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    // Check availability for a date
    if (action === 'availability') {
      const dateStr = searchParams.get('date');
      // Pass undefined if not specified so CalendarService uses tenant's defaultMeetingDurationMinutes
      const durationParam = searchParams.get('duration');
      const duration = durationParam ? parseInt(durationParam) : undefined;

      if (!dateStr) {
        return NextResponse.json({ success: false, error: 'date parameter required' }, { status: 400 });
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
      }

      const slots = await CalendarService.getAvailability(tenantId, date, duration);

      return NextResponse.json({
        success: true,
        data: slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
      });
    }

    // Get upcoming appointments
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (start && end) {
      const appointments = await CalendarService.getByDateRange(
        tenantId,
        new Date(start),
        new Date(end)
      );
      return NextResponse.json({ success: true, data: appointments });
    }

    const limit = parseInt(searchParams.get('limit') || '20');
    const appointments = await CalendarService.getUpcoming(tenantId, limit);
    return NextResponse.json({ success: true, data: appointments });
  } catch (err) {
    console.error('[Appointments API] Error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load appointments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const parsed = validateRequest(appointmentCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { contactId, title, description, startTime, endTime, staffId, notes } = parsed.data;

    const result = await CalendarService.createAppointment({
      tenantId,
      contactId,
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      staffId,
      notes,
      source: 'dashboard',
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: { id: result.appointmentId } });
  } catch (err) {
    console.error('[Appointments API] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create appointment' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const parsed = validateRequest(appointmentUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { id, status, title, description, startTime, endTime, notes } = parsed.data;

    const appointment = await db.appointment.findFirst({
      where: { id, tenantId },
    });

    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    // If cancelling, use the service method for Google Calendar cleanup
    if (status === 'cancelled') {
      const result = await CalendarService.cancelAppointment(id, tenantId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Otherwise, update fields
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime);
    if (notes !== undefined) updateData.notes = notes;

    await db.appointment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Appointments API] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update appointment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  const result = await CalendarService.cancelAppointment(id, tenantId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
