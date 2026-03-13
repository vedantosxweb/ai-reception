// =============================================================================
// Telephony Service - Twilio/Telnyx abstraction for voice & SMS
// =============================================================================

import twilio from 'twilio';
import { db } from '@/lib/db';
import { buildTwilioWebhookUrl } from '@/lib/telephony/webhook';

// =============================================================================
// Twilio Client
// =============================================================================

let _twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  if (!_twilioClient) {
    _twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Reusable helper for retrying failed API calls with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err as Error;
      // Triggers for transient errors (429, 500, 503)
      const shouldRetry = lastError.message?.includes('429') || 
                         lastError.message?.includes('500') || 
                         lastError.message?.includes('503') ||
                         lastError.message?.includes('ETIMEDOUT') ||
                         lastError.message?.includes('ECONNREFUSED');
      
      if (!shouldRetry || i === maxRetries - 1) break;
      
      const jitter = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i) + jitter));
    }
  }
  throw lastError;
}

// =============================================================================
// TwiML Builders
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SayVoice = any; // Twilio voice type - using any to avoid version-specific type issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SayLanguage = any; // Twilio language type

// Language to Polly voice + TwiML language mapping
const LANGUAGE_VOICE_MAP: Record<string, { voice: string; twimlLang: string; name: string }> = {
  en: { voice: 'Polly.Joanna', twimlLang: 'en-US', name: 'English' },
  'en-GB': { voice: 'Polly.Amy', twimlLang: 'en-GB', name: 'English (UK)' },
  'en-AU': { voice: 'Polly.Nicole', twimlLang: 'en-AU', name: 'English (AU)' },
  es: { voice: 'Polly.Lupe', twimlLang: 'es-US', name: 'Spanish' },
  'es-ES': { voice: 'Polly.Lucia', twimlLang: 'es-ES', name: 'Spanish (Spain)' },
  fr: { voice: 'Polly.Lea', twimlLang: 'fr-FR', name: 'French' },
  'fr-CA': { voice: 'Polly.Gabrielle', twimlLang: 'fr-CA', name: 'French (Canada)' },
  de: { voice: 'Polly.Vicki', twimlLang: 'de-DE', name: 'German' },
  it: { voice: 'Polly.Bianca', twimlLang: 'it-IT', name: 'Italian' },
  pt: { voice: 'Polly.Camila', twimlLang: 'pt-BR', name: 'Portuguese (BR)' },
  'pt-PT': { voice: 'Polly.Ines', twimlLang: 'pt-PT', name: 'Portuguese (PT)' },
  ja: { voice: 'Polly.Mizuki', twimlLang: 'ja-JP', name: 'Japanese' },
  ko: { voice: 'Polly.Seoyeon', twimlLang: 'ko-KR', name: 'Korean' },
  zh: { voice: 'Polly.Zhiyu', twimlLang: 'zh-CN', name: 'Chinese (Mandarin)' },
  hi: { voice: 'Polly.Aditi', twimlLang: 'hi-IN', name: 'Hindi' },
  ar: { voice: 'Polly.Zeina', twimlLang: 'ar-AE', name: 'Arabic' },
  nl: { voice: 'Polly.Lotte', twimlLang: 'nl-NL', name: 'Dutch' },
  pl: { voice: 'Polly.Ewa', twimlLang: 'pl-PL', name: 'Polish' },
  ru: { voice: 'Polly.Tatyana', twimlLang: 'ru-RU', name: 'Russian' },
  sv: { voice: 'Polly.Astrid', twimlLang: 'sv-SE', name: 'Swedish' },
  tr: { voice: 'Polly.Filiz', twimlLang: 'tr-TR', name: 'Turkish' },
  da: { voice: 'Polly.Naja', twimlLang: 'da-DK', name: 'Danish' },
  nb: { voice: 'Polly.Liv', twimlLang: 'nb-NO', name: 'Norwegian' },
};

