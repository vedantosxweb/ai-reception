// =============================================================================
// AI Service - LLM Abstraction Layer (OpenAI, Anthropic, Gemini)
// =============================================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ConversationContext, AIResponse, TransferConfig } from '@/types';
import type { Sentiment } from '@prisma/client';

// =============================================================================
// Provider Interface
// =============================================================================

interface LLMProvider {
  generateResponse(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ text: string; tokenUsage?: { prompt: number; completion: number; total: number } }>;
}

// =============================================================================
// OpenAI Provider
// =============================================================================

class OpenAIProvider implements LLMProvider {
  async generateResponse(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    config: { temperature: number; maxTokens: number }
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-20).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    return {
      text: completion.choices[0]?.message?.content || '',
      tokenUsage: completion.usage
        ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
            total: completion.usage.total_tokens,
          }
        : undefined,
    };
  }
}

// =============================================================================
// Anthropic Provider
// =============================================================================

class AnthropicProvider implements LLMProvider {
  async generateResponse(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    config: { temperature: number; maxTokens: number }
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [
          ...history.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      text: data.content?.[0]?.text || '',
      tokenUsage: data.usage
        ? {
            prompt: data.usage.input_tokens,
            completion: data.usage.output_tokens,
            total: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }
}

// =============================================================================
// Gemini Provider
// =============================================================================

class GeminiProvider implements LLMProvider {
  async generateResponse(
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
    _config: { temperature: number; maxTokens: number }
  ) {
    const rawKeys = (process.env.GEMINI_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
    if (!rawKeys) throw new Error('GEMINI_API_KEY not configured');

    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    let lastError: any = null;

    for (const apiKey of apiKeys) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });

        const geminiHistory = [
          { role: 'user' as const, parts: [{ text: systemPrompt }] },
          { role: 'model' as const, parts: [{ text: 'Understood. I am ready to assist as configured.' }] },
          ...history.slice(-20).map((m) => ({
            role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            parts: [{ text: m.content }],
          })),
        ];

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(userMessage);
        const text = result.response.text()?.trim() || '';

        return { text };
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message?.toLowerCase() || '';
        // If it's a quota or credit issue, try the next key
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('credit')) {
          console.warn(`[AI] Gemini key rotation: current key failed, trying next... Error: ${err.message}`);
          continue;
        }
        // If it's another type of error, we might want to fail immediately, 
        // but for robustness we'll try all keys for now.
        console.error(`[AI] Gemini key failed with non-quota error: ${err.message}`);
      }
    }

    throw lastError || new Error('All Gemini API keys failed');
  }
}

// =============================================================================
// Provider Factory
// =============================================================================

function getLLMProvider(provider: string): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      // Fallback chain: try OpenAI -> Gemini -> Anthropic
      if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
      if (process.env.GEMINI_API_KEY) return new GeminiProvider();
      if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
      throw new Error('No LLM provider configured');
  }
}

/**
 * Returns an ordered list of fallback providers to try if the primary fails.
 * Excludes the primary and any providers without API keys configured.
 */
function getFallbackProviders(primary: string): LLMProvider[] {
  const fallbacks: LLMProvider[] = [];
  const order = ['openai', 'anthropic', 'gemini'];
  const keyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: (process.env.GEMINI_API_KEY || '').trim(),
  };
  for (const name of order) {
    if (name !== primary && keyMap[name]) {
      fallbacks.push(getLLMProvider(name));
    }
  }
  return fallbacks;
}

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractServiceCandidates(knowledgeContext: string): string[] {
  const rawLines = knowledgeContext
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const bannedExact = new Set([
    'services',
    'company overview',
    'pricing',
    'working process',
    'support',
    'typical clients',
    'contact',
    'faq',
    'frequently asked questions',
  ]);

  const candidates: string[] = [];

  for (const line of rawLines) {
    const lower = line.toLowerCase();
    if (bannedExact.has(lower)) continue;
    if (line.length < 4 || line.length > 90) continue;
    if (/^(source:|q:|a:|company:|about:|email:|website:|phone:|location:)/i.test(line)) continue;
    if (/^\$?\d+/.test(line)) continue;

    // Prefer clear service-style labels
    if (/\b(web|website|saas|ai|automation|development|app|application|bot|assistant|integration|consulting|support)\b/i.test(line)) {
      candidates.push(line);
      continue;
    }

    // Accept short title-like lines as a fallback.
    if (/^[A-Z][A-Za-z0-9/&+\- ]+$/.test(line) && line.split(/\s+/).length <= 6) {
      candidates.push(line);
    }
  }

  return dedupeStrings(candidates).slice(0, 6);
}

