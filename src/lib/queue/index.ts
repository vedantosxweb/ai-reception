// =============================================================================
// BullMQ Queue Definitions & Helpers
// Uses Redis connection from env, with graceful fallback
// =============================================================================

import { Queue, type JobsOptions } from 'bullmq';
import { log } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Connection configuration
// ---------------------------------------------------------------------------

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    log.api.warn('Invalid REDIS_URL, queues will not be available');
    return null;
  }
}

const connection = getRedisConnection();

// ---------------------------------------------------------------------------
// Queue names
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  KNOWLEDGE_PROCESSING: 'knowledge-processing',
  CALL_ANALYSIS: 'call-analysis',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  USAGE_AGGREGATION: 'usage-aggregation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Queue instances (lazily created)
// ---------------------------------------------------------------------------

const queues = new Map<string, Queue>();

function getQueue(name: QueueName): Queue | null {
  if (!connection) return null;

  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection }));
  }
  return queues.get(name)!;
}

// ---------------------------------------------------------------------------
// Job addition helpers
// ---------------------------------------------------------------------------

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

/**
 * Add a job to a queue. Returns false if Redis is unavailable (job not queued).
 * Callers should handle the fallback case (e.g., process synchronously).
 */
export async function addJob<T extends Record<string, unknown>>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options?: Partial<JobsOptions>
): Promise<boolean> {
  const queue = getQueue(queueName);
  if (!queue) {
    log.api.warn({ queueName, jobName }, 'Queue unavailable (no Redis), job not enqueued');
    return false;
  }

  try {
    await queue.add(jobName, data, { ...DEFAULT_JOB_OPTIONS, ...options });
    log.api.info({ queueName, jobName }, 'Job enqueued');
    return true;
  } catch (error) {
    log.api.error({ queueName, jobName, error }, 'Failed to enqueue job');
    return false;
  }
}

// ---------------------------------------------------------------------------
// Typed job creation helpers
// ---------------------------------------------------------------------------

export interface KnowledgeProcessingJob {
  tenantId: string;
  knowledgeSourceId: string;
  url?: string;
  content?: string;
  type: 'WEBSITE' | 'PDF' | 'FAQ' | 'TEXT' | 'CRAWL';
}

export interface CallAnalysisJob {
  tenantId: string;
  callId: string;
}

export interface EmailNotificationJob {
  type: 'missed_call' | 'voicemail' | 'daily_summary' | 'password_reset' | 'email_verification' | 'welcome';
  tenantId: string;
  data: Record<string, unknown>;
}

export interface UsageAggregationJob {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}

export async function enqueueKnowledgeProcessing(data: KnowledgeProcessingJob) {
  return addJob(QUEUE_NAMES.KNOWLEDGE_PROCESSING, 'process-knowledge', data as unknown as Record<string, unknown>);
}

export async function enqueueCallAnalysis(data: CallAnalysisJob) {
  return addJob(QUEUE_NAMES.CALL_ANALYSIS, 'analyze-call', data as unknown as Record<string, unknown>);
}

export async function enqueueEmailNotification(data: EmailNotificationJob) {
  return addJob(QUEUE_NAMES.EMAIL_NOTIFICATIONS, `email-${data.type}`, data as unknown as Record<string, unknown>, {
    attempts: 2,
  });
}

export async function enqueueUsageAggregation(data: UsageAggregationJob) {
  return addJob(QUEUE_NAMES.USAGE_AGGREGATION, 'aggregate-usage', data as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function closeAllQueues(): Promise<void> {
  for (const [, queue] of queues) {
    try {
      await queue.close();
    } catch {
      // Ignore close errors
    }
  }
  queues.clear();
}
