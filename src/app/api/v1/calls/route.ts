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
  const q = searchParams.get('q');
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
  const where: any = {
    tenantId: session.user.tenantId,
    ...(receptionistId ? { receptionistId } : {}),
    ...(status ? { status: status.toUpperCase() as 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' } : {}),
    ...(direction ? { direction: direction.toUpperCase() as 'INBOUND' | 'OUTBOUND' } : {}),
  };

  // Add search filter if provided
  if (q) {
    where.OR = [
      { callerNumber: { contains: q, mode: 'insensitive' } },
      { intent: { contains: q, mode: 'insensitive' } },
      { 
        transcripts: { 
          some: { 
            content: { contains: q, mode: 'insensitive' } 
          } 
        } 
      },
      {
        contact: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ]
        }
      }
    ];
  }

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

// DELETE /api/v1/calls - Delete a call record (GDPR compliance)
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Call ID required' }, { status: 400 });
  }

  const existing = await db.call.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 });
  }

  // Delete cascades to transcripts, call events, and transfers via schema
  await db.call.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'call.deleted',
      resource: 'call',
      resourceId: id,
    },
  });

  return NextResponse.json({ success: true, message: 'Call record deleted' });
}
