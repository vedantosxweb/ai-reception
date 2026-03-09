import { logger, createLogger, log } from '@/lib/logger';

export { logger, createLogger, log };

export const authLogger = log.auth;
export const billingLogger = log.billing;
export const aiLogger = log.ai;
export const telephonyLogger = log.telephony;
export const webhookLogger = log.webhook;
export const knowledgeLogger = log.knowledge;
export const apiLogger = log.api;
