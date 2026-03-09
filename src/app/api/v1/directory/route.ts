// =============================================================================
// Directory API - Manage phone directory
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const entries = await db.directoryEntry.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({ success: true, data: entries });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, title, department, extension, phoneNumber, email, isDefault } = body;

  if (!name) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
  }

  const entry = await db.directoryEntry.create({
    data: {
      tenantId: session.user.tenantId,
      name,
      title,
      department,
      extension,
      phoneNumber,
      email,
      isDefault: isDefault || false,
    },
  });

  return NextResponse.json({ success: true, data: entry }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const body = await req.json();
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ success: false, error: 'Entry ID required' }, { status: 400 });
  }

  const existing = await db.directoryEntry.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
  }

  const updated = await db.directoryEntry.update({ where: { id }, data: updateData });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'Entry ID required' }, { status: 400 });
  }

  await db.directoryEntry.deleteMany({
    where: { id, tenantId: session.user.tenantId },
  });

  return NextResponse.json({ success: true, message: 'Entry deleted' });
}
