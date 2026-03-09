// =============================================================================
// API Auth Middleware - Extracts session with tenant context
// =============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session: session as AuthenticatedSession, error: null };
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
