// =============================================================================
// Rate Limiting — In-memory + Redis-backed limiter for API routes
// =============================================================================

import { NextResponse } from 'next/server';
import { checkRateLimitRedis } from '@/lib/redis';

// ---------------------------------------------------------------------------
// In-memory fallback (for development or when Redis is unavailable)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 60_000; // 1 minute

// Periodic cleanup of expired entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(key);
    }
  }, CLEANUP_INTERVAL);
}

function checkMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowSeconds * 1000 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining, resetAt: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Unified rate limit check (Redis → memory fallback)
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    // Try Redis first
    return await checkRateLimitRedis(key, maxRequests, windowSeconds);
  } catch {
    // Fallback to in-memory
    return checkMemoryRateLimit(key, maxRequests, windowSeconds);
  }
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
