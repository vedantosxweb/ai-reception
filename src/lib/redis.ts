// =============================================================================
// Redis Client - Singleton for sessions, rate limiting, active calls
// Falls back to in-memory storage when REDIS_URL is not set (dev/simple deploy)
// =============================================================================

import Redis from 'ioredis';
import type { ConversationContext } from '@/types';

// =============================================================================
// In-Memory Fallback Store
// =============================================================================

const memStore = new Map<string, { value: string; expiresAt: number }>();

function memSet(key: string, value: string, ttlSeconds?: number): void {
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity,
  });
}

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memDel(key: string): void {
  memStore.delete(key);
}

// Clean up expired keys every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (now > entry.expiresAt) memStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

// =============================================================================
// Redis Client (only created when REDIS_URL is configured)
// =============================================================================

let _redis: Redis | null = null;
let _redisAvailable: boolean | null = null;

export function getRedisClient(): Redis | null {
  if (_redisAvailable === false) return null;

  const url = process.env.REDIS_URL;
  if (!url) {
    _redisAvailable = false;
    return null;
  }

  if (_redis) return _redis;

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 2) {
          _redisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
    });

    _redis.on('error', (err) => {
      if (_redisAvailable !== false) {
        console.warn('[Redis] Connection error, falling back to in-memory:', err.message);
        _redisAvailable = false;
      }
    });

    _redis.on('ready', () => {
      _redisAvailable = true;
      console.log('[Redis] Connected');
    });

    _redis.connect().catch((err) => {
      console.warn('[Redis] Initial connection failed, using in-memory fallback:', err.message);
      _redisAvailable = false;
    });

    return _redis;
  } catch (err) {
    console.warn('[Redis] Failed to initialize:', err);
    _redisAvailable = false;
    return null;
  }
}

// Generic get/set/del with automatic fallback
async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client || _redisAvailable === false) return memGet(key);
  try {
    return await client.get(key);
  } catch {
    return memGet(key);
  }
}

async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  if (!client || _redisAvailable === false) {
    memSet(key, value, ttlSeconds);
    return;
  }
  try {
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
    // Also keep in memory as secondary cache
    memSet(key, value, ttlSeconds);
  } catch {
    memSet(key, value, ttlSeconds);
  }
}

async function redisDel(key: string): Promise<void> {
  const client = getRedisClient();
  memDel(key);
  if (!client || _redisAvailable === false) return;
  try {
    await client.del(key);
  } catch {
    // ignore
  }
}

// =============================================================================
// Active Call Sessions
// =============================================================================

const CALL_SESSION_PREFIX = 'call_session:';
const CALL_SESSION_TTL = 3600; // 1 hour max call

export interface ActiveCallSession {
  tenantId: string;
  receptionistId: string;
  phoneNumberId: string;
  callId: string;
  callerNumber: string;
  dialedNumber: string;
  contactId?: string;
  startedAt: string; // ISO string
  voiceLanguage?: string;
}

export async function setActiveCall(callSid: string, session: ActiveCallSession): Promise<void> {
  await redisSet(`${CALL_SESSION_PREFIX}${callSid}`, JSON.stringify(session), CALL_SESSION_TTL);
}

export async function getActiveCall(callSid: string): Promise<ActiveCallSession | null> {
  const data = await redisGet(`${CALL_SESSION_PREFIX}${callSid}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as ActiveCallSession;
  } catch {
    return null;
  }
}

export async function deleteActiveCall(callSid: string): Promise<void> {
  await redisDel(`${CALL_SESSION_PREFIX}${callSid}`);
}

// =============================================================================
// AI Conversation Sessions
// =============================================================================

const AI_SESSION_PREFIX = 'ai_session:';
const AI_SESSION_TTL = 1800; // 30 min conversation timeout

export async function setAISession(sessionId: string, context: ConversationContext): Promise<void> {
  const serializable = {
    ...context,
    history: context.history.map((h) => ({
      ...h,
      timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : h.timestamp,
    })),
  };
  await redisSet(`${AI_SESSION_PREFIX}${sessionId}`, JSON.stringify(serializable), AI_SESSION_TTL);
}

export async function getAISession(sessionId: string): Promise<ConversationContext | null> {
  const data = await redisGet(`${AI_SESSION_PREFIX}${sessionId}`);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as ConversationContext;
    parsed.history = parsed.history.map((h) => ({
      ...h,
      timestamp: new Date(h.timestamp),
    }));
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteAISession(sessionId: string): Promise<void> {
  await redisDel(`${AI_SESSION_PREFIX}${sessionId}`);
}

// =============================================================================
// Rate Limiting
// =============================================================================

const RATE_LIMIT_PREFIX = 'rl:';

// In-memory rate limit fallback (per process)
const memRateMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimitRedis(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const client = getRedisClient();
  const now = Math.floor(Date.now() / 1000);

  if (!client || _redisAvailable === false) {
    // In-memory fallback
    const entry = memRateMap.get(key);
    if (!entry || now > entry.resetAt) {
      memRateMap.set(key, { count: 1, resetAt: now + windowSeconds });
      return { allowed: true, remaining: maxRequests - 1, resetAt: (now + windowSeconds) * 1000 };
    }
    entry.count++;
    const allowed = entry.count <= maxRequests;
    return { allowed, remaining: Math.max(0, maxRequests - entry.count), resetAt: entry.resetAt * 1000 };
  }

  try {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, now - windowSeconds);
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
    pipeline.zcard(redisKey);
    pipeline.expire(redisKey, windowSeconds);
    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) || 0;
    const allowed = count <= maxRequests;
    return {
      allowed,
      remaining: Math.max(0, maxRequests - count),
      resetAt: (now + windowSeconds) * 1000,
    };
  } catch {
    // Fallback on Redis error
    return { allowed: true, remaining: maxRequests, resetAt: (now + windowSeconds) * 1000 };
  }
}
