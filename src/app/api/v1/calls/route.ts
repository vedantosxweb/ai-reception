// =============================================================================
// Calls API - Call logs, recordings, transcripts
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';

// GET /api/v1/calls - List calls with transcripts
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const receptionistId = searchParams.get('receptionistId');
  const status = searchParams.get('status');
  const direction = searchParams.get('direction');
  const callId = searchParams.get('id');

  // Single call with full details
  if (callId) {
    const call = await db.call.findFirst({
      where: { id: callId, tenantId: session.user.tenantId },
      include: {
        contact: true,
        receptionist: { select: { id: true, name: true } },
        phoneNumber: { select: { id: true, number: true } },
        transcripts: { orderBy: { createdAt: 'asc' } },
        transfers: true,
        callEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!call) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: call });
  }

  // List calls
  const where = {
    tenantId: session.user.tenantId,
    ...(receptionistId ? { receptionistId } : {}),
    ...(status ? { status: status.toUpperCase() as 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' } : {}),
    ...(direction ? { direction: direction.toUpperCase() as 'INBOUND' | 'OUTBOUND' } : {}),
  };

  const [calls, total] = await Promise.all([
    db.call.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        receptionist: { select: { id: true, name: true } },
        _count: { select: { transcripts: true, transfers: true } },
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.call.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: calls,
    meta: { page, limit, total },
  });
}
