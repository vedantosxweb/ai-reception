/**
 * Twilio Voice Webhook Handler - Production Ready
 * Handles incoming voice calls with STT → LLM → TTS pipeline
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { generateResponse, getConversation, textToSpeech } from '@/lib/ai'
import { db } from '@/lib/db'

// Get Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER

// Create Twilio client
function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('Twilio credentials not configured')
    return null
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

// Active call sessions
const activeCalls = new Map<string, {
  phoneNumber: string
  startTime: Date
  transcript: string
  contactId?: string
  callSid: string
}>()

/**
 * Main POST handler for Twilio webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const data = Object.fromEntries(formData.entries())

    const callSid = data.CallSid as string
    const from = data.From as string
    const to = data.To as string
    const callStatus = data.CallStatus as string
    const digits = data.Digits as string | undefined
    const speechResult = data.SpeechResult as string | undefined
    const recordingUrl = data.RecordingUrl as string | undefined

    console.log('📞 Twilio Webhook:', { 
      callSid, 
      from, 
      to, 
      callStatus,
      hasSpeech: !!speechResult,
      hasDigits: !!digits 
    })

    // Route based on call status
    switch (callStatus) {
      case 'ringing':
      case 'queued':
        return handleIncomingCall(callSid, from, to)
      
      case 'in-progress':
        if (speechResult || digits) {
          return handleUserInput(callSid, from, speechResult || digits || '', !!digits)
        }
        return handleGatherInput(callSid, from)
      
      case 'completed':
      case 'busy':
      case 'no-answer':
      case 'failed':
        return handleCallEnd(callSid, from, callStatus, recordingUrl)
      
      default:
        return handleIncomingCall(callSid, from, to)
    }
  } catch (error) {
    console.error('❌ Twilio webhook error:', error)
    return createTwiMLResponse({
      say: 'We apologize, but an error occurred. Please try again later.',
      hangup: true,
    })
  }
}

/**
 * Handle incoming call - Initial greeting
 */
async function handleIncomingCall(callSid: string, from: string, to: string): Promise<NextResponse> {
  console.log('📞 Incoming call from:', from)

  // Store call session
  activeCalls.set(callSid, {
    phoneNumber: from,
    startTime: new Date(),
    transcript: '',
    callSid,
  })

  // Create or update contact in database
  let contactId: string | undefined
  try {
    const contact = await db.contact.upsert({
      where: { phone: from },
      create: {
        firstName: 'Caller',
        lastName: from.slice(-4),
        phone: from,
        source: 'voice',
        status: 'lead',
        lastContact: new Date(),
      },
      update: {
        lastContact: new Date(),
      },
    })
    contactId = contact.id

    // Update session with contact ID
    const session = activeCalls.get(callSid)
    if (session) {
      session.contactId = contactId
    }
  } catch (error) {
    console.error('Error creating contact:', error)
  }

  // Create call log
  try {
    await db.callLog.create({
      data: {
        id: callSid,
        phoneNumber: from,
        direction: 'inbound',
        status: 'answered',
        contactId,
      },
    })
  } catch (error) {
    console.error('Error creating call log:', error)
  }

  // Return greeting TwiML
  return createTwiMLResponse({
    say: 'Hello! Thank you for calling. I am your AI receptionist. How can I help you today?',
    pause: 1,
    gather: {
      action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
      input: 'speech dtmf',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      say: 'Please tell me how I can assist you, or press a number. Press 1 for sales, 2 for support, 3 for scheduling, or 0 to speak with a representative.',
    },
  })
}

/**
 * Handle gather input - Listen for speech
 */
function handleGatherInput(callSid: string, from: string): NextResponse {
  return createTwiMLResponse({
    gather: {
      action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
      input: 'speech dtmf',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      say: 'I\'m listening. How can I help you?',
    },
    say: 'I didn\'t hear anything. Thank you for calling. Goodbye!',
    hangup: true,
  })
}

/**
 * Handle user input (speech or DTMF)
 */
async function handleUserInput(
  callSid: string,
  from: string,
  input: string,
  isDigits: boolean
): Promise<NextResponse> {
  const session = activeCalls.get(callSid)
  
  if (!session) {
    return createTwiMLResponse({
      say: 'I apologize, but there was a session error. Please call again.',
      hangup: true,
    })
  }

  // Update transcript
  session.transcript += `\nCaller: ${input}`
  console.log('📝 User input:', input, '(digits:', isDigits, ')')

  // Handle DTMF menu
  if (isDigits) {
    return handleDTMFMenu(callSid, input)
  }

  // Get conversation context
  const context = getConversation(callSid, 'voice')
  context.metadata = {
    phoneNumber: from,
    contactId: session.contactId,
  }

  // Generate AI response
  console.log('🤖 Generating AI response...')
  const response = await generateResponse(input, context)
  console.log('🤖 AI Response:', response.text.substring(0, 100) + '...')

  // Update transcript
  session.transcript += `\nAI: ${response.text}`

  // Update call log with intent and sentiment
  try {
    await db.callLog.update({
      where: { id: callSid },
      data: {
        intent: response.intent,
        sentiment: response.sentiment,
        transcript: session.transcript,
      },
    })
  } catch (error) {
    console.error('Error updating call log:', error)
  }

  // Handle escalation request
  if (response.intent === 'escalation' || response.shouldEscalate) {
    return handleEscalation(callSid, from, response.text)
  }

  // Handle booking intent
  if (response.intent === 'booking' && session.contactId) {
    try {
      await db.appointment.create({
        data: {
          contactId: session.contactId,
          title: 'Phone Booking Request',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          status: 'pending',
          source: 'voice',
          notes: `Booking request from call ${callSid}`,
        },
      })
    } catch (error) {
      console.error('Error creating appointment:', error)
    }
  }

  // Continue conversation
  return createTwiMLResponse({
    say: response.text,
    pause: 1,
    gather: {
      action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
      input: 'speech dtmf',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: 'true',
      say: 'Is there anything else I can help you with?',
    },
    say: 'Thank you for calling. Have a great day!',
    hangup: true,
  })
}

