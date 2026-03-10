// =============================================================================
// API Auth Middleware - Clerk-based session extraction with tenant context
// =============================================================================

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import type { UserRole } from '@prisma/client';
import { checkRateLimitRedis } from '@/lib/redis';
import { PLAN_CONFIG } from '@/lib/config/env';

export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    plan: string;
  };
}

type RequireSessionResult =
  | { session: AuthenticatedSession; error: null }
  | { session: null; error: NextResponse };

export async function requireSession(): Promise<RequireSessionResult> {
  const { userId } = await auth();

  if (!userId) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Look up local user by Clerk email
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  if (!email) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'No email associated with account' }, { status: 401 }),
    };
  }

  let dbUser = await db.user.findFirst({
    where: { email },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, plan: true },
      },
    },
  });

  // Auto-provision: if Clerk user exists but not yet in DB, create them now
  if (!dbUser || !dbUser.tenant) {
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'User';
    const planConfig = PLAN_CONFIG['STARTER'];
    const companyName = name + "'s Company";
    const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug.slice(0, 50) || 'company';
    let counter = 0;
    while (await db.tenant.findUnique({ where: { slug } })) {
      counter++;
      slug = `${baseSlug.slice(0, 46)}-${counter}`;
    }

    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug,
          plan: 'STARTER',
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          monthlyMinutes: planConfig.monthlyMinutes,
          maxReceptionists: planConfig.maxReceptionists,
          maxPhoneNumbers: planConfig.maxPhoneNumbers,
          maxKnowledgeSources: planConfig.maxKnowledgeSources,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          passwordHash: '',
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // Default business hours (Mon-Fri 9-5)
      await tx.businessHour.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          tenantId: tenant.id,
          dayOfWeek: day,
          openTime: '09:00',
          closeTime: '17:00',
          isOpen: day >= 1 && day <= 5,
        })),
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'tenant.created',
          resource: 'tenant',
          resourceId: tenant.id,
          details: { plan: 'STARTER', trialDays: 14, source: 'auto_provision' },
        },
      });

      return { tenant, user };
    });

    dbUser = {
      ...result.user,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        plan: result.tenant.plan,
      },
    };
  }

  return {
    session: {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        tenantId: dbUser.tenant!.id,
        tenantSlug: dbUser.tenant!.slug,
        tenantName: dbUser.tenant!.name,
        plan: dbUser.tenant!.plan,
      },
    },
    error: null,
  };
}

export async function requireRole(...roles: UserRole[]): Promise<RequireSessionResult> {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };

  if (!roles.includes(session.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 }),
    };
  }

  return { session, error: null };
}

export async function requireOwnerOrAdmin(): Promise<RequireSessionResult> {
  return requireRole('OWNER', 'ADMIN');
}

// Rate limiting helper (Redis-backed)
export async function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(key, maxRequests, windowSeconds);
}
