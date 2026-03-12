import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Edge-compatible rate limiter using Upstash Redis
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 60, windowSeconds: 60 }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const now = Date.now();
    const redisKey = `rl_edge:${key}`;
    
    // Slidding window implementation with Upstash
    const p = redis.pipeline();
    p.zremrangebyscore(redisKey, 0, now - config.windowSeconds * 1000);
    p.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
    p.zcard(redisKey);
    p.expire(redisKey, config.windowSeconds);
    
    const results = await p.exec();
    const count = (results[2] as number) || 0;
    
    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: now + config.windowSeconds * 1000,
    };
  } catch (error) {
    console.error('[RateLimit] Error:', error);
    // Fallback: Allow if Redis is down
    return { allowed: true, remaining: 1, resetAt: Date.now() + 60000 };
  }
}
