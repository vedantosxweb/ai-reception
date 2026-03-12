import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRedisClient } from '@/lib/redis';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check Database
    await db.$queryRaw`SELECT 1`;
    status.services.database = 'healthy';
  } catch (error) {
    status.services.database = 'unhealthy';
    status.status = 'error';
    log.api.error({ error }, 'Health check: Database connection failed');
  }

  try {
    // Check Redis
    const redis = await getRedisClient();
    if (redis) {
      await redis.ping();
      status.services.redis = 'healthy';
    } else {
      status.services.redis = 'unavailable (fallback to memory)';
    }
  } catch (error) {
    status.services.redis = 'unhealthy';
    status.status = 'error';
    log.api.error({ error }, 'Health check: Redis connection failed');
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return NextResponse.json(status, { status: httpStatus });
}
