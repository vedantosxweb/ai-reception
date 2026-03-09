// =============================================================================
// Audit Logs API - View audit trail
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';

// GET /api/v1/audit-logs - List audit log entries
export async function GET(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const action = searchParams.get('action');
  const resource = searchParams.get('resource');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Record<string, unknown> = {
    tenantId: session.user.tenantId,
  };

  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (resource) where.resource = resource;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: logs,
    meta: { page, limit, total },
  });
}

// POST /api/v1/audit-logs - Create a manual audit log entry (for admin notes)
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { action, resource, resourceId, details } = body;

    if (!action || !resource) {
      return NextResponse.json(
        { success: false, error: 'action and resource are required' },
        { status: 400 }
      );
    }

    const log = await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action,
        resource,
        resourceId: resourceId || null,
        details: details || null,
      },
    });

    return NextResponse.json({ success: true, data: log }, { status: 201 });
  } catch (err) {
    console.error('[AuditLogs] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create audit log' }, { status: 500 });
  }
}
