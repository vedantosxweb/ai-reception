// =============================================================================
// API Auth Middleware - Clerk-based session extraction with tenant context
// =============================================================================

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import type { UserRole } from '@prisma/client';
import { checkRateLimitRedis } from '@/lib/redis';

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

  // Look up local user by Clerk ID (stored in externalId field or matched by email)
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  if (!email) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'No email associated with account' }, { status: 401 }),
    };
  }

  const dbUser = await db.user.findFirst({
    where: { email },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, plan: true },
      },
    },
  });

  if (!dbUser || !dbUser.tenant) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'User not found. Please complete onboarding.' }, { status: 403 }),
    };
  }

  return {
    session: {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        tenantId: dbUser.tenant.id,
        tenantSlug: dbUser.tenant.slug,
        tenantName: dbUser.tenant.name,
        plan: dbUser.tenant.plan,
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
