// =============================================================================
// Rate Limiting — Redis-backed limiter for API routes (delegates to redis.ts)
// =============================================================================

import { NextResponse } from 'next/server';
import { checkRateLimitRedis } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Unified rate limit check (delegates to redis.ts which has in-memory fallback)
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  return checkRateLimitRedis(key, maxRequests, windowSeconds);
}

// ---------------------------------------------------------------------------
// Higher-order helper — returns 429 response if rate limited
// ---------------------------------------------------------------------------

export async function withRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<NextResponse | null> {
  const key = `rl:${identifier}`;
  const { allowed, remaining, resetAt } = await checkRateLimit(key, maxRequests, windowSeconds);

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Return null means "allowed" — caller continues
  return null;
}

// ---------------------------------------------------------------------------
// Presets for common endpoints
// ---------------------------------------------------------------------------

/** Auth endpoints: 10 requests per minute per IP */
export function rateLimitAuth(ip: string) {
  return withRateLimit(`auth:${ip}`, 10, 60);
}

/** Public API: 30 requests per minute per IP */
export function rateLimitPublic(ip: string) {
  return withRateLimit(`public:${ip}`, 30, 60);
}

/** Webhook endpoints: 100 requests per minute per IP */
export function rateLimitWebhook(ip: string) {
  return withRateLimit(`webhook:${ip}`, 100, 60);
}
