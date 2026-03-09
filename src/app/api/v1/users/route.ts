// =============================================================================
// Users API - Manage team members within a tenant
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, requireOwnerOrAdmin } from '@/lib/api-auth';
import { hashPassword } from '@/lib/auth';

// GET /api/v1/users - List users in the tenant
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const where: Record<string, unknown> = {
    tenantId: session.user.tenantId,
  };

  if (role) where.role = role.toUpperCase();
  if (status) where.status = status.toUpperCase();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    meta: { page, limit, total },
  });
}

// POST /api/v1/users - Invite/create a new team member
export async function POST(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { name, email, role, password, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'name and email are required' },
        { status: 400 }
      );
    }

    const emailNorm = email.trim().toLowerCase();

    // Check for duplicate email within tenant
    const existing = await db.user.findFirst({
      where: { tenantId: session.user.tenantId, email: emailNorm },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists in your organization' },
        { status: 409 }
      );
    }

    // Only OWNER can create ADMIN users; prevent creating another OWNER
    const userRole = (role || 'MEMBER').toUpperCase();
    if (userRole === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot create additional owner accounts' },
        { status: 403 }
      );
    }
    if (userRole === 'ADMIN' && session.user.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Only the owner can create admin users' },
        { status: 403 }
      );
    }

    const validRoles = ['ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: `role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const passwordHash = password ? await hashPassword(password) : await hashPassword(crypto.randomUUID());
    const userStatus = password ? 'ACTIVE' : 'INVITED';

    const user = await db.user.create({
      data: {
        tenantId: session.user.tenantId,
        name: name.trim(),
        email: emailNorm,
        passwordHash,
        role: userRole as 'ADMIN' | 'MEMBER' | 'VIEWER',
        status: userStatus as 'ACTIVE' | 'INVITED',
        phone: phone || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'user.created',
        resource: 'User',
        resourceId: user.id,
        details: { name: user.name, email: user.email, role: user.role },
      },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (err) {
    console.error('[Users] Create error:', err);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

// PATCH /api/v1/users - Update a team member
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { id, name, role, status, phone, password } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    const existing = await db.user.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Prevent modifying the OWNER unless you are the OWNER
    if (existing.role === 'OWNER' && session.user.id !== existing.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify the organization owner' },
        { status: 403 }
      );
    }

    // Prevent demoting yourself from OWNER
    if (session.user.id === existing.id && existing.role === 'OWNER' && role && role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot demote yourself from owner' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (role && role !== 'OWNER') updateData.role = role.toUpperCase();
    if (status) updateData.status = status.toUpperCase();
    if (phone !== undefined) updateData.phone = phone || null;
    if (password) updateData.passwordHash = await hashPassword(password);

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        updatedAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: 'user.updated',
        resource: 'User',
        resourceId: id,
        details: { updatedFields: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Users] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/v1/users - Remove a team member
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireOwnerOrAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
  }

  const existing = await db.user.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Prevent deleting the OWNER
  if (existing.role === 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Cannot delete the organization owner' },
      { status: 403 }
    );
  }

  // Prevent self-deletion
  if (existing.id === session.user.id) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete your own account' },
      { status: 403 }
    );
  }

  await db.user.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'user.deleted',
      resource: 'User',
      resourceId: id,
      details: { name: existing.name, email: existing.email },
    },
  });

  return NextResponse.json({ success: true, message: 'User deleted' });
}