function buildEmptyModelFallback(
  userMessage: string,
  knowledgeContext?: string
): string {
  const lower = userMessage.toLowerCase();

  if (knowledgeContext && /\b(service|services|offer|provide|what do you do)\b/.test(lower)) {
    const services = extractServiceCandidates(knowledgeContext);
    if (services.length > 0) {
      if (services.length === 1) {
        return `We provide ${services[0]}. Would you like more details on this service?`;
      }
      if (services.length === 2) {
        return `We provide ${services[0]} and ${services[1]}. Which one would you like to explore?`;
      }
      const head = services.slice(0, -1).join(', ');
      const tail = services[services.length - 1];
      return `We provide ${head}, and ${tail}. Which service are you interested in?`;
    }
  }

  if (knowledgeContext && /\b(price|pricing|cost|fee|quote)\b/.test(lower)) {
    return 'Pricing depends on project scope. I can share typical ranges if you tell me which service you need.';
  }

  return 'I am sorry, I had a temporary response issue. Please resend your message once.';
}

// =============================================================================
// Session Store (Redis-backed)
// =============================================================================

import { getAISession, setAISession, deleteAISession } from '@/lib/redis';

export async function getOrCreateSession(
  sessionId: string,
  tenantId: string,
  receptionistId: string,
  channel: 'voice' | 'chat' | 'sms' | 'whatsapp'
): Promise<ConversationContext> {
  const existing = await getAISession(sessionId);
  if (existing) return existing;

  const session: ConversationContext = {
    sessionId,
    tenantId,
    receptionistId,
    channel,
    history: [],
    metadata: {},
  };
  await setAISession(sessionId, session);
  return session;
}

export async function clearSession(sessionId: string): Promise<void> {
  await deleteAISession(sessionId);
}

