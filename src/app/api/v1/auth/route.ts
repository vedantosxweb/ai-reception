// =============================================================================
// Auth API - Register, Login handled via NextAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitRedis } from '@/lib/redis';
import { registerTenantOwner } from '@/lib/services/registration.service';

// POST /api/v1/auth - Register new tenant + owner
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimitRedis(`register:${ip}`, 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = await registerTenantOwner(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenant: result.tenant,
          user: result.user,
        },
        message: 'Account created successfully. Please check your email to verify, then sign in.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
