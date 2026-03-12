// =============================================================================
// BullMQ Workers — Background job processors
// Start these in a separate process or via docker-compose worker service
// Usage: npx tsx src/lib/queue/workers.ts
// =============================================================================

import { Worker, type Job } from 'bullmq';
import { log } from '@/lib/logger';
import {
  QUEUE_NAMES,
  type KnowledgeProcessingJob,
  type CallAnalysisJob,
  type EmailNotificationJob,
  type UsageAggregationJob,
  type OutboundTaskJob,
  type MasterSchedulerJob,
} from './index';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required to run workers');
  }
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

// ---------------------------------------------------------------------------
// Knowledge Processing Worker
// ---------------------------------------------------------------------------

async function processKnowledgeJob(job: Job<KnowledgeProcessingJob>) {
  const { tenantId, knowledgeSourceId, type } = job.data;
  log.knowledge.info({ tenantId, knowledgeSourceId, type }, 'Processing knowledge source');

  const { KnowledgeBaseService } = await import('@/lib/knowledge/knowledge.service');
  const { db } = await import('@/lib/db');

  try {
    // Mark as processing
    await db.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: { status: 'PROCESSING' },
    });

    const source = await db.knowledgeSource.findUnique({
      where: { id: knowledgeSourceId },
    });

    if (!source) {
      throw new Error(`Knowledge source ${knowledgeSourceId} not found`);
    }

    // Use the appropriate method based on source type
    if (source.url) {
      await KnowledgeBaseService.addWebsiteSource(tenantId, source.receptionistId || '', source.url);
    } else if (source.content) {
      await KnowledgeBaseService.addTextSource(tenantId, source.receptionistId || '', source.name, source.content);
    }

    log.knowledge.info({ knowledgeSourceId }, 'Knowledge source processed successfully');
  } catch (error) {
    // Mark as error
    await db.knowledgeSource.update({
      where: { id: knowledgeSourceId },
      data: {
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    }).catch(console.error);

    throw error; // Re-throw so BullMQ retries
  }
}

// ---------------------------------------------------------------------------
// Call Analysis Worker
// ---------------------------------------------------------------------------