export function getLanguageVoiceMap() {
  return LANGUAGE_VOICE_MAP;
}

export function resolveVoiceAndLang(language?: string, voiceName?: string): { voice: SayVoice; lang: SayLanguage } {
  const langConfig = LANGUAGE_VOICE_MAP[language || 'en'] || LANGUAGE_VOICE_MAP['en'];
  
  // Centralized fallback logic:
  // 1. Use voiceName if provided and NOT a generic default like 'alloy' or 'Polly.Joanna' (if we want to override those)
  // 2. Otherwise use ELEVENLABS_DEFAULT_VOICE_ID if configured
  // 3. Finally fall back to the language map default
  
  let resolvedVoice = voiceName;

  // If voice is a generic default or empty, check for ElevenLabs environment default
  const genericDefaults = ['alloy', 'Polly.Joanna', 'Polly.Aditi']; // Add common defaults to override
  if (!resolvedVoice || genericDefaults.includes(resolvedVoice)) {
    resolvedVoice = process.env.ELEVENLABS_DEFAULT_VOICE_ID || langConfig.voice;
  }

  // Handle ElevenLabs voice IDs
  // If the voice doesn't start with Polly. or Google., and looks like an ID, assume it's ElevenLabs
  if (resolvedVoice && !resolvedVoice.startsWith('Polly.') && !resolvedVoice.startsWith('Google.')) {
    // Prefix with ElevenLabs. for Twilio integration if not already prefixed
    if (!resolvedVoice.startsWith('ElevenLabs.')) {
      resolvedVoice = `ElevenLabs.${resolvedVoice}`;
    }
  }

  return {
    voice: resolvedVoice as SayVoice,
    lang: langConfig.twimlLang as SayLanguage,
  };
}

