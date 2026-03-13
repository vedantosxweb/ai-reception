// =============================================================================
// Environment Configuration - Production-grade validation
// =============================================================================

import { z } from 'zod/v4';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.url().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  // Deepgram (STT)
  DEEPGRAM_API_KEY: z.string().optional(),

  // ElevenLabs (TTS)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),
  TWILIO_WEBHOOK_STRICT_VALIDATION: z.enum(['true', 'false']).optional(),

  // Telnyx
  TELNYX_API_KEY: z.string().optional(),

  // Creem (Billing / Merchant of Record)
  CREEM_API_KEY: z.string().optional(),
  CREEM_WEBHOOK_SECRET: z.string().optional(),
  CREEM_API_URL: z.string().default('https://test-api.creem.io/v1'),

  // Creem Product IDs
  CREEM_PRODUCT_STARTER: z.string().optional(),
  CREEM_PRODUCT_GROWTH: z.string().optional(),
  CREEM_PRODUCT_PRO: z.string().optional(),
  CREEM_PRODUCT_ENTERPRISE: z.string().optional(),

  // Pinecone (Vector DB)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().default('ai-receptionist'),

  // Redis
  REDIS_URL: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // Resend (Email)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('AI Receptionist <notifications@resend.dev>'),

  // Google Calendar
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),

  // HubSpot CRM
  HUBSPOT_API_KEY: z.string().optional(),

  // Feature Flags
  ENABLE_SMS: z.enum(['true', 'false']).default('true'),
  ENABLE_WHATSAPP: z.string().default('false'),
  AVERAGE_APPOINTMENT_VALUE: z.string().optional(),
  FX_API_URL: z.string().optional(),
  FX_CACHE_TTL_MINUTES: z.string().optional(),

  // Security
  ENCRYPTION_KEY: z.string().optional(),

  // Internal
  HOST_PROVISION_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _env: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (_env) return _env;

  // Skip validation during Docker builds or when explicitly requested
  if (process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true') {
    _env = process.env as unknown as EnvConfig;
    return _env;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`
    ).join('\n');
    console.error(`Environment validation failed:\n${formatted}`);
    // In production, throw. In dev, fall back to raw process.env.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables:\n${formatted}`);
    }
  }

  // Use validated data if successful, otherwise fall back to raw env in dev
  _env = (parsed.success ? parsed.data : process.env as unknown as EnvConfig);
  return _env;
}

// Plan configuration
export const PLAN_CONFIG = {
  STARTER: {
    name: 'Starter',
    monthlyMinutes: 100,
    maxReceptionists: 1,
    maxPhoneNumbers: 1,
    maxKnowledgeSources: 5,
    priceMonthly: 4900, // $49.00
    overagePerMinute: 15, // $0.15
    features: ['1 AI Receptionist', '1 Phone Number', '100 minutes/mo', 'Basic Knowledge Base', 'Email Support'],
  },
  GROWTH: {
    name: 'Growth',
    monthlyMinutes: 500,
    maxReceptionists: 3,
    maxPhoneNumbers: 3,
    maxKnowledgeSources: 20,
    priceMonthly: 14900, // $149.00
    overagePerMinute: 12, // $0.12
    features: ['3 AI Receptionists', '3 Phone Numbers', '500 minutes/mo', 'Advanced Knowledge Base', 'SMS Integration', 'Call Transfer', 'Priority Support'],
  },
  PRO: {
    name: 'Pro',
    monthlyMinutes: 2000,
    maxReceptionists: 10,
    maxPhoneNumbers: 10,
    maxKnowledgeSources: 100,
    priceMonthly: 39900, // $399.00
    overagePerMinute: 10, // $0.10
    features: ['10 AI Receptionists', '10 Phone Numbers', '2000 minutes/mo', 'Unlimited Knowledge Base', 'Full SMS', 'Advanced Analytics', 'Custom Voices', 'API Access', 'Dedicated Support'],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    monthlyMinutes: 10000,
    maxReceptionists: 50,
    maxPhoneNumbers: 50,
    maxKnowledgeSources: 500,
    priceMonthly: 99900, // $999.00
    overagePerMinute: 8, // $0.08
    features: ['50 AI Receptionists', '50 Phone Numbers', '10000 minutes/mo', 'Custom LLM', 'White Label', 'SSO', 'SLA', 'Custom Integration', 'Dedicated Account Manager'],
  },
} as const;

export type PlanKey = keyof typeof PLAN_CONFIG;
