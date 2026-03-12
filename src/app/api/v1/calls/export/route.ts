// =============================================================================
// Calls Export API - Generate CSV of call logs
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const calls = await db.call.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true } },
        receptionist: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    // CSV header
    const header = ['Date', 'Caller Name', 'Caller Number', 'Direction', 'Status', 'Duration (sec)', 'Intent', 'Sentiment', 'Agent'];
    
    // CSV rows
    const rows = calls.map(c => [
      new Date(c.startedAt).toISOString(),
      c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown',
      c.callerNumber,
      c.direction,
      c.status,
      c.duration || 0,
      c.intent || '',
      c.sentiment || '',
      c.receptionist?.name || ''
    ]);

    const csvContent = [
      header.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="call-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate export' }, { status: 500 });
  }
}