export function buildGreetingTwiML(options: {
  greeting: string;
  gatherUrl: string;
  voiceName?: string;
  language?: string;
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const { voice, lang } = resolveVoiceAndLang(options.language, options.voiceName);

  response.say(
    { voice: voice as SayVoice, language: lang },
    options.greeting
  );

  response.pause({ length: 1 });

  const gather = response.gather({
    action: options.gatherUrl,
    input: ['speech', 'dtmf'],
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    method: 'POST',
    language: lang,
  });

  gather.say(
    { voice: voice as SayVoice, language: lang },
    ''
  );

  return response.toString();
}

export function buildResponseTwiML(options: {
  text: string;
  gatherUrl: string;
  voiceName?: string;
  shouldHangup?: boolean;
  language?: string;
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const { voice, lang } = resolveVoiceAndLang(options.language, options.voiceName);

  response.say(
    { voice: voice as SayVoice, language: lang },
    options.text
  );

  if (options.shouldHangup) {
    response.hangup();
  } else {
    const gather = response.gather({
      action: options.gatherUrl,
      input: ['speech', 'dtmf'],
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      method: 'POST',
      language: lang,
    });

    gather.say(
      { voice: voice as SayVoice, language: lang },
      ''
    );

    // If no input, ask again
    response.say(
      { voice: voice as SayVoice, language: lang },
      options.language && options.language !== 'en'
        ? '' // For non-English, the LLM handles the language in its responses
        : 'I didn\'t catch that. Is there anything else I can help you with?'
    );

    response.gather({
      action: options.gatherUrl,
      input: ['speech', 'dtmf'],
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      method: 'POST',
      language: lang,
    });

    response.say(
      { voice: voice as SayVoice, language: lang },
      options.language && options.language !== 'en'
        ? '' // Let the AI handle goodbye in the right language
        : 'Thank you for calling. Goodbye!'
    );
    response.hangup();
  }

  return response.toString();
}

export function buildTransferTwiML(options: {
  message: string;
  transferTo: string;
  voiceName?: string;
  callerId?: string;
  language?: string;
  statusCallback?: string;
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const { voice, lang } = resolveVoiceAndLang(options.language, options.voiceName);

  response.say(
    { voice: voice as SayVoice, language: lang },
    options.message
  );

  response.pause({ length: 1 });

  const dial = response.dial({
    callerId: options.callerId || process.env.TWILIO_PHONE_NUMBER,
    timeout: 30,
    action: options.statusCallback, // Use action to know when dial ends
  });
  
  // Use Twilio's default wait music during dialing
  dial.number({
    url: 'http://com.twilio.music.classic.s3.amazonaws.com/Wait_and_Hope.mp3',
    statusCallback: options.statusCallback,
    statusCallbackEvent: ['completed'],
    statusCallbackMethod: 'POST',
  }, options.transferTo);

  // If transfer fails
  response.say(
    { voice: voice as SayVoice, language: lang },
    options.language && options.language !== 'en'
      ? ''
      : 'I\'m sorry, the line is busy. Please leave a message after the beep.'
  );

  response.record({
    maxLength: 120,
    transcribe: true,
    method: 'POST',
  });

  response.hangup();

  return response.toString();
}

export function buildVoicemailTwiML(options: {
  message: string;
  voiceName?: string;
  callbackUrl: string;
  language?: string;
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  const { voice, lang } = resolveVoiceAndLang(options.language, options.voiceName);

  response.say(
    { voice: voice as SayVoice, language: lang },
    options.message
  );

  response.record({
    maxLength: 120,
    action: options.callbackUrl,
    transcribe: true,
    method: 'POST',
  });

  response.hangup();
  return response.toString();
}

// Build TwiML for outbound calls with AI receptionist
export function buildOutboundCallTwiML(options: {
  greeting: string;
  gatherUrl: string;
  voiceName?: string;
  language?: string;
}): string {
  return buildGreetingTwiML(options);
}

// =============================================================================
// SMS Operations
// =============================================================================

export async function sendSMS(
  to: string,
  body: string,
  from?: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const message = await withRetry(() => client.messages.create({
      to,
      from: from || process.env.TWILIO_PHONE_NUMBER!,
      body,
      statusCallback: buildTwilioWebhookUrl('/api/webhooks/twilio/status/sms'),
    }));

    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('[Telephony] SMS send error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// =============================================================================
// WhatsApp Operations
// =============================================================================

export async function sendWhatsApp(
  to: string,
  body: string,
  from?: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    // WhatsApp messages require the whatsapp: prefix
    const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const whatsappFrom = from
      ? (from.startsWith('whatsapp:') ? from : `whatsapp:${from}`)
      : (process.env.TWILIO_WHATSAPP_NUMBER || `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`);

    const message = await withRetry(() => client.messages.create({
      to: whatsappTo,
      from: whatsappFrom,
      body,
    }));

    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('[Telephony] WhatsApp send error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// =============================================================================
// Call Recording
// =============================================================================

/**
 * Start recording an in-progress call via the Twilio REST API.
 * Records both channels (dual) so caller and AI are captured.
 * The recordingStatusCallback fires when the recording is ready.
 */
export async function startCallRecording(
  callSid: string
): Promise<{ success: boolean; recordingSid?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const recording = await client.calls(callSid).recordings.create({
      recordingChannels: 'dual',
      recordingStatusCallback: buildTwilioWebhookUrl('/api/webhooks/twilio/recording'),
      recordingStatusCallbackMethod: 'POST',
    });

    return { success: true, recordingSid: recording.sid };
  } catch (error) {
    console.error('[Telephony] Failed to start recording:', error);
    return { success: false, error: (error as Error).message };
  }
}

// =============================================================================
// Call Operations
// =============================================================================

export async function makeOutboundCall(
  to: string,
  options: {
    from?: string;
    twiml?: string;
    url?: string;
    statusCallback?: string;
    tenantId?: string;
    receptionistId?: string;
  } = {}
): Promise<{ success: boolean; callSid?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) return { success: false, error: 'Twilio not configured' };

  try {
    const callParams: Record<string, unknown> = {
      to,
      from: options.from || process.env.TWILIO_PHONE_NUMBER!,
      statusCallback: options.statusCallback || buildTwilioWebhookUrl('/api/webhooks/twilio/status'),
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    };

    if (options.twiml) {
      callParams.twiml = options.twiml;
    } else if (options.url) {
      callParams.url = options.url;
    } else {
      // Default: use the voice webhook so the AI handles the outbound call too
      callParams.url = buildTwilioWebhookUrl('/api/webhooks/twilio/voice');
      callParams.method = 'POST';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = await withRetry(() => client.calls.create(callParams as any));
    return { success: true, callSid: call.sid };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function hangupCall(callSid: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client) return false;

  try {
    await client.calls(callSid).update({ status: 'completed' });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// SMS Messaging
// =============================================================================

export async function sendSms(options: {
  to: string;
  body: string;
  tenantId: string;
  from?: string;
}): Promise<{ sid: string } | null> {
  const client = getTwilioClient();
  if (!client) return null;

  try {
    const from = options.from || process.env.TWILIO_PHONE_NUMBER;
    const message = await client.messages.create({
      to: options.to,
      from,
      body: options.body,
    });
    return { sid: message.sid };
  } catch (error) {
    console.error('[Telephony] Failed to send SMS:', error);
    return null;
  }
}

// =============================================================================
// Outbound Calling
// =============================================================================

export async function initiateOutboundCall(options: {
  to: string;
  from: string;
  tenantId: string;
  receptionistId?: string;
  message?: string;
  callbackUrl?: string; // TwiML for when the call is answered
}): Promise<{ sid: string } | null> {
  const client = getTwilioClient();
  if (!client) return null;

  try {
    const callUrl = options.callbackUrl || buildTwilioWebhookUrl('/api/webhooks/twilio/voice/outbound');
    
    const call = await client.calls.create({
      to: options.to,
      from: options.from,
      url: callUrl,
      method: 'POST',
      // We can pass session-like data via URL params if needed
    });

    return { sid: call.sid };
  } catch (error) {
    console.error('[Telephony] Failed to initiate outbound call:', error);
    return null;
  }
}


export function validateTwilioWebhook(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!process.env.TWILIO_AUTH_TOKEN) return false;
  return twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, params);
}

// =============================================================================
// Phone Number Management
// =============================================================================

export async function provisionPhoneNumber(
  tenantId: string,
  areaCode?: string
): Promise<{ number: string; sid: string } | null> {
  const client = getTwilioClient();
  if (!client) return null;

  try {
    // Search for available numbers
    const available = await client.availablePhoneNumbers('US')
      .local.list({
        areaCode: areaCode ? parseInt(areaCode) : undefined,
        voiceEnabled: true,
        smsEnabled: true,
        limit: 1,
      });

    if (available.length === 0) return null;

    // Purchase the number
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      voiceUrl: buildTwilioWebhookUrl('/api/webhooks/twilio/voice'),
      voiceMethod: 'POST',
      smsUrl: buildTwilioWebhookUrl('/api/webhooks/twilio/sms'),
      smsMethod: 'POST',
      statusCallback: buildTwilioWebhookUrl('/api/webhooks/twilio/status'),
      statusCallbackMethod: 'POST',
    });

    // Save to DB
    await db.phoneNumber.create({
      data: {
        tenantId,
        number: purchased.phoneNumber,
        provider: 'twilio',
        providerSid: purchased.sid,
        friendlyName: purchased.friendlyName ?? undefined,
        capabilities: 'voice,sms',
        status: 'ACTIVE',
      },
    });

    return { number: purchased.phoneNumber, sid: purchased.sid };
  } catch (error) {
    console.error('[Telephony] Failed to provision number:', error);
    return null;
  }
}
