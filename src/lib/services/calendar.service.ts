// =============================================================================
// Calendar Service - Appointment booking + Google Calendar sync
// =============================================================================

import { db } from '@/lib/db';
import { google } from 'googleapis';
import { deserializeIntegrationCredentials } from '@/lib/security/integration-credentials';
import { log } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface BookingRequest {
  tenantId: string;
  contactId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  source?: string;
  staffId?: string;
  notes?: string;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
}

// =============================================================================
// Google Calendar Auth
// =============================================================================

function getGoogleCalendarClient(credentials: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const auth = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret
  );
  auth.setCredentials({ refresh_token: credentials.refreshToken });
  return google.calendar({ version: 'v3', auth });
}

function getGoogleCredentials(raw: unknown): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const creds = deserializeIntegrationCredentials(raw);
  if (!creds?.clientId || !creds.clientSecret || !creds.refreshToken) return null;
  return {
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    refreshToken: creds.refreshToken,
  };
}

async function getCalendarIntegration(tenantId: string) {
  const integration = await db.integration.findUnique({
    where: { tenantId_provider: { tenantId, provider: 'google_calendar' } },
  });
  if (!integration || integration.status !== 'active' || !integration.credentials) {
    return null;
  }
  return integration;
}

// =============================================================================
// Availability Checking
// =============================================================================

