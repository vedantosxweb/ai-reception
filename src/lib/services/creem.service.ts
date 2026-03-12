import { Redis } from '@upstash/redis'

/**
 * Service for handling Creem.io interactions and idempotency.
 */
export class CreemService {
  private static redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  })
  
  /**
   * Checks if an event ID has already been processed using Redis.
   * Uses SETNX (Set if Not eXists) to guarantee atomic idempotency.
   * 
   * @param eventId The unique event ID from the Creem.io webhook
   * @param expirationSeconds How long to keep the idempotency key (default 7 days)
   * @returns true if this is a NEW event that should be processed, false if already processed
   */
  static async isNewEvent(eventId: string, expirationSeconds: number = 604800): Promise<boolean> {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      console.warn('⚠️ UPSTASH_REDIS_REST_URL not configured. Bypassing idempotency check.');
      return true; // Bypass in local dev if not configured, but log loudly
    }

    try {
      const key = `creem:event:${eventId}`;
      // SET key "processed" EX duration NX
      // Returns "OK" if set (was new), null if already existed
      const result = await this.redis.set(key, 'processed', {
        ex: expirationSeconds,
        nx: true
      });

      return result === 'OK'; // If OK, it's new. If null, it's a duplicate.
    } catch (error) {
      console.error('Redis idempotency check failed:', error);
      // In a strict production system, you might want to fail closed (return false)
      // to avoid double-charging if Redis is down, but we fail open to prevent webhook drop loops.
      return true;
    }
  }
}
