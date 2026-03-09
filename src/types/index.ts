// =============================================================================
// Shared TypeScript Types
// =============================================================================

import type { PlanTier, UserRole, Sentiment } from '@prisma/client';

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Auth types
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
  plan: PlanTier;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  iat: number;
  exp: number;
}

// AI Pipeline types
export interface VoicePipelineConfig {
  sttProvider: 'deepgram' | 'openai' | 'google';
  llmProvider: 'openai' | 'anthropic' | 'gemini';
  llmModel: string;
  ttsProvider: 'openai' | 'elevenlabs' | 'playht';
  voiceId: string;
  voiceSpeed: number;
  temperature: number;
  maxTokens: number;
  enableInterruptions: boolean;
  silenceTimeout: number;
}

export interface ConversationContext {
  sessionId: string;
  tenantId: string;
  receptionistId: string;
  channel: 'voice' | 'chat' | 'sms' | 'whatsapp';
  callerNumber?: string;
  contactId?: string;
  history: ConversationTurn[];
  knowledgeContext?: string;
  metadata: {
    intent?: string;
    sentiment?: Sentiment;
    emergencyDetected?: boolean;
    transferRequested?: boolean;
    transferTarget?: string;
    bookingData?: BookingData;
    leadScore?: number;
  };
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  latencyMs?: number;
}

export interface AIResponse {
  text: string;
  intent: string;
  sentiment: Sentiment;
  confidence: number;
  shouldTransfer: boolean;
  transferTarget?: string;
  transferDepartment?: string;
  shouldEscalate: boolean;
  emergencyDetected: boolean;
  bookingComplete: boolean;
  availabilityCheckRequest?: { date: string; time: string };
  leadScore: number;
  sendSms: boolean;
  smsContent?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
}

export interface BookingData {
  name?: string;
  phone?: string;
  email?: string;
  date?: string;
  time?: string;
  service?: string;
}

// Knowledge base types
export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
}

export interface WebScrapingResult {
  title: string;
  description: string;
  services: string[];
  businessHours: string[];
  faqs: Array<{ question: string; answer: string }>;
  location: string;
  contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
  };
  rawContent: string;
}

// Call types
export interface CallSession {
  callId: string;
  tenantId: string;
  receptionistId: string;
  callerNumber: string;
  dialedNumber: string;
  startedAt: Date;
  transcript: TranscriptEntry[];
  context: ConversationContext;
}

export interface TranscriptEntry {
  speaker: 'caller' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  confidence?: number;
}

// Transfer types
export interface TransferConfig {
  type: 'blind' | 'warm' | 'voicemail' | 'department' | 'extension';
  target: string;
  targetName?: string;
  department?: string;
  reason?: string;
}

// Billing types
export interface UsageSummary {
  totalMinutes: number;
  includedMinutes: number;
  overageMinutes: number;
  overageCost: number;
  smsSent: number;
  smsReceived: number;
  totalCalls: number;
  periodStart: Date;
  periodEnd: Date;
}

// Dashboard types
export interface DashboardAnalytics {
  summary: {
    totalCalls: number;
    totalMinutes: number;
    avgCallDuration: number;
    transferRate: number;
    resolutionRate: number;
    sentimentBreakdown: Record<string, number>;
  };
  callVolume: Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  topIntents: Array<{
    intent: string;
    count: number;
    percentage: number;
  }>;
  recentCalls: Array<{
    id: string;
    callerNumber: string;
    duration: number;
    sentiment: Sentiment;
    intent: string;
    startedAt: Date;
  }>;
}