async function processCallAnalysis(job: Job<CallAnalysisJob>) {
  const { tenantId, callId } = job.data;
  log.ai.info({ tenantId, callId }, 'Analyzing call');

  const { db } = await import('@/lib/db');
  const { generateAIResponse, getOrCreateSession } = await import('@/lib/ai');

  const call = await db.call.findUnique({
    where: { id: callId },
    include: { transcripts: { orderBy: { createdAt: 'asc' } } },
  });

  if (!call || call.transcripts.length === 0) return;

  // Build transcript text
  const transcriptText = call.transcripts
    .map((t) => `${t.speaker}: ${t.content}`)
    .join('\n');

  // Create a session context for analysis
  const context = await getOrCreateSession(
    `analysis-${callId}`,
    tenantId,
    call.receptionistId || '',
    'voice'
  );

  // Generate summary via AI
  try {
    const response = await generateAIResponse(
      `Summarize this phone call in 2-3 sentences:\n\n${transcriptText}`,
      context,
      {
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        systemPrompt: 'You are a call summarization assistant. Provide concise, factual summaries.',
        maxTokens: 200,
        temperature: 0.3,
      }
    );

    await db.call.update({
      where: { id: callId },
      data: {
        summary: response.text,
        sentiment: response.sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null,
        intent: response.intent || call.intent,
      },
    });

    log.ai.info({ callId }, 'Call analysis complete');
  } catch (error) {
    log.ai.error({ callId, error }, 'Call analysis failed');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Email Notification Worker
// ---------------------------------------------------------------------------

async function processEmailNotification(job: Job<EmailNotificationJob>) {
  const { type, tenantId, data } = job.data;
  log.webhook.info({ tenantId, type }, 'Sending email notification');

  const emailService = await import('@/lib/email/email.service');

  switch (type) {
    case 'missed_call':
      await emailService.sendMissedCallAlert({
        tenantId,
        callerNumber: data.callerNumber as string,
        dialedNumber: data.dialedNumber as string,
        status: data.status as string,
        startedAt: new Date(data.startedAt as string),
        contactName: data.contactName as string | undefined,
        receptionistName: data.receptionistName as string | undefined,
      });
      break;

    case 'voicemail':
      await emailService.sendVoicemailNotification({
        tenantId,
        callerNumber: data.callerNumber as string,
        dialedNumber: data.dialedNumber as string,
        recordingUrl: data.recordingUrl as string,
        duration: data.duration as number | undefined,
        startedAt: new Date(data.startedAt as string),
        contactName: data.contactName as string | undefined,
        receptionistName: data.receptionistName as string | undefined,
      });
      break;

    case 'daily_summary':
      await emailService.buildAndSendDailySummary(tenantId);
      break;

    default:
      log.webhook.warn({ type }, 'Unknown email notification type');
  }
}

// ---------------------------------------------------------------------------
// Usage Aggregation Worker
// ---------------------------------------------------------------------------

async function processUsageAggregation(job: Job<UsageAggregationJob>) {
  const { tenantId, periodStart, periodEnd } = job.data;
  log.billing.info({ tenantId, periodStart, periodEnd }, 'Aggregating usage');

  const { db } = await import('@/lib/db');

  const calls = await db.call.findMany({
    where: {
      tenantId,
      startedAt: { gte: new Date(periodStart), lt: new Date(periodEnd) },
      status: 'COMPLETED',
      duration: { not: null },
    },
    select: { duration: true },
  });

  const totalMinutes = Math.ceil(
    calls.reduce((sum, c) => sum + (c.duration || 0), 0) / 60
  );

  await db.usageRecord.create({
    data: {
      tenantId,
      type: 'VOICE_MINUTES',
      quantity: totalMinutes,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
    },
  });

  log.billing.info({ tenantId, totalMinutes }, 'Usage aggregation complete');
}

// ---------------------------------------------------------------------------
// Outbound Task Worker (AI-01, AI-02, AI-03)
// ---------------------------------------------------------------------------

async function processOutboundTask(job: Job<OutboundTaskJob>) {
  const { tenantId, scheduledCallId } = job.data;
  const { db } = await import('@/lib/db');
  
  log.telephony.info({ tenantId, scheduledCallId }, 'Processing outbound task');

  const scheduledCall = await (db as any).scheduledCall.findUnique({
    where: { id: scheduledCallId },
    include: { contact: true, phoneNumber: true },
  });

  if (!scheduledCall || scheduledCall.status !== 'PENDING') return;

  try {
    // Mark as in progress
    await (db as any).scheduledCall.update({
      where: { id: scheduledCallId },
      data: { status: 'IN_PROGRESS' },
    });

    const { type, metadata, contact, phoneNumber } = scheduledCall;
    const meta = metadata as any;

    if (type === 'SMS_SUMMARY') {
      const { sendSms } = await import('@/lib/telephony/twilio.service');
      await sendSms({
        to: meta.to || contact?.phone,
        body: meta.body,
        tenantId,
      });
    } else if (type === 'FOLLOW_UP' || type === 'CALLBACK') {
      const { initiateOutboundCall } = await import('@/lib/telephony/twilio.service');
      // Trigger actual outbound call via Twilio
      await initiateOutboundCall({
        tenantId,
        to: contact?.phone || meta.to,
        from: phoneNumber?.number || meta.from,
        receptionistId: meta.receptionistId,
        message: meta.initialMessage,
      });
    }

    // Mark as completed
    await (db as any).scheduledCall.update({
      where: { id: scheduledCallId },
      data: { status: 'COMPLETED' },
    });

  } catch (error) {
    const lastError = error instanceof Error ? error.message : 'Unknown error';
    await (db as any).scheduledCall.update({
      where: { id: scheduledCallId },
      data: { 
        status: 'FAILED',
        lastError,
        retryCount: { increment: 1 }
      },
    }).catch(console.error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Master Scheduler Worker (Periodically triggers other jobs)
// ---------------------------------------------------------------------------

async function processMasterScheduler(job: Job<MasterSchedulerJob>) {
  const { type } = job.data;
  const { db } = await import('@/lib/db');
  const { enqueueEmailNotification } = await import('./index');

  log.api.info({ type }, 'Processing master scheduler job');

  if (type === 'daily-digest-trigger') {
    const tenants = await db.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      await enqueueEmailNotification({
        type: 'daily_summary',
        tenantId: tenant.id,
        data: {},
      });
    }
    log.api.info({ tenantCount: tenants.length }, 'Daily summaries enqueued for all tenants');
  }

  if (type === 'weekly-faq-trigger') {
    const { FAQBuilderService } = await import('@/lib/ai/faq-builder');
    const receptionists = await db.aIReceptionist.findMany({
      select: { id: true, tenantId: true },
    });

    for (const r of receptionists) {
      // Trigger FAQ analysis for each receptionist (per tenant)
      await FAQBuilderService.suggestFAQs(r.tenantId)
        .catch((err: Error) => log.api.error({ err: err.message, receptionistId: r.id }, 'Weekly FAQ generation failed'));
    }
    log.api.info({ receptionistCount: receptionists.length }, 'Weekly FAQ analysis complete');
  }
}

// ---------------------------------------------------------------------------
// Start all workers
// ---------------------------------------------------------------------------

export function startWorkers() {
  const connection = getRedisConnection();

  const knowledgeWorker = new Worker(
    QUEUE_NAMES.KNOWLEDGE_PROCESSING,
    processKnowledgeJob,
    { connection, concurrency: 2 }
  );

  const callAnalysisWorker = new Worker(
    QUEUE_NAMES.CALL_ANALYSIS,
    processCallAnalysis,
    { connection, concurrency: 3 }
  );

  const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL_NOTIFICATIONS,
    processEmailNotification,
    { connection, concurrency: 5 }
  );

  const usageWorker = new Worker(
    QUEUE_NAMES.USAGE_AGGREGATION,
    processUsageAggregation,
    { connection, concurrency: 1 }
  );

  const outboundWorker = new Worker(
    QUEUE_NAMES.OUTBOUND_TASKS,
    processOutboundTask,
    { connection, concurrency: 5 }
  );

  const workers = [
    { name: 'knowledge', worker: knowledgeWorker },
    { name: 'call-analysis', worker: callAnalysisWorker },
    { name: 'email', worker: emailWorker },
    { name: 'usage', worker: usageWorker },
    { name: 'outbound', worker: outboundWorker },
    {
      name: 'master-scheduler',
      worker: new Worker(QUEUE_NAMES.MASTER_SCHEDULER, processMasterScheduler, { connection, concurrency: 1 }),
    },
  ];

  // Setup periodic jobs
  import('./index').then(({ setupPeriodicJobs }) => {
    setupPeriodicJobs().catch((err) => log.api.error({ err }, 'Failed to setup periodic jobs'));
  });

  for (const { name, worker } of workers) {
    worker.on('completed', (job) => {
      log.api.info({ worker: name, jobId: job.id }, 'Job completed');
    });
    worker.on('failed', (job, err) => {
      log.api.error({ worker: name, jobId: job?.id, error: err.message }, 'Job failed');
    });
    worker.on('error', (err) => {
      log.api.error({ worker: name, error: err.message }, 'Worker error');
    });
  }

  log.api.info('All workers started');

  const shutdown = async () => {
    log.api.info('Shutting down workers...');
    await Promise.all(workers.map(({ worker }) => worker.close()));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return workers.map(({ worker }) => worker);
}

// ---------------------------------------------------------------------------
// Auto-start if run directly
// ---------------------------------------------------------------------------

if (require.main === module) {
  startWorkers();
}
