/**
 * Twilio Integration Module - Production Ready
 * Handles all Twilio voice and SMS operations
 */

import twilio from 'twilio'

// Get Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

// Twilio client singleton
let twilioClient: twilio.Twilio | null = null

export function getTwilioClient(): twilio.Twilio | null {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio credentials not configured')
    return null
  }

  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    console.log('✅ Twilio client initialized for:', TWILIO_PHONE_NUMBER)
  }

  return twilioClient
}

/**
 * Check if Twilio is configured
 */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER)
}

/**
 * Get configured phone number
 */
export function getTwilioPhoneNumber(): string | null {
  return TWILIO_PHONE_NUMBER || null
}

/**
 * Make an outbound call
 */
export async function makeOutboundCall(
  to: string,
  twimlUrl?: string,
  twiml?: string
): Promise<{ success: boolean; callSid?: string; error?: string }> {
  const client = getTwilioClient()
  if (!client) {
    return { success: false, error: 'Twilio not configured' }
  }

  try {
    console.log(`📞 Making outbound call to: ${to}`)
    
    const call = await client.calls.create({
      to,
      from: TWILIO_PHONE_NUMBER!,
      ...(twimlUrl ? { url: twimlUrl } : { twiml }),
    })

    console.log(`✅ Call initiated: ${call.sid}`)
    return { success: true, callSid: call.sid }
  } catch (error) {
    console.error('❌ Error making outbound call:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Send SMS message
 */
export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const client = getTwilioClient()
  if (!client) {
    return { success: false, error: 'Twilio not configured' }
  }

  try {
    console.log(`📱 Sending SMS to: ${to}`)
    
    const message = await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER!,
      body,
    })

    console.log(`✅ SMS sent: ${message.sid}`)
    return { success: true, messageSid: message.sid }
  } catch (error) {
    console.error('❌ Error sending SMS:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Generate TwiML for voice response
 */
export function generateTwiML(options: {
  say?: string
  play?: string
  gather?: {
    numDigits?: number
    timeout?: number
    action?: string
    say?: string
    input?: 'speech' | 'dtmf' | 'speech dtmf'
  }
  record?: {
    maxLength?: number
    action?: string
    transcribe?: boolean
    transcribeCallback?: string
  }
  redirect?: string
  hangup?: boolean
  pause?: number
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()

  if (options.pause) {
    response.pause({ length: options.pause })
  }

  if (options.say) {
    response.say({
      voice: 'Polly.Amy',
      language: 'en-US',
    }, options.say)
  }

  if (options.play) {
    response.play({}, options.play)
  }

  if (options.gather) {
    const gather = response.gather({
      numDigits: options.gather.numDigits,
      timeout: options.gather.timeout || 5,
      action: options.gather.action,
      input: options.gather.input || 'speech dtmf',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      method: 'POST',
    })
    if (options.gather.say) {
      gather.say({
        voice: 'Polly.Amy',
        language: 'en-US',
      }, options.gather.say)
    }
  }

  if (options.record) {
    response.record({
      maxLength: options.record.maxLength || 60,
      action: options.record.action,
      transcribe: options.record.transcribe ?? true,
      transcribeCallback: options.record.transcribeCallback,
      method: 'POST',
    })
  }

  if (options.redirect) {
    response.redirect(options.redirect)
  }

  if (options.hangup) {
    response.hangup()
  }

  return response.toString()
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!TWILIO_AUTH_TOKEN) return false
  return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params)
}

/**
 * Get call details
 */
export async function getCallDetails(callSid: string) {
  const client = getTwilioClient()
  if (!client) return null

  try {
    return await client.calls(callSid).fetch()
  } catch (error) {
    console.error('Error fetching call details:', error)
    return null
  }
}

/**
 * Get all calls
 */
export async function getCalls(limit: number = 20) {
  const client = getTwilioClient()
  if (!client) return []

  try {
    const calls = await client.calls.list({ limit })
    return calls
  } catch (error) {
    console.error('Error fetching calls:', error)
    return []
  }
}

/**
 * Get all messages
 */
export async function getMessages(limit: number = 20) {
  const client = getTwilioClient()
  if (!client) return []

  try {
    const messages = await client.messages.list({ limit })
    return messages
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

/**
 * Get recording details
 */
export async function getRecordingDetails(recordingSid: string) {
  const client = getTwilioClient()
  if (!client) return null

  try {
    return await client.recordings(recordingSid).fetch()
  } catch (error) {
    console.error('Error fetching recording:', error)
    return null
  }
}

/**
 * Get recording URL
 */
export function getRecordingUrl(recordingSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`
}

/**
 * Hang up a call
 */
export async function hangupCall(callSid: string): Promise<boolean> {
  const client = getTwilioClient()
  if (!client) return false

  try {
    await client.calls(callSid).update({ status: 'completed' })
    return true
  } catch (error) {
    console.error('Error hanging up call:', error)
    return false
  }
}

/**
 * Forward call to another number
 */
export async function forwardCall(
  callSid: string,
  to: string
): Promise<boolean> {
  const client = getTwilioClient()
  if (!client) return false

  try {
    await client.calls(callSid).update({
      twiml: `<Response><Dial>${to}</Dial></Response>`
    })
    return true
  } catch (error) {
    console.error('Error forwarding call:', error)
    return false
  }
}

// Log configuration status on startup
if (isTwilioConfigured()) {
  console.log('✅ Twilio is configured and ready')
  console.log('📞 Phone Number:', TWILIO_PHONE_NUMBER)
} else {
  console.log('⚠️ Twilio is NOT configured. Set environment variables.')
}