export class CalendarService {
  /**
   * Get available time slots for a given date.
   * Uses business hours + existing appointments + availability exceptions to find open slots.
   * If Google Calendar is connected, also checks GCal busy times.
   */
  static async getAvailability(
    tenantId: string,
    date: Date,
    durationMinutes?: number
  ): Promise<AvailabilitySlot[]> {
    const dayOfWeek = date.getDay();
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        defaultMeetingDurationMinutes: true,
        meetingBufferMinutes: true,
        slotStepMinutes: true,
      },
    });
    const duration = durationMinutes ?? tenant?.defaultMeetingDurationMinutes ?? 30;
    const bufferMinutes = tenant?.meetingBufferMinutes ?? 0;
    const stepMinutes = tenant?.slotStepMinutes ?? 15;

    // Get business hours for this day
    const businessHour = await db.businessHour.findFirst({
      where: { tenantId, dayOfWeek },
    });

    if (!businessHour || !businessHour.isOpen) {
      return []; // Closed
    }

    const [openH, openM] = businessHour.openTime.split(':').map(Number);
    const [closeH, closeM] = businessHour.closeTime.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(openH, openM || 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(closeH, closeM || 0, 0, 0);

    // Get availability exceptions for this day (recurring by dayOfWeek or one-off by exceptionDate)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nextDay = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000);
    const exceptions = await db.availabilityException.findMany({
      where: {
        tenantId,
        OR: [
          { exceptionDate: null, dayOfWeek },
          { exceptionDate: { gte: dateOnly, lt: nextDay } },
        ],
      },
    });

    // Build blocked ranges from exceptions (same day, start/end as time strings)
    const exceptionBlocks: Array<{ start: Date; end: Date }> = exceptions.map((ex) => {
      const [sH, sM] = ex.startTime.split(':').map(Number);
      const [eH, eM] = ex.endTime.split(':').map(Number);
      const start = new Date(date);
      start.setHours(sH, sM || 0, 0, 0);
      const end = new Date(date);
      end.setHours(eH, eM || 0, 0, 0);
      return { start, end };
    });

    // Get existing appointments for this day
    const existingAppointments = await db.appointment.findMany({
      where: {
        tenantId,
        status: { in: ['scheduled', 'confirmed'] },
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
      orderBy: { startTime: 'asc' },
    });

    // Also check Google Calendar if connected
    let gcalBusyTimes: Array<{ start: Date; end: Date }> = [];
    try {
      const integration = await getCalendarIntegration(tenantId);
      if (integration) {
        const credentials = getGoogleCredentials(integration.credentials);
        if (credentials) {
          const calendar = getGoogleCalendarClient(credentials);
          const calendarId = (integration.config as { calendarId?: string })?.calendarId || 'primary';

          const freeBusy = await calendar.freebusy.query({
            requestBody: {
              timeMin: dayStart.toISOString(),
              timeMax: dayEnd.toISOString(),
              items: [{ id: calendarId }],
            },
          });

          const busy = freeBusy.data.calendars?.[calendarId]?.busy || [];
          gcalBusyTimes = busy
            .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
            .map((b) => ({
              start: new Date(b.start),
              end: new Date(b.end),
            }));
        }
      }
    } catch (err) {
      log.api.error({ error: err, tenantId }, 'Google Calendar freebusy check failed');
    }

    // Merge all busy times (appointments + gcal + exception blocks)
    const allBusy = [
      ...existingAppointments.map((a) => ({ start: a.startTime, end: a.endTime })),
      ...gcalBusyTimes,
      ...exceptionBlocks,
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find open slots
    const slots: AvailabilitySlot[] = [];
    let cursor = dayStart;
    const durationMs = duration * 60000;
    const bufferMs = bufferMinutes * 60000;
    const stepMs = stepMinutes * 60000;

    for (const busy of allBusy) {
      while (cursor.getTime() + durationMs <= busy.start.getTime()) {
        const slotEnd = new Date(cursor.getTime() + durationMs);
        if (slotEnd <= dayEnd) {
          slots.push({ start: new Date(cursor), end: slotEnd });
        }
        cursor = new Date(cursor.getTime() + stepMs);
      }
      // Move cursor past the busy period (including buffer)
      const busyEndWithBuffer = new Date(busy.end.getTime() + bufferMs);
      if (busyEndWithBuffer > cursor) {
        cursor = new Date(busyEndWithBuffer);
      }
    }

    // Fill remaining slots after all busy times
    while (cursor.getTime() + durationMs <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMs);
      slots.push({ start: new Date(cursor), end: slotEnd });
      cursor = new Date(cursor.getTime() + stepMs);
    }

    return slots;
  }

  // ===========================================================================
  // Appointment CRUD
  // ===========================================================================

  /**
   * Create an appointment and optionally sync to Google Calendar.
   */
  static async createAppointment(request: BookingRequest): Promise<{
    success: boolean;
    appointmentId?: string;
    error?: string;
  }> {
    try {
      // Check for conflicts
      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: request.tenantId,
          status: { in: ['scheduled', 'confirmed'] },
          OR: [
            {
              startTime: { lt: request.endTime },
              endTime: { gt: request.startTime },
            },
          ],
        },
      });

      if (conflict) {
        return { success: false, error: 'Time slot is no longer available. Please choose another time.' };
      }

      // Create appointment
      const appointment = await db.appointment.create({
        data: {
          tenantId: request.tenantId,
          contactId: request.contactId,
          staffId: request.staffId,
          title: request.title,
          description: request.description,
          startTime: request.startTime,
          endTime: request.endTime,
          source: request.source || 'ai_voice',
          notes: request.notes,
          status: 'scheduled',
        },
      });

      // Sync to Google Calendar if connected
      try {
        const integration = await getCalendarIntegration(request.tenantId);
        if (integration) {
          const contact = await db.contact.findUnique({ where: { id: request.contactId } });
          const credentials = getGoogleCredentials(integration.credentials);
          if (credentials) {
            const calendar = getGoogleCalendarClient(credentials);
            const calendarId = (integration.config as { calendarId?: string })?.calendarId || 'primary';

            const event = await calendar.events.insert({
              calendarId,
              requestBody: {
                summary: request.title,
                description: `${request.description || ''}\n\nBooked via AI Receptionist\nContact: ${contact?.firstName} ${contact?.lastName} (${contact?.phone || contact?.email || 'N/A'})`,
                start: { dateTime: request.startTime.toISOString() },
                end: { dateTime: request.endTime.toISOString() },
              },
            });

            if (event.data.id) {
              await db.appointment.update({
                where: { id: appointment.id },
                data: { externalEventId: event.data.id },
              });
            }
          }
        }
      } catch (err) {
        log.api.error({ error: err, tenantId: request.tenantId }, 'Google Calendar sync failed');
        // Non-fatal — appointment is still created locally
      }

      return { success: true, appointmentId: appointment.id };
    } catch (err) {
      log.api.error({ error: err, tenantId: request.tenantId }, 'Create appointment error');
      return { success: false, error: 'Failed to create appointment' };
    }
  }

  /**
   * Cancel an appointment and remove from Google Calendar if synced.
   */
  static async cancelAppointment(
    appointmentId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const appointment = await db.appointment.findFirst({
        where: { id: appointmentId, tenantId },
      });

      if (!appointment) {
        return { success: false, error: 'Appointment not found' };
      }

      await db.appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled' },
      });

      // Remove from Google Calendar
      if (appointment.externalEventId) {
        try {
          const integration = await getCalendarIntegration(tenantId);
          if (integration) {
            const credentials = getGoogleCredentials(integration.credentials);
            if (credentials) {
              const calendar = getGoogleCalendarClient(credentials);
              const calendarId = (integration.config as { calendarId?: string })?.calendarId || 'primary';
              await calendar.events.delete({ calendarId, eventId: appointment.externalEventId });
            }
          }
        } catch (err) {
          log.api.error({ error: err, tenantId }, 'Google Calendar delete failed');
        }
      }

      return { success: true };
    } catch (err) {
      log.api.error({ error: err, tenantId }, 'Cancel appointment error');
      return { success: false, error: 'Failed to cancel appointment' };
    }
  }

  /**
   * Get upcoming appointments for a tenant.
   */
  static async getUpcoming(tenantId: string, limit: number = 20) {
    return db.appointment.findMany({
      where: {
        tenantId,
        status: { in: ['scheduled', 'confirmed'] },
        startTime: { gte: new Date() },
      },
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
        staff: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  /**
   * Get all appointments for a date range.
   */
  static async getByDateRange(tenantId: string, start: Date, end: Date) {
    return db.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: start },
        endTime: { lte: end },
      },
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
        staff: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
