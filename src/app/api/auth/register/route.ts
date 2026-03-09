// =============================================================================
// Auth Register API - Creates tenant + owner user
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitRedis } from '@/lib/redis';
import { registerTenantOwner } from '@/lib/services/registration.service';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 registrations per hour per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimitRedis(`register:${ip}`, 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = await registerTenantOwner(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        user: { id: result.user.id, email: result.user.email, name: result.user.name },
        tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}