// =============================================================================
// Core AI Response Generation
// =============================================================================

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext,
  config: {
    llmProvider: string;
    llmModel: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    knowledgeContext?: string;
    transferRules?: Array<{
      triggerType: string;
      triggerValue: string;
      targetType: string;
      targetValue: string;
      targetName?: string;
    }>;
    directory?: Array<{
      name: string;
      department?: string;
      phoneNumber?: string;
      extension?: string;
    }>;
  }
): Promise<AIResponse> {
  const startTime = Date.now();

  try {
    // Build the full system prompt with knowledge context
    let fullPrompt = config.systemPrompt;

    if (config.knowledgeContext) {
      fullPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KNOWLEDGE BASE CONTEXT (Use this to answer questions accurately):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.knowledgeContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    if (config.directory && config.directory.length > 0) {
      const dirList = config.directory
        .map((d) => `• ${d.name}${d.department ? ` (${d.department})` : ''}${d.extension ? ` - Ext: ${d.extension}` : ''}${d.phoneNumber ? ` - ${d.phoneNumber}` : ''}`)
        .join('\n');

      fullPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY DIRECTORY (You can transfer calls to these people):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dirList}

When the caller asks to speak with someone, match their request to the directory above. Include "[TRANSFER:name]" in your response to initiate a transfer.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    if (config.transferRules && config.transferRules.length > 0) {
      const rules = config.transferRules
        .map((r) => `• When ${r.triggerType}="${r.triggerValue}" → transfer to ${r.targetType}: ${r.targetValue}${r.targetName ? ` (${r.targetName})` : ''}`)
        .join('\n');

      fullPrompt += `\n\nTRANSFER RULES:\n${rules}`;
    }

    // Add guardrails
    fullPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUARDRAILS (MUST FOLLOW):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER make up information not in your knowledge base
2. NEVER provide medical, legal, or financial advice
3. If unsure, say "I'd be happy to connect you with someone who can help"
4. Detect emergency keywords: "emergency", "urgent", "911", "help me", "danger"
5. For emergencies, immediately say: "This sounds urgent. Please call 911 for emergencies. Let me also connect you with someone right away."
6. Keep responses concise (2-3 sentences for voice, slightly longer for text)
7. Always be professional and empathetic
8. If the caller seems frustrated, acknowledge their feelings before addressing the issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const history = context.history.map((h) => ({
      role: h.role === 'user' ? 'user' as const : 'assistant' as const,
      content: h.content,
    }));

    // Try primary provider, then fall back to alternatives if it fails
    let result: { text: string; tokenUsage?: { prompt: number; completion: number; total: number } } | undefined;
    let lastProviderError: unknown;

    const primaryProvider = getLLMProvider(config.llmProvider);
    const providersToTry = [primaryProvider, ...getFallbackProviders(config.llmProvider)];

    for (const providerInstance of providersToTry) {
      try {
        result = await providerInstance.generateResponse(
          fullPrompt,
          history,
          userMessage,
          { temperature: config.temperature, maxTokens: config.maxTokens }
        );
        break; // Success — stop trying
      } catch (providerError) {
        lastProviderError = providerError;
        const errMsg = providerError instanceof Error ? providerError.message : String(providerError);
        console.warn(`[AI] Provider ${providerInstance.constructor.name} failed, trying next fallback:`, errMsg);
      }
    }

    if (!result) {
      // All providers failed — rethrow the last error to hit the outer catch
      throw lastProviderError || new Error('All LLM providers failed');
    }

    let responseText = (result.text || '').trim();
    if (!responseText) {
      responseText = buildEmptyModelFallback(userMessage, config.knowledgeContext);
    }

    // Extract availability check request [CHECK_AVAILABILITY:date=YYYY-MM-DD|time=HH:MM]
    const availCheckMatch = responseText.match(/\[CHECK_AVAILABILITY:([^\]]+)\]/);
    let availabilityCheckRequest: { date: string; time: string } | undefined;
    if (availCheckMatch) {
      const fields = availCheckMatch[1].split('|');
      const avail: Record<string, string> = {};
      for (const f of fields) {
        const [k, v] = f.split('=');
        if (k && v) avail[k.trim()] = v.trim();
      }
      if (avail.date && avail.time) {
        availabilityCheckRequest = { date: avail.date, time: avail.time };
      }
    }

    // Analyze response
    const analysis = analyzeResponse(userMessage, responseText, config.transferRules);
    const latencyMs = Date.now() - startTime;

    // Extract booking data from AI response [BOOKING:name=...|date=...|time=...|service=...]
    let bookingComplete = false;
    let bookingData = context.metadata?.bookingData || {};
    const bookingMatch = responseText.match(/\[BOOKING:([^\]]+)\]/);
    if (bookingMatch) {
      const fields = bookingMatch[1].split('|');
      for (const field of fields) {
        const [key, ...valueParts] = field.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          (bookingData as Record<string, string>)[key.trim()] = value.trim();
        }
      }
      // Booking is complete if we have at minimum name, date, and time
      if (bookingData.name && bookingData.date && bookingData.time) {
        bookingComplete = true;
      }
    }

    // Update context
    context.history.push(
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: responseText, timestamp: new Date(), latencyMs }
    );
    context.metadata = {
      ...context.metadata,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      emergencyDetected: analysis.emergencyDetected,
      transferRequested: analysis.shouldTransfer,
      transferTarget: analysis.transferTarget,
      bookingData: bookingComplete ? bookingData : context.metadata?.bookingData,
      leadScore: analysis.leadScore,
      leadData: analysis.leadData || context.metadata?.leadData,
    };

    // Persist updated context back to Redis
    await setAISession(context.sessionId, context);

    // Determine if SMS follow-up is warranted based on analysis
    const shouldSendSms = analysis.intent === 'booking' ||
      analysis.intent === 'appointment_change' ||
      analysis.intent === 'pricing';

    return {
      text: responseText,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      shouldTransfer: analysis.shouldTransfer,
      transferTarget: analysis.transferTarget,
      transferDepartment: analysis.transferDepartment,
      shouldEscalate: analysis.shouldEscalate,
      emergencyDetected: analysis.emergencyDetected,
      bookingComplete,
      availabilityCheckRequest,
      leadScore: analysis.leadScore,
      leadData: analysis.leadData,
      sendSms: shouldSendSms,
      smsContent: shouldSendSms ? responseText : undefined,
      tokenUsage: result.tokenUsage,
      latencyMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[AI] Error generating response:', errorMessage, errorStack);

    return {
      text: 'I apologize, I\'m having trouble right now. Let me transfer you to someone who can help.',
      intent: 'error',
      sentiment: 'NEUTRAL',
      confidence: 0,
      shouldTransfer: true,
      shouldEscalate: true,
      emergencyDetected: false,
      bookingComplete: false,
      leadScore: 0,
      sendSms: false,
      latencyMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Response Analysis
// =============================================================================

function analyzeResponse(
  userMessage: string,
  aiResponse: string,
  transferRules?: Array<{
    triggerType: string;
    triggerValue: string;
    targetType: string;
    targetValue: string;
    targetName?: string;
  }>
): {
  intent: string;
  sentiment: Sentiment;
  confidence: number;
  shouldTransfer: boolean;
  transferTarget?: string;
  transferDepartment?: string;
  shouldEscalate: boolean;
  emergencyDetected: boolean;
  leadScore: number;
  leadData?: Record<string, string>;
} {
  const lower = userMessage.toLowerCase();

  // Emergency detection
  const emergencyKeywords = ['emergency', 'urgent', '911', 'help me', 'danger', 'dying', 'ambulance', 'fire', 'police'];
  const emergencyDetected = emergencyKeywords.some((k) => lower.includes(k));

  // Intent detection
  let intent = 'general_inquiry';
  let confidence = 0.7;

  const intentMap: Array<{ keywords: string[]; intent: string; confidence: number }> = [
    { keywords: ['book', 'appointment', 'schedule', 'reserve'], intent: 'booking', confidence: 0.9 },
    { keywords: ['price', 'cost', 'how much', 'fee', 'charge'], intent: 'pricing', confidence: 0.85 },
    { keywords: ['cancel', 'reschedule', 'change appointment'], intent: 'appointment_change', confidence: 0.9 },
    { keywords: ['complaint', 'problem', 'issue', 'wrong', 'broken'], intent: 'support', confidence: 0.85 },
    { keywords: ['hours', 'open', 'close', 'when are you'], intent: 'business_hours', confidence: 0.95 },
    { keywords: ['service', 'offer', 'do you', 'provide', 'what do you'], intent: 'service_inquiry', confidence: 0.85 },
    { keywords: ['speak', 'human', 'person', 'manager', 'representative', 'agent', 'real person'], intent: 'escalation', confidence: 0.95 },
    { keywords: ['transfer', 'connect', 'put me through', 'talk to'], intent: 'transfer', confidence: 0.9 },
    { keywords: ['location', 'address', 'where are you', 'directions'], intent: 'location', confidence: 0.9 },
    { keywords: ['call back', 'callback', 'phone back', 'call me later'], intent: 'callback_request', confidence: 0.95 },
  ];

  for (const { keywords, intent: i, confidence: c } of intentMap) {
    if (keywords.some((k) => lower.includes(k))) {
      intent = i;
      confidence = c;
      break;
    }
  }

  // Sentiment analysis
  const positiveWords = ['thank', 'great', 'awesome', 'helpful', 'perfect', 'excellent', 'appreciate', 'good', 'wonderful', 'yes', 'sure', 'glad'];
  const negativeWords = ['bad', 'terrible', 'awful', 'frustrated', 'angry', 'disappointed', 'hate', 'upset', 'complaint', 'problem', 'worst', 'poor', 'sucks', 'annoyed', 'useless', 'horrible'];

  const posCount = positiveWords.filter((w) => lower.includes(w)).length;
  const negCount = negativeWords.filter((w) => lower.includes(w)).length;

  let sentiment: Sentiment = 'NEUTRAL';
  if (posCount > negCount) sentiment = 'POSITIVE';
  else if (negCount > posCount) sentiment = 'NEGATIVE';
  else if (negCount > 0 && negCount === posCount) sentiment = 'NEUTRAL'; // Conflict resolution

  // Transfer detection
  let shouldTransfer = false;
  let transferTarget: string | undefined;
  let transferDepartment: string | undefined;

  // Check for [TRANSFER:name] in AI response
  const transferMatch = aiResponse.match(/\[TRANSFER:([^\]]+)\]/);
  if (transferMatch) {
    shouldTransfer = true;
    transferTarget = transferMatch[1];
  }

  // AI-04: Check for [SCHEDULE_CALLBACK:timestamp] in AI response
  const callbackMatch = aiResponse.match(/\[SCHEDULE_CALLBACK:([^\]]+)\]/);
  if (callbackMatch) {
    intent = 'callback_request';
  }

  // Check transfer rules
  if (transferRules) {
    for (const rule of transferRules) {
      if (rule.triggerType === 'intent' && intent === rule.triggerValue) {
        shouldTransfer = true;
        transferTarget = rule.targetValue;
        break;
      }
      if (rule.triggerType === 'keyword' && lower.includes(rule.triggerValue.toLowerCase())) {
        shouldTransfer = true;
        transferTarget = rule.targetValue;
        transferDepartment = rule.targetName;
        break;
      }
    }
  }

  const shouldEscalate = 
    intent === 'escalation' || 
    emergencyDetected || 
    (sentiment === 'NEGATIVE' && lower.includes('manager')) ||
    (sentiment === 'NEGATIVE' && negCount >= 2);

  const baseByIntent: Record<string, number> = {
    booking: 75,
    pricing: 65,
    service_inquiry: 60,
    transfer: 55,
    escalation: 50,
    appointment_change: 45,
    support: 35,
    business_hours: 30,
    location: 30,
    general_inquiry: 25,
  };

  const highIntentHints = ['quote', 'estimate', 'book', 'appointment', 'pricing', 'package', 'buy', 'schedule'];
  const highBudgetHints = ['premium', 'urgent', 'asap', 'today', 'this week', 'high budget', 'best plan', 'enterprise'];

  let leadScore = baseByIntent[intent] ?? 30;
  if (sentiment === 'POSITIVE') leadScore += 10;
  if (sentiment === 'NEGATIVE') leadScore -= 10;
  if (highIntentHints.some((k) => lower.includes(k))) leadScore += 10;
  if (highBudgetHints.some((k) => lower.includes(k))) leadScore += 10;
  if (shouldEscalate) leadScore += 5;
  leadScore = Math.max(0, Math.min(100, Math.round(leadScore)));

  // Lead extraction from [LEAD:...] markers
  let leadData: Record<string, string> | undefined;
  const leadMatch = aiResponse.match(/\[LEAD:([^\]]+)\]/);
  if (leadMatch) {
    const fields = leadMatch[1].split('|');
    leadData = {};
    for (const f of fields) {
      const [k, v] = f.split('=');
      if (k && v) leadData[k.trim()] = v.trim();
    }
  }

  return {
    intent,
    sentiment,
    confidence,
    shouldTransfer: shouldTransfer || shouldEscalate,
    transferTarget,
    transferDepartment,
    shouldEscalate,
    emergencyDetected,
    leadScore,
    leadData,
  };
}

