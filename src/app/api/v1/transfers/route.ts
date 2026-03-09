// =============================================================================
// Transfer Rules API - Manage call transfer rules
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import {
  transferCreateSchema,
  transferUpdateSchema,
  validateRequest,
} from '@/lib/security/validation';

// GET /api/v1/transfers - List transfer rules
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const triggerType = searchParams.get('triggerType');
  const active = searchParams.get('active');

  const where = {
    tenantId: session.user.tenantId,
    ...(triggerType ? { triggerType } : {}),
    ...(active !== null && active !== undefined ? { isActive: active === 'true' } : {}),
  };

  const [rules, total] = await Promise.all([
    db.transferRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.transferRule.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: rules,
    meta: { page, limit, total },
  });
}

// POST /api/v1/transfers - Create a transfer rule
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = validateRequest(transferCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { name, triggerType, triggerValue, targetType, targetValue, priority, isActive } = parsed.data;

    const rule = await db.transferRule.create({
      data: {
        tenantId: session.user.tenantId,
        name,
        triggerType,
        triggerValue,
        targetType,
        targetValue,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'transfer_rule.created',
        resource: 'TransferRule',
        resourceId: rule.id,
        details: { name, triggerType, targetType },
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (err) {
    console.error('[Transfers] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create transfer rule' }, { status: 500 });
  }
}

// PATCH /api/v1/transfers - Update a transfer rule
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = validateRequest(transferUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { id, ...updateData } = parsed.data;

    const existing = await db.transferRule.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transfer rule not found' }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedFields = ['name', 'triggerType', 'triggerValue', 'targetType', 'targetValue', 'priority', 'isActive'];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updateData) sanitized[key] = updateData[key];
    }

    const updated = await db.transferRule.update({ where: { id }, data: sanitized });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'transfer_rule.updated',
        resource: 'TransferRule',
        resourceId: id,
        details: { updatedFields: Object.keys(sanitized) },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Transfers] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update transfer rule' }, { status: 500 });
  }
}

// DELETE /api/v1/transfers - Delete a transfer rule
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Transfer rule ID required' }, { status: 400 });
  }

  const existing = await db.transferRule.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Transfer rule not found' }, { status: 404 });
  }

  await db.transferRule.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'transfer_rule.deleted',
      resource: 'TransferRule',
      resourceId: id,
      details: { name: existing.name },
    },
  });

  return NextResponse.json({ success: true, message: 'Transfer rule deleted' });
}
