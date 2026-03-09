import { db } from '@/lib/db';

function fmtDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function buildCustomerMemoryContext(
  tenantId: string,
  callerNumber?: string
): Promise<string | undefined> {
  if (!callerNumber) return undefined;

  const contact = await db.contact.findFirst({
    where: { tenantId, phone: callerNumber },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      lastContactAt: true,
      source: true,
    },
  });

  if (!contact) return undefined;

  const [recentCalls, upcomingAppointment, lastAppointment] = await Promise.all([
    db.call.findMany({
      where: { tenantId, callerNumber },
      select: { startedAt: true, intent: true, sentiment: true, direction: true, status: true },
      orderBy: { startedAt: 'desc' },
      take: 3,
    }),
    db.appointment.findFirst({
      where: {
        tenantId,
        contact: { phone: callerNumber },
        startTime: { gte: new Date() },
        status: { in: ['scheduled', 'confirmed'] },
      },
      select: { title: true, startTime: true, notes: true },
      orderBy: { startTime: 'asc' },
    }),
    db.appointment.findFirst({
      where: {
        tenantId,
        contact: { phone: callerNumber },
        startTime: { lt: new Date() },
      },
      select: { title: true, startTime: true, notes: true, status: true },
      orderBy: { startTime: 'desc' },
    }),
  ]);

  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Customer';
  const lines: string[] = [];
  lines.push(`Known caller: ${name} (${contact.phone || callerNumber})`);
  lines.push(`Lead status: ${contact.status || 'unknown'}`);
  if (contact.lastContactAt) lines.push(`Last contact: ${fmtDate(contact.lastContactAt)}`);
  if (contact.source) lines.push(`Original source: ${contact.source}`);

  if (upcomingAppointment) {
    lines.push(`Upcoming appointment: ${upcomingAppointment.title} on ${fmtDate(upcomingAppointment.startTime)}`);
  }

  if (lastAppointment) {
    lines.push(`Last appointment: ${lastAppointment.title} on ${fmtDate(lastAppointment.startTime)} (${lastAppointment.status})`);
  }

  if (recentCalls.length > 0) {
    lines.push('Recent call history:');
    for (const c of recentCalls) {
      lines.push(
        `- ${fmtDate(c.startedAt)} | ${c.direction} | ${c.status}` +
        `${c.intent ? ` | intent=${c.intent}` : ''}` +
        `${c.sentiment ? ` | sentiment=${c.sentiment}` : ''}`
      );
    }
  }

  return lines.join('\n');
}