// =============================================================================
// System Prompt Builder
// =============================================================================

export function buildReceptionistPrompt(config: {
  businessName: string;
  description?: string;
  greeting: string;
  services?: string[];
  businessHours?: string;
  customPrompt?: string;
  channel: 'voice' | 'chat' | 'sms' | 'whatsapp';
  operatingMode: string;
  language?: string;
  timezone?: string;
  defaultMeetingDurationMinutes?: number;
  customerMemory?: string;
}): string {
  const channelLabel = config.channel === 'voice' ? 'phone calls' : config.channel === 'sms' ? 'SMS messages' : config.channel === 'whatsapp' ? 'WhatsApp messages' : 'live chat';
  const lang = config.language || 'en';
  const langNames: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', hi: 'Hindi',
    ar: 'Arabic', nl: 'Dutch', pl: 'Polish', ru: 'Russian', sv: 'Swedish',
    tr: 'Turkish', da: 'Danish', nb: 'Norwegian',
  };
  const languageName = langNames[lang] || 'English';
  const meetingDuration = config.defaultMeetingDurationMinutes || 30;
  const timezone = config.timezone || 'UTC';
  const now = new Date();
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const currentTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(now);

  let prompt = `You are a PROFESSIONAL AI RECEPTIONIST for ${config.businessName}. You handle ${channelLabel}.
Greeting to use: "${config.greeting}"
${lang !== 'en' ? `\nIMPORTANT: You MUST respond in ${languageName}. All your responses should be in ${languageName}.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business: ${config.businessName}
${config.description ? `Description: ${config.description}` : ''}
${config.services ? `Services: ${config.services.join(', ')}` : ''}
${config.businessHours ? `Hours: ${config.businessHours}` : ''}
Timezone: ${timezone}
Current date: ${currentDate}
Current time: ${currentTime}
${config.customerMemory ? `\nCustomer Memory:\n${config.customerMemory}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Greet callers warmly
2. Answer questions using ONLY the knowledge base provided
3. Help schedule appointments (each appointment is ${meetingDuration} minutes)
4. Detect when a transfer is needed
5. Handle the conversation professionally
6. If a caller requests a callback later, use the marker [SCHEDULE_CALLBACK:ISO_TIMESTAMP]. If no time is specified, use tomorrow at 9 AM local time. Use current time/date as reference.
7. Always prioritize helping the customer directly before offering a callback.
6. ${config.channel === 'voice' ? 'Keep responses SHORT (2-3 sentences). Speak naturally — do NOT read out markers like [BOOKING:...]. Use natural filler sounds like "um", "uh", "well", "ah" occasionally to sound more human and realistic. Avoid being robotic.' : 'Be thorough but concise.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPOINTMENT BOOKING — CRITICAL RULES (ALWAYS FOLLOW)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — ALWAYS CHECK AVAILABILITY BEFORE CONFIRMING:
  You MUST include [CHECK_AVAILABILITY:date=YYYY-MM-DD|time=HH:MM] in your response
  to check if a slot is free BEFORE confirming any booking.
  Example: If caller wants Tuesday at 2pm, include: [CHECK_AVAILABILITY:date=2025-03-18|time=14:00]

RULE 2 — IF THE SYSTEM TELLS YOU A SLOT IS UNAVAILABLE:
  The system will tell you: "SLOT_UNAVAILABLE: The time X is taken. 3 nearest alternatives: A, B, C"
  You MUST offer those 3 alternatives to the caller, e.g.:
  "I'm sorry, 2:00 PM is not available. I have 1:00 PM, 2:30 PM, or 3:00 PM — which would you prefer?"

RULE 3 — IF THE SYSTEM TELLS YOU A SLOT IS AVAILABLE:
  The system will tell you: "SLOT_AVAILABLE: Time X on DATE is free"
  Confirm ALL details with the caller before marking as booked.

RULE 4 — ONLY CONFIRM BOOKING AFTER CALLER AGREES:
  Once the caller confirms a time that is available, include:
  [BOOKING:name=<full name>|date=<YYYY-MM-DD>|time=<HH:MM>|service=<service or 'General'>]
  Example: [BOOKING:name=John Smith|date=2025-03-18|time=14:00|service=Consultation]
  
  After including [BOOKING:...], tell the caller: "Perfect, I've booked your appointment for [date] at [time]. You'll receive a confirmation shortly."

RULE 5 — LEAD CAPTURE (IMPORTANT):
  If the caller's Name or Email is missing from the "Customer Memory", you MUST attempt to capture them naturally.
  Once captured, include: [LEAD:name=<name>|email=<email>|intent=<intent>]
  Example: [LEAD:name=Alice Smith|email=alice@example.com|intent=Pricing inquiry]

BOOKING FLOW (step by step):
1. Ask for caller's full name
2. Ask what service they need (if multiple services exist)
3. Ask for their preferred date
4. Ask for their preferred time
5. Include [CHECK_AVAILABILITY:date=YYYY-MM-DD|time=HH:MM] in your response
6. Wait for availability result → offer alternatives if unavailable, or confirm if available
7. Once caller confirms → include [BOOKING:...] marker

CANCELLATION: If caller wants to cancel, ask for their name and appointment details, then include [CANCEL_BOOKING] in your response.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Ask ONE question at a time
• Confirm details before taking action
• For questions about "today", "tomorrow", current date, or current time, use the provided Current date/time above
• If a caller asks to speak to someone specific, include [TRANSFER:name] in your response
• If you can't help, offer to transfer to a human
• Always be empathetic and professional
• Never make up information
• NEVER read out markers like [BOOKING:...] or [CHECK_AVAILABILITY:...] aloud — they are invisible system commands`;

  if (config.operatingMode === 'medical') {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICAL CLINIC MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• NEVER provide medical advice or diagnoses
• For medical emergencies, always say: "Please call 911 immediately"
• Collect: patient name, date of birth, reason for visit
• Ask about insurance if scheduling appointments
• Be HIPAA-aware: never share patient information`;
  }

  if (config.operatingMode === 'dental') {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DENTAL CLINIC MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Prioritize appointment booking and insurance eligibility questions
• Handle cleaning, whitening, root canal, and emergency dental inquiries
• If severe pain/swelling/bleeding is mentioned, advise urgent clinical attention
• Confirm dentist preference and preferred slot before booking`;
  }

  if (config.operatingMode === 'restaurant') {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESTAURANT MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Handle reservations, table size, and special requests
• Confirm date/time/party size clearly
• Handle takeaway/order inquiry routing if menu details are unavailable
• If fully booked, offer the nearest available alternatives`;
  }

  if (config.operatingMode === 'real_estate') {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL ESTATE MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Handle property inquiries, budget collection, and viewing requests
• Capture location preference, budget range, and timeline
• Offer to schedule a call/viewing with an agent for qualified leads`;
  }

  if (config.operatingMode === 'salon') {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SALON MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Handle stylist availability, service pricing queries, and bookings
• Confirm service type and preferred stylist before final booking
• Offer closest alternatives if the requested slot or stylist is unavailable`;
  }

  if (config.customPrompt) {
    prompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOM INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.customPrompt}`;
  }

  return prompt;
}