/**
 * Handle DTMF menu selection
 */
function handleDTMFMenu(callSid: string, digits: string): NextResponse {
  const menuActions: Record<string, { say: string; action?: 'connect' | 'hangup' }> = {
    '1': { 
      say: 'You selected Sales. Let me transfer you to our sales team.',
      action: 'connect'
    },
    '2': { 
      say: 'You selected Support. One moment while I connect you.',
      action: 'connect'
    },
    '3': { 
      say: 'You selected Scheduling. I can help you book an appointment right now.',
    },
    '0': { 
      say: 'I\'ll connect you with a representative. Please hold.',
      action: 'connect'
    },
  }

  const selection = menuActions[digits]
  
  if (!selection) {
    return createTwiMLResponse({
      say: 'I didn\'t understand that selection.',
      gather: {
        action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
        numDigits: 1,
        say: 'Press 1 for Sales, 2 for Support, 3 for Scheduling, or 0 to speak with someone.',
      },
    })
  }

  return createTwiMLResponse({
    say: selection.say,
    // For now, just continue the conversation
    // In production, you would use <Dial> to transfer
    gather: {
      action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
      input: 'speech dtmf',
      speechTimeout: 'auto',
      say: 'How can I assist you further?',
    },
  })
}

/**
 * Handle escalation to human
 */
function handleEscalation(callSid: string, from: string, message: string): NextResponse {
  console.log('⬆️ Escalating call:', callSid)

  // Update call log
  db.callLog.update({
    where: { id: callSid },
    data: { resolved: false },
  }).catch(console.error)

  return createTwiMLResponse({
    say: message || 'I understand you need to speak with someone. Please hold while I transfer you.',
    pause: 2,
    say: 'All representatives are currently assisting other customers. Please leave a message after the tone.',
    record: {
      maxLength: 120,
      transcribe: true,
      action: `/api/twilio/voice?CallSid=${callSid}&event=recording`,
      transcribeCallback: `/api/twilio/transcribe?CallSid=${callSid}`,
    },
    say: 'Thank you for your message. We will get back to you shortly.',
    hangup: true,
  })
}

/**
 * Handle call end
 */
async function handleCallEnd(
  callSid: string, 
  from: string, 
  status: string,
  recordingUrl?: string
): Promise<NextResponse> {
  console.log('📞 Call ended:', callSid, 'Status:', status)

  const session = activeCalls.get(callSid)
  
  if (session) {
    const duration = Math.floor(
      (Date.now() - session.startTime.getTime()) / 1000
    )

    // Update call log
    try {
      await db.callLog.update({
        where: { id: callSid },
        data: {
          duration,
          status: status === 'completed' ? 'answered' : status,
          recording: recordingUrl,
          transcript: session.transcript,
        },
      })
    } catch (error) {
      console.error('Error updating call log:', error)
    }

    // Clear session
    activeCalls.delete(callSid)
  }

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'application/xml' },
  })
}

/**
 * Create TwiML response
 */
function createTwiMLResponse(options: {
  say?: string
  pause?: number
  gather?: {
    action?: string
    numDigits?: number
    input?: string
    speechTimeout?: string
    speechModel?: string
    enhanced?: string
    say?: string
  }
  record?: {
    maxLength?: number
    transcribe?: boolean
    action?: string
    transcribeCallback?: string
  }
  hangup?: boolean
}): NextResponse {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()

  if (options.say) {
    response.say({
      voice: 'Polly.Amy',
      language: 'en-US',
    }, options.say)
  }

  if (options.pause) {
    response.pause({ length: options.pause })
  }

  if (options.gather) {
    const gather = response.gather({
      action: options.gather.action,
      numDigits: options.gather.numDigits,
      input: options.gather.input as 'speech' | 'dtmf' | 'speech dtmf' | undefined,
      speechTimeout: options.gather.speechTimeout,
      speechModel: options.gather.speechModel as 'phone_call' | undefined,
      enhanced: options.gather.enhanced === 'true',
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
      transcribe: options.record.transcribe ?? true,
      action: options.record.action,
      transcribeCallback: options.record.transcribeCallback,
    })
  }

  if (options.hangup) {
    response.hangup()
  }

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'application/xml' },
  })
}

/**
 * GET handler for webhook verification and gather redirects
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const event = searchParams.get('event')
  const callSid = searchParams.get('CallSid') || ''

  console.log('📞 GET request:', { event, callSid })

  if (event === 'gather') {
    return createTwiMLResponse({
      gather: {
        action: `/api/twilio/voice?CallSid=${callSid}&event=gather`,
        input: 'speech dtmf',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: 'true',
        say: 'I\'m still here. How can I help you?',
      },
      say: 'Thank you for calling. Goodbye!',
      hangup: true,
    })
  }

  // Health check
  return NextResponse.json({ 
    status: 'ok', 
    twilio: !!TWILIO_ACCOUNT_SID,
    phoneNumber: TWILIO_PHONE_NUMBER,
  })
}
