// =============================================================================
// Input Validation & Sanitization
// =============================================================================

import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

/** Strip HTML tags from user input to prevent XSS */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/** Remove null bytes and control characters */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, '')                          // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '') // control chars (keep \n, \r, \t)
    .trim();
}

// ---------------------------------------------------------------------------
// Common Zod Schemas
// ---------------------------------------------------------------------------

export const emailSchema = z.string().email().transform((e) => e.toLowerCase().trim());

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const registrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().min(1, 'Company name is required').max(200),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const receptionistCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).optional(),
  voiceProvider: z.string().max(50).optional(),
  voiceId: z.string().max(120).optional(),
  voiceLanguage: z.string().min(2).max(16).optional(),
  voiceSpeed: z.number().min(0.5).max(2).optional(),
  llmProvider: z.string().max(50).optional(),
  llmModel: z.string().max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  sttProvider: z.string().max(50).optional(),
  greeting: z.string().max(4000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  fallbackMessage: z.string().max(4000).optional(),
  enableInterruptions: z.boolean().optional(),
  enableSmsFollowup: z.boolean().optional(),
  enableVoicemail: z.boolean().optional(),
  enableEmergencyDetect: z.boolean().optional(),
  neverSendToVoicemail: z.boolean().optional(),
  operatingMode: z.string().max(50).optional(),
  maxCallDuration: z.number().int().min(30).max(7200).optional(),
  silenceTimeout: z.number().int().min(1).max(120).optional(),
});

const receptionistStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);

export const receptionistUpdateSchema = receptionistCreateSchema.partial().extend({
  id: z.string().min(1, 'Receptionist ID required'),
  status: receptionistStatusSchema.optional(),
});

export const phoneNumberProvisionSchema = z.object({
  areaCode: z.string().regex(/^\d{3}$/, 'areaCode must be a 3-digit US area code').optional(),
  receptionistId: z.string().min(1).optional(),
});

export const phoneNumberUpdateSchema = z.object({
  id: z.string().min(1, 'Phone number ID required'),
  receptionistId: z.string().nullable().optional(),
  friendlyName: z.string().max(120).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const transferCreateSchema = z.object({
  name: z.string().min(1).max(120),
  triggerType: z.enum(['intent', 'keyword', 'department', 'name', 'context']),
  triggerValue: z.string().min(1).max(200),
  targetType: z.enum(['phone', 'extension', 'department', 'voicemail']),
  targetValue: z.string().min(1).max(200),
  priority: z.number().int().min(-100).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const transferUpdateSchema = z.object({
  id: z.string().min(1, 'Transfer rule ID required'),
  name: z.string().min(1).max(120).optional(),
  triggerType: z.enum(['intent', 'keyword', 'department', 'name', 'context']).optional(),
  triggerValue: z.string().min(1).max(200).optional(),
  targetType: z.enum(['phone', 'extension', 'department', 'voicemail']).optional(),
  targetValue: z.string().min(1).max(200).optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const appointmentCreateSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  staffId: z.string().min(1).optional(),
  notes: z.string().max(4000).optional(),
});

export const appointmentUpdateSchema = z.object({
  id: z.string().min(1, 'id is required'),
  status: z.string().max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const integrationConnectSchema = z.object({
  provider: z.enum(['hubspot', 'google_calendar']),
  credentials: z.record(z.string(), z.string()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'Credentials are required',
  }),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const integrationUpdateSchema = z.object({
  provider: z.enum(['hubspot', 'google_calendar']),
  status: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Validation Helper — returns error response or parsed data
// ---------------------------------------------------------------------------

export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: firstIssue
        ? `${firstIssue.path.join('.')}: ${firstIssue.message}`.replace(/^: /, '')
        : 'Validation failed',
    };
  }
  return { success: true, data: result.data };
}
